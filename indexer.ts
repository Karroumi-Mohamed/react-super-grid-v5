import { generateKeyBetween } from "fractional-indexing";
import { Indexer } from "./src/SupperGrid/core/Indexer";

/**
 * ═══════════════════════════════════════════════════════════════════════════
 * REACT SUPER GRID V5 - COMPREHENSIVE ARCHITECTURE DOCUMENTATION
 * ═══════════════════════════════════════════════════════════════════════════
 * 
 * This file documents the complete architecture of the React Super Grid system,
 * including Spaces, Rows, Cells, Commands, Plugins, and the Action system.
 * 
 * Author's Understanding and Thoughts on the Architecture
 * ═══════════════════════════════════════════════════════════════════════════
 */

/**
 * ───────────────────────────────────────────────────────────────────────────
 * 1. CORE CONCEPTS - THE SPATIAL GRID ARCHITECTURE
 * ───────────────────────────────────────────────────────────────────────────
 * 
 * The grid is built on a hierarchical spatial model:
 * 
 *   TABLE
 *   ├── SPACES (vertical segments owned by plugins or the table)
 *   │   ├── Space 1 (owned by PluginA)
 *   │   ├── Space 2 (table-space - main data)
 *   │   └── Space 3 (owned by PluginB)
 *   │
 *   ├── ROWS (horizontal data containers within spaces)
 *   │   ├── Row 1 (in Space 1)
 *   │   ├── Row 2 (in Space 2)
 *   │   └── Row 3 (in Space 2)
 *   │
 *   └── CELLS (individual data units at row-column intersections)
 *       ├── Cell[Row1, Col1]
 *       ├── Cell[Row1, Col2]
 *       └── Cell[Row2, Col1]
 * 
 * SPATIAL RELATIONSHIPS:
 * ----------------------
 * - Spaces are linked vertically: top ↔ bottom
 * - Rows are linked vertically within and across spaces: top ↔ bottom
 * - Cells are linked both vertically AND horizontally: top ↔ bottom, left ↔ right
 * 
 * This creates a fully navigable 2D grid where you can traverse:
 * - Vertically: from any cell to cells above/below (even across space boundaries)
 * - Horizontally: from any cell to cells left/right (within the same row)
 */

/**
 * ───────────────────────────────────────────────────────────────────────────
 * 2. THE INDEXER SYSTEM - FRACTIONAL POSITIONING
 * ───────────────────────────────────────────────────────────────────────────
 * 
 * The Indexer is the backbone of row ordering in the grid. It uses fractional
 * indexing to maintain a stable, BOTTOM-TO-TOP order of rows.
 * 
 * KEY CONCEPTS:
 * -------------
 * 
 * a) Short IDs with Full Index Mapping
 *    - Each position gets a short ID: "IDX_0", "IDX_1", etc.
 *    - These map to full fractional indices: "a0", "a1", "a2V", etc.
 *    - This allows efficient storage and fast comparison
 * 
 * b) Order Direction: BOTTOM-TO-TOP
 *    - Lower lexicographic value = ABOVE (top of screen)
 *    - Higher lexicographic value = BELOW (bottom of screen)
 *    - This is inverted from normal array indexing!
 * 
 * c) Indexer API Methods:
 * 
 *    Indexer.above(belowId?)
 *    - Creates a new index ABOVE the given position
 *    - If no ID provided, creates a new baseline position
 *    - Returns: short ID like "IDX_5"
 * 
 *    Indexer.below(aboveId?)
 *    - Creates a new index BELOW the given position
 *    - Used less frequently in practice
 * 
 *    Indexer.between(lowerIndex, upperIndex)
 *    - Creates a new index BETWEEN two existing positions
 *    - Critical for insertion operations
 *    - Maintains order integrity
 * 
 *    Indexer.compare(refA, refB)
 *    - Returns -1 if refA is ABOVE refB
 *    - Returns 0 if equal
 *    - Returns 1 if refA is BELOW refB
 * 
 * d) Performance Characteristics:
 *    - O(1) index generation in most cases
 *    - Fractional indices can grow in length over time
 *    - Auto-redistribution when indices exceed 400 characters
 *    - Handles 10k+ insertions efficiently
 * 
 * PRACTICAL EXAMPLE:
 * ------------------
 * Visual representation (top of screen to bottom):
 * 
 *   ┌─────────────────────┐
 *   │ Row 3: IDX_2 "a0"   │ ← ABOVE (smaller value)
 *   ├─────────────────────┤
 *   │ Row 1: IDX_0 "a1"   │ ← MIDDLE
 *   ├─────────────────────┤
 *   │ Row 2: IDX_1 "a2"   │ ← BELOW (larger value)
 *   └─────────────────────┘
 * 
 * To insert between Row 3 and Row 1:
 *   newIndex = Indexer.between("IDX_2", "IDX_0")
 *   // Creates "IDX_3" with value between "a0" and "a1"
 */

