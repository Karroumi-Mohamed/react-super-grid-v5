# Server Integration Plugins - Architecture Guide

## Question: How do DraftPlugin and RestPlugin interact?

**User's Question:**
> "explain to me how draftPlugin and restPlugin will work, like draft plugin will stop save apis made from cells in rows that are in the draft space, then blocks that api from reaching to other plugins (ex: rest plugin), but how creation request will be sent to server? are we forced to provide config to each plugin about the server end points (config can be passed to plugins in the new ExamplePlugin(config: ExamplePluginConfig) something like that??"

## Answer: Multiple Approaches to Plugin Isolation

There are **multiple ways** to prevent DraftPlugin from triggering server saves in RestPlugin. Each approach has different trade-offs in terms of coupling, complexity, and flexibility.

### Overview of Approaches

1. **Space-Based Filtering** (Recommended) - RestPlugin checks spaceId
2. **Explicit API Blocking** - DraftPlugin blocks save() API from executing
3. **Dependency-Based Filtering** - RestPlugin queries DraftPlugin
4. **Command-Based Communication** - Plugins communicate via commands

Let's explore each approach in detail.

---

## Approach 1: Space-Based Filtering (Recommended)

### The Core Pattern: Space Isolation

The key insight is that **DraftPlugin doesn't need to block RestPlugin** - instead, **RestPlugin should only handle rows in table-space**, not plugin spaces. This leverages the architecture's space isolation principle.

### How It Works

#### 1. DraftPlugin Creates Rows in Its Own Space

```typescript
export class DraftPlugin extends BasePlugin {
    readonly name = 'draft-plugin';
    private draftRowIds: Set<RowId> = new Set();

    private handleAddRow(): void {
        const draftData = { name: '', age: 0, email: '' };

        // Add to draft-plugin's space, NOT table-space
        const rowId = this.tableAPIs.createRow(draftData, 'top', true);
        this.draftRowIds.add(rowId);
    }
}
```

**Result**: Rows exist in `draft-plugin Space`, isolated from table-space.

#### 2. RestPlugin Only Handles Table-Space Rows

```typescript
export class RestPlugin extends BasePlugin {
    readonly name = 'rest-plugin';
    private config: RestPluginConfig;

    constructor(config: RestPluginConfig) {
        super();
        this.config = config;
    }

    onBeforeAction(cellId: CellId, actionName: string, apiUsage: APIUsage): boolean | void {
        if (actionName !== 'saveAction') return true;

        // Get the row that owns this cell
        const cell = this.tableAPIs.getCellRegistry().get(cellId);
        if (!cell) return true;

        const row = this.tableAPIs.getRowRegistry().get(cell.rowId);
        if (!row) return true;

        // CRITICAL: Only handle table-space rows
        if (row.spaceId !== 'table-space') {
            return true; // Ignore cells from plugin spaces
        }

        // This row is in table-space, send to server
        apiUsage.on('save', async (value: any) => {
            await fetch(`${this.config.apiBaseUrl}/rows/${cell.rowId}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    columnKey: this.getCellColumnKey(cellId),
                    value: value
                })
            });
            return true;
        });

        return true;
    }
}
```

**Result**:
- Cells in draft-plugin space → RestPlugin ignores them (no server save)
- Cells in table-space → RestPlugin sends PATCH to server

#### 3. Plugin Configuration Pattern

Plugins receive configuration via constructor:

```typescript
// types.ts or RestPlugin.ts
export interface RestPluginConfig {
    apiBaseUrl: string;
    endpoints?: {
        create?: string;
        update?: string;
        delete?: string;
    };
}

// App.tsx
const restPlugin = new RestPlugin({
    apiBaseUrl: 'https://api.example.com',
    endpoints: {
        create: '/rows',
        update: '/rows/:id',
        delete: '/rows/:id'
    }
});

<SuperGrid
    data={data}
    config={config}
    plugins={[focusPlugin, editPlugin, restPlugin, draftPlugin]}
