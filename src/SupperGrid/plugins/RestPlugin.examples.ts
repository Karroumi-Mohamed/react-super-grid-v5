/**
 * RestPlugin Configuration Examples
 *
 * This file demonstrates how to configure RestPlugin for various
 * real-world scenarios and backend frameworks.
 */

import type { RestPluginConfig } from './RestPlugin';

// ============================================================================
// Example 1: Laravel Backend (Most Common)
// ============================================================================

export const laravelRestConfig: RestPluginConfig = {
    baseUrl: 'https://api.example.com/api',

    auth: {
        type: 'bearer',
        // Can be static token or function that fetches from localStorage/cookie
        token: () => localStorage.getItem('auth_token') || ''
    },

    endpoints: {
        // Create new row: POST /api/rows
        create: {
            method: 'POST',
            url: (_data) => `https://api.example.com/api/rows`,
            transformRequest: (data) => {
                // Laravel typically expects flat data
                return data;
            },
            transformResponse: (response) => {
                // Laravel typically returns { data: {...} }
                return response.data;
            }
        },

        // Update cell: PATCH /api/rows/{id}
        update: {
            method: 'PATCH',
            url: (rowId, _columnKey, _value) => `https://api.example.com/api/rows/${rowId}`,
            transformRequest: (_rowId, columnKey, value) => {
                // Send just the changed field
                return { [columnKey]: value };
            },
            transformResponse: (response) => {
                return response.data;
            }
        },

        // Delete row: DELETE /api/rows/{id}
        delete: {
            method: 'DELETE',
            url: (rowId) => `https://api.example.com/api/rows/${rowId}`
        },

        // Bulk create: POST /api/rows/bulk
        bulkCreate: {
            method: 'POST',
            url: 'https://api.example.com/api/rows/bulk',
            transformRequest: (data) => {
                // Laravel expects { rows: [...] }
                return { rows: data };
            },
            transformResponse: (response) => {
                // Laravel returns { data: [...] }
                return response.data;
            }
        }
    },

    errorHandling: {
        retry: {
            enabled: true,
            maxAttempts: 3,
            delay: 1000,
            backoff: 'exponential',
            retryOn: [408, 429, 500, 502, 503, 504]
        },
        onError: async (error) => {
            console.error('API Error:', error);
            // Could integrate with toast notification library
            // toast.error(error.message);
        },
        showErrorsInUI: true
    },

    optimization: {
        debounceMs: 500, // Wait 500ms after user stops typing before saving
        optimistic: true, // Update UI immediately, rollback on error
        batchUpdates: {
            enabled: false // Laravel doesn't support batch updates by default
        }
    },

    headers: {
        'Accept': 'application/json',
        'X-Requested-With': 'XMLHttpRequest' // Laravel CSRF
    },

    timeout: 30000,
    debug: import.meta.env?.DEV ?? false
};

// ============================================================================
// Example 2: Laravel with Sanctum Authentication
// ============================================================================

export const laravelSanctumConfig: RestPluginConfig = {
    baseUrl: '/api', // Same-origin requests

    auth: {
        type: 'custom',
        getHeaders: async () => {
            // Sanctum uses cookies for SPA authentication
            // CSRF token is required for state-changing requests
            const csrfToken = document.querySelector('meta[name="csrf-token"]')?.getAttribute('content');
            return {
                'X-CSRF-TOKEN': csrfToken || '',
                'X-Requested-With': 'XMLHttpRequest'
            };
        }
    },

    endpoints: {
        create: {
            method: 'POST',
            url: '/api/rows',
            transformResponse: (response) => response.data
        },
        update: {
            method: 'PATCH',
            url: (rowId) => `/api/rows/${rowId}`,
            transformRequest: (_rowId, columnKey, value) => ({ [columnKey]: value }),
            transformResponse: (response) => response.data
        },
        delete: {
            method: 'DELETE',
            url: (rowId) => `/api/rows/${rowId}`
        },
        bulkCreate: {
            method: 'POST',
            url: '/api/rows/bulk',
            transformRequest: (data) => ({ rows: data }),
            transformResponse: (response) => response.data
        }
    },

    errorHandling: {
        retry: { enabled: true, maxAttempts: 2 },
        onError: async (error) => {
            if (error.statusCode === 419) {
                // CSRF token mismatch - reload page
                console.error('CSRF token expired, reloading page...');
                window.location.reload();
            } else if (error.statusCode === 401) {
                // Unauthorized - redirect to login
                window.location.href = '/login';
            }
        }
    },

    optimization: {
        debounceMs: 300,
        optimistic: true
    },

    debug: true
};

// ============================================================================
// Example 3: RESTful API with JWT Authentication
// ============================================================================

