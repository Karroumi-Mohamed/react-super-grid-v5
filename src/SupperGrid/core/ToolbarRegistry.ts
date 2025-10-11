import type { ButtonId, ButtonVariant, ButtonPosition, ToolbarButton, WindowConfig } from './types';

/**
 * ToolbarRegistry
 *
 * Manages toolbar buttons registered by plugins or table components.
 * Buttons are organized by position (left/right) and maintain insertion order.
 */
export class ToolbarRegistry {
    private buttons = new Map<ButtonId, ToolbarButton>();
    private buttonOrder: ButtonId[] = []; // Track insertion order

    /**
     * Register a new button or update an existing one
     * @returns ButtonId for use with removeButton
     */
    register(
        label: string,
        callback: () => void,
        position: ButtonPosition = 'left',
        variant: ButtonVariant = 'normal',
        windowConfig?: WindowConfig
    ): ButtonId {
        // Generate unique button ID
        const id = `btn-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

        const button: ToolbarButton = {
            id,
            label,
            callback,
            position,
            variant,
            window: windowConfig
        };

        this.buttons.set(id, button);
        this.buttonOrder.push(id);

        return id;
    }

    /**
     * Remove a button by ID
     * @returns true if button existed and was removed
     */
    unregister(id: ButtonId): boolean {
        const existed = this.buttons.delete(id);
        if (existed) {
            // Remove from order tracking
            const index = this.buttonOrder.indexOf(id);
            if (index !== -1) {
                this.buttonOrder.splice(index, 1);
            }
        }
        return existed;
    }

    /**
     * Get all buttons for a specific position, in insertion order
     */
    getButtons(position: ButtonPosition): ToolbarButton[] {
        return this.buttonOrder
            .map(id => this.buttons.get(id))
            .filter((btn): btn is ToolbarButton => btn !== undefined && btn.position === position);
    }

    /**
     * Get all buttons (both positions)
     */
    getAllButtons(): ToolbarButton[] {
        return this.buttonOrder
            .map(id => this.buttons.get(id))
            .filter((btn): btn is ToolbarButton => btn !== undefined);
    }

    /**
     * Check if a button exists
     */
    has(id: ButtonId): boolean {
        return this.buttons.has(id);
    }

    /**
     * Clear all buttons
     */
    clear(): void {
        this.buttons.clear();
        this.buttonOrder = [];
    }
}
