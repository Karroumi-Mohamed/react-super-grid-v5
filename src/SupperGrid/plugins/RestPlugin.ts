import { BasePlugin } from '../core/BasePlugin';
import type { CellCommand, RowCommand, CellId, RowId } from '../core/types';
import type { APIUsage } from '../core/ActionRegistry';
import type { DraftPlugin } from './DraftPlugin';

/**
 * RestPlugin Configuration
 *
 * Enterprise-ready REST API integration with support for:
 * - Authentication (Bearer tokens, API keys, custom headers)
 * - Laravel/conventional REST backends
 * - Custom request/response transformers
 * - Error handling and retry logic
 * - Batch operations
 * - Optimistic updates
 */

// ============================================================================
// Configuration Types
// ============================================================================

/**
 * Authentication configuration
 */
export type RestAuthConfig =
    | { type: 'none' }
    | { type: 'bearer'; token: string | (() => string | Promise<string>) }
    | { type: 'api-key'; key: string; headerName?: string }
    | { type: 'custom'; getHeaders: () => Record<string, string> | Promise<Record<string, string>> };

/**
 * HTTP method configuration for CRUD operations
 */
export interface RestEndpointConfig {
    /**
     * Create new row (default: POST /rows)
     */
    create?: {
        method?: 'POST' | 'PUT';
        url: string | ((data: any) => string);
        transformRequest?: (data: any) => any;
        transformResponse?: (response: any) => any;
    };

    /**
     * Update existing row (default: PATCH /rows/:id)
     */
    update?: {
        method?: 'PATCH' | 'PUT' | 'POST';
        url: string | ((rowId: string, columnKey: string, value: any) => string);
        transformRequest?: (rowId: string, columnKey: string, value: any) => any;
        transformResponse?: (response: any) => any;
    };

    /**
     * Delete row (default: DELETE /rows/:id)
     */
    delete?: {
        method?: 'DELETE' | 'POST';
        url: string | ((rowId: string) => string);
        transformRequest?: (rowId: string) => any;
        transformResponse?: (response: any) => any;
    };

    /**
     * Bulk create (for draft commits)
     */
    bulkCreate?: {
        method?: 'POST' | 'PUT';
        url: string;
        transformRequest?: (data: any[]) => any;
        transformResponse?: (response: any) => any[];
    };
}

/**
 * Error handling configuration
 */
export interface RestErrorConfig {
    /**
     * Retry failed requests
     */
    retry?: {
        enabled: boolean;
        maxAttempts?: number; // Default: 3
        delay?: number; // Milliseconds, default: 1000
        backoff?: 'linear' | 'exponential'; // Default: exponential
        retryOn?: number[]; // HTTP status codes to retry on, default: [408, 429, 500, 502, 503, 504]
    };

    /**
     * Handle errors globally
     */
    onError?: (error: RestPluginError) => void | Promise<void>;

    /**
     * Show errors in UI (future: could integrate with NotificationPlugin)
     */
    showErrorsInUI?: boolean;
}

/**
 * Performance and optimization configuration
 */
export interface RestOptimizationConfig {
    /**
     * Debounce rapid cell edits (milliseconds)
     */
    debounceMs?: number; // Default: 0 (no debounce)

    /**
     * Enable optimistic updates (update UI before server confirms)
     */
    optimistic?: boolean; // Default: true

    /**
     * Batch multiple updates into single request
     */
    batchUpdates?: {
        enabled: boolean;
        maxBatchSize?: number; // Default: 10
        batchWindowMs?: number; // Default: 100ms
    };
}

/**
 * Main RestPlugin configuration
 */
export interface RestPluginConfig {
    /**
     * Base URL for API (e.g., 'https://api.example.com' or '/api')
     */
    baseUrl: string;

    /**
     * Authentication configuration
     */
    auth: RestAuthConfig;

    /**
     * Endpoint configuration for CRUD operations
     */
    endpoints: RestEndpointConfig;

    /**
     * Error handling configuration
     */
    errorHandling?: RestErrorConfig;