/>
```

### The Complete Flow: Draft → Server

#### Step 1: User Creates Draft Row

```typescript
// DraftPlugin
private handleAddRow(): void {
    const emptyData = { name: '', age: 0, email: '' };
    const rowId = this.tableAPIs.createRow(emptyData, 'top', true);
    this.draftRowIds.add(rowId);

    // Show "Save" button
    if (!this.saveButtonId) {
        this.saveButtonId = this.tableAPIs.addButton(
            'Save Drafts',
            () => this.handleSaveDrafts(),
            'right',
            'standout'
        );
    }
}
```

**State**: Row exists in draft-plugin space. User can edit cells.

#### Step 2: User Edits Draft Cells

When user edits a cell in draft space:
- TextCell triggers `saveAction`
- Action system calls `onBeforeAction` on all plugins
- **RestPlugin checks spaceId** → sees it's NOT table-space → ignores it
- **No server request sent**

Draft changes stay local.

#### Step 3: User Clicks "Save Drafts"

**Why this approach works:**
- ✅ Leverages existing space isolation architecture
- ✅ No coupling between DraftPlugin and RestPlugin
- ✅ RestPlugin doesn't need to know about DraftPlugin
- ✅ Simple spaceId check - minimal code

**Trade-offs:**
- Requires RestPlugin to understand space semantics
- Every persistence plugin needs to implement the same filter

Two sub-patterns for committing drafts to server:

##### Approach A: Direct API Call (Simpler)

```typescript
// DraftPlugin
private async handleSaveDrafts(): Promise<void> {
    const draftRows = Array.from(this.draftRowIds).map(rowId =>
        this.tableAPIs.getRowRegistry().get(rowId)
    );

    // Send all drafts to server
    const responses = await Promise.all(
        draftRows.map(row =>
            fetch(`${this.restConfig.apiBaseUrl}/rows`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(row.data)
            }).then(res => res.json())
        )
    );

    // Move rows from draft space to table-space
    responses.forEach((serverRow, index) => {
        const draftRowId = Array.from(this.draftRowIds)[index];

        // Delete from draft space
        this.tableAPIs.deleteRow(draftRowId);

        // Create in table-space with server ID
        this.tableAPIs.createRowInTableSpace(serverRow, 'top', false);
    });

    // Single render after all moves
    this.tableAPIs.renderTableSpace();

    // Clear drafts
    this.draftRowIds.clear();
    if (this.saveButtonId) {
        this.tableAPIs.removeButton(this.saveButtonId);
        this.saveButtonId = null;
    }
}
```

**Configuration**: DraftPlugin needs RestPlugin's config:

```typescript
// App.tsx
const restConfig = {
    apiBaseUrl: 'https://api.example.com'
};

const restPlugin = new RestPlugin(restConfig);
const draftPlugin = new DraftPlugin(restConfig); // Pass same config

<SuperGrid plugins={[restPlugin, draftPlugin]} />
```

##### Approach B: Command-Based (More Decoupled)

DraftPlugin dispatches a command that RestPlugin intercepts:

```typescript
// types.ts - Add new command type
type TableCommand =
    | { name: 'commitDraft'; payload: { rowData: any } }
    | { name: 'deleteDraft'; payload: { rowId: RowId } };

// DraftPlugin
private async handleSaveDrafts(): Promise<void> {
    const draftRows = Array.from(this.draftRowIds).map(rowId =>
        this.tableAPIs.getRowRegistry().get(rowId)
    );

    // Dispatch commands for each draft
    for (const row of draftRows) {
        // Dispatch "commitDraft" command
        // RestPlugin will intercept and handle server save
        this.tableAPIs.dispatchTableCommand({
            name: 'commitDraft',
            payload: { rowData: row.data }
        });
    }

    // Clean up drafts
    this.draftRowIds.forEach(id => this.tableAPIs.deleteRow(id));
    this.draftRowIds.clear();
}