/**
 * ───────────────────────────────────────────────────────────────────────────
 * 3. SPACE SYSTEM - VERTICAL SEGMENTATION
 * ───────────────────────────────────────────────────────────────────────────
 * 
 * Spaces divide the table vertically into sections, each potentially owned by
 * different plugins. This enables powerful extensibility.
 * 
 * SPACE STRUCTURE:
 * ----------------
 * interface Space {
 *     name: string;           // Human-readable name
 *     owner?: string;         // Plugin name or 'table' if main space
 *     top: SpaceId | null;    // Space above this one
 *     bottom: SpaceId | null; // Space below this one
 *     rowIds: RowId[];        // Rows contained in this space
 * }
 * 
 * SPACE ORDERING (BOTTOM-TO-TOP):
 * --------------------------------
 * Spaces are ordered from bottom to top, visually:
 * 
 *   ┌──────────────────────────┐
 *   │ Plugin A Space (above)   │ ← top = null, bottom = "table-space"
 *   ├──────────────────────────┤
 *   │ Table Space (middle)     │ ← top = "pluginA-space", bottom = "pluginB-space"
 *   ├──────────────────────────┤
 *   │ Plugin B Space (below)   │ ← top = "table-space", bottom = null
 *   └──────────────────────────┘
 * 
 * CROSS-SPACE ROW LINKING:
 * ------------------------
 * Rows can be linked across space boundaries, enabling seamless navigation:
 * 
 * Example: Navigating from last row of Table Space to first row of Plugin B Space
 *   Row(tableSpace, last).bottom → Row(pluginBSpace, first)
 *   Row(pluginBSpace, first).top → Row(tableSpace, last)
 * 
 * This is handled by the Space component's linkToSpaceAbove/linkToSpaceBelow functions.
 * 
 * SPACE COMMANDS:
 * ---------------
 * Spaces respond to commands dispatched via SpaceCommandRegistry:
 * 
 *   - addRow: { rowData, position: 'top' | 'bottom' }
 *     Creates a new row in the space
 *     Handles fractional indexing and cross-space linking
 * 
 *   - render: {}
 *     Forces the space to re-render
 *     Useful for plugin-triggered updates
 */