export const jwtRestConfig: RestPluginConfig = {
    baseUrl: 'https://api.example.com/v1',

    auth: {
        type: 'bearer',
        // Async token fetcher - could refresh token if expired
        token: async (): Promise<string> => {
            let token: string = localStorage.getItem('jwt_token') || '';

            // Check if token is expired
            const expiry = localStorage.getItem('jwt_expiry');
            if (expiry && Date.now() > parseInt(expiry)) {
                // Refresh token
                const response = await fetch('https://api.example.com/v1/auth/refresh', {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${localStorage.getItem('refresh_token') || ''}`
                    }
                });

                const data = await response.json();
                token = data.access_token || '';
                localStorage.setItem('jwt_token', token);
                localStorage.setItem('jwt_expiry', String(Date.now() + (data.expires_in || 3600) * 1000));
            }

            return token;
        }
    },

    endpoints: {
        create: {
            method: 'POST',
            url: 'https://api.example.com/v1/items'
        },
        update: {
            method: 'PUT', // Some REST APIs use PUT instead of PATCH
            url: (rowId) => `https://api.example.com/v1/items/${rowId}`,
            transformRequest: (_rowId, columnKey, value) => {
                // Full resource update might be required
                return { [columnKey]: value };
            }
        },
        delete: {
            method: 'DELETE',
            url: (rowId) => `https://api.example.com/v1/items/${rowId}`
        },
        bulkCreate: {
            method: 'POST',
            url: 'https://api.example.com/v1/items/batch'
        }
    },

    errorHandling: {
        retry: {
            enabled: true,
            maxAttempts: 3,
            backoff: 'exponential'
        }
    },

    optimization: {
        debounceMs: 500,
        optimistic: true
    },

    timeout: 15000,
    debug: false
};

// ============================================================================
// Example 4: API Key Authentication (Third-party APIs)
// ============================================================================

export const apiKeyRestConfig: RestPluginConfig = {
    baseUrl: 'https://api.thirdparty.com/v2',

    auth: {
        type: 'api-key',
        key: 'your-api-key-here',
        headerName: 'X-API-Key' // Some use 'X-API-KEY', 'Api-Key', etc.
    },

    endpoints: {
        create: {
            method: 'POST',
            url: 'https://api.thirdparty.com/v2/records'
        },
        update: {
            method: 'PATCH',
            url: (rowId, columnKey, _value) => `https://api.thirdparty.com/v2/records/${rowId}/fields/${columnKey}`,
            transformRequest: (_rowId, _columnKey, value) => ({ value })
        },
        delete: {
            method: 'DELETE',
            url: (rowId) => `https://api.thirdparty.com/v2/records/${rowId}`
        }
    },

    errorHandling: {
        retry: {
            enabled: true,
            maxAttempts: 2,
            retryOn: [429, 500, 502, 503] // Third-party might have rate limits
        },
        onError: async (error) => {
            if (error.statusCode === 429) {
                console.error('Rate limited! Slow down requests.');
            }
        }
    },

    headers: {
        'Accept': 'application/json'
    },

    optimization: {
        debounceMs: 1000, // Higher debounce to avoid rate limits
        optimistic: false // Be conservative with third-party APIs
    },

    debug: true
};

// ============================================================================
// Example 5: GraphQL Backend (via REST plugin)
// ============================================================================

export const graphqlRestConfig: RestPluginConfig = {
    baseUrl: 'https://api.example.com/graphql',

    auth: {
        type: 'bearer',
        token: () => localStorage.getItem('token') || ''
    },

    endpoints: {
        create: {
            method: 'POST',
            url: 'https://api.example.com/graphql',
            transformRequest: (data) => ({
                query: `
                    mutation CreateRow($input: RowInput!) {
                        createRow(input: $input) {
                            id
                            name
                            age
                            email
                        }
                    }
                `,
                variables: { input: data }
            }),
            transformResponse: (response) => response.data.createRow
        },
        update: {
            method: 'POST',
            url: 'https://api.example.com/graphql',
            transformRequest: (rowId, columnKey, value) => ({
                query: `
                    mutation UpdateRow($id: ID!, $field: String!, $value: String!) {
                        updateRow(id: $id, field: $field, value: $value) {
                            id
                        }
                    }
                `,
                variables: { id: rowId, field: columnKey, value: String(value) }
            }),
            transformResponse: (response) => response.data.updateRow
        },
        delete: {
            method: 'POST',
            url: 'https://api.example.com/graphql',
            transformRequest: (rowId) => ({
                query: `
                    mutation DeleteRow($id: ID!) {
                        deleteRow(id: $id) {
                            success
                        }
                    }
                `,
                variables: { id: rowId }
            })
        }
    },

    errorHandling: {
        retry: { enabled: false }, // GraphQL errors usually shouldn't be retried
        onError: async (error) => {
            console.error('GraphQL Error:', error.response);
        }
    },

    optimization: {
        debounceMs: 300,
        optimistic: true
    }
};

// ============================================================================
// Example 6: No Authentication (Public API / Development)
// ============================================================================

export const noAuthRestConfig: RestPluginConfig = {
    baseUrl: 'http://localhost:3000/api',

    auth: {
        type: 'none'
    },

    endpoints: {
        create: {
            method: 'POST',
            url: 'http://localhost:3000/api/rows'
        },
        update: {
            method: 'PATCH',
            url: (rowId) => `http://localhost:3000/api/rows/${rowId}`,
            transformRequest: (_rowId, columnKey, value) => ({ [columnKey]: value })
        },
        delete: {
            method: 'DELETE',
            url: (rowId) => `http://localhost:3000/api/rows/${rowId}`
        },
        bulkCreate: {
            method: 'POST',
            url: 'http://localhost:3000/api/rows/bulk',
            transformRequest: (data) => ({ rows: data })
        }
    },

    errorHandling: {
        retry: { enabled: false } // Don't retry in development
    },

    optimization: {
        debounceMs: 0, // Immediate updates for faster feedback
        optimistic: true
    },

    debug: true // Verbose logging for development
};

// ============================================================================
// Example 7: Complex Custom Headers (Enterprise)
// ============================================================================

export const enterpriseRestConfig: RestPluginConfig = {
    baseUrl: 'https://enterprise-api.example.com/api/v2',

    auth: {
        type: 'custom',
        getHeaders: async () => {
            // Complex auth logic - might involve multiple tokens
            const accessToken = await getAccessToken();
            const tenantId = getCurrentTenantId();
            const sessionId = getSessionId();

            return {
                'Authorization': `Bearer ${accessToken}`,
                'X-Tenant-ID': tenantId,
                'X-Session-ID': sessionId,
                'X-Client-Version': '1.0.0',
                'X-Request-ID': generateRequestId()
            };
        }
    },

    endpoints: {
        create: {
            method: 'POST',
            url: (_data) => {
                const tenantId = getCurrentTenantId();
                return `https://enterprise-api.example.com/api/v2/tenants/${tenantId}/rows`;
            },
            transformRequest: (data) => ({
                ...data,
                metadata: {
                    created_by: getCurrentUserId(),
                    created_at: new Date().toISOString()
                }
            }),
            transformResponse: (response) => response.payload.data
        },
        update: {
            method: 'PUT',
            url: (rowId) => {
                const tenantId = getCurrentTenantId();
                return `https://enterprise-api.example.com/api/v2/tenants/${tenantId}/rows/${rowId}`;
            },
            transformRequest: (_rowId, columnKey, value) => ({
                changes: [{ field: columnKey, value }],
                metadata: {
                    updated_by: getCurrentUserId(),
                    updated_at: new Date().toISOString()
                }
            }),
            transformResponse: (response) => response.payload.data
        },
        bulkCreate: {
            method: 'POST',
            url: `https://enterprise-api.example.com/api/v2/tenants/${getCurrentTenantId()}/rows/bulk`,
            transformRequest: (data) => ({
                items: data,
                batch_metadata: {
                    batch_id: generateBatchId(),
                    submitted_by: getCurrentUserId()
                }
            }),
            transformResponse: (response) => response.payload.items
        }
    },

    errorHandling: {
        retry: {
            enabled: true,
            maxAttempts: 5,
            delay: 2000,
            backoff: 'exponential',
            retryOn: [408, 429, 500, 502, 503, 504]
        },
        onError: async (error) => {
            // Log to enterprise monitoring system
            await logToMonitoringSystem(error);

            // Show user-friendly message
            showErrorNotification(error);

            // Handle specific enterprise error codes
            if (error.statusCode === 402) {
                showPaymentRequiredDialog();
            }
        },
        showErrorsInUI: true
    },

    optimization: {
        debounceMs: 1000,
        optimistic: false, // Enterprise needs confirmed saves
        batchUpdates: {
            enabled: true,
            maxBatchSize: 50,
            batchWindowMs: 200
        }
    },

    headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'X-API-Version': '2.0'
    },

    timeout: 60000, // 60 seconds for slow enterprise systems
    debug: false
};

// ============================================================================
// Utility functions for examples
// ============================================================================

function getAccessToken(): Promise<string> {
    // Implement token refresh logic
    return Promise.resolve(localStorage.getItem('access_token') || '');
}

function getCurrentTenantId(): string {
    return localStorage.getItem('tenant_id') || 'default';
}

function getSessionId(): string {
    return sessionStorage.getItem('session_id') || '';
}

function getCurrentUserId(): string {
    return localStorage.getItem('user_id') || 'anonymous';
}

function generateRequestId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

function generateBatchId(): string {
    return `batch-${Date.now()}`;
}

async function logToMonitoringSystem(error: any): Promise<void> {
    // Send to Sentry, DataDog, etc.
    console.error('Logged to monitoring:', error);
}

function showErrorNotification(error: any): void {
    // Show toast notification
    console.error('User notification:', error.message);
}

function showPaymentRequiredDialog(): void {
    // Show payment dialog
    console.log('Payment required');
}
