import { useEffect, useRef, useReducer } from 'react';
import type { RowId, SpaceId, TableConfig, RowProps, SpaceCommand, SpaceCommandHandler, Row } from '../core/types';
import type { TableCore } from '../core/TableCore';
import { GridRow } from '../SuperGridOptimized';
import { v4 as uuidv4 } from 'uuid';
import { Indexer } from '../core/Indexer';

interface SpaceProps<TData> {
    spaceId: SpaceId;
    tableCore: TableCore;
    config: TableConfig<TData>;
    initialData?: TData[]; // Only for table space
    onCellsRegistered?: (() => void) | null; // Callback for when all cells are registered
}

// Get row string directly from row object
function getRowIndex(rowId: RowId, tableCore: TableCore): string | null {
    const row = tableCore.getRowRegistry().get(rowId);
    return row?.rowString ? row.rowString : null;
}

export function SpaceOptimized<TData>({ spaceId, tableCore, config, initialData, onCellsRegistered }: SpaceProps<TData>) {
    // Use reducer for force re-render without maintaining state
    const [, forceRender] = useReducer(x => x + 1, 0);

    const renderCountRef = useRef(0);
    const initializedRef = useRef(false);
    renderCountRef.current += 1;
    const previousRowRef = useRef<RowId | null>(null);

    // Track cell registration completion for table space
    const cellsRegisteredCountRef = useRef(0);
    const expectedCellsCountRef = useRef(0);
    const tableSpaceReadyReportedRef = useRef(false);

    // Get current row IDs directly from registry - no local state!
    const getCurrentRowIds = (): RowId[] => {
        const space = tableCore.getSpaceRegistry().get(spaceId);
        return space ? space.rowIds : [];
    };

    // Register SpaceCommand handler
    useEffect(() => {
        const handleSpaceCommand: SpaceCommandHandler = (command: SpaceCommand) => {
            switch (command.name) {
                case 'addRow':
                    if ('rowData' in command.payload) {
                        handleAddRow(command.payload.rowData, command.payload.position || 'bottom', command);
                    }
                    break;
                case 'render':
                    // Force re-render of this space - use setTimeout to ensure we're completely outside the render cycle
                    setTimeout(() => {
                        forceRender();
                    }, 0);
                    break;
                default:
                    console.warn(`Space ${spaceId}: Unhandled SpaceCommand:`, command.name);
            }
        };

        // Register handler with SpaceCommandRegistry
        tableCore.getSpaceCommandRegistry().register(spaceId, handleSpaceCommand);

        return () => {
            tableCore.getSpaceCommandRegistry().unregister(spaceId);
        };
    }, [spaceId, tableCore]);

    // Handle addRow command with cross-space linking - optimized version
    const handleAddRow = (rowData: any, position: 'top' | 'bottom', command: SpaceCommand) => {
        const newRowId = uuidv4();
        const rowRegistry = tableCore.getRowRegistry();
        const spaceRegistry = tableCore.getSpaceRegistry();

        // Get current space
        const currentSpace = spaceRegistry.get(spaceId);
        if (!currentSpace) {
            return;
        }

        // Use current space rowIds from registry (most up-to-date)
        const currentRowIds = currentSpace.rowIds;

        // Get space insertion context for plugin ordering (unused in simplified version)
        const spaceAboveWithRows = findNearestSpaceWithRows('above');
        const spaceBelowWithRows = findNearestSpaceWithRows('below');

        let rowString: string;
        let top: string | null = null;
        let bottom: string | null = null;

        let insertIndex = position === 'top' ? 0 : currentRowIds.length;
        if (currentRowIds.length === 0) {
            if (spaceAboveWithRows && spaceBelowWithRows) {
                // If both spaces have rows, insert between bottom row of top space and top row of bottom space
                const topSpace = spaceRegistry.get(spaceAboveWithRows);
                const bottomSpace = spaceRegistry.get(spaceBelowWithRows);
                if (!topSpace || !bottomSpace) {
                    console.warn("❌ Inconsistent space state when adding row");
                    return;
                }

                //bottom row id of top Space
                const aboveRowId = topSpace.rowIds[topSpace.rowIds.length - 1];
                //top row id of bottom Space
                const belowRowId = bottomSpace.rowIds[0];

                if (!aboveRowId || !belowRowId) {
                    console.warn("No valid rows found in spaces when adding row");
                    return;
                }

                const aboveRow = rowRegistry.get(aboveRowId);
                const belowRow = rowRegistry.get(belowRowId);

                if (!aboveRow || !belowRow) {
                    console.warn("❌ Inconsistent row state when adding row");
                    return;
                }


                top = aboveRowId;
                bottom = belowRowId;
                rowString = Indexer.between(belowRow.rowString, aboveRow.rowString);
            } else if (spaceAboveWithRows) {
                // If only space above has rows, this case is rare to happen just if the table space had not inital data
                const topSpace = spaceRegistry.get(spaceAboveWithRows);
                if (!topSpace) {
                    console.warn("❌ Inconsistent space state when adding row");
                    return;
                }

                // Get the last row of the top space
                const aboveRowId = topSpace.rowIds[topSpace.rowIds.length - 1];
                const aboveRow = rowRegistry.get(aboveRowId);
                if (!aboveRow) {
                    console.warn("❌ Inconsistent row state when adding row");
                    return;
                }

                top = aboveRowId;
                rowString = Indexer.below(aboveRow.rowString);
            } else if (spaceBelowWithRows) {
                // If only space below has rows
                const bottomSpace = spaceRegistry.get(spaceBelowWithRows);
                if (!bottomSpace) {
                    console.warn("❌ Inconsistent space state when adding row");
                    return;
                }

                // Get the first row of the bottom space
                const belowRowId = bottomSpace.rowIds[0];
                const belowRow = rowRegistry.get(belowRowId);
                if (!belowRow) {
                    console.warn("❌ Inconsistent row state when adding row");
                    return;
                }

                bottom = belowRowId;
                rowString = Indexer.above(belowRow.rowString);
            } else {
                // If no spaces have rows, just create a new row at the top
                rowString = Indexer.above();
            }
        } else {
            if (position === 'top') {
                if (spaceAboveWithRows) {
                    // insert between top row of the current space and bottom row of the above space
                    const topSpace = spaceRegistry.get(spaceAboveWithRows);
                    if (!topSpace) {
                        console.warn("❌ Inconsistent space state when adding row");
                        return;
                    }

                    // bottom row id of top Space
                    const aboveRowId = topSpace.rowIds[topSpace.rowIds.length - 1];
                    const aboveRow = rowRegistry.get(aboveRowId);
                    if (!aboveRow) {
                        console.warn("❌ Inconsistent row state when adding row");
                        return;
                    }

                    const currentTopRowId = currentRowIds[0];
                    const currentTopRow = rowRegistry.get(currentTopRowId);
                    if (!currentTopRow) {
                        console.warn("❌ Inconsistent row state when adding row");
                        return;
                    }

                    top = aboveRowId;
                    bottom = currentTopRowId;
                    rowString = Indexer.between(currentTopRow.rowString, aboveRow.rowString);
                } else {
                    const currentTopRowId = currentRowIds[0];
                    const currentTopRow = rowRegistry.get(currentTopRowId);
                    if (!currentTopRow) {
                        console.warn("❌ Inconsistent row state when adding row");
                        return;
                    }

                    bottom = currentTopRowId;
                    rowString = Indexer.above(currentTopRow.rowString);
                }
            } else { // position === 'bottom'
                if (spaceBelowWithRows) {
                    // insert between top row of the current space and bottom row of the below space
                    const bottomSpace = spaceRegistry.get(spaceBelowWithRows);
                    if (!bottomSpace) {
                        console.warn("❌ Inconsistent space state when adding row");
                        return;
                    }

                    // top row id of bottom Space
                    const belowRowId = bottomSpace.rowIds[0];
                    const belowRow = rowRegistry.get(belowRowId);
                    if (!belowRow) {
                        console.warn("❌ Inconsistent row state when adding row");
                        return;
                    }

                    const currentBottomRowId = currentRowIds[currentRowIds.length - 1];
                    const currentBottomRow = rowRegistry.get(currentBottomRowId);
                    if (!currentBottomRow) {
                        console.warn("❌ Inconsistent row state when adding row");
                        return;
                    }

                    top = currentBottomRowId;
                    bottom = belowRowId;
                    rowString = Indexer.between(belowRow.rowString, currentBottomRow.rowString);
                } else {
                    // rare case, usually means table space had no initial data
                    const currentBottomRowId = currentRowIds[currentRowIds.length - 1];
                    const currentBottomRow = rowRegistry.get(currentBottomRowId);
                    if (!currentBottomRow) {
                        console.warn("❌ Inconsistent row state when adding row");
                        return;
                    }

                    top = currentBottomRowId;
                    rowString = Indexer.below(currentBottomRow.rowString);
                }
            }
        }

        // Create new row object
        const newRow: Row<TData> = {
            spaceId: spaceId,
            data: rowData,
            cells: [],
            top: null,
            bottom: null,
            rowString: rowString
        };

        // Register new row
        rowRegistry.register(newRowId, newRow);
        const coordinator = tableCore.getCellCoordinator();

        if (bottom) {
            coordinator.linkRows(newRowId, bottom)
        }
        if (top) {
            coordinator.linkRows(top, newRowId)
        }

        // Link new row with neighbors in current space

        // Update space.rowIds in registry ONLY (no local state)
        const updatedRowIds = [...currentRowIds];
        updatedRowIds.splice(insertIndex, 0, newRowId);

        currentSpace.rowIds = updatedRowIds;
        spaceRegistry.register(spaceId, currentSpace);

        // Only re-render if render flag is true
        if ('render' in command.payload && command.payload.render) {
            Promise.resolve().then(() => {
                forceRender();
            });
        }
    };

    // Find nearest space above or below that has rows - optimized
    const findNearestSpaceWithRows = (direction: 'above' | 'below'): SpaceId | null => {
        const spaceRegistry = tableCore.getSpaceRegistry();
        const rowRegistry = tableCore.getRowRegistry();
        const currentSpace = spaceRegistry.get(spaceId);
        if (!currentSpace) return null;

        let searchSpaceId = direction === 'above' ? currentSpace.top : currentSpace.bottom;

        while (searchSpaceId) {
            const searchSpace = spaceRegistry.get(searchSpaceId);
            if (!searchSpace) break;

            if (searchSpace.rowIds.length > 0) {
                // Verify that the rows actually exist in the row registry
                const validRowIds = searchSpace.rowIds.filter(rowId => rowRegistry.has(rowId));

                if (validRowIds.length > 0) {
                    // Update space registry with only valid rows if cleanup was needed
                    if (validRowIds.length !== searchSpace.rowIds.length) {
                        console.warn(`🧹 Cleaning up phantom rows in space ${searchSpaceId}:`,
                            searchSpace.rowIds.length - validRowIds.length, 'phantom rows removed');
                        searchSpace.rowIds = validRowIds;
                        spaceRegistry.register(searchSpaceId, searchSpace);
                    }
                    return searchSpaceId;
                } else {
                    // All rows are phantom - clear the space
                    console.warn(`🧹 All rows in space ${searchSpaceId} are phantoms - clearing space rowIds`);
                    searchSpace.rowIds = [];
                    spaceRegistry.register(searchSpaceId, searchSpace);
                }
            }

            searchSpaceId = direction === 'above' ? searchSpace.top : searchSpace.bottom;
        }

        return null;
    };

    // Initialize with table data if provided (only once) - optimized
    useEffect(() => {
        if (initialData && initialData.length > 0 && !initializedRef.current && spaceId === "table-space") {
            initializedRef.current = true;

            const newRowIds: RowId[] = [];
            let previousIndexId: string | undefined = undefined;

            try {
                // Batch create all rows without triggering re-renders
                // Create rows using above() to make indices go higher (as requested)
                const coordinator = tableCore.getCellCoordinator();
                for (let i = 0; i < initialData.length; i++) {
                    const rowId = uuidv4();

                    // Use above() to make indexer go higher for table space (as requested)
                    const rowString: string = previousIndexId === undefined ? Indexer.above() : Indexer.above(previousIndexId);
                    previousIndexId = rowString;

                    // Create Row object
                    const rowObject: Row<TData> = {
                        spaceId: spaceId,
                        data: initialData[i],
                        cells: [],
                        bottom: previousRowRef.current,
                        top: null,
                        rowString: rowString
                    };

                    // Link to previous row
                    tableCore.getRowRegistry().register(rowId, rowObject);
                    newRowIds.unshift(rowId); // Add to beginning to maintain visual order when using above()
                    if (previousRowRef.current) {
                        coordinator.linkRows(rowId, previousRowRef.current);
                    }
                    previousRowRef.current = rowId;
                }

                // Update the space registry with the new row IDs (single update)
                const spaceRegistry = tableCore.getSpaceRegistry();
                const currentSpace = spaceRegistry.get(spaceId);
                if (currentSpace) {
                    currentSpace.rowIds = newRowIds;
                    spaceRegistry.register(spaceId, currentSpace);
                }

                // Calculate expected number of cells for readiness tracking
                if (spaceId === 'table-space' && onCellsRegistered) {
                    expectedCellsCountRef.current = newRowIds.length * config.length;
                    cellsRegisteredCountRef.current = 0;
                }

                // Force a single re-render after all rows are created
                forceRender();

            } catch (error) {
                console.error("❌ Error during table space initialization:", error);
                throw error;
            }
        }
    }, [spaceId, tableCore]); // Removed initialData from deps to prevent re-runs

    // Callback to track cell registration for table space readiness
    const onCellRegistered = () => {
        if (spaceId === 'table-space' && onCellsRegistered && !tableSpaceReadyReportedRef.current) {
            cellsRegisteredCountRef.current += 1;
            if (cellsRegisteredCountRef.current >= expectedCellsCountRef.current && expectedCellsCountRef.current > 0) {
                tableSpaceReadyReportedRef.current = true;
                // Call the cell registration callback
                onCellsRegistered();
            }
        }
    };

    // Get current row IDs from registry
    const currentRowIds = getCurrentRowIds();

    // Always render space (even empty) for handler registration and zero UI footprint
    const linkRowCells = (rowId: RowId) => {
        const row = tableCore.getRowRegistry().get(rowId);
        if (!row) return;

        const cellCoordinator = tableCore.getCellCoordinator();
        const top = tableCore.getRowRegistry().get(row.top!);
        const bottom = tableCore.getRowRegistry().get(row.bottom!);

        // Link this row's cells with the row above
        if (top)
            cellCoordinator.linkRowsCells(top.cells, row.cells);
        // Link this row's cells with the row below
        if (bottom)
            cellCoordinator.linkRowsCells(row.cells, bottom.cells);
    }
    return (
        <div className="flex flex-col">
            {currentRowIds.map((rowId, index) => {
                const row = tableCore.getRowRegistry().get(rowId);
                if (!row) return null;
                tableCore.getCellCoordinator().linkRows(row.top!, rowId);
                tableCore.getCellCoordinator().linkRows(rowId, row.bottom!);

                const tableApis = tableCore.createRowAPI(rowId, spaceId);

                // Get string position from row object
                const stringPosition = getRowIndex(rowId, tableCore);
                if (!stringPosition) {
                    return null;
                }

                const rowProps: RowProps<TData> = {
                    id: rowId,
                    data: row.data,
                    columns: config,
                    tableApis: tableApis,
                    rowIndex: index,
                    rowString: stringPosition,
                    isFirstRow: index === 0,
                    isLastRow: index === currentRowIds.length - 1,
                    onCellsRegistered: () => {
                        linkRowCells(rowId);
                        // For table space, track cell registration completion
                        if (spaceId === 'table-space') {
                            // Use microtask to avoid setState during render
                            Promise.resolve().then(() => {
                                // Each row has config.length cells
                                for (let i = 0; i < config.length; i++) {
                                    onCellRegistered();
                                }
                            });
                        }
                    }
                };

                return (
                    <GridRowWrapper
                        key={rowId}
                        rowProps={rowProps}
                    />
                );
            })}
        </div>
    );
}

// Wrapper to detect when cells are registered - optimized
function GridRowWrapper<TData>({ rowProps }: {
    rowProps: RowProps<TData>;
}) {
    return <GridRow {...rowProps} />;
}