// RestPlugin - Intercept commit commands
onTableCommand(command: TableCommand): void {
    if (command.name === 'commitDraft') {
        const { rowData } = command.payload;

        // Send to server
        fetch(`${this.config.apiBaseUrl}/rows`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(rowData)
        })
        .then(res => res.json())
        .then(serverRow => {
            // Create in table-space with server-assigned ID
            this.tableAPIs.createRowInTableSpace(serverRow, 'top', true);
        });
    }
}
```

**Benefits**:
- DraftPlugin doesn't need RestPlugin's config
- DraftPlugin doesn't know about server implementation
- RestPlugin owns all server communication
- Can swap RestPlugin for MockRestPlugin without changing DraftPlugin

### Which Approach to Use?

**Use Approach A (Direct API Call) when:**
- Simple CRUD operations
- Single backend service
- DraftPlugin and RestPlugin are tightly related
- You want synchronous behavior (await server response)

**Use Approach B (Command-Based) when:**
- Multiple plugins need to react to commits (e.g., LoggingPlugin, CachePlugin)
- You want to mock server in tests (MockRestPlugin)
- DraftPlugin should work without RestPlugin
- You want async, fire-and-forget behavior

### Key Architectural Principles

1. **Space Isolation**: Plugin spaces are isolated from table-space
   - DraftPlugin uses its own space
   - RestPlugin filters by spaceId
   - No explicit blocking needed

2. **Configuration via Constructor**: Plugins receive config as constructor parameter
   ```typescript
   new RestPlugin({ apiBaseUrl: '...' })
   new DraftPlugin({ restConfig: '...' })
   ```

3. **Space-Based Filtering**: Plugins check `row.spaceId` to determine behavior
   ```typescript
   if (row.spaceId !== 'table-space') return true; // Ignore
   ```

4. **Batch Operations**: Use `render: false` flag for bulk operations
   ```typescript
   drafts.forEach(d => createRowInTableSpace(d, 'top', false));
   renderTableSpace(); // Single render
   ```

5. **Plugin Independence**: Plugins don't directly reference each other
   - Communication via commands (decoupled)
   - OR shared config (simple)

### Complete Example: RestPlugin + DraftPlugin

```typescript
// RestPlugin.ts
export interface RestPluginConfig {
    apiBaseUrl: string;
}

export class RestPlugin extends BasePlugin {
    readonly name = 'rest-plugin';
    private config: RestPluginConfig;

    constructor(config: RestPluginConfig) {
        super();
        this.config = config;
    }

    onBeforeAction(cellId: CellId, actionName: string, apiUsage: APIUsage): boolean | void {
        if (actionName !== 'saveAction') return true;

        const cell = this.tableAPIs.getCellRegistry().get(cellId);
        if (!cell) return true;

        const row = this.tableAPIs.getRowRegistry().get(cell.rowId);
        if (!row || row.spaceId !== 'table-space') return true;

        // Only table-space rows get saved to server
        apiUsage.on('save', async (value: any) => {
            await fetch(`${this.config.apiBaseUrl}/rows/${cell.rowId}`, {
                method: 'PATCH',
                body: JSON.stringify({ value })
            });
            return true;
        });

        return true;
    }
}

// DraftPlugin.ts
export class DraftPlugin extends BasePlugin {
    readonly name = 'draft-plugin';
    private draftRowIds: Set<RowId> = new Set();
    private restConfig: RestPluginConfig;
    private saveButtonId: ButtonId | null = null;

    constructor(restConfig: RestPluginConfig) {
        super();
        this.restConfig = restConfig;
    }

    onInit(): void {
        this.tableAPIs.addButton('+ Add Draft', () => this.handleAddRow(), 'right');
    }

    private handleAddRow(): void {
        const emptyRow = { name: '', age: 0, email: '' };
        const rowId = this.tableAPIs.createRow(emptyRow, 'top', true);
        this.draftRowIds.add(rowId);

        // Show save button when drafts exist
        if (!this.saveButtonId) {
            this.saveButtonId = this.tableAPIs.addButton(
                'Save Drafts',
                () => this.handleSaveDrafts(),
                'right',
                'standout'
            );
        }
    }

