import { useMemo } from 'react';
import type { ToolbarButton } from '../core/types';
import { cn } from '../core/utils';

interface ToolbarProps {
    buttons: ToolbarButton[];
}

/**
 * Toolbar Component
 *
 * Renders toolbar buttons in left and right sections with responsive layout.
 * Styling matches the TextCell aesthetic (no rounded corners, ring borders).
 */
export function Toolbar({ buttons }: ToolbarProps) {
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
                        <ToolbarButton key={button.id} button={button} />
                    ))}
                </div>

                {/* Right section */}
                <div className="flex items-center gap-1 flex-wrap">
                    {rightButtons.map(button => (
                        <ToolbarButton key={button.id} button={button} />
                    ))}
                </div>
            </div>
        </div>
    );
}

interface ToolbarButtonProps {
    button: ToolbarButton;
}

function ToolbarButton({ button }: ToolbarButtonProps) {
    const handleClick = () => {
        if (button.variant !== 'disabled') {
            button.callback();
        }
    };

    return (
        <button
            onClick={handleClick}
            disabled={button.variant === 'disabled'}
            className={cn(
                'h-10 px-3 transition-colors text-sm',
                'border-neutral-200 border-[0.5px] box-border',
                'flex items-center justify-center',
                'ring-[0.5px] ring-inset',
                // Base styling matching header cells
                button.variant === 'normal' && 'bg-stone-50 hover:bg-stone-100 hover:ring-stone-800 ring-transparent text-neutral-700 cursor-pointer',
                button.variant === 'standout' && 'bg-blue-50 hover:bg-blue-100 hover:ring-blue-600 ring-transparent text-blue-700 cursor-pointer',
                button.variant === 'disabled' && 'bg-gray-100 ring-transparent text-gray-400 cursor-not-allowed'
            )}
        >
            {button.label}
        </button>
    );
}