/**
 * ───────────────────────────────────────────────────────────────────────────
 * 4. ROW SYSTEM - HORIZONTAL DATA CONTAINERS
 * ───────────────────────────────────────────────────────────────────────────
 * 
 * Rows represent horizontal slices of data across all columns.
 * 
 * ROW STRUCTURE:
 * --------------
 * interface Row<T> {
 *     spaceId: SpaceId;        // Which space owns this row
 *     data: T;                 // The actual row data
 *     cells: CellId[];         // IDs of cells in this row
 *     top: RowId | null;       // Row above (even across spaces!)
 *     bottom: RowId | null;    // Row below (even across spaces!)
 *     rowString: string;       // Indexer ID for positioning
 * }
 * 
 * ROW LINKING MECHANICS:
 * ----------------------
 * Rows are linked in two ways:
 * 
 * 1. Row-level linking (via RowRegistry):
 *    row1.bottom = row2Id
 *    row2.top = row1Id
 * 
 * 2. Cell-level linking (via CellCoordinator):
 *    linkRowsCells(row1.cells, row2.cells)
 *    This links each cell vertically to its counterpart in the adjacent row
 * 
 * ADD ROW ALGORITHM:
 * ------------------
 * When adding a row to a space, the algorithm considers:
 * 
 * 1. Position: 'top' or 'bottom' of the space
 * 2. Existing rows in the space
 * 3. Rows in adjacent spaces (for proper indexing)
 * 
 * Pseudocode for position='bottom' (most common):
 * 
 *   if (space has no rows) {
 *       // Find space context
 *       spaceAbove = findNearestSpaceWithRows('above')
 *       spaceBelow = findNearestSpaceWithRows('below')
 *       
 *       if (both exist) {
 *           // Sandwich between two spaces
 *           rowString = Indexer.between(lastRowOfAbove, firstRowOfBelow)
 *       } else if (only above exists) {
 *           rowString = Indexer.below(lastRowOfAbove)
 *       } else if (only below exists) {
 *           rowString = Indexer.above(firstRowOfBelow)
 *       } else {
 *           // First row in entire table
 *           rowString = Indexer.above()
 *       }
 *   } else {
 *       // Space has rows - add at bottom
 *       lastRowString = space.rowIds[space.rowIds.length - 1].rowString
 *       
 *       spaceBelow = findNearestSpaceWithRows('below')
 *       if (spaceBelow exists) {
 *           firstRowStringBelow = spaceBelow.rowIds[0].rowString
 *           rowString = Indexer.between(lastRowString, firstRowStringBelow)
 *       } else {
 *           rowString = Indexer.below(lastRowString)
 *       }
 *   }
 * 
 * ROW COMMANDS:
 * -------------
 *   - delete: {}
 *     Marks row for deletion
 * 
 *   - destroy: {}
 *     Actually destroys the row and cleans up all cell references
 * 
 *   - linkToTop: { targetRowId }
 *     Links this row to another row above
 * 
 *   - linkToBottom: { targetRowId }
 *     Links this row to another row below
 * 
 *   - error: { error }
 *     Delivers error to row component
 */

/**
 * ───────────────────────────────────────────────────────────────────────────
 * 5. CELL SYSTEM - INDIVIDUAL DATA UNITS
 * ───────────────────────────────────────────────────────────────────────────
 * 
 * Cells are the atomic units of the grid, representing individual editable values.
 * 
 * CELL STRUCTURE:
 * ---------------
 * interface Cell {
 *     rowId: RowId;           // Which row owns this cell
 *     top: CellId | null;     // Cell directly above
 *     bottom: CellId | null;  // Cell directly below
 *     left: CellId | null;    // Cell to the left
 *     right: CellId | null;   // Cell to the right
 * }
 * 
 * CELL ID FORMAT:
 * ---------------
 * CellIds encode spatial information:
 *   Format: "{columnIndex}-{rowIndexerId}-{uuid}"
 *   Example: "2-IDX_5-abc123def456"
 * 
 * This allows:
 * - Column extraction for horizontal comparison
 * - Row identification for vertical comparison
 * - Uniqueness via UUID
 * 
 * CELL NAVIGATION:
 * ----------------
 * The fully-linked structure enables 4-directional navigation:
 * 
 *   cell.top    → Navigate UP (to row above)
 *   cell.bottom → Navigate DOWN (to row below)
 *   cell.left   → Navigate LEFT (to previous column)
 *   cell.right  → Navigate RIGHT (to next column)
 * 
 * This is used by plugins like FocusPlugin for keyboard navigation.
 */

