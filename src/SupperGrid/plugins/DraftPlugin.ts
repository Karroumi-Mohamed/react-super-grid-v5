import { BasePlugin } from '../core/BasePlugin';
import type { CellCommand, RowId, ButtonId } from '../core/types';

/**
 * DraftPlugin
 *
 * Demonstrates the Toolbar API by managing draft rows.
 *
 * Features:
 * - Adds "+ Add" button to create draft rows
 * - Adds "Save" button (standout variant) when draft rows exist
 * - Removes "Save" button when all drafts are deleted
 * - Tracks draft rows internally
 * - Shows button position (left/right) and variants (normal/standout)
 */
export class DraftPlugin extends BasePlugin {
    readonly name = 'draft-plugin';
    readonly version = '1.0.0';
    readonly dependencies: string[] = [];

    private draftRowIds: Set<RowId> = new Set();
    private addButtonId: ButtonId | null = null;
    private saveButtonId: ButtonId | null = null;

    onInit(): void {
        console.log('📝 DraftPlugin: Initialized');

        // Add "+ Add" button to right side
        if (this.tableAPIs) {
            this.addButtonId = this.tableAPIs.addButton(
                '+ Add',
                () => this.handleAddRow(),
                'right',
                'normal'
            );
        }
    }

    onDestroy(): void {
        // Cleanup buttons
        if (this.addButtonId && this.tableAPIs) {
            this.tableAPIs.removeButton(this.addButtonId);
        }
        if (this.saveButtonId && this.tableAPIs) {
            this.tableAPIs.removeButton(this.saveButtonId);
        }
        this.draftRowIds.clear();
        console.log('📝 DraftPlugin: Destroyed');
    }

    onBeforeCellCommand(_command: CellCommand): boolean | void {
        return true; // Allow all commands
    }

    /**
     * Handle "+ Add" button click
     * Creates a new draft row and updates toolbar
     */
    private handleAddRow(): void {
        if (!this.tableAPIs) return;

        // Create a draft row with empty/default data
        const draftData = {
            name: '',
            age: 0,
            email: ''
        };

        console.log('📝 DraftPlugin: Adding draft row');

        // Get current row count to track the new row
        const beforeRowIds = this.tableAPIs.getRowIds();

        // Create row in plugin's own space at the top
        this.tableAPIs.createRow(draftData, 'top');

        // Wait a tick for row to be registered, then track it
        setTimeout(() => {
            const afterRowIds = this.tableAPIs!.getRowIds();
            const newRowId = afterRowIds.find(id => !beforeRowIds.includes(id));

            if (newRowId) {
                this.draftRowIds.add(newRowId);
                console.log(`📝 DraftPlugin: Draft row ${newRowId} created. Total drafts: ${this.draftRowIds.size}`);

                // Add "Save" button if not already present
                this.ensureSaveButton();
            }
        }, 10);
    }

    /**
     * Ensure "Save" button exists when drafts are present
     */
    private ensureSaveButton(): void {
        if (this.draftRowIds.size > 0 && !this.saveButtonId && this.tableAPIs) {
            console.log('📝 DraftPlugin: Adding Save button');
            this.saveButtonId = this.tableAPIs.addButton(
                'Save',
                () => this.handleSave(),
                'right',
                'standout'
            );
        }
    }

    /**
     * Handle "Save" button click
     * Saves all draft rows and removes the Save button
     */
    private handleSave(): void {
        console.log(`📝 DraftPlugin: Saving ${this.draftRowIds.size} draft rows`);

        // In a real implementation, you would:
        // 1. Validate row data
        // 2. Send to backend
        // 3. Mark rows as saved

        // For demo purposes, just clear drafts
        const count = this.draftRowIds.size;
        this.draftRowIds.clear();

        console.log(`📝 DraftPlugin: ${count} draft rows saved and cleared`);

        // Remove "Save" button
        this.removeSaveButton();
    }

    /**
     * Remove "Save" button when no drafts exist
     */
    private removeSaveButton(): void {
        if (this.saveButtonId && this.tableAPIs) {
            console.log('📝 DraftPlugin: Removing Save button');
            this.tableAPIs.removeButton(this.saveButtonId);
            this.saveButtonId = null;
        }
    }

    /**
     * Track row deletions to update draft count
     */
    onBeforeRowCommand<K extends keyof import('../core/types').RowCommandMap>(
        command: import('../core/types').RowCommand<K>
    ): boolean | void {
        if (command.name === 'destroy' && command.targetId) {
            // Check if this is a draft row
            if (this.draftRowIds.has(command.targetId)) {
                console.log(`📝 DraftPlugin: Draft row ${command.targetId} being deleted`);
                this.draftRowIds.delete(command.targetId);

                // Remove Save button if no more drafts
                if (this.draftRowIds.size === 0) {
                    this.removeSaveButton();
                }
            }
        }
        return true; // Allow command to proceed
    }
}
