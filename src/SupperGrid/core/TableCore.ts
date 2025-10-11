import type {
    CellCommand,
    CellCommandInput,
    RowCommand,
    SpaceCommand,
    CellId,
    RowId,
    SpaceId,
    CellCommandHandeler,
    RowCommandMap,
    TableRowAPI,
    CellTableAPIs,
    ActionMap,
    ButtonId,
    ButtonVariant,
    ButtonPosition,
    WindowConfig,
} from './types';
import type { TablePluginAPIs, RowPluginAPIs, RowTableAPIs, VerticalComparison } from './BasePlugin';
import { CellCommandRegistry, RowCommandRegistry, SpaceCommandRegistry } from './CommandRegistry';
import { ActionRegistry } from './ActionRegistry';
import { ToolbarRegistry } from './ToolbarRegistry';
import { PluginManager } from './PluginManager';
import type { BasePlugin } from './BasePlugin';
import { CellRegistry, RowRegistry, SpaceRegistry } from './Registries';
import { CellCoordinator } from './CellCordinator';
import { SpaceCoordinator } from './SpaceCoordinator';
import { Indexer } from './Indexer';

// Global initialization state to handle React StrictMode
let globalPluginInitialized = false;

export class TableCore {
    private cellCommandRegistry: CellCommandRegistry;
    private rowCommandRegistry: RowCommandRegistry;
    private spaceCommandRegistry: SpaceCommandRegistry;
    private actionRegistry: ActionRegistry;
    private toolbarRegistry: ToolbarRegistry;
    private pluginManager: PluginManager;
    private cellRegistry: CellRegistry;
    private rowRegistry: RowRegistry<any>;
    private spaceRegistry: SpaceRegistry;
    private cellCoordinator: CellCoordinator;
    private spaceCoordinator: SpaceCoordinator;
    private pluginsInitialized = false;
    private pluginSpaceIds: Map<string, SpaceId> = new Map(); // Track plugin space IDs
    private keyboardOwnerRef: React.MutableRefObject<CellId | null> | null = null;
    private toolbarChangeCallback: (() => void) | null = null;
    private windowChangeCallback: (() => void) | null = null;
    private activeWindowId: ButtonId | null = null;

    constructor() {
        this.cellCommandRegistry = new CellCommandRegistry();
        this.rowCommandRegistry = new RowCommandRegistry();
        this.spaceCommandRegistry = new SpaceCommandRegistry();
        this.actionRegistry = new ActionRegistry();
        this.toolbarRegistry = new ToolbarRegistry();
        this.pluginManager = new PluginManager();
        this.cellRegistry = new CellRegistry();
        this.rowRegistry = new RowRegistry();
        this.spaceRegistry = new SpaceRegistry();
        this.cellCoordinator = new CellCoordinator(this.cellRegistry, this.rowRegistry);
        this.spaceCoordinator = new SpaceCoordinator(this.spaceRegistry);

        // Set up action registry with real API factory
        this.actionRegistry.setRealAPIsFactory((cellId: CellId) => this.createRealCellTableAPIs(cellId));
    }

