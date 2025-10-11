import { BasePlugin } from '../core/BasePlugin';
import type { CellCommand, RowCommand } from '../core/types';

/**
 * FilterPlugin
 *
 * Example plugin demonstrating window system usage.
 * Shows how to add a button with an attached window component.
 */
export class FilterPlugin extends BasePlugin {
    readonly name = 'filter-plugin';
    readonly version = '1.0.0';
    readonly dependencies: string[] = [];

    onInit(): void {
        console.log('🔍 FilterPlugin: Initialized');

        // Add button with window
        if (this.tableAPIs) {
            this.tableAPIs.addButton(
                'Filter',
                () => {}, // Callback not needed when window is used
                'right',
                'normal',
                {
                    component: FilterWindow,
                    title: 'Filter Options'
                }
            );
        }
    }

    onDestroy(): void {
        console.log('🔍 FilterPlugin: Destroyed');
    }

    onBeforeCellCommand(_command: CellCommand): boolean | void {
        return true; // Allow all commands
    }

    onBeforeRowCommand(_command: RowCommand): boolean | void {
        return true; // Allow all commands
    }
}

/**
 * FilterWindow Component
 *
 * This is the UI that appears when the Filter button is clicked.
 * It can be any React component with filter controls.
 */
function FilterWindow() {
    return (
        <div className="flex flex-col gap-3 min-w-[250px]">
            <div>
                <label className="block text-sm font-medium text-neutral-700 mb-1">
                    Search
                </label>
                <input
                    type="text"
                    placeholder="Search..."
                    className="w-full px-2 py-1 border border-neutral-300 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
            </div>

            <div>
                <label className="block text-sm font-medium text-neutral-700 mb-1">
                    Column
                </label>
                <select className="w-full px-2 py-1 border border-neutral-300 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500">
                    <option>All Columns</option>
                    <option>Name</option>
                    <option>Age</option>
                    <option>Email</option>
                </select>
            </div>

            <div className="flex gap-2 pt-2">
                <button className="flex-1 px-3 py-1 bg-blue-50 text-blue-700 text-sm hover:bg-blue-100 border border-neutral-200">
                    Apply
                </button>
                <button className="flex-1 px-3 py-1 bg-stone-50 text-neutral-700 text-sm hover:bg-stone-100 border border-neutral-200">
                    Clear
                </button>
            </div>
        </div>
    );
}