    private async handleSaveDrafts(): Promise<void> {
        const draftRows = Array.from(this.draftRowIds)
            .map(id => this.tableAPIs.getRowRegistry().get(id))
            .filter(row => row !== undefined);

        // Send to server
        const serverRows = await Promise.all(
            draftRows.map(row =>
                fetch(`${this.restConfig.apiBaseUrl}/rows`, {
                    method: 'POST',
                    body: JSON.stringify(row.data)
                }).then(res => res.json())
            )
        );

        // Move from draft space to table-space (no renders)
        this.draftRowIds.forEach(id => this.tableAPIs.deleteRow(id));
        serverRows.forEach(row =>
            this.tableAPIs.createRowInTableSpace(row, 'top', false)
        );

        // Single render
        this.tableAPIs.renderTableSpace();

        // Cleanup
        this.draftRowIds.clear();
        if (this.saveButtonId) {
            this.tableAPIs.removeButton(this.saveButtonId);
            this.saveButtonId = null;
        }
    }
}

// App.tsx
const restConfig = { apiBaseUrl: 'https://api.example.com' };
const restPlugin = new RestPlugin(restConfig);
const draftPlugin = new DraftPlugin(restConfig);

<SuperGrid plugins={[focusPlugin, editPlugin, restPlugin, draftPlugin]} />
```

---

## Approach 2: Explicit API Blocking

### The Pattern: Block save() API Execution

In this approach, **DraftPlugin intercepts the saveAction** and explicitly **blocks the save() API** from executing. This prevents RestPlugin's save handler from having any effect.

### How It Works

#### 1. DraftPlugin Blocks save() API

```typescript
export class DraftPlugin extends BasePlugin {
    readonly name = 'draft-plugin';
    private draftRowIds: Set<RowId> = new Set();
    private draftChanges = new Map<CellId, any>(); // Store changes locally

    onBeforeAction(cellId: CellId, actionName: string, apiUsage: APIUsage): boolean | void {
        if (actionName !== 'saveAction') return true;

        // Check if this cell belongs to a draft row
        const cell = this.tableAPIs.getCellRegistry().get(cellId);
        if (!cell) return true;

        const row = this.tableAPIs.getRowRegistry().get(cell.rowId);
        if (!row) return true;

        // Is this row in our draft space?
        if (row.spaceId === this.getMySpace()) {
            // Intercept and BLOCK the save API
            apiUsage.on('save', (value: any) => {
                console.log('📝 Draft: Blocking save API, storing locally');

                // Store value in local draft state
                this.draftChanges.set(cellId, value);

                return false; // ← BLOCKS save() from executing
            });

            // Allow action to continue to other plugins
            return true;
        }

        return true;
    }
}
```

#### 2. RestPlugin Tries to Execute, But Fails

```typescript
export class RestPlugin extends BasePlugin {
    readonly name = 'rest-plugin';