/**
 * ───────────────────────────────────────────────────────────────────────────
 * 6. COMMAND SYSTEM - COMMUNICATION CHANNELS
 * ───────────────────────────────────────────────────────────────────────────
 * 
 * The grid uses a command-based architecture for all communication between
 * components, plugins, and the core system.
 * 
 * THREE COMMAND REGISTRIES:
 * --------------------------
 * 
 * A) CellCommandRegistry - Cell-to-Table Communication
 *    - Commands: focus, blur, select, edit, click, keydown, etc.
 *    - Flow: Component → Registry → Plugin Chain → Target Cell
 *    - Can have targetId (delivered to cell) or no targetId (plugin-only)
 * 
 * B) RowCommandRegistry - Row-level Operations
 *    - Commands: delete, destroy, linkToTop, linkToBottom, error
 *    - Flow: TableCore → Registry → Plugin Chain → Target Row
 *    - Always has a targetId
 * 
 * C) SpaceCommandRegistry - Space-level Operations
 *    - Commands: addRow, render
 *    - Flow: Plugin/TableCore → Registry → Target Space
 *    - No plugin interception (currently)
 * 
 * COMMAND STRUCTURE:
 * ------------------
 * All commands share a common structure:
 * 
 * interface Command {
 *     name: string;              // Command type
 *     payload?: any;             // Command-specific data
 *     targetId?: string;         // Target component ID (optional for some cell commands)
 *     originPlugin?: string;     // Which plugin created this command
 *     timestamp?: number;        // When command was created
 * }
 * 
 * COMMAND DISPATCH FLOW:
 * ----------------------
 * 1. Command is created (by component, plugin, or TableCore)
 * 2. Timestamp is added if not provided
 * 3. Command enters plugin interception chain
 * 4. Each plugin's onBeforeXCommand() is called in order
 * 5. Plugin can:
 *    - Return true/void to allow command to continue
 *    - Return false to block command
 *    - Throw error (caught and logged, command continues)
 * 6. If command passes all plugins, it's delivered to target
 * 
 * BYPASS MECHANISM:
 * -----------------
 * If a plugin creates a command with originPlugin = its own name,
 * that plugin is skipped in the interception chain.
 * 
 * This prevents infinite loops and allows plugins to send commands
 * without intercepting their own messages.
 * 
 * EXAMPLE - Focus Command Flow:
 * ------------------------------
 * User clicks cell → 
 *   MouseEvent → 
 *     CellCommand { name: 'click', targetId: 'cell-123' } →
 *       FocusPlugin.onBeforeCellCommand() [intercepts, sends focus command] →
 *         CellCommand { name: 'focus', targetId: 'cell-123', originPlugin: 'focus-plugin' } →
 *           Cell receives focus command →
 *             Cell updates visual state (border, background)
 */

/**
 * ───────────────────────────────────────────────────────────────────────────
 * 7. PLUGIN SYSTEM - EXTENSIBILITY ARCHITECTURE
 * ───────────────────────────────────────────────────────────────────────────
 * 
 * Plugins are the primary extension mechanism for the grid.
 * 
 * PLUGIN STRUCTURE:
 * -----------------
 * abstract class BasePlugin {
 *     name: string;                    // Unique plugin identifier
 *     version: string;                 // Plugin version
 *     dependencies: string[] = [];     // Other plugins this depends on
 *     processLast: boolean = false;    // Should run after all normal plugins
 *     
 *     onInit?(): void;                 // Called once during initialization
 *     onDestroy?(): void;              // Called on cleanup
 *     
 *     onBeforeCellCommand(command): boolean | void;  // Intercept cell commands
 *     onBeforeRowCommand(command): boolean | void;   // Intercept row commands
 * }
 * 
 * PLUGIN CAPABILITIES:
 * --------------------
 * Plugins have access to powerful APIs:
 * 
 * TablePluginAPIs:
 *   - createCellCommand(targetId, command)  // Send commands to cells
 *   - createRowCommand(targetId, command)   // Send commands to rows
 *   - createRow(rowData, position)          // Add row to plugin's space
 *   - createRowInTableSpace(rowData, pos)   // Add row to main table
 *   - getCell(cellId)                       // Access cell spatial data
 *   - getRow(rowId)                         // Access row data
 *   - compareVertical(cell1, cell2)         // Spatial comparison
 *   - compareHorizontal(cell1, cell2)       // Spatial comparison
 *   - deleteRow(rowId)                      // Remove row
 *   - getMySpace()                          // Get plugin's space ID
 *   - renderSpace(spaceId)                  // Force space re-render
 *   - scrollToCell(cellId)                  // Scroll cell into view
 * 
 * PLUGIN ORDER RESOLUTION:
 * ------------------------
 * Plugins are initialized and process commands in a specific order:
 * 
 * 1. DEPENDENCY RESOLUTION
 *    Plugins are topologically sorted by their dependencies.
 *    If PluginB depends on PluginA, then PluginA initializes first.
 * 
 * 2. TWO-PHASE ORDERING
 *    Plugins are split into two groups:
 *    
 *    a) Normal Phase
 *       - Plugins without processLast=true
 *       - Sorted by dependencies within this group
 *    
 *    b) Process Last Phase
 *       - Plugins with processLast=true
 *       - Any plugin that depends on a processLast plugin
 *       - Sorted by dependencies within this group
 * 
 *    Final order: [...normalPlugins, ...processLastPlugins]
 * 
 * 3. CIRCULAR DEPENDENCY DETECTION
 *    The system detects and throws errors for circular dependencies.
 * 
 * EXAMPLE PLUGIN ORDER:
 * ---------------------
 * Given:
 *   - PluginA (normal, no deps)
 *   - PluginB (normal, depends on PluginA)
 *   - PluginC (processLast, no deps)
 *   - PluginD (normal, depends on PluginC)
 * 
 * Resolution:
 *   1. PluginA (normal, no deps)
 *   2. PluginB (normal, after PluginA)
 *   3. PluginD (moved to processLast because depends on PluginC)
 *   4. PluginC (processLast)
 * 
 * PLUGIN INTERCEPTION:
 * --------------------
 * When a command is dispatched, each plugin in order gets a chance to:
 * 
 * 1. Inspect the command
 * 2. Modify plugin state (but NOT the command itself)
 * 3. Send additional commands
 * 4. Block the command (return false)
 * 
 * This enables powerful features like:
 * - Focus management (FocusPlugin)
 * - Selection ranges (SelectionPlugin)
 * - Undo/redo tracking
 * - Validation
 * - Logging/analytics
 * 
 * EXAMPLE PLUGINS:
 * ----------------
 * 
 * A) FocusPlugin
 *    - Tracks currently focused cell
 *    - Intercepts click → sends focus command
 *    - Intercepts arrow keys → navigates focus
 *    - Uses cell spatial links (top, bottom, left, right)
 * 
 * B) SelectionPlugin
 *    - Manages cell selection ranges
 *    - Intercepts Shift+Click → extends selection
 *    - Sends select/unselect commands to cells
 * 
 * C) PerformancePlugin
 *    - Monitors command processing time
 *    - Logs performance metrics
 *    - Can run as processLast to measure full chain
 */

