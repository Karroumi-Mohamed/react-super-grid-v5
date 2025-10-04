import { useState, useCallback } from 'react';
import type { CellId, TableRowAPI } from '../core/types';

/**
 * Hook function signature for managing cell value
 * Returns [value, setValue] tuple
 */
export interface CellValueHook<T = any> {
    (initialValue: T): readonly [T, (newValue: T) => void];
}

/**
 * Builder interface for creating context-aware cell value hooks
 */
export interface CellValueHookBuilder {
    buildHook<T = any>(cellId: CellId, columnKey: string): CellValueHook<T>;
}

/**
 * Creates a hook builder bound to a specific row context
 *
 * This builder creates context-aware hooks that automatically:
 * 1. Manage local cell state (for immediate UI updates)
 * 2. Update row data in the registry (maintains data consistency)
 *
 * @param rowId - The ID of the row this builder is bound to
 * @param tableApis - Row-level table APIs for accessing registry
 * @returns A builder that can create hooks for individual cells
 *
 * @example
 * ```typescript
 * // In GridRow component
 * const hookBuilder = createCellValueHookBuilder(rowId, tableApis);
 * const nameHook = hookBuilder.buildHook(cellId, 'name');
 *
 * // In TextCell component
 * const [value, setValue] = useCellValue(initialValue);
 * // setValue automatically updates both cell state AND row data
 * ```
 */
export function createCellValueHookBuilder(
    rowId: string,
    tableApis: TableRowAPI
): CellValueHookBuilder {

    return {
        buildHook<T = any>(cellId: CellId, columnKey: string): CellValueHook<T> {
            // Return a context-aware hook function
            return function useCellValue(initialValue: T): readonly [T, (newValue: T) => void] {
                // Local state for immediate UI updates
                const [internalValue, setInternalValueState] = useState<T>(() => initialValue);

                // Enhanced setValue that updates BOTH cell state AND row data
                const setValue = useCallback((newValue: T) => {
                    // 1. Update cell's local state (immediate UI feedback)
                    setInternalValueState(newValue);

                    // 2. Update row data in registry (maintains consistency)
                    const row = tableApis.getRow(rowId);
                    if (row) {
                        // Clone data to avoid mutation
                        const updatedData = { ...row.data };
                        updatedData[columnKey] = newValue;

                        // Update row data using the API
                        tableApis.updateRowData(rowId, updatedData);

                        console.log(`📝 Cell ${cellId} updated row data: ${columnKey} = ${newValue}`);
                    } else {
                        console.warn(`⚠️ Could not update row data for cell ${cellId}: row ${rowId} not found`);
                    }
                }, []);

                return [internalValue, setValue] as const;
            };
        }
    };
}
