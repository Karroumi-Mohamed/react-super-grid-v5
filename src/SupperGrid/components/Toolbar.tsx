import { useMemo, useState, useRef, useEffect } from 'react';
import type { ToolbarButton } from '../core/types';
import type { TableCore } from '../core/TableCore';
import { cn } from '../core/utils';
import { Window } from './Window';

interface ToolbarProps {
    buttons: ToolbarButton[];
    tableCore: TableCore;
}

/**
 * Toolbar Component
 *
 * Renders toolbar buttons in left and right sections with responsive layout.
 * Styling matches the TextCell aesthetic (no rounded corners, ring borders).
 */
export function Toolbar({ buttons, tableCore }: ToolbarProps) {
    // Separate buttons by position
    const { leftButtons, rightButtons } = useMemo(() => {
        const left = buttons.filter(btn => btn.position === 'left');
        const right = buttons.filter(btn => btn.position === 'right');
        return { leftButtons: left, rightButtons: right };
    }, [buttons]);

    // Don't render if no buttons
    if (buttons.length === 0) {
        return null;
    }

    return (
        <div className="w-full bg-white">
            <div className="flex items-center justify-between gap-2 py-2 flex-wrap">
                {/* Left section */}
                <div className="flex items-center gap-1 flex-wrap">
                    {leftButtons.map(button => (
                        <ToolbarButton key={button.id} button={button} tableCore={tableCore} />
                    ))}
                </div>

                {/* Right section */}
                <div className="flex items-center gap-1 flex-wrap">
                    {rightButtons.map(button => (
                        <ToolbarButton key={button.id} button={button} tableCore={tableCore} />
                    ))}
                </div>
            </div>
        </div>
    );
}

interface ToolbarButtonProps {
    button: ToolbarButton;
    tableCore: TableCore;
}

function ToolbarButton({ button, tableCore }: ToolbarButtonProps) {
    const [isOpen, setIsOpen] = useState(false);
    const [windowPosition, setWindowPosition] = useState<{
        vertical: 'below' | 'above';
        horizontal: 'left' | 'right';
    } | null>(null);
    const containerRef = useRef<HTMLDivElement>(null);

    // Subscribe to window state changes from TableCore
    useEffect(() => {
        const checkWindowState = () => {
            const activeWindow = tableCore.getActiveWindow();
            const shouldBeOpen = activeWindow?.buttonId === button.id;
            setIsOpen(shouldBeOpen);
        };

        tableCore.setWindowChangeCallback(checkWindowState);
        checkWindowState();
    }, [button.id, tableCore]);

    // Calculate window position when opened
    useEffect(() => {
        if (!isOpen || !containerRef.current || !button.window) {
            setWindowPosition(null);
            return;
        }

        const buttonRect = containerRef.current.getBoundingClientRect();
        const estimatedWindowHeight = 200;
        const estimatedWindowWidth = 300;

        const spaceBelow = window.innerHeight - buttonRect.bottom;
        const spaceAbove = buttonRect.top;
        const spaceRight = window.innerWidth - buttonRect.left;

        // Determine vertical position: prefer below, fallback to above
        const vertical = (spaceBelow >= estimatedWindowHeight || spaceBelow >= spaceAbove)
            ? 'below'
            : 'above';

        // Determine horizontal position: prefer left-aligned, fallback to right-aligned
        const horizontal = (spaceRight >= estimatedWindowWidth)
            ? 'left'
            : 'right';

        setWindowPosition({ vertical, horizontal });
    }, [isOpen, button.window]);

    const handleClick = () => {
        if (button.variant !== 'disabled') {
            if (button.window) {
                tableCore.toggleWindow(button.id);
            } else {
                button.callback();
            }
        }
    };

    const handleClose = () => {
        tableCore.closeWindow();
    };

    // Button without window - simple case
    if (!button.window) {
        return (
            <button
                onClick={handleClick}
                disabled={button.variant === 'disabled'}
                className={cn(
                    'h-10 px-3 transition-colors text-sm',
                    'border-neutral-200 border-[0.5px] box-border',
                    'flex items-center justify-center',
                    'ring-[0.5px] ring-inset',
                    button.variant === 'normal' && 'bg-stone-50 hover:bg-stone-100 hover:ring-stone-800 ring-transparent text-neutral-700 cursor-pointer',
                    button.variant === 'standout' && 'bg-blue-50 hover:bg-blue-100 hover:ring-blue-600 ring-transparent text-blue-700 cursor-pointer',
                    button.variant === 'disabled' && 'bg-gray-100 ring-transparent text-gray-400 cursor-not-allowed'
                )}
            >
                {button.label}
            </button>
        );
    }

    // Button with window - needs container
    const WindowComponent = button.window.component;

    return (
        <div ref={containerRef} className="relative">
            <button
                onClick={handleClick}
                disabled={button.variant === 'disabled'}
                className={cn(
                    'h-10 px-3 transition-colors text-sm',
                    'border-neutral-200 border-[0.5px] box-border',
                    'flex items-center justify-center',
                    'ring-[0.5px] ring-inset',
                    button.variant === 'normal' && 'bg-stone-50 hover:bg-stone-100 hover:ring-stone-800 ring-transparent text-neutral-700 cursor-pointer',
                    button.variant === 'standout' && 'bg-blue-50 hover:bg-blue-100 hover:ring-blue-600 ring-transparent text-blue-700 cursor-pointer',
                    button.variant === 'disabled' && 'bg-gray-100 ring-transparent text-gray-400 cursor-not-allowed'
                )}
            >
                {button.label}
            </button>

            {/* Window positioned relative to button */}
            {isOpen && windowPosition && (
                <>
                    {/* Backdrop */}
                    <div
                        className="fixed inset-0 z-40"
                        onClick={handleClose}
                    />

                    {/* Window */}
                    <div
                        className={cn(
                            'absolute z-50',
                            windowPosition.vertical === 'below' && 'top-full mt-1',
                            windowPosition.vertical === 'above' && 'bottom-full mb-1',
                            windowPosition.horizontal === 'left' && 'left-0',
                            windowPosition.horizontal === 'right' && 'right-0'
                        )}
                    >
                        <Window
                            title={button.window.title}
                            onClose={handleClose}
                        >
                            <WindowComponent />
                        </Window>
                    </div>
                </>
            )}
        </div>
    );
}