    /**
     * Performance optimization configuration
     */
    optimization?: RestOptimizationConfig;

    /**
     * Additional headers to include in all requests
     */
    headers?: Record<string, string>;

    /**
     * Request timeout in milliseconds (default: 30000)
     */
    timeout?: number;

    /**
     * Enable detailed logging for debugging
     */
    debug?: boolean;
}

// ============================================================================
// Error Types
// ============================================================================

export class RestPluginError extends Error {
    public readonly operation: 'create' | 'update' | 'delete' | 'bulkCreate';
    public readonly statusCode?: number;
    public readonly response?: any;
    public readonly originalError?: Error;

    constructor(
        message: string,
        operation: 'create' | 'update' | 'delete' | 'bulkCreate',
        statusCode?: number,
        response?: any,
        originalError?: Error
    ) {
        super(message);
        this.name = 'RestPluginError';
        this.operation = operation;
        this.statusCode = statusCode;
        this.response = response;
        this.originalError = originalError;
    }
}

// ============================================================================
// RestPlugin Implementation
// ============================================================================

export class RestPlugin extends BasePlugin {
    readonly name = 'rest-plugin';
    readonly version = '1.0.0';
    readonly dependencies = ['draft-plugin']; // Optional dependency

    private config: RestPluginConfig;
    private draftPlugin: DraftPlugin | null = null;
    private pendingRequests = new Map<string, AbortController>();
    private updateQueue = new Map<string, { columnKey: string; value: any; timestamp: number }>();
    private debounceTimers = new Map<string, ReturnType<typeof setTimeout>>();

    constructor(config: RestPluginConfig) {
        super();
        this.config = this.normalizeConfig(config);
    }

    /**
     * Normalize and apply defaults to configuration
     */
    private normalizeConfig(config: RestPluginConfig): RestPluginConfig {
        const normalized: RestPluginConfig = {
            ...config,
            timeout: config.timeout ?? 30000,
            debug: config.debug ?? false,
            headers: config.headers ?? {},
            errorHandling: {
                retry: {
                    enabled: config.errorHandling?.retry?.enabled ?? false,
                    maxAttempts: config.errorHandling?.retry?.maxAttempts ?? 3,
                    delay: config.errorHandling?.retry?.delay ?? 1000,
                    backoff: config.errorHandling?.retry?.backoff ?? 'exponential',
                    retryOn: config.errorHandling?.retry?.retryOn ?? [408, 429, 500, 502, 503, 504]
                },
                onError: config.errorHandling?.onError,
                showErrorsInUI: config.errorHandling?.showErrorsInUI ?? false
            },
            optimization: {
                debounceMs: config.optimization?.debounceMs ?? 0,
                optimistic: config.optimization?.optimistic ?? true,
                batchUpdates: config.optimization?.batchUpdates ?? { enabled: false }
            }
        };
        return normalized;
    }

    onInit(): void {
        this.log('🌐 RestPlugin: Initialized');

        // Try to get DraftPlugin (optional dependency)
        this.draftPlugin = this.getPlugin<DraftPlugin>('draft-plugin');

        if (this.draftPlugin) {
            // Register callback with DraftPlugin
            this.draftPlugin.onCommit(async (drafts) => {
                await this.handleDraftCommit(drafts);
            });
            this.log('🌐 RestPlugin: Registered with DraftPlugin');
        } else {
            this.log('🌐 RestPlugin: DraftPlugin not found (OK if not using drafts)');
        }
    }

    onDestroy(): void {
        // Cancel all pending requests
        this.pendingRequests.forEach(controller => controller.abort());
        this.pendingRequests.clear();

        // Clear all debounce timers
        this.debounceTimers.forEach(timer => clearTimeout(timer));
        this.debounceTimers.clear();

        this.updateQueue.clear();
        this.log('🌐 RestPlugin: Destroyed');
    }

    onBeforeCellCommand(_command: CellCommand): boolean | void {
        return true; // Allow all commands
    }

