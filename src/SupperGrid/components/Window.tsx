import { useEffect } from 'react';
import { cn } from '../core/utils';

interface WindowProps {
    title: string;
    children: React.ReactNode;
    onClose: () => void;
}

/**
 * Window Component
 *
 * Displays a modal-like window with title bar and close button.
 * Handles ESC key to close.
 */
export function Window({ title, children, onClose }: WindowProps) {
    // Handle ESC key
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                onClose();
            }
        };

        document.addEventListener('keydown', handleKeyDown);
        return () => document.removeEventListener('keydown', handleKeyDown);
    }, [onClose]);

    return (
        <div className="bg-white border-[1px] border-neutral-200 shadow-lg min-w-[300px]">
            {/* Title bar */}
            <div className="flex items-center justify-between px-3 py-2 bg-stone-50 border-b-[1px] border-neutral-200">
                <h3 className="text-sm font-medium text-neutral-700">{title}</h3>
                <button
                    onClick={onClose}
                    className={cn(
                        'w-6 h-6 flex items-center justify-center',
                        'hover:bg-neutral-200 transition-colors',
                        'text-neutral-500 hover:text-neutral-700'
                    )}
                    aria-label="Close window"
                >
                    ✕
                </button>
            </div>

            {/* Content */}
            <div className="p-3">
                {children}
            </div>
        </div>
    );
}
