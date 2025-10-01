# React Super Grid - Architecture Documentation

## Table of Contents
1. [Overview](#overview)
2. [Core Architecture](#core-architecture)
3. [The Command System](#the-command-system)
4. [The Action System](#the-action-system)
5. [Plugin System](#plugin-system)
6. [Spatial Navigation](#spatial-navigation)
7. [Fractional Indexing](#fractional-indexing)
8. [Keyboard Ownership](#keyboard-ownership)
9. [Complete Flow Examples](#complete-flow-examples)

---

## Overview

React Super Grid is a sophisticated, plugin-based data grid system built on three fundamental architectural pillars: **spatial structure**, **command-driven communication**, and **plugin extensibility**. Unlike traditional grid implementations that rely on array indices and coordinate calculations, this system maintains a true graph structure where every entity (cell, row, space) knows its neighbors through direct references.

The architecture solves a critical problem in modern grid systems: how to enable rich, extensible functionality without creating a monolithic, tightly-coupled codebase. By implementing a bidirectional command/action system with plugin interception, the grid achieves a separation of concerns that allows features like selection, editing, validation, and custom behaviors to be added, removed, or modified without touching the core grid implementation.

---

## Core Architecture

### The Entity Hierarchy

The grid is composed of three primary entity types, arranged in a hierarchical spatial structure:

**Spaces** are vertical sections that divide the grid into logical regions. Each space can be owned by a plugin or by the table itself. Spaces are linked vertically, creating a chain from top to bottom. The table space always resides at the bottom, while plugin spaces stack above it in dependency order.

```typescript
type Space = {
    name: string;
    owner?: string;        // Plugin name or 'table'
    top: SpaceId | null;   // Space above this one
    bottom: SpaceId | null; // Space below this one
    rowIds: RowId[];       // Rows contained in this space
};
```

When you register a plugin that creates rows (like a "Header" plugin or "Summary" plugin), the system automatically creates a space for it. This space becomes part of the vertical chain. For example, if you have a HeaderPlugin and a FooterPlugin with the table in between, the spatial structure becomes:

```
┌─────────────────────┐
│ Header Space        │ ← Plugin-owned space (top)
│ top: null           │
│ bottom: table-space │
├─────────────────────┤
│ Table Space         │ ← Main data grid
│ top: header-space   │
│ bottom: footer-space│
├─────────────────────┤
│ Footer Space        │ ← Plugin-owned space (bottom)
│ top: table-space    │
│ bottom: null        │
└─────────────────────┘
```

This spatial organization allows rows to be inserted between spaces seamlessly. When a plugin adds a row to its space, the system automatically maintains ordering by using fractional indices that respect the boundaries between spaces.

**Rows** contain data and cells, maintaining both vertical relationships (to other rows) and a reference to their parent space. Each row has a fractional index stored as a string reference (like "IDX_5"), which determines its position in the overall grid ordering.

```typescript
type Row<T> = {
    spaceId: SpaceId;       // Which space owns this row
    data: T;                 // User data
    cells: CellId[];         // Ordered list of cell IDs
    top: RowId | null;       // Row above
    bottom: RowId | null;    // Row below
    rowString: string;       // Fractional index reference
};
```

The critical insight here is that `rowString` is not the actual fractional index value (like "a0" or "m5"), but a **reference** to it. The `Indexer` maintains a map from these references to the actual values. This indirection provides two benefits: it allows us to redistribute indices if they grow too long (though this is currently disabled), and it creates stable identifiers that don't change even if the underlying fractional values need adjustment.

**Cells** are the atomic units of the grid, forming a true 2D linked structure where each cell knows its four neighbors.

```typescript
type Cell = {
    rowId: RowId;           // Parent row
    top: CellId | null;     // Cell above
    bottom: CellId | null;  // Cell below
    left: CellId | null;    // Cell to the left
    right: CellId | null;   // Cell to the right
};
```

Cell IDs follow a specific format: `"01-IDX_5-uuid"` where:
- `01` is the column index (zero-padded)
- `IDX_5` is the row's fractional index reference
- `uuid` is a unique identifier

This format enables efficient spatial comparisons without registry lookups. A plugin can parse two cell IDs and immediately determine their relative positions both horizontally (by comparing column indices) and vertically (by comparing fractional index references through the Indexer).

### Why This Structure?

Traditional grids use array indices: `grid[rowIndex][colIndex]`. Navigation requires arithmetic (`rowIndex + 1` for down, `colIndex - 1` for left`). Insertion requires array splicing and reindexing. This approach is simple but becomes problematic when:

1. Rows can be inserted anywhere (requires reindexing everything below)
2. Multiple plugins want to add rows at different positions (coordination nightmare)
3. Navigation needs to skip over filtered/hidden rows (requires scanning)
4. Undo/redo needs stable references (array indices change)

Our spatial graph structure solves all of these:

1. Insertion is O(1) - just update four pointers and generate a fractional index
2. Plugins work in isolated spaces with automatic ordering
3. Navigation follows pointers, naturally skipping anything not in the graph
4. References are stable UUIDs that survive any structural changes

---

## The Command System

The command system implements **Table → Cell** communication. It is the mechanism by which the table (or plugins) send instructions to cells.

### Command Flow

Commands flow through a three-stage pipeline that enables plugin interception before reaching their target:

```
1. Creation
   ↓
TableCore.dispatchCellCommand({
    name: 'focus',
    targetId: cellId
})

2. Plugin Chain
   ↓
for each plugin:
    result = plugin.onBeforeCellCommand(command)
    if result === false: BLOCK

3. Delivery
   ↓
if command has targetId:
    cellHandler(command)
else:
    // Plugin-only command, stops here
```

This architecture enables several powerful patterns. First, **command blocking** - any plugin can prevent a command from reaching its target by returning false. This is how a "ReadOnly" plugin could block all edit commands, or how a "Validation" plugin could block focus from leaving an invalid cell.

Second, **command observation** - plugins see all commands even if they don't block them. A "History" plugin could log every focus change. An "Analytics" plugin could track user navigation patterns. A "Sync" plugin could broadcast commands to a server.

Third, **command transformation** - while plugins can't modify the command object itself (it's already created), they can respond by creating new commands. For example, a "SmartNavigation" plugin could intercept an arrow key, block the default navigation, and create a custom navigation command that skips empty cells.

### Plugin Bypass System

When a plugin creates a command, it should not intercept its own command (infinite loops!). The system handles this automatically:

```typescript
// Plugin creates command
this.tableAPIs.createCellCommand(cellId, { name: 'focus' });

// System adds originPlugin
const command = {
    name: 'focus',
    targetId: cellId,
    originPlugin: 'my-plugin',  // ← Automatically added
    timestamp: Date.now()
};

// During plugin chain
for (const plugin of plugins) {
    if (command.originPlugin === plugin.name) {
        continue;  // ← Skip creator
    }
    plugin.onBeforeCellCommand(command);
}
```

This bypass system is why plugins can safely create commands in response to other commands without creating loops.

### Keyboard Commands Without Targets

Keyboard events from the document don't have a specific target cell - they're global. These commands have no `targetId`:

```typescript
// User presses ArrowDown
dispatchKeyboardCommand('keydown', event);

// Creates command WITHOUT targetId
{
    name: 'keydown',
    // targetId: undefined ← No specific cell
    payload: { event },
    timestamp: Date.now()
}

// Plugins see it, but cells don't
Plugin Chain: ✅ Processes command
Cell Delivery: ❌ Skipped (no targetId)
```

This is how FocusPlugin can intercept arrow keys and create targeted navigation commands. It receives the global keyboard command, determines which cell should be focused next based on the current focus state, then creates a targeted focus command for that specific cell.

### Command Types

The type system ensures compile-time safety for all command variations:

```typescript
type CellCommandNoPayload =
  | { name: "focus" }
  | { name: "blur" }
  | { name: "select" }
  | { name: "unselect" };

type CellCommandWithPayload =
  | { name: "updateValue"; payload: { value: any } }
  | { name: "click"; payload: { event: MouseEvent } }
  | { name: "keydown"; payload: { event: KeyboardEvent } };

type CellCommand =
  | (CellCommandNoPayload & {
      targetId?: CellId;
      originPlugin?: string;
      timestamp?: number;
    })
  | (CellCommandWithPayload & {
      targetId?: CellId;
      originPlugin?: string;
      timestamp?: number;
    });
```

This type structure captures several important constraints:
- Commands can have optional payloads
- targetId is optional (for keyboard commands)
- originPlugin is automatically added by the system
- timestamp is automatically added by the system

---

## The Action System

The action system implements **Cell → Table** communication. It is the symmetric counterpart to commands, allowing cells to declare their intentions to the table while giving plugins full visibility and control.

### Why Actions Were Needed

Before actions, cells had no structured way to communicate with the table. If a cell wanted to save data, it had two bad options:

**Option 1: Direct API calls** - Cell has access to `updateCellValue(cellId, value)`. Problem: plugins can't intercept, validate, or transform the save.

**Option 2: Emit DOM events** - Cell triggers an event that bubbles up. Problem: unstructured, plugins need to parse event types and infer intent.

Actions solve this by providing a **declarative, inspectable** communication channel. When a cell wants to save, it doesn't call an API directly - it declares an action that describes what it wants to do:

```typescript
// Cell declares: "I want to save this value"
runAction('saveAction', newValue);
```

Plugins can then see exactly what the cell intends to do before it happens, inspect the specific APIs that will be called, and block individual API calls while allowing others.

### The Three-Phase Execution Model

Actions execute in three distinct phases that separate intent, inspection, and execution:

**Phase 1: Recording**

The action runs with a proxy version of the table APIs. This proxy doesn't execute any real logic - it just records what was called:

```typescript
// Cell's action definition
saveAction: (api, newValue) => {
    api.save(newValue);
    api.releaseKeyboard();
}

// Runs with recording proxy
const recordingAPI = new Proxy({}, {
    get(target, methodName) {
        return (...args) => {
            recorder.record(methodName, args);
            // No execution!
        };
    }
});

// After action runs
recorder.getCalls() === [
    { method: 'save', args: [newValue] },
    { method: 'releaseKeyboard', args: [] }
]
```

This recording phase is why actions must be pure sequences of API calls. Any conditional logic or calculations need to happen before the action, not inside it:

```typescript
// ❌ BAD - logic inside action
saveAction: (api, value) => {
    if (value.length > 10) {  // Can't be recorded!
        value = value.slice(0, 10);
    }
    api.save(value);
}

// ✅ GOOD - logic before action
const handleSave = () => {
    const finalValue = internalValue.length > 10
        ? internalValue.slice(0, 10)
        : internalValue;
    runAction('saveAction', finalValue);
};
```

**Phase 2: Plugin Interception**

Each plugin's `onBeforeAction` is called with the action name and an `apiUsage` object. This object allows plugins to register handlers for specific API calls:

```typescript
// Plugin intercepts
onBeforeAction(cellId, actionName, apiUsage) {
    // Register handler for 'save' API
    apiUsage.on('save', (value) => {
        if (!this.validate(value)) {
            return false;  // Block this API call
        }
        return true;  // Allow this API call
    });

    return true;  // Continue to next plugin
}
```

Multiple plugins can register handlers for the same API. All handlers run, and if ANY returns false, the API is blocked:

```typescript
Plugin A: apiUsage.on('save', (val) => val.length > 0);  // true
Plugin B: apiUsage.on('save', (val) => val.length < 100); // true
Plugin C: apiUsage.on('save', (val) => !hasBadWords(val)); // false
Result: API blocked (C blocked it)
```

**Phase 3: Execution**

The system executes each recorded API call, but first checks if any plugin blocked it:

```typescript
for (const call of recordedCalls) {
    // Check: did any plugin block this?
    if (!shouldExecute(call.method, call.args)) {
        console.log(`API "${call.method}" blocked`);
        continue;  // Skip this API
    }

    // Execute with real API
    realAPIs[call.method](...call.args);
}
```

This means an action can be partially executed. If a cell runs:

```typescript
saveAction: (api, value) => {
    api.save(value);           // Plugin blocks this
    api.releaseKeyboard();     // This still executes
}
```

The keyboard gets released even though the save was blocked. This is intentional - plugins block specific behaviors, not entire actions.

### Action Context

Actions carry context about their origin and purpose:

```typescript
// Cell runs action
runAction('saveAction', newValue);

// Plugin sees:
onBeforeAction(cellId, actionName, apiUsage) {
    // cellId: which cell triggered this
    // actionName: 'saveAction' (cell's internal name)
    // apiUsage: what APIs will be called
}
```

The `actionName` is critical for semantic distinction. A cell might have both `'saveAction'` and `'autoSaveAction'`. Plugins can treat them differently:

```typescript
onBeforeAction(cellId, actionName, apiUsage) {
    if (actionName === 'autoSaveAction') {
        // More lenient validation for auto-save
        apiUsage.on('save', (value) => value !== '');
    } else {
        // Strict validation for manual save
        apiUsage.on('save', (value) =>
            value !== '' && value.length >= 3
        );
    }
}
```

### Plugin-Triggered Actions

Plugins can trigger actions on behalf of cells using `tableAPIs.runAction()`:

```typescript
// Plugin triggers save on multiple cells
for (const cellId of selectedCells) {
    this.tableAPIs.runAction(cellId, 'saveAction', newValue);
}
```

The `originPlugin` is automatically set, enabling bypass:

```typescript
// Plugin A triggers action
this.tableAPIs.runAction(cellId, 'saveAction', value);

// Plugin A's onBeforeAction is SKIPPED
// Plugin B's onBeforeAction runs normally
```

This prevents infinite loops and allows plugins to perform bulk operations without re-triggering their own logic.

---

## Plugin System

Plugins are the extensibility mechanism that allows adding features without modifying core code. Each plugin is a class that extends `BasePlugin` and implements command/action interception methods.

### Plugin Lifecycle

A plugin goes through several stages from registration to destruction:

**1. Registration** - Plugins are added to the PluginManager before initialization:

```typescript
const focusPlugin = new FocusPlugin();
const selectPlugin = new SelectPlugin();
tableCore.addPlugin(focusPlugin);
tableCore.addPlugin(selectPlugin);
```

At this stage, plugins are inert. They have no access to APIs and their methods aren't called yet.

**2. Dependency Resolution** - The PluginManager analyzes dependencies and creates an initialization order:

```typescript
class SelectPlugin extends BasePlugin {
    readonly dependencies = ['focus-plugin'];
}

// Result: FocusPlugin initializes before SelectPlugin
```

The resolution algorithm uses topological sorting with a two-phase approach. Normal plugins initialize first, then `processLast` plugins. If a normal plugin depends on a `processLast` plugin, it gets moved to the second phase:

```
Normal Phase:
  FocusPlugin (no deps) → EditPlugin (deps: focus) → SelectPlugin (deps: focus)

ProcessLast Phase:
  PerformancePlugin (processLast: true)
```

**3. Space Creation** - Each plugin gets its own space in the grid:

```typescript
for (const plugin of orderedPlugins) {
    const spaceId = spaceCoordinator.createPluginSpace(plugin.name);
    tableCore.setPluginSpaceId(plugin.name, spaceId);
}
```

Spaces are created in dependency order, so a HeaderPlugin's space will be above a BodyPlugin's space if BodyPlugin depends on HeaderPlugin.

**4. API Binding** - Each plugin receives context-bound APIs:

```typescript
const tableAPIs = tableCore.createPluginAPI(plugin.name);
plugin.setAPIs(tableAPIs, rowAPIs, rowTableAPIs);
```

These APIs are bound to the plugin's name, so when the plugin calls `tableAPIs.createCellCommand()`, the system automatically sets `originPlugin` to the plugin's name.

**5. Initialization** - Finally, `onInit()` is called:

```typescript
for (const plugin of orderedPlugins) {
    plugin.onInit();
}
```

Now the plugin can create rows, register listeners, start timers, etc.

**6. Active Operation** - Plugins intercept commands and actions:

```typescript
// Every cell command
plugin.onBeforeCellCommand(command);

// Every row command
plugin.onBeforeRowCommand(command);

// Every action
plugin.onBeforeAction(cellId, actionName, apiUsage);
```

**7. Destruction** - When the component unmounts, plugins are destroyed in reverse order:

```typescript
for (let i = plugins.length - 1; i >= 0; i--) {
    plugins[i].onDestroy();
}
```

This reverse order ensures that plugins with dependencies are destroyed before their dependencies.

### Plugin APIs

Plugins receive three API objects, each scoped to different contexts:

**TablePluginAPIs** - Grid-level operations bound to the plugin's context:

```typescript
interface TablePluginAPIs {
    // Create commands (auto-adds originPlugin)
    createCellCommand(targetId, command);
    createRowCommand(targetId, command);

    // Create rows in plugin's space
    createRow(rowData, position);

    // Create rows in table space
    createRowInTableSpace(rowData, position);

    // Spatial queries
    getCell(cellId);
    getRow(rowId);
    compareVertical(cellId1, cellId2);
    compareHorizontal(cellId1, cellId2);

    // Space navigation
    getMySpace();
    getSpaceAbove(spaceId);
    getSpaceBelow(spaceId);

    // Keyboard state
    getKeyboardOwner();

    // Trigger actions
    runAction(cellId, actionName, payload);
}
```

The critical feature here is that all command creation methods automatically inject the plugin's name as `originPlugin`. This enables the bypass system without plugins needing to track their own identity.

### Plugin Dependencies

Dependencies are declared statically and enforce ordering:

```typescript
class EditPlugin extends BasePlugin {
    readonly dependencies = ['focus-plugin'];

    private focusPlugin: FocusPlugin | null = null;

    onInit() {
        this.focusPlugin = this.getPlugin<FocusPlugin>('focus-plugin');
    }
}
```

The `getPlugin()` method is type-safe, returning the plugin instance or null if not found. This allows plugins to call methods on their dependencies:

```typescript
onBeforeCellCommand(command) {
    if (command.name === 'keydown' && command.payload.event.key === 'Enter') {
        const focusedCell = this.focusPlugin?.getFocused();
        if (focusedCell) {
            this.tableAPIs.createCellCommand(focusedCell, { name: 'edit' });
        }
    }
}
```

Circular dependencies are detected and throw an error during resolution:

```
PluginA depends on PluginB
PluginB depends on PluginC
PluginC depends on PluginA
→ Error: Circular dependency detected
```

---

## Spatial Navigation

Spatial navigation is the system's core strength. Instead of calculating `[row + 1, col]` to move down, we follow a pointer: `cell.bottom`.

### Cell Linking

Cells are linked when rows are created and when new rows are inserted. The linking process establishes all four directional pointers:

**Horizontal Linking** happens during cell creation within a row:

```typescript
for (let i = 0; i < columns.length; i++) {
    const cellId = generateCellId(i, rowString);
    const previousCellId = i > 0 ? cells[i-1] : null;
    const nextCellId = i < columns.length-1 ? generateCellId(i+1, rowString) : null;

    const cell = {
        rowId,
        top: null,        // Set later
        bottom: null,     // Set later
        left: previousCellId,  // ← Linked immediately
        right: nextCellId      // ← Linked immediately
    };
}
```

**Vertical Linking** happens after all cells in a row are registered:

```typescript
onCellsRegistered() {
    linkRowCells(rowId);
}

function linkRowCells(rowId) {
    const row = rowRegistry.get(rowId);
    const topRow = rowRegistry.get(row.top);
    const bottomRow = rowRegistry.get(row.bottom);

    if (topRow) {
        cellCoordinator.linkRowsCells(topRow.cells, row.cells);
    }
    if (bottomRow) {
        cellCoordinator.linkRowsCells(row.cells, bottomRow.cells);
    }
}

function linkRowsCells(topCells, bottomCells) {
    for (let i = 0; i < topCells.length; i++) {
        linkVertical(topCells[i], bottomCells[i]);
    }
}

function linkVertical(topId, bottomId) {
    const topCell = cellRegistry.get(topId);
    const bottomCell = cellRegistry.get(bottomId);

    topCell.bottom = bottomId;
    bottomCell.top = topId;
}
```

This two-stage linking (horizontal immediate, vertical deferred) ensures all cells exist before we try to link them vertically.

### Navigation Examples

With spatial linking in place, navigation becomes trivial:

```typescript
// Move down
const currentCell = getCell(currentCellId);
const nextCellId = currentCell.bottom;
if (nextCellId) {
    focusCell(nextCellId);
}

// Move right
const rightCellId = currentCell.right;
if (rightCellId) {
    focusCell(rightCellId);
}
```

No array bounds checking, no index arithmetic, no need to know the grid dimensions. If the pointer exists, there's a cell in that direction. If it's null, you're at the edge.

This enables natural navigation behaviors that would be complex with array indices:

```typescript
// Navigate to last cell in row (follow right pointers until null)
let cellId = firstCellInRow;
while (true) {
    const cell = getCell(cellId);
    if (!cell.right) break;
    cellId = cell.right;
}

// Navigate to bottom of column (follow bottom pointers)
let cellId = topCellInColumn;
while (true) {
    const cell = getCell(cellId);
    if (!cell.bottom) break;
    cellId = cell.bottom;
}
```

### Spatial Comparisons

Plugins often need to compare cell positions. The system provides comparison functions that work directly with cell IDs:

```typescript
const comparison = tableAPIs.compareVertical(cellId1, cellId2);

if (comparison === null) {
    // Same row or different columns
} else {
    // comparison = { top: cellId, bottom: cellId }
    const topCell = comparison.top;
    const bottomCell = comparison.bottom;
}
```

The implementation parses the fractional index from the cell ID and uses the Indexer to compare:

```typescript
compareVertical(cellId1, cellId2) {
    const parseRowIndex = (cellId) => cellId.split('-')[1];

    const index1 = parseRowIndex(cellId1);
    const index2 = parseRowIndex(cellId2);

    const result = Indexer.compare(index1, index2);

    if (result === 0) return null;  // Same row
    if (result < 0) return { top: cellId1, bottom: cellId2 };
    else return { top: cellId2, bottom: cellId1 };
}
```

This comparison works across spaces. A cell in a HeaderPlugin space can be compared with a cell in the table space, and the system correctly determines which is higher.

---

## Fractional Indexing

Fractional indexing solves the insertion problem: how do you insert a row between existing rows without renumbering everything?

### The Problem

Array-based systems require renumbering on insertion:

```
Before:  [row0, row1, row2, row3]
Insert between row1 and row2:
After:   [row0, row1, NEW, row2, row3]
         0     1     2    3     4    ← All indices after insertion point changed
```

If you have references to row3 (like undo/redo, bookmarks, external links), they're now invalid. If you're doing real-time collaboration, you need to propagate index updates to all clients.

### The Solution

Fractional indexing uses string values that can always have a value generated between any two existing values:

```
Row positions:
row1: "a0"
row2: "b0"

Insert between them:
row1:    "a0"
newRow:  "aV"  ← Between a0 and b0
row2:    "b0"
```

The values use lexicographic ordering (string comparison), and the fractional-indexing library guarantees you can always generate a value between any two strings.

### Implementation Details

We don't store the fractional values directly in rows. Instead, we use references:

```typescript
class Indexer {
    private static indexMap = new Map<string, string>();
    private static idCounter = 0;

    static above(belowId?: string): string {
        const belowIndex = belowId ? this.indexMap.get(belowId) : null;
        const newIndex = generateKeyBetween(belowIndex, null);

        const newId = `IDX_${this.idCounter++}`;
        this.indexMap.set(newId, newIndex);
        return newId;
    }
}
```

Rows store `rowString: "IDX_5"`, which maps to the actual fractional value `"a0"`. This indirection allows:

1. **Stable references** - Row IDs never change even if we redistribute indices
2. **Efficient redistribution** - If indices grow too long, we can regenerate them while preserving order
3. **Compact storage** - "IDX_5" is shorter than many fractional values

### Insertion Algorithm

When inserting a row, we need to determine its fractional index based on:
- The space it's being inserted into
- The position (top or bottom of the space)
- Neighboring rows in adjacent spaces

```typescript
function addRow(rowData, position) {
    const currentSpace = spaceRegistry.get(spaceId);
    const currentRows = currentSpace.rowIds;

    if (currentRows.length === 0) {
        // Empty space - need to look at adjacent spaces
        const spaceAbove = findNearestSpaceWithRows('above');
        const spaceBelow = findNearestSpaceWithRows('below');

        if (spaceAbove && spaceBelow) {
            // Insert between bottom of top space and top of bottom space
            const topRow = getLastRowOf(spaceAbove);
            const bottomRow = getFirstRowOf(spaceBelow);
            rowString = Indexer.between(bottomRow.rowString, topRow.rowString);
        }
        else if (spaceAbove) {
            // Insert below the top space
            const topRow = getLastRowOf(spaceAbove);
            rowString = Indexer.below(topRow.rowString);
        }
        else if (spaceBelow) {
            // Insert above the bottom space
            const bottomRow = getFirstRowOf(spaceBelow);
            rowString = Indexer.above(bottomRow.rowString);
        }
        else {
            // First row ever
            rowString = Indexer.above();
        }
    }
    else {
        // Space has rows - insert at top or bottom
        if (position === 'top') {
            const currentTop = currentRows[0];
            const spaceAbove = findNearestSpaceWithRows('above');

            if (spaceAbove) {
                const topSpaceBottom = getLastRowOf(spaceAbove);
                rowString = Indexer.between(currentTop.rowString, topSpaceBottom.rowString);
            } else {
                rowString = Indexer.above(currentTop.rowString);
            }
        }
        else {
            const currentBottom = currentRows[currentRows.length - 1];
            const spaceBelow = findNearestSpaceWithRows('below');

            if (spaceBelow) {
                const bottomSpaceTop = getFirstRowOf(spaceBelow);
                rowString = Indexer.between(bottomSpaceTop.rowString, currentBottom.rowString);
            } else {
                rowString = Indexer.below(currentBottom.rowString);
            }
        }
    }
}
```

This algorithm ensures that:
1. Rows within a space maintain relative order
2. Rows across spaces maintain correct ordering (header above table above footer)
3. No renumbering is ever required
4. Insertion is O(1) regardless of grid size

---

## Keyboard Ownership

Keyboard ownership solves the editing problem: when a cell is being edited, keyboard events should go to the input field, not to navigation plugins.

### The Problem

The grid has document-level keyboard listeners for navigation:

```typescript
document.addEventListener('keydown', (event) => {
    dispatchKeyboardCommand('keydown', event);
});
```

When you type in a cell's input field, the event bubbles to the document listener. Navigation plugins see the event and might intercept it. Typing "h" could trigger navigation instead of appearing in the input.

### The Solution: Ownership Model

A cell can "borrow" the keyboard, telling the system "don't create keyboard commands until I release it":

```typescript
// Cell requests ownership
api.requestKeyboard();
keyboardOwnerRef.current = cellId;

// User types "h"
document keydown fires
  ↓
dispatchKeyboardCommand checks: getKeyboardOwner() !== null?
  ↓
Returns early - NO command created
  ↓
Event continues to input field naturally
```

The ownership is stored in a React ref in the SuperGrid component:

```typescript
const keyboardOwnerRef = useRef<CellId | null>(null);
tableCore.setKeyboardOwnerRef(keyboardOwnerRef);
```

Using a ref instead of state prevents re-renders when ownership changes. The grid doesn't need to re-render just because a cell started editing.

### Ownership Flow

**Entering Edit Mode:**

```
1. User presses Enter
   ↓
2. EditPlugin intercepts keydown command
   ↓
3. Sends 'edit' command to focused cell
   ↓
4. Cell receives edit command
   ↓
5. Cell runs: runAction('requestKeyboardAction')
   ↓
6. Action executes: api.requestKeyboard()
   ↓
7. keyboardOwnerRef.current = cellId
   ↓
8. Cell shows input field
```

**While Editing:**

```
User types "h"
  ↓
Input field keydown fires
  ↓
Event bubbles to document listener
  ↓
dispatchKeyboardCommand called
  ↓
Checks: keyboardOwnerRef.current !== null?
  → YES (cellId owns keyboard)
  ↓
Return early (no command created)
  ↓
Event continues naturally to input
  ↓
"h" appears in input ✅
```

**Exiting Edit Mode:**

```
User presses Enter in input
  ↓
Input's onKeyDown fires
  ↓
runAction('saveAction', value)
  ↓
Action executes:
  → api.save(value)
  → api.releaseKeyboard()
  ↓
keyboardOwnerRef.current = null
  ↓
event.stopPropagation() prevents document listener
  ↓
Cell exits edit mode
```

The `stopPropagation()` is critical. Without it:

```
User presses Enter to save
  ↓
Input's onKeyDown fires
  → Saves value
  → Releases keyboard
  → Sets editing = false
  ↓
Event bubbles to document
  ↓
Keyboard is now released (owner = null)
  ↓
EditPlugin sees Enter key
  ↓
Sends 'edit' command to focused cell
  ↓
Cell re-enters edit mode! ❌
```

With stopPropagation, the Enter event never reaches the document listener, so EditPlugin never sees it.

---

## Complete Flow Examples

Let's trace several complete user interactions through the entire system to see how all the pieces work together.

### Example 1: Navigation with Arrow Keys

**Scenario**: User clicks a cell, then presses ArrowDown

```
STEP 1: User clicks cell
  ↓
Row component's onClick fires
  ↓
tableApis.sendMouseEvent(cellId, 'click', event)
  ↓
TableCore.convertMouseEventToCommand()
  ↓
Creates command:
{
    name: 'click',
    targetId: 'col01-IDX_5-uuid-abc',
    payload: { event },
    timestamp: 1234567890
}
  ↓
CellCommandRegistry.dispatch(command)
  ↓
Plugin Chain:
  FocusPlugin.onBeforeCellCommand(command)
    → Sees click command
    → Calls this.focusCell(targetId)
    → Creates focus command: { name: 'focus', targetId }
    → Returns true (allow original click)

  EditPlugin.onBeforeCellCommand(command)
    → Sees click command
    → Not interested
    → Returns true

  SelectPlugin.onBeforeCellCommand(command)
    → Sees click command
    → Clears selection
    → Returns true
  ↓
Cell Handler:
  TextCell receives click command
  → console.log('Cell clicked')

Result: Cell is now focused (has focus ring)

STEP 2: User presses ArrowDown
  ↓
Document keydown listener fires
  ↓
TableCore.dispatchKeyboardCommand('keydown', event)
  ↓
Checks keyboard ownership:
  getKeyboardOwner() === null? → Yes
  ↓
Creates command (no targetId):
{
    name: 'keydown',
    payload: { event },
    timestamp: 1234567891
}
  ↓
CellCommandRegistry.dispatch(command)
  ↓
Plugin Chain:
  FocusPlugin.onBeforeCellCommand(command)
    → Sees keydown with no targetId
    → Checks: isArrow(event.key)? → Yes (ArrowDown)
    → Gets current focused cell: 'col01-IDX_5-uuid-abc'
    → Gets cell: { bottom: 'col01-IDX_6-uuid-def', ... }
    → Calls this.focusCell('col01-IDX_6-uuid-def')
      Creates: { name: 'blur', targetId: 'col01-IDX_5-uuid-abc' }
      Creates: { name: 'focus', targetId: 'col01-IDX_6-uuid-def' }
    → event.preventDefault()
    → Returns true
  ↓
Cell Handler:
  No targetId, so no cell receives the keydown command

Result: Focus moved from row 5 to row 6
```

### Example 2: Editing a Cell

**Scenario**: User focuses a cell, presses Enter to edit, types "hello", presses Enter to save

```
STEP 1: Cell is focused (from previous example)

STEP 2: User presses Enter
  ↓
Document keydown listener fires
  ↓
TableCore.dispatchKeyboardCommand('keydown', event)
  ↓
Keyboard ownership check: null → Continue
  ↓
Creates keydown command (no targetId)
  ↓
Plugin Chain:
  FocusPlugin.onBeforeCellCommand(command)
    → Sees keydown with no targetId
    → Checks: isArrow(event.key)? → No (Enter)
    → Returns true (not interested)

  EditPlugin.onBeforeCellCommand(command)
    → Sees keydown with no targetId
    → Checks: event.key === 'Enter'? → Yes
    → Gets focused cell from FocusPlugin: cellId
    → Creates command: { name: 'edit', targetId: cellId }
    → event.preventDefault()
    → Returns false (block original keydown)
  ↓
Edit command dispatched:
  ↓
Cell Handler:
  TextCell receives 'edit' command
    → Saves original value: setOriginalValue(internalValue)
    → Sets editing mode: setIsEditing(true)
    → Runs action: runAction('requestKeyboardAction')
      ↓
      Phase 1: Recording
        recordingAPI.requestKeyboard() → recorded
      ↓
      Phase 2: Plugin Interception
        (No plugins intercept this action)
      ↓
      Phase 3: Execution
        realAPI.requestKeyboard()
          → keyboardOwnerRef.current = cellId
    → Input field appears with autoFocus

Result: Cell is in edit mode, keyboard is owned

STEP 3: User types "h"
  ↓
Input field keydown fires
  ↓
Event bubbles to document listener
  ↓
TableCore.dispatchKeyboardCommand('keydown', event)
  ↓
Keyboard ownership check:
  getKeyboardOwner() === cellId? → Yes
  → Return early (NO COMMAND CREATED)
  ↓
Event continues to input field
  ↓
"h" appears in input ✅

[User continues typing "ello"]

Result: Input shows "hello"

STEP 4: User presses Enter to save
  ↓
Input's onKeyDown handler fires
  ↓
Checks: e.key === 'Enter'? → Yes
  ↓
runAction('saveAction', internalValue)
  ↓
Phase 1: Recording
  recordingAPI.save("hello") → recorded
  recordingAPI.releaseKeyboard() → recorded
  ↓
Phase 2: Plugin Interception
  ValidationPlugin.onBeforeAction(cellId, 'saveAction', apiUsage)
    → apiUsage.on('save', (value) => {
         return value.length > 0; // true for "hello"
       })
    → Returns true
  ↓
Phase 3: Execution
  Check: shouldExecute('save', ["hello"])
    → Run handlers: ValidationPlugin handler returns true
    → YES, execute
  realAPI.save("hello")
    → Dispatches: { name: 'updateValue', targetId: cellId, payload: { value: "hello" } }
      ↓
      Plugin Chain:
        (Plugins see updateValue command)
      ↓
      Cell Handler:
        TextCell receives updateValue
        → setInternalValue("hello")

  Check: shouldExecute('releaseKeyboard', [])
    → No handlers
    → YES, execute
  realAPI.releaseKeyboard()
    → keyboardOwnerRef.current = null
  ↓
setIsEditing(false)
  ↓
event.stopPropagation()
  ↓
Input disappears, display shows "hello"

Result: Value saved, keyboard released, edit mode exited
```

### Example 3: Plugin Propagation (Testing)

**Scenario**: SavePropagationPlugin propagates saves to the left cell

```
STEP 1: User saves "hello" in cellId: 'col02-IDX_5-uuid-abc'
  ↓
runAction('saveAction', "hello")
  ↓
Phase 2: Plugin Interception
  SavePropagationPlugin.onBeforeAction(cellId, 'saveAction', apiUsage)
    → Detects: actionName === 'saveAction'
    → apiUsage.on('save', (value) => {
         // Store for later propagation
         this.pendingSave = { cellId, value };
         return true; // Allow
       })
    → Returns true
  ↓
Phase 3: Execution
  save("hello") executes
  releaseKeyboard() executes
  ↓
Action complete, but SavePropagationPlugin has pendingSave
  ↓
Plugin's onBeforeAction returns, now we run microtask:
  setTimeout(() => {
    const cell = this.tableAPIs.getCell(this.pendingSave.cellId);
    if (cell.left) {
      this.tableAPIs.runAction(cell.left, 'saveAction', this.pendingSave.value);
    }
  }, 0);
  ↓
Microtask executes:
  Triggers: runAction('col01-IDX_5-uuid-def', 'saveAction', "hello")
  ↓
  Phase 2: Plugin Interception
    SavePropagationPlugin.onBeforeAction(...)
      → originPlugin === 'save-propagation-plugin'? → YES
      → SKIPPED (bypass)
  ↓
  Phase 3: Execution
    Left cell saves "hello"

Result: Both cells now have "hello"
```

### Example 4: Selective API Blocking

**Scenario**: SaveBlockerPlugin blocks saves on odd counter, blocks action on even counter

```
Counter = 1 (odd)

User saves "test"
  ↓
runAction('saveAction', "test")
  ↓
Phase 2: Plugin Interception
  SaveBlockerPlugin.onBeforeAction(cellId, 'saveAction', apiUsage)
    → Increments counter: this.counter = 2
    → Checks: wasOdd (1 was odd)? → YES
    → apiUsage.on('save', (value) => {
         console.log('Blocking save API');
         return false; // BLOCK API
       })
    → Returns true (action continues)
  ↓
Phase 3: Execution
  Check: shouldExecute('save', ["test"])
    → SaveBlockerPlugin handler returns false
    → NO, skip

  Check: shouldExecute('releaseKeyboard', [])
    → No handlers
    → YES, execute
  realAPI.releaseKeyboard()
    → Keyboard released

Result: Save blocked, but keyboard still released


Counter = 2 (even)

User saves "test"
  ↓
runAction('saveAction', "test")
  ↓
Phase 2: Plugin Interception
  SaveBlockerPlugin.onBeforeAction(cellId, 'saveAction', apiUsage)
    → Increments counter: this.counter = 3
    → Checks: wasOdd (2 was even)? → NO
    → Don't register API handler
    → Returns false (BLOCK ACTION - stop plugin chain)
  ↓
Phase 3: Execution
  save("test") executes normally (no one blocked it)
  releaseKeyboard() executes normally

Result: Action continued (other plugins skipped), both APIs executed
```

The key difference:
- **Odd counter**: Blocks the `save` API specifically while allowing `releaseKeyboard`
- **Even counter**: Blocks the action from reaching other plugins but both APIs still execute

---

## Summary

React Super Grid is built on a foundation of spatial graphs, bidirectional communication channels, and plugin interception. Every entity knows its neighbors. Every interaction flows through well-defined pipelines. Every feature is a plugin that observes and influences behavior without modifying core code.

This architecture trades initial complexity for long-term flexibility. Adding a new feature requires writing a plugin, not untangling interdependent code. Changing behavior requires intercepting commands, not finding and modifying scattered event handlers. Understanding the system requires learning the patterns, but once learned, those patterns apply everywhere consistently.

The result is a grid that can grow in functionality while remaining comprehensible, testable, and maintainable.