    onBeforeRowCommand<K extends keyof import('../core/types').RowCommandMap>(
        _command: RowCommand<K>
    ): boolean | void {
        return true; // Allow all commands
    }

    /**
     * Intercept saveAction to sync cell edits to server
     */
    onBeforeAction(cellId: CellId, actionName: string, apiUsage: APIUsage): boolean | void {
        if (actionName !== 'saveAction') return true;

        const cell = this.tableAPIs!.getCellRegistry().get(cellId);
        if (!cell) return true;

        const row = this.tableAPIs!.getRowRegistry().get(cell.rowId);
        if (!row || row.spaceId !== 'table-space') {
            // Only sync table-space rows (ignore plugin spaces like draft-plugin)
            return true;
        }

        // Listen for save API call
        apiUsage.on('save', (value: any) => {
            this.handleCellUpdate(cell.rowId, cellId, value).catch(error => {
                console.error('🌐 RestPlugin: Failed to handle cell update:', error);
            });
            return true;
        });

        return true;
    }

    // ========================================================================
    // Cell Update Handling
    // ========================================================================

    /**
     * Handle cell value update (with debouncing if configured)
     */
    private async handleCellUpdate(rowId: RowId, cellId: CellId, value: any): Promise<void> {
        const debounceMs = this.config.optimization?.debounceMs ?? 0;

        if (debounceMs > 0) {
            // Clear existing debounce timer for this cell
            const existingTimer = this.debounceTimers.get(cellId);
            if (existingTimer) {
                clearTimeout(existingTimer);
            }

            // Set new debounce timer
            const timer = setTimeout(() => {
                this.sendCellUpdate(rowId, cellId, value);
                this.debounceTimers.delete(cellId);
            }, debounceMs);

            this.debounceTimers.set(cellId, timer);
        } else {
            // No debounce - send immediately
            await this.sendCellUpdate(rowId, cellId, value);
        }
    }

    /**
     * Send cell update to server
     */
    private async sendCellUpdate(rowId: RowId, cellId: CellId, value: any): Promise<void> {
        // Get column key from cell ID (format: "colIndex-rowString-uuid")
        const columnKey = this.getColumnKeyFromCellId(cellId);
        if (!columnKey) {
            console.error('🌐 RestPlugin: Could not determine column key from cell ID');
            return;
        }

        this.log(`🌐 RestPlugin: Updating cell ${cellId} (row: ${rowId}, column: ${columnKey}, value: ${value})`);

        try {
            await this.makeUpdateRequest(rowId, columnKey, value);
            this.log(`🌐 RestPlugin: Cell update successful`);
        } catch (error) {
            await this.handleError(error as Error, 'update', { rowId, cellId, columnKey, value });
        }
    }

    // ========================================================================
    // Draft Commit Handling
    // ========================================================================

    /**
     * Handle draft commit from DraftPlugin
     */
    private async handleDraftCommit(drafts: any[]): Promise<void> {
        this.log(`🌐 RestPlugin: Committing ${drafts.length} drafts to server`);

        try {
            let serverRows: any[];

            // Use bulk endpoint if available, otherwise create individually
            if (this.config.endpoints.bulkCreate) {
                serverRows = await this.makeBulkCreateRequest(drafts);
            } else {
                serverRows = await Promise.all(
                    drafts.map(data => this.makeCreateRequest(data))
                );
            }

            this.log(`🌐 RestPlugin: Server returned ${serverRows.length} rows`);

            // Add server rows to table-space
            serverRows.forEach(row => {
                this.tableAPIs!.createRowInTableSpace(row, 'top');
            });

            this.log('🌐 RestPlugin: Draft commit complete');
        } catch (error) {
            await this.handleError(error as Error, 'bulkCreate', { drafts });
            throw error; // Re-throw so DraftPlugin knows it failed
        }
    }

    // ========================================================================
    // HTTP Request Methods
    // ========================================================================

