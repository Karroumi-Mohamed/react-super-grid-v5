/**
 * ERP Accounting Module Example
 *
 * This example demonstrates how to use React Super Grid with the
 * ERP Accounting REST API server for managing journal entries.
 *
 * Features demonstrated:
 * - RestPlugin integration with accounting API
 * - DraftPlugin for creating journal entries
 * - Real-time updates with server synchronization
 * - Multi-cell editing
 * - Cell selection and keyboard navigation
 */

import { useEffect, useState, useRef } from 'react';
import { SuperGrid, type SuperGridRef } from '../src/SupperGrid/SuperGridOptimized';
import type { TableConfig } from '../src/SupperGrid/core/types';
import { TextCell } from '../src/SupperGrid/cells/TextCell';
import { FocusPlugin } from '../src/SupperGrid/plugins/FocusPlugin';
import { EditPlugin } from '../src/SupperGrid/plugins/EditPlugin';
import { SelectPlugin } from '../src/SupperGrid/plugins/SelectionPlugin';
import { MultiEditPlugin } from '../src/SupperGrid/plugins/MultiEditPlugin';
import { DraftPlugin } from '../src/SupperGrid/plugins/DraftPlugin';
import { RestPlugin } from '../src/SupperGrid/plugins/RestPlugin';

// ============================================================================
// Types
// ============================================================================

interface JournalEntry {
    id: number;
    date: string;
    accountCode: string;
    accountName: string;
    description: string;
    debit: number;
    credit: number;
    balance: number;
    reference: string;
    status: 'draft' | 'posted' | 'voided';
    createdBy: string;
    createdAt: string;
    updatedAt: string;
}

interface Account {
    code: string;
    name: string;
    type: 'asset' | 'liability' | 'equity' | 'revenue' | 'expense';
    balance: number;
}

// ============================================================================
// Configuration
// ============================================================================

const API_BASE_URL = 'http://localhost:8080/api';

// RestPlugin Configuration
const restConfig = {
    baseUrl: API_BASE_URL,

    auth: {
        type: 'none' as const
    },

    endpoints: {
        create: {
            method: 'POST' as const,
            url: `${API_BASE_URL}/journal-entries`,
            transformResponse: (response: any) => response.data
        },

        update: {
            method: 'PATCH' as const,
            url: (rowId: string) => `${API_BASE_URL}/journal-entries/${rowId}`,
            transformRequest: (_rowId: string, columnKey: string, value: any) => ({
                [columnKey]: value
            }),
            transformResponse: (response: any) => response.data
        },

        delete: {
            method: 'DELETE' as const,
            url: (rowId: string) => `${API_BASE_URL}/journal-entries/${rowId}`
        },

        bulkCreate: {
            method: 'POST' as const,
            url: `${API_BASE_URL}/journal-entries/bulk`,
            transformRequest: (data: any[]) => ({ rows: data }),
            transformResponse: (response: any) => response.data
        }
    },

    errorHandling: {
        retry: {
            enabled: true,
            maxAttempts: 3,
            delay: 1000,
            backoff: 'exponential' as const
        },
        onError: async (error: any) => {
            console.error('❌ API Error:', error);
            alert(`Error: ${error.message || 'Unknown error occurred'}`);
        },
        showErrorsInUI: true
    },

    optimization: {
        debounceMs: 500,
        optimistic: true
    },

    debug: true
};

// ============================================================================
// Accounting Example Component
// ============================================================================

