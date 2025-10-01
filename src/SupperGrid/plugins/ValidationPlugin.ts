import { BasePlugin } from '../core/BasePlugin';
import type { CellCommand, CellId } from '../core/types';
import type { APIUsage } from '../core/ActionRegistry';

export class ValidationPlugin extends BasePlugin {
    readonly name = 'validation-plugin';
    readonly version = '1.0.0';

    onInit(): void {
        console.log('ValidationPlugin initialized');
    }

    onDestroy(): void {
        console.log('ValidationPlugin destroyed');
    }

    onBeforeCellCommand(_command: CellCommand): boolean | void {
        // Allow all cell commands
        return true;
    }

    onBeforeRowCommand(): boolean | void {
        // Allow all row commands
        return true;
    }

    // Intercept actions and validate API calls
    onBeforeAction(cellId: CellId, _actionName: string, apiUsage: APIUsage): boolean | void {
        // Intercept save API calls
        apiUsage.on('save', (value) => {
            // Validate the value
            if (this.validate(value)) {
                console.log(`✅ ValidationPlugin: Value "${value}" is valid for cell ${cellId}`);
                return true; // Allow save
            } else {
                console.error(`❌ ValidationPlugin: Value "${value}" is invalid for cell ${cellId}`);
                return false; // Block save
            }
        });

        // Intercept deleteRow API calls
        apiUsage.on('deleteRow', () => {
            console.log(`🗑️ ValidationPlugin: Allowing row deletion from cell ${cellId}`);
            return true; // Allow deletion
        });

        return true; // Continue to next plugin
    }

    private validate(value: any): boolean {
        // Example validation: non-empty strings
        if (typeof value === 'string') {
            return value.trim().length > 0;
        }
        return true; // Allow non-string values
    }
}
