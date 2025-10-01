import { BasePlugin } from '../core/BasePlugin';
import type { CellCommand, RowCommand, CellId } from '../core/types';
import type { APIUsage } from '../core/ActionRegistry';

/**
 * SaveBlockerPlugin
 *
 * This plugin demonstrates the two levels of blocking in the Action System:
 * 1. API-level blocking: Prevents specific API calls from executing (apiUsage.on returns false)
 * 2. Action-level blocking: Prevents the entire action from reaching subsequent plugins (onBeforeAction returns false)
 *
 * The plugin uses a counter to alternate between these two blocking strategies:
 * - When counter is ODD: Blocks the save() API call only, action continues to other plugins
 * - When counter is EVEN: Blocks the entire action, preventing other plugins from seeing it
 *
 * This demonstrates the difference between fine-grained API blocking vs complete action blocking.
 */
export class SaveBlockerPlugin extends BasePlugin {
    readonly name = 'save-blocker-plugin';
    readonly version = '1.0.0';
    readonly dependencies: string[] = [];

    private counter: number = 0;

    onInit(): void {
        console.log('🚫 SaveBlockerPlugin: Initialized (counter starts at 0)');
    }

    onDestroy(): void {
        console.log('🚫 SaveBlockerPlugin: Destroyed');
    }

    onBeforeCellCommand(_command: CellCommand): boolean | void {
        return true; // Allow all commands
    }

    onBeforeRowCommand(_command: RowCommand): boolean | void {
        return true; // Allow all commands
    }

    /**
     * Intercepts save actions and blocks them based on counter state
     */
    onBeforeAction(cellId: CellId, actionName: string, apiUsage: APIUsage): boolean | void {
        // Only interested in save actions
        if (actionName !== 'saveAction') {
            return true;
        }

        // Check current counter state BEFORE incrementing
        const isOdd = this.counter % 2 === 1;
        const currentCount = this.counter;

        // Increment counter for next time
        this.counter++;

        if (isOdd) {
            // ODD counter: Block the save API specifically
            console.log(`🚫 SaveBlockerPlugin: Counter is ${currentCount} (ODD) - Blocking save API only`);

            apiUsage.on('save', (value: any) => {
                console.log(`🚫 SaveBlockerPlugin: ❌ Blocked save API for cell ${cellId} with value "${value}"`);
                console.log(`🚫 SaveBlockerPlugin: Action continues to other plugins, but save() won't execute`);
                return false; // Block this specific API call
            });

            // Allow action to continue to other plugins
            return true;
        } else {
            // EVEN counter: Block the entire action
            console.log(`🚫 SaveBlockerPlugin: Counter is ${currentCount} (EVEN) - Blocking entire action`);
            console.log(`🚫 SaveBlockerPlugin: ❌ Action blocked at plugin level for cell ${cellId}`);
            console.log(`🚫 SaveBlockerPlugin: Other plugins won't see this action at all`);

            // Block the entire action from reaching other plugins
            return false;
        }
    }
}
