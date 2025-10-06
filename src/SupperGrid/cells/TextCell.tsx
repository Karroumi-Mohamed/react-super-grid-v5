import { useState, useEffect } from 'react';
import type { CellComponent, BaseCellConfig, CellCommand, CellTableAPIs } from '../core/types';
import { cn } from '../core/utils';

interface TextCellConfig extends BaseCellConfig {
    placeholder?: string;
    maxLength?: number;
    readOnly?: boolean;
}

export const TextCell: CellComponent<string, TextCellConfig> = ({
    id,
    value,
    config,
    registerCommands,
    registerActions,
    runAction,
    useCellValue,
    position: _position // Not used, borders handled by container
}) => {
    // Use the context-aware hook - automatically syncs with row data
    const [internalValue, setInternalValue] = useCellValue(value ?? '');

    const [isFocused, setIsFocused] = useState(false);
    const [isSelected, setIsSelected] = useState(false);
    const [isEditing, setIsEditing] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [originalValue, setOriginalValue] = useState<string>(''); // Track value before editing

    // Register command handler when component mounts
    useEffect(() => {
        registerCommands((command: CellCommand) => {
            switch (command.name) {
                case 'focus':
                    setIsFocused(true);
                    break;

                case 'blur':
                    setIsFocused(false);
                    break;

                case 'select':
                    setIsSelected(true);
                    break;

                case 'unselect':
                    setIsSelected(false);
                    break;

                case 'edit':
                    if (!config.readOnly) {
                        // Save current value before entering edit mode
                        setOriginalValue(internalValue);
                        setIsEditing(true);
                        // Request keyboard ownership when entering edit mode
                        runAction('requestKeyboardAction');
                    }
                    break;

                case 'exitEdit':
                    setIsEditing(false);
                    break;

                case 'updateValue':
                    if (command.payload?.value !== undefined) {
                        setInternalValue(String(command.payload.value));
                    }
                    break;

                case 'error':
                    setError(command.payload?.error || 'An error occurred');
                    break;

                default:
                    // Ignore unknown commands
                    break;
            }
        });
    }, [registerCommands, config.readOnly]);

    // Register actions when component mounts
    useEffect(() => {
        registerActions({
            // Request keyboard - claim keyboard ownership for editing
            requestKeyboardAction: (api: CellTableAPIs) => {
                api.requestKeyboard();
            },

            // Save action - update value (which syncs to row data) and release keyboard
            saveAction: (api: CellTableAPIs, newValue: string) => {
                api.save(newValue);  // Dispatches updateValue command (which calls setInternalValue via command handler)
                api.releaseKeyboard();
            },

            // Exit action - just release keyboard without saving
            exitAction: (api: CellTableAPIs) => {
                api.releaseKeyboard();
            },

            // Navigate action - save then move in direction
            navigateAction: (api: CellTableAPIs, direction: 'up' | 'down' | 'left' | 'right') => {
                setInternalValue(internalValue);  // Ensure row data is synced
                api.navigate(direction);
            }
        });
    }, [registerActions, internalValue, setInternalValue]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const newValue = e.target.value;
        if (!config.maxLength || newValue.length <= config.maxLength) {
            setInternalValue(newValue);
            setError(null);
        }
    };

    const handleBlur = () => {
        setIsEditing(false);
        // Value is maintained in cell state, no need to sync back to props
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter') {
            // Use action system to save and exit
            runAction('saveAction', internalValue);
            setIsEditing(false);
            // Stop event from bubbling to document listener
            e.stopPropagation();
        } else if (e.key === 'Escape') {
            // Revert to original value
            setInternalValue(originalValue);
            // Use action system to exit without saving
            runAction('exitAction');
            setIsEditing(false);
            // Stop event from bubbling to document listener
            e.stopPropagation();
        }
    };

    return (
        <div
            className={cn(
                'p-2 transition-colors min-h-[40px] flex items-center w-full relative',
                // Cell states
                config.readOnly && 'bg-gray-100 cursor-not-allowed',
                isSelected && isFocused
                    ? 'bg-neutral-200 ring-[1px] ring-green-300 z-10' // hybrid: focus bg + select ring (outside)
                    : isSelected
                        ? 'bg-green-50 ring-[1px] ring-green-300 z-10'
                        : isFocused
                            ? 'bg-neutral-200 ring-[1px] ring-neutral-800 z-20'
                            : 'bg-white z-0' // normal: no ring, container has border
            )}
            data-cell-id={id}
        >
            {isEditing && !config.readOnly ? (
                <input
                    type="text"
                    value={internalValue}
                    onChange={handleChange}
                    onBlur={handleBlur}
                    onKeyDown={handleKeyDown}
                    placeholder={config.placeholder}
                    maxLength={config.maxLength}
                    autoFocus
                    className="w-full h-full bg-transparent border-none outline-none p-0 m-0"
                />
            ) : (
                <span className={cn(
                    "block truncate",
                    !internalValue && !config.placeholder && "text-center"
                )}>
                    {internalValue || config.placeholder || '—'}
                </span>
            )}
            {error && (
                <span className="ml-2 text-red-500 text-xs">
                    ⚠
                </span>
            )}
        </div>
    );
};