export function AccountingExample() {
    const [journalEntries, setJournalEntries] = useState<JournalEntry[]>([]);
    const [accounts, setAccounts] = useState<Account[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const gridRef = useRef<SuperGridRef>(null);

    // Plugins
    const focusPlugin = useRef(new FocusPlugin()).current;
    const editPlugin = useRef(new EditPlugin()).current;
    const selectPlugin = useRef(new SelectPlugin()).current;
    const multiEditPlugin = useRef(new MultiEditPlugin()).current;
    const draftPlugin = useRef(new DraftPlugin()).current;
    const restPlugin = useRef(new RestPlugin(restConfig)).current;

    const plugins = [
        focusPlugin,
        editPlugin,
        selectPlugin,
        multiEditPlugin,
        draftPlugin,
        restPlugin
    ];

    // ========================================================================
    // Data Fetching
    // ========================================================================

    useEffect(() => {
        const fetchData = async () => {
            setLoading(true);
            setError(null);

            try {
                // Fetch journal entries
                const entriesResponse = await fetch(`${API_BASE_URL}/journal-entries?sort=date&order=asc`);
                if (!entriesResponse.ok) {
                    throw new Error(`Failed to fetch journal entries: ${entriesResponse.status}`);
                }
                const entriesData = await entriesResponse.json();
                setJournalEntries(entriesData.data);

                // Fetch accounts
                const accountsResponse = await fetch(`${API_BASE_URL}/accounts`);
                if (!accountsResponse.ok) {
                    throw new Error(`Failed to fetch accounts: ${accountsResponse.status}`);
                }
                const accountsData = await accountsResponse.json();
                setAccounts(accountsData.data);

                console.log('✅ Data loaded:', {
                    entries: entriesData.data.length,
                    accounts: accountsData.data.length
                });
            } catch (err) {
                const errorMessage = err instanceof Error ? err.message : 'Failed to fetch data';
                setError(errorMessage);
                console.error('❌ Error fetching data:', err);
            } finally {
                setLoading(false);
            }
        };

        fetchData();
    }, []);

    // ========================================================================
    // Column Configuration
    // ========================================================================

    const columns: TableConfig<JournalEntry> = [
        {
            key: 'date',
            header: 'Date',
            width: '120px',
            cell: TextCell
        },
        {
            key: 'accountCode',
            header: 'Account Code',
            width: '130px',
            cell: TextCell
        },
        {
            key: 'accountName',
            header: 'Account Name',
            width: '200px',
            cell: TextCell
        },
        {
            key: 'description',
            header: 'Description',
            width: '300px',
            cell: TextCell
        },
        {
            key: 'debit',
            header: 'Debit',
            width: '120px',
            cell: TextCell
        },
        {
            key: 'credit',
            header: 'Credit',
            width: '120px',
            cell: TextCell
        },
        {
            key: 'balance',
            header: 'Balance',
            width: '120px',
            cell: TextCell
        },
        {
            key: 'reference',
            header: 'Reference',
            width: '130px',
            cell: TextCell
        },
        {
            key: 'status',
            header: 'Status',
            width: '100px',
            cell: TextCell
        }
    ];

    // ========================================================================
    // Render
    // ========================================================================

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-screen bg-gray-50">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
                    <p className="text-gray-600">Loading accounting data...</p>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="flex items-center justify-center min-h-screen bg-gray-50">
                <div className="bg-red-50 border border-red-200 rounded-lg p-6 max-w-md">
                    <h2 className="text-red-800 font-semibold mb-2">Error Loading Data</h2>
                    <p className="text-red-600 mb-4">{error}</p>
                    <p className="text-sm text-gray-600 mb-4">
                        Make sure the API server is running:
                    </p>
                    <pre className="bg-gray-800 text-green-400 p-3 rounded text-xs overflow-x-auto">
cd server{'\n'}
npm run dev
                    </pre>
                    <button
                        onClick={() => window.location.reload()}
                        className="mt-4 bg-red-600 text-white px-4 py-2 rounded hover:bg-red-700"
                    >
                        Retry
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-50 p-8">
            <div className="max-w-[1600px] mx-auto">
                {/* Header */}
                <div className="mb-6">
                    <h1 className="text-3xl font-bold text-gray-900 mb-2">
                        📊 ERP Accounting Module
                    </h1>
                    <p className="text-gray-600">
                        Journal entries management with React Super Grid
                    </p>
                </div>

                {/* Stats Cards */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                    <div className="bg-white rounded-lg shadow p-4 border border-gray-200">
                        <div className="text-sm text-gray-600 mb-1">Total Entries</div>
                        <div className="text-2xl font-bold text-gray-900">
                            {journalEntries.length}
                        </div>
                    </div>

                    <div className="bg-white rounded-lg shadow p-4 border border-gray-200">
                        <div className="text-sm text-gray-600 mb-1">Chart of Accounts</div>
                        <div className="text-2xl font-bold text-gray-900">
                            {accounts.length}
                        </div>
                    </div>

                    <div className="bg-white rounded-lg shadow p-4 border border-gray-200">
                        <div className="text-sm text-gray-600 mb-1">Server Status</div>
                        <div className="text-2xl font-bold text-green-600">
                            🟢 Connected
                        </div>
                    </div>
                </div>

                {/* Instructions */}
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
                    <h3 className="font-semibold text-blue-900 mb-2">💡 How to Use</h3>
                    <ul className="text-sm text-blue-800 space-y-1">
                        <li>• <strong>Click</strong> a cell to focus it</li>
                        <li>• <strong>Double-click</strong> or press <kbd className="px-1 py-0.5 bg-white rounded">Enter</kbd> to edit</li>
                        <li>• <strong>Press "+"</strong> button to add draft entries (top right)</li>
                        <li>• <strong>Press "Save"</strong> to commit drafts to server</li>
                        <li>• <strong>Select multiple cells</strong> (Shift+Click) and edit one to update all</li>
                        <li>• <strong>Arrow keys</strong> to navigate between cells</li>
                        <li>• <strong>Changes auto-save</strong> to server (with 500ms debounce)</li>
                    </ul>
                </div>

                {/* Account Reference */}
                <details className="bg-white border border-gray-200 rounded-lg p-4 mb-6">
                    <summary className="cursor-pointer font-semibold text-gray-900">
                        📚 Chart of Accounts Reference
                    </summary>
                    <div className="mt-4 grid grid-cols-2 md:grid-cols-3 gap-4">
                        {['asset', 'liability', 'equity', 'revenue', 'expense'].map(type => (
                            <div key={type}>
                                <h4 className="font-semibold text-sm text-gray-700 mb-2 capitalize">
                                    {type}
                                </h4>
                                <div className="space-y-1">
                                    {accounts
                                        .filter(acc => acc.type === type)
                                        .map(acc => (
                                            <div key={acc.code} className="text-xs text-gray-600">
                                                <span className="font-mono">{acc.code}</span> - {acc.name}
                                            </div>
                                        ))
                                    }
                                </div>
                            </div>
                        ))}
                    </div>
                </details>

                {/* Grid */}
                <div className="bg-white rounded-lg shadow-lg border border-gray-200 p-6">
                    <SuperGrid
                        ref={gridRef}
                        data={journalEntries}
                        config={columns}
                        plugins={plugins}
                    />
                </div>

                {/* Footer */}
                <div className="mt-6 text-center text-sm text-gray-500">
                    <p>
                        API Server: <code className="bg-gray-100 px-2 py-1 rounded">{API_BASE_URL}</code>
                    </p>
                    <p className="mt-2">
                        Powered by React Super Grid with RestPlugin + DraftPlugin
                    </p>
                </div>
            </div>
        </div>
    );
}

export default AccountingExample;
