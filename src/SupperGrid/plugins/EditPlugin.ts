import { BasePlugin } from '../core/BasePlugin';
import type { CellCommand, RowCommand } from '../core/types';
import type { FocusPlugin } from './FocusPlugin';

export class EditPlugin extends BasePlugin {
    readonly name = 'edit-plugin';
    readonly version = '1.0.0';
    readonly dependencies = ['focus-plugin'];

    private focusPlugin: FocusPlugin | null = null;

    onInit(): void {
        // Get reference to FocusPlugin
        this.focusPlugin = this.getPlugin<FocusPlugin>('focus-plugin');

        if (!this.focusPlugin) {
            console.error('EditPlugin: FocusPlugin dependency not found');
        }
    }

    onDestroy(): void {
        this.focusPlugin = null;
    }

    onBeforeCellCommand(command: CellCommand): boolean | void {
        // Intercept keyboard commands
        if (command.name === 'keydown' && !command.targetId) {
            const event = command.payload.event;

            // Check if Enter key is pressed
            if (event.key === 'Enter') {
                const focusedCell = this.focusPlugin?.getFocused();

                if (focusedCell) {
                    // Send edit command to focused cell
                    this.tableAPIs?.createCellCommand(focusedCell, {
                        name: 'edit'
                    });

                    // Prevent default and block further processing
                    event.preventDefault();
                    return false;
                }
            }
        }

        return true; // Allow other commands
    }

    onBeforeRowCommand(_command: RowCommand): boolean | void {
        return true;
    }
}
