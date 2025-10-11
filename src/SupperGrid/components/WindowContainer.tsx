import { useEffect, useReducer, useState, useRef } from 'react';
import { Window } from './Window';
import type { TableCore } from '../core/TableCore';

interface WindowContainerProps {
    tableCore: TableCore;
}

export function WindowContainer({ tableCore }: WindowContainerProps) {
    const [, forceUpdate] = useReducer(x => x + 1, 0);
    const [position, setPosition] = useState<{ top: number; left: number } | null>(null);
    const windowRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        tableCore.setWindowChangeCallback(() => forceUpdate());
    }, [tableCore]);

    const activeWindow = tableCore.getActiveWindow();

    // Calculate position when window opens
    useEffect(() => {
        if (!activeWindow) {
            setPosition(null);
            return;
        }

        // Find button element by data-button-id
        const buttonElement = document.querySelector(`[data-button-id="${activeWindow.buttonId}"]`);
        if (!buttonElement) {
            setPosition(null);
            return;
        }

        const buttonRect = buttonElement.getBoundingClientRect();
        const windowHeight = windowRef.current?.offsetHeight || 200; // Estimate if not rendered yet

        // Check if there's space below
        const spaceBelow = window.innerHeight - buttonRect.bottom;
        const spaceAbove = buttonRect.top;

        let top: number;
        let left: number;

        // Position horizontally (align with button left edge)
        left = buttonRect.left;

        // Position vertically (prefer below, fallback to above)
        if (spaceBelow >= windowHeight || spaceBelow >= spaceAbove) {
            // Position below button
            top = buttonRect.bottom + 4;
        } else {
            // Position above button
            top = buttonRect.top - windowHeight - 4;
        }

        setPosition({ top, left });
    }, [activeWindow]);

    if (!activeWindow || !position) return null;

    const WindowComponent = activeWindow.button.window!.component;

    return (
        <>
            {/* Backdrop */}
            <div
                className="fixed inset-0 z-40"
                onClick={() => tableCore.closeWindow()}
            />

            {/* Window */}
            <div
                ref={windowRef}
                className="fixed z-50"
                style={{
                    top: `${position.top}px`,
                    left: `${position.left}px`,
                }}
            >
                <Window
                    title={activeWindow.button.window!.title}
                    onClose={() => tableCore.closeWindow()}
                >
                    <WindowComponent />
                </Window>
            </div>
        </>
    );
}