    onBeforeAction(cellId: CellId, actionName: string, apiUsage: APIUsage): boolean | void {
        if (actionName !== 'saveAction') return true;

        // RestPlugin registers its save handler
        apiUsage.on('save', async (value: any) => {
            console.log('🌐 RestPlugin: Sending to server');

            await fetch(`${this.config.apiBaseUrl}/cells/${cellId}`, {
                method: 'PATCH',
                body: JSON.stringify({ value })
            });

            return true;
        });

        return true;
    }
}
```

**What happens when user edits draft cell:**
1. Cell dispatches `saveAction`
2. Action system calls `onBeforeAction` on all plugins
3. **DraftPlugin** intercepts first, registers `save` listener that returns `false`
4. **RestPlugin** also registers `save` listener
5. Action system executes the action: `api.save(value)`
6. **DraftPlugin's listener executes first** → returns `false` → **BLOCKS**
7. **RestPlugin's listener is registered but save() never completes**
8. Value stored in DraftPlugin's local state, not sent to server

**Why this works:**
- ✅ Explicit control over API execution
- ✅ DraftPlugin owns the blocking logic
- ✅ Works even if RestPlugin doesn't know about spaces

**Trade-offs:**
- ❌ More complex - requires understanding API blocking semantics
- ❌ Plugin order matters (DraftPlugin must intercept before RestPlugin)
- ❌ RestPlugin's listener still runs (but has no effect)

#### 3. Committing Drafts

When user clicks "Save Drafts", DraftPlugin applies the local changes to the actual cells before sending to server:

```typescript
// DraftPlugin
private async handleSaveDrafts(): Promise<void> {
    // Apply all draft changes to cells
    this.draftChanges.forEach((value, cellId) => {
        // Update the cell's actual value
        this.tableAPIs.sendCellCommand(cellId, {
            name: 'updateValue',
            payload: { value }
        });
    });

    // Get draft rows
    const draftRows = Array.from(this.draftRowIds)
        .map(id => this.tableAPIs.getRowRegistry().get(id))
        .filter(row => row !== undefined);

    // Send to server
    const serverRows = await Promise.all(
        draftRows.map(row =>
            fetch(`${this.restConfig.apiBaseUrl}/rows`, {
                method: 'POST',
                body: JSON.stringify(row.data)
            }).then(res => res.json())
        )
    );

    // Move to table-space
    this.draftRowIds.forEach(id => this.tableAPIs.deleteRow(id));
    serverRows.forEach(row =>
        this.tableAPIs.createRowInTableSpace(row, 'top', false)
    );

    this.tableAPIs.renderTableSpace();

    // Clear local state
    this.draftChanges.clear();
    this.draftRowIds.clear();
}
```

---

## Approach 3: Dependency-Based Filtering

### The Pattern: RestPlugin Queries DraftPlugin

RestPlugin explicitly depends on DraftPlugin and asks "is this a draft?" before handling saves.

### How It Works

```typescript
// RestPlugin.ts
export class RestPlugin extends BasePlugin {
    readonly name = 'rest-plugin';
    readonly dependencies = ['draft-plugin']; // Explicit dependency
    private draftPlugin: DraftPlugin | null = null;

    onInit(): void {
        // Get reference to DraftPlugin
        this.draftPlugin = this.getPlugin<DraftPlugin>('draft-plugin');
    }

    onBeforeAction(cellId: CellId, actionName: string, apiUsage: APIUsage): boolean | void {
        if (actionName !== 'saveAction') return true;

        // Ask DraftPlugin if this is a draft cell
        if (this.draftPlugin?.isDraft(cellId)) {
            // It's a draft - don't send to server
            return true; // Allow action but don't register listener
        }

        // Not a draft - send to server
        apiUsage.on('save', async (value: any) => {
            await this.sendToServer(cellId, value);
        });

        return true;
    }
}

// DraftPlugin.ts
export class DraftPlugin extends BasePlugin {
    // Expose public helper method
    isDraft(cellId: CellId): boolean {
        const cell = this.tableAPIs.getCellRegistry().get(cellId);
        if (!cell) return false;

        const row = this.tableAPIs.getRowRegistry().get(cell.rowId);
        return row?.spaceId === this.getMySpace();
    }
}
```

**Why this works:**
- ✅ Explicit relationship - RestPlugin depends on DraftPlugin
- ✅ No space semantics needed in RestPlugin
- ✅ Clear API - `isDraft()` method

**Trade-offs:**
- ❌ Tight coupling - RestPlugin can't work without DraftPlugin
- ❌ Requires dependency system to be implemented
- ❌ Every persistence plugin needs to know about draft concept

---

## Approach 4: Command-Based Communication

### The Pattern: Plugins Communicate via Commands

Instead of direct interception, plugins dispatch commands that other plugins handle.

### How It Works

```typescript
// types.ts - Define new command types
type TableCommand =
    | { name: 'commitDraft'; payload: { rowData: any } }
    | { name: 'bulkCreate'; payload: { rows: any[] } };

// DraftPlugin - Dispatches command
export class DraftPlugin extends BasePlugin {
    private async handleSaveDrafts(): Promise<void> {
        const draftRows = Array.from(this.draftRowIds)
            .map(id => this.tableAPIs.getRowRegistry().get(id))
            .filter(row => row !== undefined);

        // Dispatch command for bulk create
        this.tableAPIs.dispatchTableCommand({
            name: 'bulkCreate',
            payload: { rows: draftRows.map(r => r.data) }
        });

        // Clean up draft space
        this.draftRowIds.forEach(id => this.tableAPIs.deleteRow(id));
        this.draftRowIds.clear();
    }
}