/**
 * ───────────────────────────────────────────────────────────────────────────
 * 8. ACTION SYSTEM - FUTURE CELL-TO-TABLE COMMUNICATION
 * ───────────────────────────────────────────────────────────────────────────
 * 
 * The Action System (illustrated below) is a proposed enhancement to provide
 * a higher-level API for cell-to-table communication.
 * 
 * CURRENT STATE (Commands):
 * -------------------------
 * Currently, cells communicate via low-level commands:
 *   - Cell emits: CellCommand { name: 'updateValue', payload: { value } }
 *   - Manual handling of state, validation, etc.
 * 
 * PROPOSED ACTION SYSTEM:
 * -----------------------
 * Actions would provide semantic, high-level operations:
 * 
 * interface CellTableAPI {
 *     save(value: any): void;          // Save value to backend
 *     cancel(): void;                  // Cancel current operation
 *     validate(): boolean;             // Run validation
 *     releaseKeyboard(): void;         // Release keyboard focus
 *     requestKeyboard(): void;         // Request keyboard focus
 *     showError(message: string): void; // Display error
 *     // ... more semantic operations
 * }
 * 
 * DEFINING ACTIONS:
 * -----------------
 * Actions are registered globally and consist of:
 * 
 * 1. Action Name (string identifier)
 * 2. Action Method (implementation)
 * 
 * Example:
 * 
 *   const saveActionMethod = (tableAPIs: CellTableAPI, newValue: any) => {
 *       // Semantic operations using provided APIs
 *       tableAPIs.validate();
 *       tableAPIs.save(newValue);
 *       tableAPIs.releaseKeyboard();
 *   }
 * 
 *   registerActions({
 *       "saveAction": saveActionMethod,
 *       "exitAction": (tableAPIs) => {
 *           tableAPIs.cancel();
 *           tableAPIs.releaseKeyboard();
 *       }
 *   })
 * 
 * RUNNING ACTIONS:
 * ----------------
 * Cells or plugins can run actions:
 * 
 *   runAction("saveAction", newValue);
 * 
 * PLUGIN INTERCEPTION OF ACTIONS:
 * --------------------------------
 * Plugins can intercept actions before execution:
 * 
 *   onBeforeAction(
 *       cellId: CellId,
 *       actionName: string,
 *       apiUsage: [string, any][]  // Recorded API calls
 *   ): boolean {
 *       // Inspect which APIs will be called
 *       // Example: [["validate", undefined], ["save", newValue], ["releaseKeyboard", undefined]]
 *       
 *       // Can validate, log, or block the action
 *       if (actionName === "saveAction" && !hasPermission(cellId)) {
 *           return false;  // Block the action
 *       }
 *       
 *       return true;  // Allow action to proceed
 *   }
 * 
 * API USAGE RECORDING:
 * --------------------
 * The action system would record which API methods are called:
 * 
 *   apiUsage = [
 *       ["validate", undefined],
 *       ["save", newValue],
 *       ["releaseKeyboard", undefined]
 *   ]
 * 
 * This allows plugins to:
 * - Understand action intent without executing it
 * - Validate permission before execution
 * - Log or audit actions
 * - Implement undo/redo by recording API calls
 * 
 * BENEFITS OVER COMMANDS:
 * -----------------------
 * 1. Semantic clarity (save vs updateValue)
 * 2. Encapsulated business logic
 * 3. Reusable action definitions
 * 4. Plugin inspection before execution
 * 5. Easier testing (mock CellTableAPI)
 * 6. Type-safe API contracts
 * 
 * INTEGRATION WITH CURRENT SYSTEM:
 * --------------------------------
 * Actions would sit ABOVE commands:
 * 
 *   Cell → Action → CellTableAPI → Commands → Plugins → Target
 * 
 * Under the hood, CellTableAPI methods would dispatch commands,
 * but cells would work with actions, not raw commands.
 */

