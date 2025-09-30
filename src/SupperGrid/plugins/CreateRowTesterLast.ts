import { BasePlugin } from '../core/BasePlugin';
import type { CellCommand, RowCommand, RowCommandMap } from '../core/types';

export class CreateRowTesterLast extends BasePlugin {
    name = 'createRowTesterLast';
    version = '1.0.0';
    dependencies: string[] = [];
    processLast = true; // This plugin should be processed last

    onBeforeCellCommand(_command: CellCommand): boolean | void {
        // Allow all cell commands
    }

    onBeforeRowCommand<K extends keyof RowCommandMap>(_command: RowCommand<K>): boolean | void {
        // Allow all row commands
    }

    onInit(): void {
        console.log(`🔥 ${this.name}: onInit called at ${Date.now()}`);
        // Plugin initialization - no automatic row creation
    }

    onDestroy(): void {
        console.log(`💀 ${this.name}: onDestroy called at ${Date.now()}`);
        // Plugin cleanup
    }
}
