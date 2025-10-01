import type { CellId, CellTableAPIs, ActionMap } from './types';
import type { BasePlugin } from './BasePlugin';

// API call record
interface APICall {
    method: string;
    args: any[];
}

// API handler for plugin interception
type APIHandler = (...args: any[]) => boolean | void;

// APIUsage interface for plugins
export interface APIUsage {
    on(apiName: string, handler: APIHandler): void;
}

// Recording proxy that captures API calls
class APIUsageRecorder implements APIUsage {
    private calls: APICall[] = [];
    private handlers: Map<string, APIHandler[]> = new Map();

    // Record an API call during recording phase
    record(method: string, args: any[]): void {
        this.calls.push({ method, args });
    }

    // Plugin registers handler for specific API
    on(apiName: string, handler: APIHandler): void {
        if (!this.handlers.has(apiName)) {
            this.handlers.set(apiName, []);
        }
        this.handlers.get(apiName)!.push(handler);
    }

    // Get recorded calls
    getCalls(): APICall[] {
        return this.calls;
    }

    // Check if API call should execute (run all handlers)
    shouldExecute(apiName: string, args: any[]): boolean {
        const handlers = this.handlers.get(apiName);
        if (!handlers || handlers.length === 0) {
            return true; // No handlers, allow execution
        }

        // Run all handlers - if ANY returns false, block execution
        for (const handler of handlers) {
            try {
                const result = handler(...args);
                if (result === false) {
                    return false; // Blocked
                }
            } catch (error) {
                console.error(`Error in API handler for ${apiName}:`, error);
                // Continue checking other handlers
            }
        }

        return true; // All handlers allowed or returned void
    }

    clear(): void {
        this.calls = [];
        this.handlers.clear();
    }
}

export class ActionRegistry {
    private actions = new Map<string, ActionMap>(); // cellId -> ActionMap
    private plugins: BasePlugin[] = [];
    private realAPIsFactory: ((cellId: CellId) => CellTableAPIs) | null = null;

    setPlugins(plugins: BasePlugin[]): void {
        this.plugins = plugins;
    }

    setRealAPIsFactory(factory: (cellId: CellId) => CellTableAPIs): void {
        this.realAPIsFactory = factory;
    }

    // Register actions for a specific cell
    register(cellId: CellId, actionMap: ActionMap): void {
        this.actions.set(cellId, actionMap);
    }

    // Unregister actions for a cell
    unregister(cellId: CellId): void {
        this.actions.delete(cellId);
    }

    // Execute action with three-phase model
    execute(cellId: CellId, actionName: string, payload?: any, originPlugin?: string): void {
        const actionMap = this.actions.get(cellId);
        if (!actionMap || !actionMap[actionName]) {
            console.warn(`ActionRegistry: No action "${actionName}" found for cell ${cellId}`);
            return;
        }

        const handler = actionMap[actionName];

        // ==========================================
        // PHASE 1: RECORDING
        // ==========================================
        const recorder = new APIUsageRecorder();
        const recordingAPIs = this.createRecordingProxy(recorder);

        try {
            handler(recordingAPIs, payload);
        } catch (error) {
            console.error(`ActionRegistry: Error during recording phase for action ${actionName}:`, error);
            return;
        }

        // ==========================================
        // PHASE 2: PLUGIN INTERCEPTION
        // ==========================================
        for (const plugin of this.plugins) {
            // Skip plugin that created this action (bypass system)
            if (originPlugin === plugin.name) {
                continue;
            }

            if (!plugin.onBeforeAction) {
                continue;
            }

            try {
                const result = plugin.onBeforeAction(cellId, actionName, recorder);

                // If plugin returns false, stop plugin chain (but still execute remaining APIs)
                if (result === false) {
                    break;
                }
            } catch (error) {
                console.error(`ActionRegistry: Error in plugin ${plugin.name} onBeforeAction:`, error);
                // Continue to next plugin
            }
        }

        // ==========================================
        // PHASE 3: EXECUTION
        // ==========================================
        if (!this.realAPIsFactory) {
            console.error('ActionRegistry: No real APIs factory set');
            return;
        }

        const realAPIs = this.realAPIsFactory(cellId);
        const calls = recorder.getCalls();

        for (const call of calls) {
            // Check if this API should execute (run plugin handlers)
            if (!recorder.shouldExecute(call.method, call.args)) {
                console.log(`ActionRegistry: API "${call.method}" blocked by plugin for cell ${cellId}`);
                continue; // Skip this API
            }

            // Execute real API
            const apiMethod = (realAPIs as any)[call.method];
            if (typeof apiMethod === 'function') {
                try {
                    apiMethod(...call.args);
                } catch (error) {
                    console.error(`ActionRegistry: Error executing API ${call.method}:`, error);
                }
            } else {
                console.warn(`ActionRegistry: API method "${call.method}" not found in real APIs`);
            }
        }

        // Clean up recorder
        recorder.clear();
    }

    // Create recording proxy that captures API calls
    private createRecordingProxy(recorder: APIUsageRecorder): CellTableAPIs {
        return new Proxy({} as CellTableAPIs, {
            get(_target, prop: string) {
                return (...args: any[]) => {
                    recorder.record(prop, args);
                    // Return void (no actual execution)
                };
            }
        });
    }
}