    // Factory for plugin-specific APIs with bound context
    createPluginAPI(pluginName: string): TablePluginAPIs {
        return {
            createCellCommand: (targetId: CellId, command: CellCommandInput) => {
                // Context automatically injected via closure
                const contextCommand: CellCommand = {
                    ...command,
                    targetId,
                    originPlugin: pluginName,
                    timestamp: command.timestamp || Date.now()
                };
                this.cellCommandRegistry.dispatch(contextCommand);
            },

            createRowCommand: <K extends keyof RowCommandMap>(
                targetId: RowId,
                command: RowCommand<K>
            ) => {
                const contextCommand: RowCommand<K> = {
                    ...command,
                    targetId,
                    originPlugin: pluginName,
                    timestamp: command.timestamp || Date.now()
                };
                this.rowCommandRegistry.dispatch(contextCommand);
            },

            createRow: (rowData: any, position?: 'top' | 'bottom', render?: boolean) => {

                // Smart detection: find space owned by this plugin
                const allSpaceIds = this.spaceRegistry.list();
                let pluginSpaceId: SpaceId | null = null;

                for (const spaceId of allSpaceIds) {
                    const space = this.spaceRegistry.get(spaceId);
                    if (space && space.owner === pluginName) {
                        pluginSpaceId = spaceId;
                        break;
                    }
                }

                if (!pluginSpaceId) {
                    console.error(`❌ Plugin ${pluginName} tried to create row but has no space`);
                    return;
                }


                const spaceCommand: SpaceCommand<'addRow'> = {
                    name: 'addRow',
                    payload: {
                        rowData,
                        position: position || 'top', // Default to top if not specified
                        render: render || false // Default to false - no auto re-render
                    },
                    targetId: pluginSpaceId,
                    originPlugin: pluginName,
                    timestamp: Date.now()
                };

                this.spaceCommandRegistry.dispatch(spaceCommand);
            },

            createRowInTableSpace: (rowData: any, position?: 'top' | 'bottom', render?: boolean) => {
                // Create row directly in table space
                const tableSpaceId = 'table-space';

                const spaceCommand: SpaceCommand<'addRow'> = {
                    name: 'addRow',
                    payload: {
                        rowData,
                        position: position || 'top', // Default to top if not specified
                        render: render || false // Default to false - no auto re-render
                    },
                    targetId: tableSpaceId,
                    originPlugin: pluginName,
                    timestamp: Date.now()
                };

                this.spaceCommandRegistry.dispatch(spaceCommand);
            },

            getCell: (cellId: CellId) => {
                // Access spatial coordinates of the cell
                return this.cellRegistry.get(cellId);
            },

            getRow: (rowId: RowId) => {
                // Access row object with cells array and spatial data
                return this.rowRegistry.get(rowId);
            },

            getCellRegistry: () => {
                return this.cellRegistry;
            },

            getRowRegistry: () => {
                return this.rowRegistry;
            },

            compareVertical: (cellId1: CellId, cellId2: CellId): VerticalComparison => {
                const parseCoords = (cellId: CellId) => {
                    const parts = cellId.split('-');
                    return parts[1] // Keep as string for lexicographic comparison
                };

                const index1 = parseCoords(cellId1);
                const index2 = parseCoords(cellId2);
                const result = Indexer.compare(index1, index2);

                if (result === 0) return null;
                else if (result < 0) return {top:cellId2,bottom:cellId1}
                else return {top:cellId1, bottom:cellId2}

            },

            compareHorizontal: (cellId1: CellId, cellId2: CellId): import('./BasePlugin').HorizontalComparison => {
                // Parse coordinates from cell UUIDs: "colIndex-rowIndexerId-uuid"
                const parseCoords = (cellId: CellId) => {
                    const parts = cellId.split('-');
                    return {
                        col: parseInt(parts[0]),
                        rowIndexerId: parts[1] // This is the Indexer ID (e.g., "IDX_5")
                    };
                };

                const coords1 = parseCoords(cellId1);
                const coords2 = parseCoords(cellId2);

                // Different rows - no horizontal relationship
                if (coords1.rowIndexerId !== coords2.rowIndexerId) return null;

                // Return with left cell first, right cell second
                if (coords1.col < coords2.col) {
                    return { left: cellId1, right: cellId2 };
                } else {
                    return { left: cellId2, right: cellId1 };
                }
            },

            deleteRow: (rowId: RowId) => {
                // Direct access to destroyRow method - plugins can delete rows safely
                this.destroyRow(rowId);
            },

            getRowIds: (): RowId[] => {
                // Get all row IDs from registry
                return this.rowRegistry.list();
            },

            getSpaceAbove: (spaceId: SpaceId) => {
                return this.spaceCoordinator.getSpaceAbove(spaceId);
            },

            getSpaceBelow: (spaceId: SpaceId) => {
                return this.spaceCoordinator.getSpaceBelow(spaceId);
            },

            getSpace: (spaceId: SpaceId) => {
                return this.spaceRegistry.get(spaceId);
            },

            getMySpace: () => {
                // Return this plugin's space ID from the registry
                const spaceId = this.pluginSpaceIds.get(pluginName);
                if (!spaceId) {
                    console.error(`❌ No space found for plugin ${pluginName}`);
                    return 'unknown-space';
                }
                return spaceId;
            },

            renderSpace: (spaceId: SpaceId) => {
                // Send render command to specific space
                const renderCommand: SpaceCommand<'render'> = {
                    name: 'render',
                    payload: {},
                    targetId: spaceId,
                    originPlugin: pluginName,
                    timestamp: Date.now()
                };
                this.spaceCommandRegistry.dispatch(renderCommand);
            },

            renderTableSpace: () => {
                // Send render command to table space
                const renderCommand: SpaceCommand<'render'> = {
                    name: 'render',
                    payload: {},
                    targetId: 'table-space',
                    originPlugin: pluginName,
                    timestamp: Date.now()
                };
                this.spaceCommandRegistry.dispatch(renderCommand);
            },
            scrollToCell: (cellId: CellId) => {
                // Find the DOM element with data-cell-id attribute
                const cellElement = document.querySelector(`[data-cell-id="${cellId}"]`);
                if (cellElement) {
                    cellElement.scrollIntoView({
                        behavior: 'smooth',
                        block: 'nearest',   // Don't scroll if already visible
                        inline: 'nearest'   // Don't scroll horizontally if already visible
                    });
                } else {
                    console.warn(`scrollToCell: Could not find DOM element for cell ${cellId}`);
                }
            },

            runAction: (cellId: CellId, actionName: string, payload?: any) => {
                // Context automatically injected via closure
                this.actionRegistry.execute(cellId, actionName, payload, pluginName);
            },

            getKeyboardOwner: () => {
                return this.getKeyboardOwner();
            },

            addButton: (label: string, callback: () => void, position: ButtonPosition = 'left', variant: ButtonVariant = 'normal', windowConfig?: WindowConfig) => {
                const buttonId = this.toolbarRegistry.register(label, callback, position, variant, windowConfig);
                // Notify toolbar to re-render
                this.notifyToolbarChange();
                return buttonId;
            },

            removeButton: (buttonId: ButtonId): boolean => {
                const removed = this.toolbarRegistry.unregister(buttonId);
                if (removed) {
                    // Notify toolbar to re-render
                    this.notifyToolbarChange();
                }
                return removed;
            }
        };
    }