/**
 * ───────────────────────────────────────────────────────────────────────────
 * 9. COORDINATOR SYSTEMS - SPATIAL MANAGEMENT
 * ───────────────────────────────────────────────────────────────────────────
 * 
 * Coordinators manage spatial relationships between components.
 * 
 * A) CellCoordinator
 *    Manages cell-to-cell and row-to-row linking:
 *    
 *    - linkVertical(topCellId, bottomCellId)
 *      Creates bidirectional vertical link between cells
 *    
 *    - linkHorizontal(leftCellId, rightCellId)
 *      Creates bidirectional horizontal link between cells
 *    
 *    - linkRows(topRowId, bottomRowId)
 *      Links rows at the row level
 *    
 *    - linkRowsCells(topCells[], bottomCells[])
 *      Links all cells between two rows vertically
 *      Used during row insertion and cross-space linking
 * 
 * B) SpaceCoordinator
 *    Manages space-to-space linking:
 *    
 *    - createPluginSpace(pluginName)
 *      Creates a new space owned by a plugin
 *    
 *    - getSpaceAbove(spaceId)
 *      Returns the space directly above
 *    
 *    - getSpaceBelow(spaceId)
 *      Returns the space directly below
 */

/**
 * ───────────────────────────────────────────────────────────────────────────
 * 10. REGISTRY SYSTEMS - COMPONENT STORAGE
 * ───────────────────────────────────────────────────────────────────────────
 * 
 * Registries provide centralized storage and retrieval for all components.
 * 
 * All registries implement the RegistryI<ID, Object> interface:
 * 
 *   - register(id, obj): boolean
 *     Stores or updates an object
 *     Returns true if new, false if overwritten
 *   
 *   - unregister(id): boolean
 *     Removes an object
 *     Returns true if existed, false if not found
 *   
 *   - get(id): Object | undefined
 *     Retrieves an object by ID
 *   
 *   - has(id): boolean
 *     Checks if ID exists
 *   
 *   - list(): ID[]
 *     Returns all IDs
 *   
 *   - clear(): void
 *     Removes all objects
 * 
 * REGISTRY TYPES:
 * ---------------
 * - CellRegistry: Stores Cell objects (spatial links)
 * - RowRegistry<T>: Stores Row<T> objects (data + spatial links)
 * - SpaceRegistry: Stores Space objects (vertical segments)
 * 
 * These enable:
 * - Fast lookup by ID
 * - Centralized state management
 * - Clean separation from React component state
 */

