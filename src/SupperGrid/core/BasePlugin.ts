import type { CellCommand, CellCommandInput, RowCommand, CellId, RowId, SpaceId, Cell, Space, ButtonId, ButtonVariant, ButtonPosition } from './types';
import type { APIUsage } from './ActionRegistry';

// Spatial comparison result types
export type VerticalComparison = {
    top: CellId;
    bottom: CellId;
} | null;

export type HorizontalComparison = {
    left: CellId;
    right: CellId;
} | null;

export interface TablePluginAPIs {
    createCellCommand(targetId: CellId, command: CellCommandInput): void;
    createRowCommand<K extends keyof import('./types').RowCommandMap>(
        targetId: RowId,
        command: Omit<RowCommand<K>, 'targetId' | 'originPlugin' | 'timestamp'>
    ): void;
    createRow(rowData: any, position?: 'top' | 'bottom'): void;
    createRowInTableSpace(rowData: any, position?: 'top' | 'bottom'): void;
    getCell(cellId: CellId): Cell | undefined;
    getRow(rowId: RowId): import('./types').Row<any> | undefined;
    getCellRegistry(): import('./Registries').CellRegistry;
    getRowRegistry(): import('./Registries').RowRegistry<any>;
    compareVertical(cellId1: CellId, cellId2: CellId): VerticalComparison;
    compareHorizontal(cellId1: CellId, cellId2: CellId): HorizontalComparison;
    deleteRow(rowId: RowId): void;
    getRowIds(): RowId[];
    getSpaceAbove(spaceId: SpaceId): SpaceId | null;
    getSpaceBelow(spaceId: SpaceId): SpaceId | null;
    getSpace(spaceId: SpaceId): Space | undefined;
    getMySpace(): SpaceId;
    renderSpace(spaceId: SpaceId): void;
    renderTableSpace(): void;
    scrollToCell(cellId: CellId): void;
    runAction(cellId: CellId, actionName: string, payload?: any): void;
    getKeyboardOwner(): CellId | null;
    addButton(label: string, callback: () => void, position?: ButtonPosition, variant?: ButtonVariant): ButtonId;
    removeButton(buttonId: ButtonId): boolean;
}

export interface RowPluginAPIs {
    registerCell(cellId: CellId, commandHandler: (command: CellCommand) => void): void;
    unregisterCell(cellId: CellId): void;
}

export interface RowTableAPIs {
    registerRowHandler<K extends keyof import('./types').RowCommandMap>(
        rowId: RowId,
        handler: (command: RowCommand<K>) => void
    ): void;
    unregisterRowHandler(rowId: RowId): void;
}

export interface PluginManager {
    getPlugin<T extends BasePlugin>(pluginName: string): T | null;
}

export abstract class BasePlugin {
    abstract readonly name: string;
    abstract readonly version: string;
    readonly dependencies: string[] = [];
    readonly processLast: boolean = false;

    protected pluginManager: PluginManager | null = null;
    protected tableAPIs: TablePluginAPIs | null = null;
    protected rowAPIs: RowPluginAPIs | null = null;
    protected rowTableAPIs: RowTableAPIs | null = null;

    // Plugin lifecycle methods
    onInit?(): void;
    onDestroy?(): void;

    // Command interception - return false to block the command
    abstract onBeforeCellCommand(command: CellCommand): boolean | void;
    abstract onBeforeRowCommand<K extends keyof import('./types').RowCommandMap>(
        command: RowCommand<K>
    ): boolean | void;

    // Action interception - return false to stop plugin chain (APIs still execute)
    onBeforeAction?(cellId: CellId, actionName: string, apiUsage: APIUsage): boolean | void;

    // Dependency management
    getPlugin<T extends BasePlugin>(pluginName: string): T | null {
        return this.pluginManager?.getPlugin(pluginName) || null;
    }

    // API access
    setAPIs(tableAPIs: TablePluginAPIs, rowAPIs: RowPluginAPIs, rowTableAPIs: RowTableAPIs): void {
        this.tableAPIs = tableAPIs;
        this.rowAPIs = rowAPIs;
        this.rowTableAPIs = rowTableAPIs;
    }

    setPluginManager(manager: PluginManager): void {
        this.pluginManager = manager;
    }

    protected getTableAPIs(): TablePluginAPIs {
        if (!this.tableAPIs) {
            throw new Error(`Plugin ${this.name} tried to access TableAPIs before initialization`);
        }
        return this.tableAPIs;
    }

    protected getRowAPIs(): RowPluginAPIs {
        if (!this.rowAPIs) {
            throw new Error(`Plugin ${this.name} tried to access RowAPIs before initialization`);
        }
        return this.rowAPIs;
    }

    protected getRowTableAPIs(): RowTableAPIs {
        if (!this.rowTableAPIs) {
            throw new Error(`Plugin ${this.name} tried to access RowTableAPIs before initialization`);
        }
        return this.rowTableAPIs;
    }
}
