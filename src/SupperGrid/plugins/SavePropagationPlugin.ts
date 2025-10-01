import { BasePlugin } from '../core/BasePlugin';
import type { CellCommand, RowCommand, CellId } from '../core/types';
import type { APIUsage } from '../core/ActionRegistry';

/**
 * SavePropagationPlugin
 *
 * This plugin demonstrates the Action System by propagating save actions to adjacent cells.
 * When a cell saves its value, this plugin automatically triggers the same save action
 * on the cell to its left, creating a cascade effect.
 *
 * Key Concepts Demonstrated:
 * - Action interception via onBeforeAction
 * - Reading action details through apiUsage.on('save', ...)
 * - Accessing spatial structure (cell.left)
 * - Triggering actions on other cells via tableAPIs.runAction
 * - Using originPlugin to prevent infinite loops
 */
export class SavePropagationPlugin extends BasePlugin {
    readonly name = 'save-propagation-plugin';
    readonly version = '1.0.0';
    readonly dependencies: string[] = [];

    onInit(): void {
        console.log('💫 SavePropagationPlugin: Initialized');
    }

    onDestroy(): void {
        console.log('💫 SavePropagationPlugin: Destroyed');
    }

    onBeforeCellCommand(_command: CellCommand): boolean | void {
        return true; // Allow all commands
    }

    onBeforeRowCommand(_command: RowCommand): boolean | void {
        return true; // Allow all commands
    }

    /**
     * Intercepts save actions and propagates them to the left cell
     */
    onBeforeAction(cellId: CellId, actionName: string, apiUsage: APIUsage): boolean | void {
        // Only interested in save actions
        if (actionName !== 'saveAction') {
            return true;
        }

        // Register a listener for the save API call
        apiUsage.on('save', (value: any) => {
            console.log(`💫 SavePropagationPlugin: Cell ${cellId} is saving value "${value}"`);

            // Get the cell from registry to access spatial structure
            const cell = this.tableAPIs?.getCellRegistry().get(cellId);

            if (!cell) {
                console.warn(`💫 SavePropagationPlugin: Cell ${cellId} not found in registry`);
                return true; // Allow the save to proceed
            }

            // Get the left cell
            const leftCell = cell.left;

            if (!leftCell) {
                console.log(`💫 SavePropagationPlugin: Cell ${cellId} has no left neighbor`);
                return true; // Allow the save to proceed
            }

            console.log(`💫 SavePropagationPlugin: Propagating save to left cell ${leftCell}`);

            // Schedule the propagation to happen after the current action completes
            // This prevents issues with the current action execution being interrupted
            setTimeout(() => {
                // Trigger the same save action on the left cell
                // Pass our plugin name as originPlugin to prevent infinite loops
                this.tableAPIs?.runAction(leftCell, 'saveAction', value);
            }, 0);

            // Allow the current save to proceed normally
            return true;
        });

        // Allow the action to continue to other plugins
        return true;
    }
}
