import { useEffect, useReducer } from 'react';
import { Toolbar } from './Toolbar';
import type { TableCore } from '../core/TableCore';

interface ToolbarContainerProps {
    tableCore: TableCore;
}

export function ToolbarContainer({ tableCore }: ToolbarContainerProps) {
    const [, forceUpdate] = useReducer(x => x + 1, 0);

    useEffect(() => {
        tableCore.setToolbarChangeCallback(() => forceUpdate());
    }, [tableCore]);

    return <Toolbar buttons={tableCore.getToolbarButtons()} tableCore={tableCore} />;
}