/**
 * ───────────────────────────────────────────────────────────────────────────
 * 11. TABLECORE - THE CENTRAL ORCHESTRATOR
 * ───────────────────────────────────────────────────────────────────────────
 * 
 * TableCore is the main class that orchestrates all systems:
 * 
 * RESPONSIBILITIES:
 * -----------------
 * 1. Owns all registries (Cell, Row, Space)
 * 2. Owns all command registries (Cell, Row, Space)
 * 3. Owns coordinators (Cell, Space)
 * 4. Manages plugin lifecycle
 * 5. Creates context-aware APIs for plugins
 * 6. Dispatches commands to appropriate registries
 * 7. Provides convenience methods for common operations
 * 
 * API FACTORY PATTERN:
 * --------------------
 * TableCore creates bound APIs for each plugin using closures:
 * 
 *   createPluginAPI(pluginName: string): TablePluginAPIs
 * 
 * This ensures:
 * - Each plugin's commands are tagged with originPlugin
 * - Plugins can only access their own space
 * - Context is automatically injected
 * 
 * INITIALIZATION FLOW:
 * --------------------
 * 1. TableCore constructed
 * 2. Plugins added via addPlugin()
 * 3. initializePlugins() called:
 *    a. Resolve plugin dependencies
 *    b. Create spaces for plugins
 *    c. Create and inject APIs for each plugin
 *    d. Connect plugins to command registries
 *    e. Call plugin.onInit() for each plugin in order
 */

/**
 * ───────────────────────────────────────────────────────────────────────────
 * 12. SUMMARY - THE BIG PICTURE
 * ───────────────────────────────────────────────────────────────────────────
 * 
 * The React Super Grid is a sophisticated, plugin-extensible data grid with:
 * 
 * SPATIAL MODEL:
 * - Hierarchical: Table → Spaces → Rows → Cells
 * - Fully linked 2D navigation (top, bottom, left, right)
 * - Fractional indexing for stable row ordering
 * - Cross-space row linking for seamless navigation
 * 
 * COMMUNICATION:
 * - Command-based architecture (Cell, Row, Space commands)
 * - Plugin interception chain for all commands
 * - Bypass mechanism to prevent infinite loops
 * - Future: Action system for semantic cell operations
 * 
 * EXTENSIBILITY:
 * - Plugin system with dependency resolution
 * - Two-phase ordering (normal + processLast)
 * - Context-aware APIs injected per plugin
 * - Each plugin gets its own space
 * 
 * KEY INNOVATIONS:
 * ----------------
 * 1. Fractional Indexing: Enables O(1) row insertion anywhere
 * 2. Bottom-to-Top Ordering: Matches visual representation
 * 3. Space System: Allows plugins to own vertical segments
 * 4. Cross-Space Linking: Seamless navigation across boundaries
 * 5. Command Interception: Powerful plugin capabilities
 * 6. API Factory Pattern: Type-safe, context-aware plugin APIs
 * 
 * The architecture enables building complex spreadsheet-like applications
 * with rich plugin ecosystems while maintaining clean separation of concerns.
 */

/**
 * ═══════════════════════════════════════════════════════════════════════════
 * PERFORMANCE TESTS - INDEXER VALIDATION
 * ═══════════════════════════════════════════════════════════════════════════
 */

// Test 10k index generation - sequential insertion
const indexes: string[] = [];
const start = performance.now();
indexes.push(Indexer.above());
for (let i = 0; i < 5000; i++) {
    indexes.push(Indexer.above(indexes[i]));
}
const end = performance.now();
console.log(`✓ Sequential generation: ${end - start} ms for ${indexes.length} indexes`);
console.log(`  Last index value: ${Indexer.getIndex(indexes[indexes.length - 1])}`);

// Verify ordering
console.log(`\n✓ Verifying order of ${indexes.length} indexes...`);
let isOrdered = true;
for (let i = 1; i < indexes.length; i++) {
    const prev = Indexer.getIndex(indexes[i - 1])!;
    const curr = Indexer.getIndex(indexes[i])!;
    if (prev >= curr) {
        console.error(`❌ Order error at position ${i}: ${prev} >= ${curr}`);
        isOrdered = false;
        break;
    }
}
if (isOrdered) {
    console.log("  ✓ All indexes are in correct order.");
} else {
    throw new Error("Indexes are not in order!");
}