    // Factory for row-specific APIs with bound context
    createRowAPI(rowId: RowId, spaceId?: SpaceId): TableRowAPI {
        return {
            registerCellCommands: (cellId: CellId, handler: CellCommandHandeler) => {
                // Context: this call is from rowId (captured in closure)
                this.cellCommandRegistry.register(cellId, handler);
            },

            registerCell: (cellId: CellId, cell: import('./types').Cell) => {
                // Register cell object in spatial registry
                this.cellRegistry.register(cellId, cell);
            },

            addCellToRow: (cellId: CellId) => {
                // Add cell to row's cells array in row registry
                const row = this.rowRegistry.get(rowId);
                if (row) {
                    if (!row.cells.includes(cellId)) {
                        row.cells.push(cellId);
                        this.rowRegistry.register(rowId, row);
                    }
                } else {
                    console.warn(`Row ${rowId} not found in registry when trying to add cell ${cellId}`);
                }
            },

            sendMouseEvent: (cellId: CellId, eventName: string, event: MouseEvent) => {
                // Convert DOM event to command and dispatch with space context
                this.convertMouseEventToCommand(cellId, eventName, event, spaceId);
            },

            getCellCoordinator: () => {
                // Provide access to spatial coordination methods
                return this.cellCoordinator;
            },

            registerRowHandler: (handler: import('./types').RowCommandHandler) => {
                // Register row command handler for this specific row
                this.rowCommandRegistry.register(rowId, handler);
            },

            unregisterRowHandler: () => {
                // Unregister row command handler
                this.rowCommandRegistry.unregister(rowId);
            },

            getRow: (id: RowId) => {
                return this.rowRegistry.get(id);
            },
            getCell: (id: CellId) => {
                return this.cellRegistry.get(id);
            },
            getCellActionAPIs: (cellId: CellId) => {
                return this.createCellActionAPIs(cellId);
            },
            updateRowData: (targetRowId: RowId, newData: any) => {
                const row = this.rowRegistry.get(targetRowId);
                if (row) {
                    row.data = newData;
                    this.rowRegistry.register(targetRowId, row);
                } else {
                    console.warn(`updateRowData: Row ${targetRowId} not found in registry`);
                }
            }
        };
    }

