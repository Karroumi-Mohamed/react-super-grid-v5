import { useEffect, useRef, useState, forwardRef, useImperativeHandle, type JSX, useReducer, useMemo } from 'react';
import type { TableProps, RowProps, RowId, CellId, CellCommand, Cell, CellCommandHandeler, RowCommandHandler, SpaceId } from './core/types';
import { TableCore } from './core/TableCore';
import type { BasePlugin } from './core/BasePlugin';
import { v4 as uuidv4 } from 'uuid';
import { cn } from './core/utils';
import { SpaceOptimized } from './components/SpaceOptimized';
import { Toolbar } from './components/Toolbar';
import { createCellValueHookBuilder } from './hooks/useCellValue';

interface SuperGridProps<TData> extends TableProps<TData> {
    plugins?: BasePlugin[];
}

export interface SuperGridRef {
    dispatchCellCommand: (command: CellCommand) => void;
    focusCell: (cellId: CellId) => void;
    blurCell: (cellId: CellId) => void;
    selectCell: (cellId: CellId) => void;
    editCell: (cellId: CellId) => void;
    updateCellValue: (cellId: CellId, value: any) => void;
    destroyRow: (rowId: RowId) => void;
    getTableCore: () => TableCore | null;
}

export const SuperGrid = forwardRef<SuperGridRef, SuperGridProps<any>>(function SuperGrid<TData>({ data, config, plugins = [] }: SuperGridProps<TData>, ref: React.Ref<SuperGridRef>) {
    const tableCoreRef = useRef<TableCore | null>(null);
    const keyboardOwnerRef = useRef<CellId | null>(null);
    const [tableCoreReady, setTableCoreReady] = useState(false);
    const [allSpacesCreated, setAllSpacesCreated] = useState(false);
    const [allCellsRegistered, setAllCellsRegistered] = useState(false);
    const [pluginsInitialized, setPluginsInitialized] = useState(false);
    const mountedRef = useRef(false);
    const cellRegistrationCallbackRef = useRef<(() => void) | null>(null);
    const [, forceToolbarUpdate] = useReducer(x => x + 1, 0);

    // Expose TableCore methods through ref
    useImperativeHandle(ref, () => ({
        dispatchCellCommand: (command: CellCommand) => {
            tableCoreRef.current?.dispatchCellCommand(command);
        },
        focusCell: (cellId: CellId) => {
            tableCoreRef.current?.focusCell(cellId);
        },
        blurCell: (cellId: CellId) => {
            tableCoreRef.current?.blurCell(cellId);
        },
        selectCell: (cellId: CellId) => {
            tableCoreRef.current?.selectCell(cellId);
        },
        editCell: (cellId: CellId) => {
            tableCoreRef.current?.editCell(cellId);
        },
        updateCellValue: (cellId: CellId, value: any) => {
            tableCoreRef.current?.updateCellValue(cellId, value);
        },
        destroyRow: (rowId: RowId) => {
            tableCoreRef.current?.destroyRow(rowId);
        },
        getTableCore: () => tableCoreRef.current
    }), []);

    // PHASE 1: Initialize TableCore and create ALL spaces (empty) FIRST
    useEffect(() => {
        mountedRef.current = true;

        if (!tableCoreRef.current) {
            tableCoreRef.current = new TableCore();
            tableCoreRef.current.setKeyboardOwnerRef(keyboardOwnerRef);
            tableCoreRef.current.setToolbarChangeCallback(() => {
                forceToolbarUpdate();
            });
        }

        // Add all plugins first (don't initialize yet)
        plugins.forEach(plugin => {
            try {
                tableCoreRef.current!.addPlugin(plugin);
            } catch (error) {
                console.warn('Plugin already registered:', error);
            }
        });

        // Create plugin spaces and set up dependencies
        tableCoreRef.current.getPluginManager().resolvePluginDependencies();
        const orderedPlugins = tableCoreRef.current.getPluginManager().getPluginsInOrder();

        for (const plugin of orderedPlugins) {
            // Create a space for this plugin (empty)
            const pluginSpaceId = tableCoreRef.current.getSpaceCoordinator().createPluginSpace(plugin.name);
            tableCoreRef.current.setPluginSpaceId(plugin.name, pluginSpaceId);
        }

        // Create table space
        const tableSpaceId: SpaceId = 'table-space';
        const spaceRegistry = tableCoreRef.current.getSpaceRegistry();

        if (!spaceRegistry.has(tableSpaceId)) {
            const tableSpace: import('./core/types').Space = {
                name: 'Table Space',
                owner: 'table',
                top: null,
                bottom: null,
                rowIds: []
            };
            spaceRegistry.register(tableSpaceId, tableSpace);
        }

        // Link spaces
        tableCoreRef.current.getSpaceCoordinator().linkLastPluginSpaceToTableSpace('table-space');

        setTableCoreReady(true);
        setAllSpacesCreated(true);

        // Set up callback to track when all cells are registered
        cellRegistrationCallbackRef.current = () => {
            console.log('🔗 All cells registered - ready to initialize plugins');
            setAllCellsRegistered(true);
        };
    }, []); // Only run once

    // PHASE 2: Initialize plugins ONLY after all cells are registered
    useEffect(() => {
        if (!tableCoreReady || !allSpacesCreated || !allCellsRegistered || !tableCoreRef.current) {
            return;
        }

        console.log('🚀 All prerequisites met - spaces created, cells registered - initializing plugins now');

        // Only initialize plugins if not already done
        if (!tableCoreRef.current.arePluginsInitialized()) {
            // Create context-aware APIs for plugins
            const orderedPlugins = tableCoreRef.current.getPluginManager().getPluginsInOrder();

            for (const plugin of orderedPlugins) {
                // Create context-aware APIs for this specific plugin
                const tableAPI = tableCoreRef.current.createPluginAPI(plugin.name);
                const rowAPI: import('./core/BasePlugin').RowPluginAPIs = {} as import('./core/BasePlugin').RowPluginAPIs;
                const rowTableAPI: import('./core/BasePlugin').RowTableAPIs = {} as import('./core/BasePlugin').RowTableAPIs;

                // Give the plugin its bound APIs
                plugin.setAPIs(tableAPI, rowAPI, rowTableAPI);
            }

            // Connect plugins to command registries
            const plugins_list = tableCoreRef.current.getPluginManager().getPlugins();
            tableCoreRef.current.getCellCommandRegistry().setPlugins(plugins_list);
            tableCoreRef.current.getRowCommandRegistry().setPlugins(plugins_list);
            tableCoreRef.current.getSpaceCommandRegistry().setPlugins(plugins_list);

            // NOW initialize plugins - all cells are registered and ready
            tableCoreRef.current.initializePlugins();

            setPluginsInitialized(true); // Trigger re-render to show plugin content
        }

        // Document-level keyboard event listeners
        const handleKeyDown = (event: KeyboardEvent) => {
            if (tableCoreRef.current) {
                tableCoreRef.current.dispatchKeyboardCommand('keydown', event);
            }
        };

        const handleKeyUp = (event: KeyboardEvent) => {
            if (tableCoreRef.current) {
                tableCoreRef.current.dispatchKeyboardCommand('keyup', event);
            }
        };

        // Add listeners to document
        document.addEventListener('keydown', handleKeyDown);
        document.addEventListener('keyup', handleKeyUp);

        return () => {
            // Cleanup event listeners
            document.removeEventListener('keydown', handleKeyDown);
            document.removeEventListener('keyup', handleKeyUp);

            // Only destroy TableCore if component is actually unmounting
            if (!mountedRef.current) {
                tableCoreRef.current?.destroy();
                tableCoreRef.current = null;
            }
        };
    }, [tableCoreReady, allSpacesCreated, allCellsRegistered, pluginsInitialized, plugins]);

    // Cleanup on actual unmount
    useEffect(() => {
        return () => {
            mountedRef.current = false;
            tableCoreRef.current?.destroy();
            tableCoreRef.current = null;
        };
    }, []);

    // Render spaces in plugin dependency order + table space at bottom
    const renderSpaces = () => {
        if (!tableCoreRef.current || !tableCoreReady || !allSpacesCreated) {
            return null;
        }

        const spaces: JSX.Element[] = [];

        // Get plugin spaces in dependency order (first processed = top)
        const orderedPlugins = tableCoreRef.current.getPluginManager().getPluginsInOrder();

        // Render plugin spaces using actual space IDs from registry
        const allSpaceIds = tableCoreRef.current.getSpaceRegistry().list();

        // Always render plugin spaces (empty until plugins are initialized)
        orderedPlugins.forEach(plugin => {
            // Find the space that belongs to this plugin
            let pluginSpaceId: SpaceId | null = null;

            for (const spaceId of allSpaceIds) {
                const space = tableCoreRef.current!.getSpaceRegistry().get(spaceId);
                if (space && space.owner === plugin.name) {
                    pluginSpaceId = spaceId;
                    break;
                }
            }
            if (pluginSpaceId) {
                spaces.push(
                    <SpaceOptimized
                        key={pluginSpaceId}
                        spaceId={pluginSpaceId}
                        tableCore={tableCoreRef.current!}
                        config={config}
                    />
                );
            } else {
                console.warn(`❌ No space found for plugin ${plugin.name}`);
            }
        });

        // Render table space at the bottom with initial data
        const tableSpaceId: SpaceId = 'table-space';

        spaces.push(
            <SpaceOptimized
                key={tableSpaceId}
                spaceId={tableSpaceId}
                tableCore={tableCoreRef.current!}
                config={config}
                initialData={data} // Pass initial data to table space
                onCellsRegistered={cellRegistrationCallbackRef.current} // Pass cell registration callback
            />
        );

        return spaces;
    };

    return (
        <div className="w-full flex flex-col">
            {/* Toolbar - Full width, no scroll */}
            {tableCoreRef.current && (
                <Toolbar buttons={tableCoreRef.current.getToolbarButtons()} />
            )}

            {/* Scrollable grid container */}
            <div className="overflow-x-auto grid-scrollbar">
                {/* Grid content - can be wider than container */}
                <div className="w-fit flex flex-col">
                    {/* Header row */}
                    <div className="flex">
                        {config.map((col, index) => {
                            const isFirst = index === 0;
                            const isLast = index === config.length - 1;
                            const borderClasses = cn(
                                'h-10 box-border',
                                'border-t-[1px]',
                                isFirst && 'border-l-[1px]',
                                'border-b-[1px]',
                                !isLast && 'border-r-[1px]',
                                'border-neutral-200'
                            );

                            return (
                                <div
                                    key={index}
                                    className={borderClasses}
                                    style={{ width: col.width }}
                                >
                                    <div className="h-full w-full flex justify-start items-center p-2 bg-stone-50 hover:bg-stone-100 hover:ring-stone-800 ring-transparent ring-[1px]">
                                        {col.header}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                    {/* Spaces: Plugin spaces (top) + Table space (bottom) */}
                    {renderSpaces()}
                </div>
            </div>
        </div>
    );
});

// Row component that uses the context-aware TableRowAPI (reuse existing implementation)
export function GridRow<TData>({ id, data, columns, tableApis, rowString, isFirstRow, isLastRow, onCellsRegistered }: RowProps<TData>) {
    const [isDestroyed, setIsDestroyed] = useState(false);
    const renderCountRef = useRef(0);

    // Increment render counter and log
    renderCountRef.current += 1;

    // Generate stable cell IDs with spatial coordinates (only once per row instance)
    const cellIdsRef = useRef<CellId[]>([]);

    // Initialize cell IDs with spatial coordinates if not already done
    if (cellIdsRef.current.length !== columns.length) {
        cellIdsRef.current = columns.map((_, colIndex) =>
            `${colIndex.toString().padStart(2, '0')}-${rowString}-${uuidv4()}`
            // New format: "01-30-a1b2c3d4-e5f6-7890-abcd-ef1234567890" (col=1, row="30")
        );
    }

    // Register row command handler
    useEffect(() => {
        const handleRowCommand: RowCommandHandler = (command) => {
            switch (command.name) {
                case 'destroy':
                    setIsDestroyed(true);
                    break;
                default:
                    break;
            }
        };

        tableApis.registerRowHandler(handleRowCommand);

        return () => {
            tableApis.unregisterRowHandler();
        };
    }, [id, tableApis]);

    // Track cell registration completion - use microtask to avoid setState during render
    useEffect(() => {
        if (onCellsRegistered && cellIdsRef.current.length === columns.length) {
            // Use setTimeout to ensure we're completely outside the render cycle
            setTimeout(() => {
                onCellsRegistered();
            }, 0);
        }
    }, [onCellsRegistered, columns.length]);

    // Row creates cell-specific registerCommands functions
    const createCellRegisterFunction = (cellId: string) => {
        return (handler: CellCommandHandeler) => {
            // Row uses TableRowAPI to register the cell with the table
            tableApis.registerCellCommands(cellId, handler);
        };
    };

    // Create hook builder for this row (once per row)
    const hookBuilder = useMemo(() =>
        createCellValueHookBuilder(id, tableApis),
        [id, tableApis]
    );

    // If row is destroyed, render nothing (React will unmount all child cells)
    if (isDestroyed) {
        return null;
    }

    return (
        <div className="w-full flex" data-row-id={id}>
            {columns.map((column, index) => {
                const cellId = cellIdsRef.current[index];
                const cellValue = data ? data[column.key] : null;
                const previousCellId = index > 0 ? cellIdsRef.current[index - 1] : null;
                const nextCellId = index < columns.length - 1 ? cellIdsRef.current[index + 1] : null;

                // Create Cell object with spatial coordinates
                const cellObject: Cell = {
                    rowId: id,
                    top: null,        // Will be linked after all rows are created
                    bottom: null,     // Will be linked after all rows are created
                    left: previousCellId,   // Link to the previous cell in this row
                    right: nextCellId       // Link to the next cell in this row
                };

                // Register the cell object and add to row
                tableApis.registerCell(cellId, cellObject);
                tableApis.addCellToRow(cellId);

                // Create cell-specific registerCommands function
                const cellRegisterCommands = createCellRegisterFunction(cellId);

                // Get action APIs for this cell
                const actionAPIs = tableApis.getCellActionAPIs(cellId);

                // Build context-aware hook for this specific cell
                const cellValueHook = hookBuilder.buildHook(cellId, column.key as string);

                // Create cell props with the cell-aware registerCommands function
                const cellProps = {
                    id: cellId,
                    value: cellValue,
                    config: column, // This should have the proper cell config
                    registerCommands: cellRegisterCommands,
                    registerActions: actionAPIs.registerActions,
                    runAction: actionAPIs.runAction,
                    useCellValue: cellValueHook,
                    position: {
                        isFirstRow: isFirstRow ?? false,
                        isFirstCol: index === 0,
                        isLastRow: isLastRow ?? false,
                        isLastCol: index === columns.length - 1
                    }
                };

                // Render the actual cell component wrapped in event-capturing container
                const CellComponent = column.cell;

                // Conditional borders based on position
                const borderClasses = cn(
                    'box-border',
                    isFirstRow && 'border-t-[1px]',
                    index === 0 && 'border-l-[1px]',
                    'border-b-[1px]', // Always add bottom border
                    index !== columns.length - 1 && 'border-r-[1px]',
                    'border-neutral-200'
                );

                return (
                    <div
                        key={cellId}
                        className={borderClasses}
                        data-cell-id={cellId}
                        style={{ width: column.width }}
                        onClick={(e) => tableApis.sendMouseEvent(cellId, 'click', e.nativeEvent)}
                        onDoubleClick={(e) => tableApis.sendMouseEvent(cellId, 'dblclick', e.nativeEvent)}
                        onContextMenu={(e) => tableApis.sendMouseEvent(cellId, 'contextmenu', e.nativeEvent)}
                        onMouseDown={(e) => tableApis.sendMouseEvent(cellId, 'mousedown', e.nativeEvent)}
                        onMouseUp={(e) => tableApis.sendMouseEvent(cellId, 'mouseup', e.nativeEvent)}
                        onMouseEnter={(e) => tableApis.sendMouseEvent(cellId, 'mouseenter', e.nativeEvent)}
                        onMouseLeave={(e) => tableApis.sendMouseEvent(cellId, 'mouseleave', e.nativeEvent)}
                    >
                        <div className="h-full w-full">
                            <CellComponent {...cellProps} />
                        </div>
                    </div>
                );
            })}
        </div>
    );
}
