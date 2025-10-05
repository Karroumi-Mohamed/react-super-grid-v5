import { useEffect, useRef, useState } from 'react';
import type { RowId, SpaceId, TableConfig, RowProps, SpaceCommand, SpaceCommandHandler, Row } from '../core/types';
import type { TableCore } from '../core/TableCore';
import { GridRow } from '../SuperGrid';
import { v4 as uuidv4 } from 'uuid';
import { Indexer } from '../core/Indexer';

interface SpaceProps<TData> {
    spaceId: SpaceId;
    tableCore: TableCore;
    config: TableConfig<TData>;
    initialData?: TData[]; // Only for table space
}

// Get row string directly from row object
function getRowIndex(rowId: RowId, tableCore: TableCore): string | null {
    const row = tableCore.getRowRegistry().get(rowId);
    return row?.rowString ? row.rowString : null;
}


export function Space<TData>({ spaceId, tableCore, config, initialData }: SpaceProps<TData>) {
    const [rowIds, setRowIds] = useState<RowId[]>([]);
    const renderCountRef = useRef(0);
    const initializedRef = useRef(false);
    renderCountRef.current += 1;
    const previousRowRef = useRef<RowId | null>(null);

    // Register SpaceCommand handler
    useEffect(() => {

        const handleSpaceCommand: SpaceCommandHandler = (command: SpaceCommand) => {

            switch (command.name) {
                case 'addRow':
                    if ('rowData' in command.payload) {
                        handleAddRow(command.payload.rowData, command.payload.position || 'bottom', command);
                    }
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

    // Handle addRow command with cross-space linking
    const handleAddRow = (rowData: any, position: 'top' | 'bottom', _command: SpaceCommand) => {

        const newRowId = uuidv4();
        const rowRegistry = tableCore.getRowRegistry();
        const spaceRegistry = tableCore.getSpaceRegistry();

        // Get current space
        const currentSpace = spaceRegistry.get(spaceId);
        if (!currentSpace) {
            return;
        }

        // Use current space rowIds from registry (most up-to-date) instead of component state
        const currentRowIds = currentSpace.rowIds;

        // Get space insertion context for plugin ordering
        const spaceAboveWithRows = findNearestSpaceWithRows('above');
        const spaceBelowWithRows = findNearestSpaceWithRows('below');

        let rowString: string;

        if (position === 'top') {
            if (currentRowIds.length === 0) {
                // First row in space
                if (spaceAboveWithRows && spaceBelowWithRows) {
                    // Between two spaces with rows
                    const aboveSpace = spaceRegistry.get(spaceAboveWithRows);
                    const belowSpace = spaceRegistry.get(spaceBelowWithRows);
                    const aboveRowString = aboveSpace && aboveSpace.rowIds.length > 0 ? getRowIndex(aboveSpace.rowIds[aboveSpace.rowIds.length - 1], tableCore) : null;
                    const belowRowString = belowSpace && belowSpace.rowIds.length > 0 ? getRowIndex(belowSpace.rowIds[0], tableCore) : null;
                    if (aboveRowString === null || belowRowString === null) {
                        throw new Error("Unexpected null rowString in addRow top between spaces");
                    }
                    rowString = Indexer.between(aboveRowString, belowRowString);
                } else if (spaceAboveWithRows) {
                    // Only space above has rows
                    const aboveSpace = spaceRegistry.get(spaceAboveWithRows);
                    const aboveRowString = aboveSpace && aboveSpace.rowIds.length > 0 ? getRowIndex(aboveSpace.rowIds[aboveSpace.rowIds.length - 1], tableCore) : null;
                    if (aboveRowString === null) {
                        throw new Error("Unexpected null rowString in addRow top above space");
                    }
                    rowString = Indexer.below(aboveRowString);
                } else if (spaceBelowWithRows) {
                    // Only space below has rows
                    const belowSpace = spaceRegistry.get(spaceBelowWithRows);
                    if (!belowSpace) {
                        throw new Error("Unexpected null belowSpace in addRow top below space");
                    }
                    const belowRow = rowRegistry.get(belowSpace.rowIds[0]);
                    if (!belowRow) {
                        throw new Error("Unexpected null belowRow in addRow top below space");
                    }
                    const belowRowString = belowRow.rowString;

                    if (belowRowString === null) {
                        throw new Error("Unexpected null rowString in addRow top below space");
                    }
                    rowString = Indexer.above(belowRowString);
                } else {
                    // No spaces with rows - first row in entire table
                    rowString = Indexer.above();
                }
            } else {
                // Space has existing rows - add above current top
                if (spaceAboveWithRows) {
                    // Space above has rows
                    const aboveSpace = spaceRegistry.get(spaceAboveWithRows);
                    const aboveRowString = aboveSpace && aboveSpace.rowIds.length > 0 ? getRowIndex(aboveSpace.rowIds[aboveSpace.rowIds.length - 1], tableCore) : null;
                    const currentTopRowString = getRowIndex(currentRowIds[0], tableCore);
                    if (aboveRowString === null || currentTopRowString === null) {
                        throw new Error("Unexpected null rowString in addRow top with existing rows and above space");
                    }
                    rowString = Indexer.between(aboveRowString, currentTopRowString);
                } else {
                    // No space above with rows
                    const currentTopRowString = getRowIndex(currentRowIds[0], tableCore);
                    if (currentTopRowString === null) {
                        throw new Error("Unexpected null rowString in addRow top with existing rows and no above space");
                    }
                    rowString = Indexer.above(currentTopRowString);
                }
            }
        } else {
            if (currentRowIds.length === 0) {
                // First row in space
                if (spaceAboveWithRows && spaceBelowWithRows) {
                    // Between two spaces with rows
                    const aboveSpace = spaceRegistry.get(spaceAboveWithRows);
                    const belowSpace = spaceRegistry.get(spaceBelowWithRows);
                    const aboveRowString = aboveSpace && aboveSpace.rowIds.length > 0 ? getRowIndex(aboveSpace.rowIds[aboveSpace.rowIds.length - 1], tableCore) : null;
                    const belowRowString = belowSpace && belowSpace.rowIds.length > 0 ? getRowIndex(belowSpace.rowIds[0], tableCore) : null;
                    if (aboveRowString === null || belowRowString === null) {
                        throw new Error("Unexpected null rowString in addRow top between spaces");
                    }
                    rowString = Indexer.between(aboveRowString, belowRowString);
                } else if (spaceAboveWithRows) {
                    // Only space above has rows
                    const aboveSpace = spaceRegistry.get(spaceAboveWithRows);
                    const aboveRowString = aboveSpace && aboveSpace.rowIds.length > 0 ? getRowIndex(aboveSpace.rowIds[aboveSpace.rowIds.length - 1], tableCore) : null;
                    if (aboveRowString === null) {
                        throw new Error("Unexpected null rowString in addRow top above space");
                    }
                    rowString = Indexer.below(aboveRowString);
                } else if (spaceBelowWithRows) {
                    // Only space below has rows
                    const belowSpace = spaceRegistry.get(spaceBelowWithRows);
                    const belowRowString = belowSpace && belowSpace.rowIds.length > 0 ? getRowIndex(belowSpace.rowIds[0], tableCore) : null;
                    if (belowRowString === null) {
                        throw new Error("Unexpected null rowString in addRow top below space");
                    }
                    rowString = Indexer.above(belowRowString);
                } else {
                    // No spaces with rows - first row in entire table
                    rowString = Indexer.above();
                }
            } else {
                // Space has existing rows - add below current bottom
                if (spaceBelowWithRows) {
                    // Space below has rows
                    const belowSpace = spaceRegistry.get(spaceBelowWithRows);
                    const belowRowString = belowSpace && belowSpace.rowIds.length > 0 ? getRowIndex(belowSpace.rowIds[0], tableCore) : null;
                    const currentBottomRowString = getRowIndex(currentRowIds[currentRowIds.length - 1], tableCore);
                    if (belowRowString === null || currentBottomRowString === null) {
                        throw new Error("Unexpected null rowString in addRow bottom with existing rows and below space");
                    }
                    rowString = Indexer.between(currentBottomRowString, belowRowString);
                } else {
                    // No space below with rows
                    const currentBottomRowString = getRowIndex(currentRowIds[currentRowIds.length - 1], tableCore);
                    if (currentBottomRowString === null) {
                        throw new Error("Unexpected null rowString in addRow bottom with existing rows and no below space");
                    }
                    rowString = Indexer.below(currentBottomRowString);
                }
            }
        }


        // Determine insert index based on position using registry rowIds
        const insertIndex = position === 'top' ? 0 : currentRowIds.length;

        // Create new row object
        const newRow: import('../core/types').Row<TData> = {
            spaceId: spaceId,
            data: rowData,
            cells: [],
            top: null,
            bottom: null,
            rowString: rowString
        };

        // Register new row
        rowRegistry.register(newRowId, newRow);

        // Update rowIds state - use registry data to ensure consistency
        const updatedRowIds = [...currentRowIds];
        updatedRowIds.splice(insertIndex, 0, newRowId);
        setRowIds(updatedRowIds);

        // Update space.rowIds in registry
        currentSpace.rowIds = updatedRowIds;
        spaceRegistry.register(spaceId, currentSpace);

        // Handle cross-space linking after cells are created
        setTimeout(() => {
            handleCrossSpaceLinking(newRowId, position, updatedRowIds);
        }, 50);
    };


    // Handle cross-space linking logic
    const handleCrossSpaceLinking = (newRowId: RowId, position: 'top' | 'bottom', currentRowIds: RowId[]) => {
        const rowRegistry = tableCore.getRowRegistry();

        const newRow = rowRegistry.get(newRowId);
        if (!newRow || newRow.cells.length === 0) {
            return;
        }

        // Find space above with rows
        const spaceAbove = findNearestSpaceWithRows('above');
        // Find space below with rows
        const spaceBelow = findNearestSpaceWithRows('below');

        // Link based on position and available spaces
        if (position === 'top' && currentRowIds.length === 1) {
            // First row in space - link to spaces above and below
            linkToSpaceAbove(newRowId, spaceAbove);
            linkToSpaceBelow(newRowId, spaceBelow);
        } else if (position === 'bottom' && currentRowIds.length === 1) {
            // First row in space - link to spaces above and below
            linkToSpaceAbove(newRowId, spaceAbove);
            linkToSpaceBelow(newRowId, spaceBelow);
        } else {
            // Multiple rows in space - link internally first, then handle cross-space
            linkInternallyAndCrossSpace(newRowId, position, spaceAbove, spaceBelow, currentRowIds);
        }
    };

    // Find nearest space above or below that has rows
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

    // Link new row to space above
    const linkToSpaceAbove = (newRowId: RowId, spaceAboveId: SpaceId | null) => {
        if (!spaceAboveId) return;

        const rowRegistry = tableCore.getRowRegistry();
        const spaceRegistry = tableCore.getSpaceRegistry();
        const coordinator = tableCore.getCellCoordinator();

        const spaceAbove = spaceRegistry.get(spaceAboveId);
        if (!spaceAbove || spaceAbove.rowIds.length === 0) return;

        // Get bottom row of space above
        const aboveBottomRowId = spaceAbove.rowIds[spaceAbove.rowIds.length - 1];
        const aboveBottomRow = rowRegistry.get(aboveBottomRowId);
        const newRow = rowRegistry.get(newRowId);

        if (aboveBottomRow && newRow &&
            aboveBottomRow.cells.length > 0 && newRow.cells.length > 0) {
            coordinator.linkRowsCells(aboveBottomRow.cells, newRow.cells);
        }
    };

    // Link new row to space below
    const linkToSpaceBelow = (newRowId: RowId, spaceBelowId: SpaceId | null) => {
        if (!spaceBelowId) return;

        const rowRegistry = tableCore.getRowRegistry();
        const spaceRegistry = tableCore.getSpaceRegistry();
        const coordinator = tableCore.getCellCoordinator();

        const spaceBelow = spaceRegistry.get(spaceBelowId);
        if (!spaceBelow || spaceBelow.rowIds.length === 0) return;

        // Get top row of space below
        const belowTopRowId = spaceBelow.rowIds[0];
        const belowTopRow = rowRegistry.get(belowTopRowId);
        const newRow = rowRegistry.get(newRowId);

        if (newRow && belowTopRow &&
            newRow.cells.length > 0 && belowTopRow.cells.length > 0) {
            coordinator.linkRowsCells(newRow.cells, belowTopRow.cells);
        }
    };

    // Handle internal linking + cross-space for multi-row spaces
    const linkInternallyAndCrossSpace = (newRowId: RowId, position: 'top' | 'bottom', spaceAbove: SpaceId | null, spaceBelow: SpaceId | null, currentRowIds: RowId[]) => {
        const rowRegistry = tableCore.getRowRegistry();
        const coordinator = tableCore.getCellCoordinator();

        const newRowIndex = currentRowIds.indexOf(newRowId);

        if (position === 'top') {
            // Link new row to existing top row
            if (newRowIndex + 1 < currentRowIds.length) {
                const nextRowId = currentRowIds[newRowIndex + 1];
                const nextRow = rowRegistry.get(nextRowId);
                const newRow = rowRegistry.get(newRowId);

                if (newRow && nextRow && newRow.cells.length > 0 && nextRow.cells.length > 0) {
                    coordinator.linkRowsCells(newRow.cells, nextRow.cells);
                }
            }
            // Link to space above
            linkToSpaceAbove(newRowId, spaceAbove);
        } else {
            // Link existing bottom row to new row
            if (newRowIndex > 0) {
                const prevRowId = currentRowIds[newRowIndex - 1];
                const prevRow = rowRegistry.get(prevRowId);
                const newRow = rowRegistry.get(newRowId);

                if (prevRow && newRow && prevRow.cells.length > 0 && newRow.cells.length > 0) {
                    coordinator.linkRowsCells(prevRow.cells, newRow.cells);
                }
            }
            // Link to space below
            linkToSpaceBelow(newRowId, spaceBelow);
        }
    };

    // Initialize with table data if provided (only once)
    useEffect(() => {
        if (initialData && initialData.length > 0 && rowIds.length === 0 && !initializedRef.current && spaceId === "table-space") {
            initializedRef.current = true;

            previousRowRef.current = null;
            const newRowIds: RowId[] = [];

            // Create rows in visual order: bottom to top using Indexer
            let previousIndexId: string | undefined = undefined;

            try {
                for (let i = 0; i < initialData.length; i++) {
                    const rowId = uuidv4();

                    // Generate index using Indexer - first row uses above(), subsequent rows use above(previous)
                    const rowString: string = i === 0 ? Indexer.above() : Indexer.above(previousIndexId);
                    previousIndexId = rowString;

                    // Create Row object
                    const rowObject: Row<TData> = {
                        spaceId: spaceId,
                        data: initialData[i],
                        cells: [],
                        top: previousRowRef.current,
                        bottom: null,
                        rowString: rowString
                    };

                    // Link to previous row
                    if (previousRowRef.current) {
                        const previousRow = tableCore.getRowRegistry().get(previousRowRef.current);
                        if (previousRow) {
                            previousRow.bottom = rowId;
                            tableCore.getRowRegistry().register(previousRowRef.current, previousRow);
                        }
                    }
                    tableCore.getRowRegistry().register(rowId, rowObject);
                    newRowIds.push(rowId);
                    previousRowRef.current = rowId;
                }
            } catch (error) {
                console.error("❌ Error during table space initialization:", error);
                throw error;
            }

            setRowIds(newRowIds);

            // Also update the space registry with the new row IDs
            const spaceRegistry = tableCore.getSpaceRegistry();
            const currentSpace = spaceRegistry.get(spaceId);
            if (currentSpace) {
                currentSpace.rowIds = newRowIds;
                spaceRegistry.register(spaceId, currentSpace);
            }
        }
    }, [spaceId, tableCore]);

    // Ensure component state stays in sync with registry state
    useEffect(() => {
        const spaceRegistry = tableCore.getSpaceRegistry();
        const currentSpace = spaceRegistry.get(spaceId);

        if (currentSpace && currentSpace.rowIds.length !== rowIds.length) {
            setRowIds([...currentSpace.rowIds]);
        }
    }, [spaceId, tableCore, rowIds.length]);

    // Link cells when a new row gets its cells registered
    const linkRowCells = (currentRowId: RowId) => {
        const coordinator = tableCore.getCellCoordinator();
        const currentRow = tableCore.getRowRegistry().get(currentRowId);

        if (!currentRow || !currentRow.top) return;

        const topRow = tableCore.getRowRegistry().get(currentRow.top);
        if (!topRow) return;

        // Check if both rows have cells and same count
        if (topRow.cells.length > 0 && currentRow.cells.length > 0 &&
            topRow.cells.length === currentRow.cells.length) {

            coordinator.linkRowsCells(topRow.cells, currentRow.cells);
        }
    };

    // Always render space (even empty) for handler registration and zero UI footprint
    return (
        <>
            {rowIds.map((rowId, index) => {
                const row = tableCore.getRowRegistry().get(rowId);
                if (!row) return null;

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
                    isLastRow: index === rowIds.length - 1
                };

                return (
                    <GridRowWrapper
                        key={rowId}
                        rowProps={rowProps}
                        onCellsRegistered={() => linkRowCells(rowId)}
                    />
                );
            })}
        </>
    );
}

// Wrapper to detect when cells are registered
function GridRowWrapper<TData>({ rowProps, onCellsRegistered }: {
    rowProps: RowProps<TData>;
    onCellsRegistered: () => void;
}) {
    const cellsRegisteredRef = useRef(false);

    useEffect(() => {
        // Check if cells are registered after render
        const checkCells = () => {
            if (!cellsRegisteredRef.current) {
                // Simple way to detect cells are ready - we'll call the callback
                onCellsRegistered();
                cellsRegisteredRef.current = true;
            }
        };

        // Call immediately and also after a short delay
        checkCells();
        const timeout = setTimeout(checkCells, 10);
        return () => clearTimeout(timeout);
    });

    return <GridRow {...rowProps} />;
}