    // Factory for cell-specific action APIs with bound context
    createCellActionAPIs(cellId: CellId) {
        return {
            registerActions: (actionMap: ActionMap) => {
                // cellId captured in closure
                this.actionRegistry.register(cellId, actionMap);
            },
            runAction: (actionName: string, payload?: any) => {
                // cellId captured in closure, no originPlugin (triggered by cell)
                this.actionRegistry.execute(cellId, actionName, payload);
            }
        };
    }

    // Create real CellTableAPIs implementation
    private createRealCellTableAPIs(cellId: CellId): CellTableAPIs {
        return {
            save: (value: any) => {
                // Dispatch updateValue command - plugins can intercept/validate
                this.dispatchCellCommand({
                    name: 'updateValue',
                    targetId: cellId,
                    payload: { value },
                    timestamp: Date.now()
                });
            },

            deleteRow: () => {
                const cell = this.cellRegistry.get(cellId);
                if (cell) {
                    this.destroyRow(cell.rowId);
                }
            },

            navigate: (direction: 'up' | 'down' | 'left' | 'right') => {
                const cell = this.cellRegistry.get(cellId);
                if (!cell) return;

                let targetCellId: CellId | null = null;
                switch (direction) {
                    case 'up':
                        targetCellId = cell.top;
                        break;
                    case 'down':
                        targetCellId = cell.bottom;
                        break;
                    case 'left':
                        targetCellId = cell.left;
                        break;
                    case 'right':
                        targetCellId = cell.right;
                        break;
                }

                if (targetCellId) {
                    this.focusCell(targetCellId);
                }
            },

            releaseKeyboard: () => {
                // Release keyboard ownership
                if (this.keyboardOwnerRef) {
                    this.keyboardOwnerRef.current = null;
                }
            },

            requestKeyboard: () => {
                // Claim keyboard ownership
                if (this.keyboardOwnerRef) {
                    this.keyboardOwnerRef.current = cellId;
                }
            },

            validate: (): boolean => {
                // Placeholder - could trigger validation command
                return true;
            },

            blur: () => {
                this.blurCell(cellId);
            },

            focus: () => {
                this.focusCell(cellId);
            }
        };
    }

    // Plugin management
    addPlugin(plugin: BasePlugin): void {
        this.pluginManager.addPlugin(plugin);
    }

    removePlugin(pluginName: string): void {
        this.pluginManager.removePlugin(pluginName);
    }

    // Initialize all plugins with their context-aware APIs
    initializePlugins(): void {
        // ALWAYS: Resolve plugin dependencies and set up spaces/APIs for this TableCore instance
        this.pluginManager.resolvePluginDependencies();
        const orderedPlugins = this.pluginManager.getPluginsInOrder();

        // Create spaces and set APIs for all plugins (needed for each TableCore)
        for (const plugin of orderedPlugins) {
            // Create a space for this plugin (if not already created)
            this.spaceCoordinator.createPluginSpace(plugin.name);

            // Create context-aware APIs for this specific plugin
            const tableAPI = this.createPluginAPI(plugin.name);
            const rowAPI: RowPluginAPIs = {} as RowPluginAPIs;
            const rowTableAPI: RowTableAPIs = {} as RowTableAPIs;

            // Give the plugin its bound APIs
            plugin.setAPIs(tableAPI, rowAPI, rowTableAPI);
        }

        // Connect plugins to command registries (needed for each TableCore)
        const plugins = this.pluginManager.getPlugins();
        this.cellCommandRegistry.setPlugins(plugins);
        this.rowCommandRegistry.setPlugins(plugins);
        this.spaceCommandRegistry.setPlugins(plugins);
        this.actionRegistry.setPlugins(plugins);

        // ONLY ONCE: Initialize plugins globally to prevent duplicate timers
        if (!globalPluginInitialized) {
            globalPluginInitialized = true;
            this.pluginsInitialized = true;
            this.pluginManager.initializePlugins();
        }
    }

    // Check if plugins are already initialized
    arePluginsInitialized(): boolean {
        return this.pluginsInitialized;
    }

    // Cleanup
    destroy(): void {
        if (this.pluginsInitialized) {
            this.pluginManager.destroy();
            this.pluginsInitialized = false;
        }
    }

    // Command dispatching methods
    dispatchCellCommand(command: CellCommand): void {
        this.cellCommandRegistry.dispatch(command);
    }

    dispatchRowCommand<K extends keyof RowCommandMap>(command: RowCommand<K>): void {
        this.rowCommandRegistry.dispatch(command);
    }

