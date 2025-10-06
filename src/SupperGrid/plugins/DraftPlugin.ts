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
    private onCommitCallback: ((drafts: any[]) => Promise<void>) | null = null;

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

        // Create row in plugin's own space at the top with render flag
        this.tableAPIs.createRow(draftData, 'top', true);

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
     * PUBLIC API: Register a callback to be called when drafts are committed
     * This is typically called by RestPlugin or other persistence plugins
     */
    public onCommit(callback: (drafts: any[]) => Promise<void>): void {
        this.onCommitCallback = callback;
        console.log('📝 DraftPlugin: Commit callback registered');
    }

    /**
     * PUBLIC API: Get all draft rows data
     */
    public getDraftRows(): any[] {
        return Array.from(this.draftRowIds)
            .map(id => this.tableAPIs?.getRow(id))
            .filter(row => row !== undefined)
            .map(row => row!.data);
    }

    /**
     * Handle "Save" button click
     * Saves all draft rows and removes the Save button
     */
    private async handleSave(): Promise<void> {
        console.log(`📝 DraftPlugin: Saving ${this.draftRowIds.size} draft rows`);

        if (this.onCommitCallback) {
            try {
                const drafts = this.getDraftRows();

                // Call the callback (RestPlugin will handle server communication)
                await this.onCommitCallback(drafts);

                // After successful commit, clear drafts
                this.draftRowIds.forEach(id => this.tableAPIs?.deleteRow(id));
                this.draftRowIds.clear();

                console.log(`📝 DraftPlugin: ${drafts.length} draft rows committed successfully`);

                // Remove "Save" button
                this.removeSaveButton();
            } catch (error) {
                console.error('📝 DraftPlugin: Failed to commit drafts:', error);
                // TODO: Show error notification to user
            }
        } else {
            console.warn('📝 DraftPlugin: No commit callback registered - clearing drafts without saving');

            // No callback registered - just clear drafts (demo mode)
            const count = this.draftRowIds.size;
            this.draftRowIds.clear();
            console.log(`📝 DraftPlugin: ${count} draft rows cleared (no persistence)`);

            this.removeSaveButton();
        }
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