// Test insertion between existing indexes
console.log("\n✓ Testing between() insertion at end...");
let start2 = performance.now();
for (let i = indexes.length - 1; i < 7500; i++) {
    const index = Indexer.between(indexes[i - 1], indexes[i]);
    const last = indexes.pop();
    indexes.push(index);
    indexes.push(last!);
}
let end2 = performance.now();
console.log(`  Time: ${end2 - start2} ms for ${7500 - 5001} insertions`);

// Test insertion at start
console.log("\n✓ Testing between() insertion at start...");
start2 = performance.now();
for (let i = 0; i < 2500; i++) {
    const index = Indexer.between(indexes[0], indexes[1]);
    const first = indexes.shift();
    indexes.unshift(index);
    indexes.unshift(first!);
}
end2 = performance.now();
console.log(`  Time: ${end2 - start2} ms for 2500 insertions`);
console.log(`  Total indexes: ${indexes.length}`);

// Compare with fractional-indexing library directly
console.log("\n✓ Comparing with fractional-indexing library...");
const below = generateKeyBetween(null, null);
const above = generateKeyBetween(below, null);
if (below.localeCompare(above) >= 0) {
    throw new Error("❌ Order error in fractional-indexing");
}
console.log("  ✓ Library order check passed");

// Verify Indexer.above() ordering
const indexBelow = Indexer.above();
const indexAbove = Indexer.above(indexBelow);
if (Indexer.compare(indexBelow, indexAbove) >= 0) {
    throw new Error("❌ Order error in Indexer.above()");
}
console.log("  ✓ Indexer.above() order check passed");

console.log("\n✓ All Indexer tests passed!");
console.log(`  Longest index length: ${Indexer.getLongestIndexLength()} characters`);

// Sample of generated indexes (first 10)
console.log("\n✓ Sample of first 10 index values:");
for (let i = 0; i < Math.min(10, indexes.length); i++) {
    console.log(`  ${indexes[i]} → ${Indexer.getIndex(indexes[i])}`);
}

/**
 * ═══════════════════════════════════════════════════════════════════════════
 * ACTION SYSTEM EXAMPLES (PROPOSED FUTURE IMPLEMENTATION)
 * ═══════════════════════════════════════════════════════════════════════════
 */

// Note: These are conceptual examples for the proposed Action system.
// They are not currently implemented and would need to be integrated.

/*
// Define action methods
const saveActionMethod = (tableAPIs: CellTableAPI, newValue: any) => {
    // Semantic high-level operations
    tableAPIs.validate();
    tableAPIs.save(newValue);
    tableAPIs.releaseKeyboard();
    // The beauty is: no manual command construction, just semantic operations
}

// Register actions globally
registerActions({
    "saveAction": saveActionMethod,
    "exitAction": (tableAPIs: CellTableAPI) => {
        tableAPIs.cancel();
        tableAPIs.releaseKeyboard();
        console.log("exit action triggered");
    },
    "deleteAction": (tableAPIs: CellTableAPI) => {
        tableAPIs.validate();
        tableAPIs.delete();
        tableAPIs.releaseKeyboard();
    }
})

// Run an action from cell or plugin
runAction("saveAction", "new value");

// Plugin interception of actions
onBeforeAction(cellId: CellId, actionName: string, apiUsage: [string, any][]): boolean {
    // apiUsage for saveAction would be:
    // [["validate", undefined], ["save", "new value"], ["releaseKeyboard", undefined]]
    
    console.log(`Action ${actionName} on cell ${cellId}`);
    console.log(`Will call APIs:`, apiUsage);
    
    // Can validate, log, or block
    if (actionName === "deleteAction" && !hasDeletePermission(cellId)) {
        return false; // Block deletion
    }
    
    return true; // Allow action
}

// The apiUsage array could be generated by:
// 1. Dry-run execution with a recording proxy
// 2. Static analysis of action method
// 3. Manual annotation by action author
*/