    // Dispatch keyboard commands without targetId (plugin-only)
    dispatchKeyboardCommand(eventName: string, event: KeyboardEvent): void {
        // Check keyboard ownership FIRST - if keyboard is borrowed, don't create command
        if (this.getKeyboardOwner() !== null) {
            return; // Keyboard is owned by a cell - allow default browser behavior
        }

        let keyboardCommand: CellCommand;

        switch (eventName) {
            case 'keydown':
                keyboardCommand = {
                    name: 'keydown',
                    // No targetId - this command won't reach any individual cells
                    payload: { event },
                    timestamp: Date.now()
                };
                break;
            case 'keyup':
                keyboardCommand = {
                    name: 'keyup',
                    // No targetId - this command won't reach any individual cells
                    payload: { event },
                    timestamp: Date.now()
                };
                break;
            default:
                console.warn(`Unknown keyboard event: ${eventName}`);
                return;
        }

        // Dispatch to cell command registry - plugins will see it, cells won't
        this.cellCommandRegistry.dispatch(keyboardCommand);
    }

    private convertMouseEventToCommand(cellId: CellId, eventName: string, event: MouseEvent, _spaceId?: SpaceId): void {
        // Log space information
        /* if (spaceId && (eventName === 'mouseenter' || eventName === 'mouseleave')) {
            const space = this.spaceRegistry.get(spaceId);
            const spaceName = space?.name || 'Unknown Space';
            const spaceOwner = space?.owner || 'Unknown Owner';
            console.log("==========");
            console.log(`${eventName} in Space: ${spaceName} (${spaceOwner}) - Cell: ${cellId}`);
            console.log("==========");
        } */

        let command: CellCommand;

        switch (eventName) {
            case 'click':
                command = {
                    name: 'click',
                    targetId: cellId,
                    payload: { event },
                    timestamp: Date.now()
                };
                break;

            case 'dblclick':
                command = {
                    name: 'dblclick',
                    targetId: cellId,
                    payload: { event },
                    timestamp: Date.now()
                };
                break;

            case 'contextmenu':
                command = {
                    name: 'contextmenu',
                    targetId: cellId,
                    payload: { event },
                    timestamp: Date.now()
                };
                break;

            case 'mousedown':
                command = {
                    name: 'mouseDown',
                    targetId: cellId,
                    payload: { event },
                    timestamp: Date.now()
                };
                break;

            case 'mouseup':
                command = {
                    name: 'mouseUp',
                    targetId: cellId,
                    payload: { event },
                    timestamp: Date.now()
                };
                break;

            case 'mouseenter':
                command = {
                    name: 'mouseEnter',
                    targetId: cellId,
                    payload: { event },
                    timestamp: Date.now()
                };
                break;

            case 'mouseleave':
                command = {
                    name: 'mouseLeave',
                    targetId: cellId,
                    payload: { event },
                    timestamp: Date.now()
                };
                break;

            default:
                console.warn(`Unknown mouse event: ${eventName}`);
                return;
        }

        this.dispatchCellCommand(command);
    }

    // Convenience methods for common commands
    focusCell(cellId: CellId): void {
        this.dispatchCellCommand({
            name: 'focus',
            targetId: cellId,
            timestamp: Date.now()
        });
    }

    blurCell(cellId: CellId): void {
        this.dispatchCellCommand({
            name: 'blur',
            targetId: cellId,
            timestamp: Date.now()
        });
    }

    selectCell(cellId: CellId): void {
        this.dispatchCellCommand({
            name: 'select',
            targetId: cellId,
            timestamp: Date.now()
        });
    }

    editCell(cellId: CellId): void {
        this.dispatchCellCommand({
            name: 'edit',
            targetId: cellId,
            timestamp: Date.now()
        });
    }

    updateCellValue(cellId: CellId, value: any): void {
        this.dispatchCellCommand({
            name: 'updateValue',
            targetId: cellId,
            payload: { value },
            timestamp: Date.now()
        });
    }

    // Access to registries for advanced use cases
    getCellCommandRegistry(): CellCommandRegistry {
        return this.cellCommandRegistry;
    }

    getRowCommandRegistry(): RowCommandRegistry {
        return this.rowCommandRegistry;
    }

    getSpaceCommandRegistry(): SpaceCommandRegistry {
        return this.spaceCommandRegistry;
    }