    /**
     * Make HTTP request with authentication and error handling
     */
    private async makeRequest(
        url: string,
        options: RequestInit,
        operation: 'create' | 'update' | 'delete' | 'bulkCreate',
        retryCount = 0
    ): Promise<any> {
        const controller = new AbortController();
        const requestId = `${operation}-${Date.now()}`;
        this.pendingRequests.set(requestId, controller);

        try {
            // Build headers
            const headers = await this.buildHeaders();

            // Make request with timeout
            const timeoutId = setTimeout(() => controller.abort(), this.config.timeout!);

            const response = await fetch(url, {
                ...options,
                headers: {
                    ...headers,
                    ...options.headers
                },
                signal: controller.signal
            });

            clearTimeout(timeoutId);
            this.pendingRequests.delete(requestId);

            // Handle non-OK responses
            if (!response.ok) {
                const errorBody = await response.text();

                // Check if we should retry
                const shouldRetry = this.shouldRetry(response.status, retryCount);
                if (shouldRetry) {
                    const delay = this.calculateRetryDelay(retryCount);
                    this.log(`🌐 RestPlugin: Retrying request after ${delay}ms (attempt ${retryCount + 1})`);
                    await this.sleep(delay);
                    return this.makeRequest(url, options, operation, retryCount + 1);
                }

                throw new RestPluginError(
                    `HTTP ${response.status}: ${errorBody}`,
                    operation,
                    response.status,
                    errorBody
                );
            }

            // Parse response
            const contentType = response.headers.get('content-type');
            if (contentType?.includes('application/json')) {
                return await response.json();
            } else {
                return await response.text();
            }
        } catch (error) {
            this.pendingRequests.delete(requestId);

            if (error instanceof RestPluginError) {
                throw error;
            }

            // Network error or timeout
            const shouldRetry = retryCount < (this.config.errorHandling?.retry?.maxAttempts ?? 3);
            if (shouldRetry && this.config.errorHandling?.retry?.enabled) {
                const delay = this.calculateRetryDelay(retryCount);
                this.log(`🌐 RestPlugin: Retrying after network error (attempt ${retryCount + 1})`);
                await this.sleep(delay);
                return this.makeRequest(url, options, operation, retryCount + 1);
            }

            throw new RestPluginError(
                `Network error: ${(error as Error).message}`,
                operation,
                undefined,
                undefined,
                error as Error
            );
        }
    }

    /**
     * Make CREATE request
     */
    private async makeCreateRequest(data: any): Promise<any> {
        const endpoint = this.config.endpoints.create;

        const url = typeof endpoint?.url === 'function'
            ? endpoint.url(data)
            : endpoint?.url ?? `${this.config.baseUrl}/rows`;

        const method = endpoint?.method ?? 'POST';

        const requestBody = endpoint?.transformRequest
            ? endpoint.transformRequest(data)
            : data;

        const response = await this.makeRequest(
            url,
            {
                method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(requestBody)
            },
            'create'
        );

        return endpoint?.transformResponse
            ? endpoint.transformResponse(response)
            : response;
    }

    /**
     * Make BULK CREATE request
     */
    private async makeBulkCreateRequest(data: any[]): Promise<any[]> {
        const endpoint = this.config.endpoints.bulkCreate;
        if (!endpoint) {
            throw new Error('Bulk create endpoint not configured');
        }

        const url = endpoint.url;
        const method = endpoint.method ?? 'POST';

        const requestBody = endpoint.transformRequest
            ? endpoint.transformRequest(data)
            : { rows: data }; // Default Laravel format

        const response = await this.makeRequest(
            url,
            {
                method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(requestBody)
            },
            'bulkCreate'
        );

        return endpoint.transformResponse
            ? endpoint.transformResponse(response)
            : response;
    }

    /**
     * Make UPDATE request
     */
    private async makeUpdateRequest(rowId: RowId, columnKey: string, value: any): Promise<any> {
        const endpoint = this.config.endpoints.update;

        const url = typeof endpoint?.url === 'function'
            ? endpoint.url(rowId, columnKey, value)
            : endpoint?.url ?? `${this.config.baseUrl}/rows/${rowId}`;

        const method = endpoint?.method ?? 'PATCH';

        const requestBody = endpoint?.transformRequest
            ? endpoint.transformRequest(rowId, columnKey, value)
            : { [columnKey]: value }; // Default format

        const response = await this.makeRequest(
            url,
            {
                method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(requestBody)
            },
            'update'
        );

        return endpoint?.transformResponse
            ? endpoint.transformResponse(response)
            : response;
    }