// RestPlugin - Intercepts command
export class RestPlugin extends BasePlugin {
    onTableCommand(command: TableCommand): boolean | void {
        if (command.name === 'bulkCreate') {
            const { rows } = command.payload;

            // Send to server
            fetch(`${this.config.apiBaseUrl}/rows/bulk`, {
                method: 'POST',
                body: JSON.stringify({ rows })
            })
            .then(res => res.json())
            .then(serverRows => {
                // Add to table-space
                serverRows.forEach((row: any) => {
                    this.tableAPIs.createRowInTableSpace(row, 'top', false);
                });
                this.tableAPIs.renderTableSpace();

                // Notify success
                this.tableAPIs.dispatchTableCommand({
                    name: 'draftsCommitted',
                    payload: {}
                });
            });

            return false; // Block - we're handling it
        }
    }
}

// DraftPlugin listens for success
export class DraftPlugin extends BasePlugin {
    onTableCommand(command: TableCommand): boolean | void {
        if (command.name === 'draftsCommitted') {
            // Server saved successfully
            this.clearDraftUI();
        }
    }
}
```

**Why this works:**
- ✅ Complete decoupling - plugins don't reference each other
- ✅ Multiple plugins can react to same command
- ✅ Easy to mock RestPlugin in tests
- ✅ Follows command pattern architecture

**Trade-offs:**
- ❌ More complex - requires command system implementation
- ❌ Async communication - harder to handle errors
- ❌ Less explicit flow - commands travel through system

---

## Comparison: Which Approach to Use?

| Approach | Coupling | Complexity | Flexibility | Best For |
|----------|----------|------------|-------------|----------|
| **Space-Based Filtering** | Low | Low | Medium | Simple apps, single persistence plugin |
| **Explicit API Blocking** | Medium | Medium | Low | When DraftPlugin needs full control |
| **Dependency-Based** | High | Low | Low | Small apps, tight integration needed |
| **Command-Based** | None | High | High | Large apps, multiple plugins, testing |

### Recommendations

**Use Space-Based Filtering (Approach 1) when:**
- You have a simple app with 1-2 persistence plugins
- You want minimal code complexity
- Space isolation is already part of your architecture
- **This is the recommended default**

**Use Explicit API Blocking (Approach 2) when:**
- DraftPlugin needs to store changes locally before commit
- You need fine-grained control over what gets blocked
- Plugin order is already important in your system

**Use Dependency-Based Filtering (Approach 3) when:**
- You have a small app with tight plugin relationships
- You want explicit, clear dependencies
- Your dependency resolution system is robust

**Use Command-Based Communication (Approach 4) when:**
- You're building a large, extensible system
- Multiple plugins need to react to draft commits (logging, caching, etc.)
- You want to easily swap persistence implementations
- Testing and mocking are important

---

## Configuration Pattern (All Approaches)

All approaches use the **constructor configuration pattern**:

```typescript
// Define config interface
export interface RestPluginConfig {
    apiBaseUrl: string;
    endpoints?: {
        create?: string;
        update?: string;
        delete?: string;
    };
}

// Plugin receives config via constructor
export class RestPlugin extends BasePlugin {
    constructor(private config: RestPluginConfig) {
        super();
    }
}

// App configures plugins
const restConfig = { apiBaseUrl: 'https://api.example.com' };
const restPlugin = new RestPlugin(restConfig);
const draftPlugin = new DraftPlugin(restConfig); // Can share config if needed

<SuperGrid plugins={[restPlugin, draftPlugin]} />
```

---

## Summary

- **Multiple approaches exist** - choose based on your needs
- **Space-Based Filtering** is recommended for most cases
- **Explicit API Blocking** gives fine-grained control
- **Dependency-Based Filtering** makes relationships explicit
- **Command-Based Communication** enables maximum flexibility
- **Configuration** passed via constructor in all approaches
- **Commit flow**: Draft space → Server → Table-space
- **Rendering**: Use `render: false` for bulk operations, single render at end