    getRowRegistry(): RowRegistry<any> {
        return this.rowRegistry;
    }

    getCellCoordinator(): CellCoordinator {
        return this.cellCoordinator;
    }

    getSpaceCoordinator(): SpaceCoordinator {
        return this.spaceCoordinator;
    }

    getSpaceRegistry(): SpaceRegistry {
        return this.spaceRegistry;
    }

    getPluginManager(): PluginManager {
        return this.pluginManager;
    }

    // Store plugin space ID for later reference
    setPluginSpaceId(pluginName: string, spaceId: SpaceId): void {
        this.pluginSpaceIds.set(pluginName, spaceId);
    }

    // Set keyboard owner ref from SuperGrid
    setKeyboardOwnerRef(ref: React.MutableRefObject<CellId | null>): void {
        this.keyboardOwnerRef = ref;
    }

    // Get current keyboard owner (for plugins to check)
    getKeyboardOwner(): CellId | null {
        return this.keyboardOwnerRef?.current ?? null;
    }

    // Toolbar management
    setToolbarChangeCallback(callback: () => void): void {
        this.toolbarChangeCallback = callback;
    }

    private notifyToolbarChange(): void {
        if (this.toolbarChangeCallback) {
            this.toolbarChangeCallback();
        }
    }

    getToolbarButtons() {
        return this.toolbarRegistry.getAllButtons();
    }

    // Window management
    setWindowChangeCallback(callback: () => void): void {
        this.windowChangeCallback = callback;
    }

    private notifyWindowChange(): void {
        if (this.windowChangeCallback) {
            this.windowChangeCallback();
        }
    }

    toggleWindow(buttonId: ButtonId): void {
        if (this.activeWindowId === buttonId) {
            // Close if already open
            this.activeWindowId = null;
        } else {
            // Open this window (closes others)
            this.activeWindowId = buttonId;
        }
        this.notifyWindowChange();
    }

    closeWindow(): void {
        this.activeWindowId = null;
        this.notifyWindowChange();
    }

    getActiveWindow(): { buttonId: ButtonId; button: import('./types').ToolbarButton } | null {
        if (!this.activeWindowId) return null;
        const button = this.toolbarRegistry.getAllButtons().find(b => b.id === this.activeWindowId);
        if (!button || !button.window) return null;
        return { buttonId: this.activeWindowId, button };
    }

    // Row destruction with automatic cell cleanup
    destroyRow(rowId: RowId): void {

        const row = this.rowRegistry.get(rowId);
        if (!row) {
            console.warn(`TableCore: Row ${rowId} not found for destruction`);
            return;
        }

        // 1. Clean up cell registrations (React handles component unmounting)
        row.cells.forEach(cellId => {
            this.cellCommandRegistry.unregister(cellId);
            this.cellRegistry.unregister(cellId);
        });

        // 2. Fix spatial navigation - link neighboring rows
        const topRowId = row.top;
        const bottomRowId = row.bottom;

        if (topRowId && bottomRowId) {
            // Connect top row directly to bottom row
            this.cellCoordinator.linkRows(topRowId, bottomRowId);

            // Link cells between top and bottom rows (skip destroyed row)
            const topRow = this.rowRegistry.get(topRowId);
            const bottomRow = this.rowRegistry.get(bottomRowId);
            if (topRow && bottomRow) {
                this.cellCoordinator.linkRowsCells(topRow.cells, bottomRow.cells);
            }
        } else if (topRowId) {
            // This was the last row - clear bottom reference from top row
            const topRow = this.rowRegistry.get(topRowId);
            if (topRow) {
                topRow.bottom = null;
                this.rowRegistry.register(topRowId, topRow);
            }
        } else if (bottomRowId) {
            // This was the first row - clear top reference from bottom row
            const bottomRow = this.rowRegistry.get(bottomRowId);
            if (bottomRow) {
                bottomRow.top = null;
                this.rowRegistry.register(bottomRowId, bottomRow);
            }
        }

        // 3. Send destroy command to row component
        this.dispatchRowCommand({
            name: 'destroy',
            targetId: rowId,
            payload: {},
            timestamp: Date.now()
        });

        // 4. Clean up row registrations
        this.rowCommandRegistry.unregister(rowId);
        this.rowRegistry.unregister(rowId);

    }

}
