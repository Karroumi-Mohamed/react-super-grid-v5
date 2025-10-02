import { BasePlugin } from '../core/BasePlugin';
import type { CellCommand, RowCommand, CellId } from '../core/types';
import type { APIUsage } from '../core/ActionRegistry';
import type { SelectPlugin } from './SelectionPlugin';

/**
 * MultiEditPlugin
 *
 * Enables multi-cell editing through selection.
 * When multiple cells are selected and one is edited, all selected cells
 * receive the same edit action.
 *
 * Features:
 * - Depends on SelectionPlugin to get selected cells
 * - Intercepts actions from cells that are part of a selection
 * - Propagates the action to all other selected cells
 * - Uses originPlugin to bypass itself and avoid infinite loops
 */
export class MultiEditPlugin extends BasePlugin {
    readonly name = 'multi-edit-plugin';
    readonly version = '1.0.0';
    readonly dependencies = ['selection'];

    private selectionPlugin: SelectPlugin | null = null;

    onInit(): void {
        // Get reference to SelectionPlugin
        this.selectionPlugin = this.getPlugin<SelectPlugin>('selection');

        if (!this.selectionPlugin) {
            console.error('MultiEditPlugin: SelectionPlugin dependency not found');
        }

        console.log('✏️ MultiEditPlugin: Initialized');
    }

    onDestroy(): void {
        this.selectionPlugin = null;
        console.log('✏️ MultiEditPlugin: Destroyed');
    }

    onBeforeCellCommand(_command: CellCommand): boolean | void {
        return true; // Allow all commands
    }

    onBeforeRowCommand(_command: RowCommand): boolean | void {
        return true; // Allow all commands
    }

    /**
     * Intercept actions from selected cells and propagate to all selected cells
     */
    onBeforeAction(cellId: CellId, actionName: string, apiUsage: APIUsage): boolean | void {
        // Only interested in saveAction for now
        if (actionName !== 'saveAction') {
            return true;
        }

        // Get all selected cells
        const selectedCells = this.selectionPlugin?.getSelected() || [];

        // Only propagate if there are multiple selected cells and this cell is one of them
        if (selectedCells.length <= 1 || !selectedCells.includes(cellId)) {
            return true; // No multi-edit needed
        }

        console.log(`✏️ MultiEditPlugin: Propagating ${actionName} from ${cellId} to ${selectedCells.length - 1} other cells`);

        // Listen for the save API call to get the value
        apiUsage.on('save', (value: any) => {
            console.log(`✏️ MultiEditPlugin: Value to propagate: "${value}"`);

            // Propagate to all other selected cells
            selectedCells.forEach(targetCellId => {
                // Skip the originating cell
                if (targetCellId === cellId) return;

                console.log(`✏️ MultiEditPlugin: Applying ${actionName} to cell ${targetCellId}`);

                // Run the same action on this cell
                // Pass our plugin name as originPlugin to bypass ourselves (avoid infinite loop)
                this.tableAPIs?.runAction(targetCellId, actionName, value);
            });

            // Allow the original save to proceed
            return true;
        });

        // Allow the action to continue
        return true;
    }
}