    // ========================================================================
    // Authentication
    // ========================================================================

    /**
     * Build authentication headers
     */
    private async buildHeaders(): Promise<Record<string, string>> {
        const headers: Record<string, string> = {
            'Content-Type': 'application/json',
            ...this.config.headers
        };

        switch (this.config.auth.type) {
            case 'bearer': {
                const token = typeof this.config.auth.token === 'function'
                    ? await this.config.auth.token()
                    : this.config.auth.token;
                headers['Authorization'] = `Bearer ${token}`;
                break;
            }
            case 'api-key': {
                const headerName = this.config.auth.headerName ?? 'X-API-Key';
                headers[headerName] = this.config.auth.key;
                break;
            }
            case 'custom': {
                const customHeaders = await this.config.auth.getHeaders();
                Object.assign(headers, customHeaders);
                break;
            }
            case 'none':
                // No authentication
                break;
        }

        return headers;
    }

    // ========================================================================
    // Error Handling & Retry Logic
    // ========================================================================

    /**
     * Handle errors globally
     */
    private async handleError(
        error: Error,
        operation: 'create' | 'update' | 'delete' | 'bulkCreate',
        _context?: any
    ): Promise<void> {
        const pluginError = error instanceof RestPluginError
            ? error
            : new RestPluginError(error.message, operation, undefined, undefined, error);

        console.error(`🌐 RestPlugin: ${operation} failed:`, pluginError);

        if (this.config.errorHandling?.onError) {
            await this.config.errorHandling.onError(pluginError);
        }

        if (this.config.errorHandling?.showErrorsInUI) {
            // TODO: Integrate with NotificationPlugin when available
            console.error('UI Error notification:', pluginError.message);
        }
    }

    /**
     * Determine if request should be retried
     */
    private shouldRetry(statusCode: number, retryCount: number): boolean {
        if (!this.config.errorHandling?.retry?.enabled) return false;
        if (retryCount >= (this.config.errorHandling.retry.maxAttempts ?? 3)) return false;

        const retryOn = this.config.errorHandling.retry.retryOn ?? [408, 429, 500, 502, 503, 504];
        return retryOn.includes(statusCode);
    }

    /**
     * Calculate retry delay with backoff
     */
    private calculateRetryDelay(retryCount: number): number {
        const baseDelay = this.config.errorHandling?.retry?.delay ?? 1000;
        const backoff = this.config.errorHandling?.retry?.backoff ?? 'exponential';

        if (backoff === 'exponential') {
            return baseDelay * Math.pow(2, retryCount);
        } else {
            return baseDelay * (retryCount + 1);
        }
    }

    // ========================================================================
    // Utility Methods
    // ========================================================================

    /**
     * Get column key from cell ID format "colIndex-rowString-uuid"
     */
    private getColumnKeyFromCellId(cellId: CellId): string | null {
        // TODO: This needs to be improved - we need a way to map cell ID to column config
        // For now, we'll need to traverse the config to find the column
        // This is a limitation that might need architectural improvement

        // Parse column index from cell ID
        const parts = cellId.split('-');
        if (parts.length < 3) return null;

        const colIndex = parseInt(parts[0], 10);
        if (isNaN(colIndex)) return null;

        // Get column config from table (we need access to table config here)
        // This is a TODO - we need to store column config in plugin or pass it differently
        console.warn('🌐 RestPlugin: Column key extraction needs implementation');
        return `column_${colIndex}`; // Placeholder
    }

    /**
     * Sleep utility for retry delays
     */
    private sleep(ms: number): Promise<void> {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    /**
     * Debug logging
     */
    private log(message: string, ...args: any[]): void {
        if (this.config.debug) {
            console.log(message, ...args);
        }
    }
}
