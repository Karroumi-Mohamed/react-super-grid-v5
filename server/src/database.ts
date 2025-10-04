/**
 * In-Memory Database for ERP Accounting Module
 *
 * Simple in-memory storage with sample accounting data
 */

import { JournalEntry, Account } from './types';

export class Database {
    private journalEntries: Map<number, JournalEntry> = new Map();
    private accounts: Map<string, Account> = new Map();
    private nextId: number = 1;

    constructor() {
        this.initializeAccounts();
        this.initializeSampleData();
    }

    // ============================================================================
    // Chart of Accounts
    // ============================================================================

    private initializeAccounts() {
        const chartOfAccounts: Account[] = [
            // Assets
            { code: '1000', name: 'Cash', type: 'asset', balance: 50000 },
            { code: '1100', name: 'Accounts Receivable', type: 'asset', balance: 15000 },
            { code: '1200', name: 'Inventory', type: 'asset', balance: 25000 },
            { code: '1500', name: 'Equipment', type: 'asset', balance: 100000 },

            // Liabilities
            { code: '2000', name: 'Accounts Payable', type: 'liability', balance: 8000 },
            { code: '2100', name: 'Notes Payable', type: 'liability', balance: 50000 },
            { code: '2200', name: 'Accrued Expenses', type: 'liability', balance: 3000 },

            // Equity
            { code: '3000', name: 'Owner\'s Capital', type: 'equity', balance: 100000 },
            { code: '3100', name: 'Retained Earnings', type: 'equity', balance: 29000 },

            // Revenue
            { code: '4000', name: 'Sales Revenue', type: 'revenue', balance: 0 },
            { code: '4100', name: 'Service Revenue', type: 'revenue', balance: 0 },
            { code: '4200', name: 'Interest Income', type: 'revenue', balance: 0 },

            // Expenses
            { code: '5000', name: 'Cost of Goods Sold', type: 'expense', balance: 0 },
            { code: '5100', name: 'Salaries Expense', type: 'expense', balance: 0 },
            { code: '5200', name: 'Rent Expense', type: 'expense', balance: 0 },
            { code: '5300', name: 'Utilities Expense', type: 'expense', balance: 0 },
            { code: '5400', name: 'Office Supplies', type: 'expense', balance: 0 },
            { code: '5500', name: 'Depreciation Expense', type: 'expense', balance: 0 },
        ];

        chartOfAccounts.forEach(account => {
            this.accounts.set(account.code, account);
        });
    }

    private initializeSampleData() {
        const sampleEntries: Omit<JournalEntry, 'id' | 'createdAt' | 'updatedAt'>[] = [
            {
                date: '2025-09-01',
                accountCode: '1000',
                accountName: 'Cash',
                description: 'Initial capital investment',
                debit: 100000,
                credit: 0,
                balance: 100000,
                reference: 'INV-001',
                status: 'posted',
                createdBy: 'admin'
            },
            {
                date: '2025-09-01',
                accountCode: '3000',
                accountName: 'Owner\'s Capital',
                description: 'Initial capital investment',
                debit: 0,
                credit: 100000,
                balance: 100000,
                reference: 'INV-001',
                status: 'posted',
                createdBy: 'admin'
            },
            {
                date: '2025-09-05',
                accountCode: '1100',
                accountName: 'Accounts Receivable',
                description: 'Sales on account',
                debit: 15000,
                credit: 0,
                balance: 15000,
                reference: 'INV-002',
                status: 'posted',
                createdBy: 'john.doe'
            },
            {
                date: '2025-09-05',
                accountCode: '4000',
                accountName: 'Sales Revenue',
                description: 'Sales on account',
                debit: 0,
                credit: 15000,
                balance: 15000,
                reference: 'INV-002',
                status: 'posted',
                createdBy: 'john.doe'
            },
            {
                date: '2025-09-10',
                accountCode: '5100',
                accountName: 'Salaries Expense',
                description: 'Monthly salary payment',
                debit: 8000,
                credit: 0,
                balance: 8000,
                reference: 'PAY-001',
                status: 'posted',
                createdBy: 'jane.smith'
            },
            {
                date: '2025-09-10',
                accountCode: '1000',
                accountName: 'Cash',
                description: 'Monthly salary payment',
                debit: 0,
                credit: 8000,
                balance: 92000,
                reference: 'PAY-001',
                status: 'posted',
                createdBy: 'jane.smith'
            },
            {
                date: '2025-09-15',
                accountCode: '5200',
                accountName: 'Rent Expense',
                description: 'Office rent for September',
                debit: 2500,
                credit: 0,
                balance: 2500,
                reference: 'RENT-001',
                status: 'posted',
                createdBy: 'admin'
            },
            {
                date: '2025-09-15',
                accountCode: '1000',
                accountName: 'Cash',
                description: 'Office rent for September',
                debit: 0,
                credit: 2500,
                balance: 89500,
                reference: 'RENT-001',
                status: 'posted',
                createdBy: 'admin'
            },
            {
                date: '2025-09-20',
                accountCode: '1500',
                accountName: 'Equipment',
                description: 'Purchase of office equipment',
                debit: 25000,
                credit: 0,
                balance: 25000,
                reference: 'EQ-001',
                status: 'posted',
                createdBy: 'john.doe'
            },
            {
                date: '2025-09-20',
                accountCode: '1000',
                accountName: 'Cash',
                description: 'Purchase of office equipment',
                debit: 0,
                credit: 25000,
                balance: 64500,
                reference: 'EQ-001',
                status: 'posted',
                createdBy: 'john.doe'
            },
        ];

        sampleEntries.forEach(entry => {
            const now = new Date().toISOString();
            this.journalEntries.set(this.nextId, {
                ...entry,
                id: this.nextId,
                createdAt: now,
                updatedAt: now
            });
            this.nextId++;
        });
    }

    // ============================================================================
    // Journal Entries CRUD
    // ============================================================================

    getAllJournalEntries(sortBy: string = 'id', order: 'asc' | 'desc' = 'asc'): JournalEntry[] {
        const entries = Array.from(this.journalEntries.values());

        entries.sort((a, b) => {
            let aVal: any = a[sortBy as keyof JournalEntry];
            let bVal: any = b[sortBy as keyof JournalEntry];

            if (typeof aVal === 'string') {
                return order === 'asc'
                    ? aVal.localeCompare(bVal)
                    : bVal.localeCompare(aVal);
            }

            return order === 'asc' ? aVal - bVal : bVal - aVal;
        });

        return entries;
    }

    getJournalEntryById(id: number): JournalEntry | undefined {
        return this.journalEntries.get(id);
    }

    createJournalEntry(entry: Omit<JournalEntry, 'id' | 'createdAt' | 'updatedAt' | 'balance' | 'createdBy'>): JournalEntry {
        const now = new Date().toISOString();

        // Calculate balance (debit - credit for asset/expense, credit - debit for liability/equity/revenue)
        const account = this.accounts.get(entry.accountCode);
        let balance = entry.debit - entry.credit;

        if (account) {
            if (['liability', 'equity', 'revenue'].includes(account.type)) {
                balance = entry.credit - entry.debit;
            }
            // Update account balance
            account.balance += balance;
        }

        const newEntry: JournalEntry = {
            ...entry,
            id: this.nextId++,
            balance,
            createdBy: 'system',
            createdAt: now,
            updatedAt: now
        };

        this.journalEntries.set(newEntry.id, newEntry);
        return newEntry;
    }

    createBulkJournalEntries(entries: Omit<JournalEntry, 'id' | 'createdAt' | 'updatedAt' | 'balance' | 'createdBy'>[]): JournalEntry[] {
        return entries.map(entry => this.createJournalEntry(entry));
    }

    updateJournalEntry(id: number, updates: Partial<Omit<JournalEntry, 'id' | 'createdAt' | 'updatedAt'>>): JournalEntry | null {
        const entry = this.journalEntries.get(id);
        if (!entry) {
            return null;
        }

        const updatedEntry: JournalEntry = {
            ...entry,
            ...updates,
            id: entry.id,
            createdAt: entry.createdAt,
            updatedAt: new Date().toISOString()
        };

        // Recalculate balance if debit/credit changed
        if (updates.debit !== undefined || updates.credit !== undefined) {
            const account = this.accounts.get(updatedEntry.accountCode);
            let balance = updatedEntry.debit - updatedEntry.credit;

            if (account && ['liability', 'equity', 'revenue'].includes(account.type)) {
                balance = updatedEntry.credit - updatedEntry.debit;
            }

            updatedEntry.balance = balance;
        }

        this.journalEntries.set(id, updatedEntry);
        return updatedEntry;
    }

    deleteJournalEntry(id: number): boolean {
        return this.journalEntries.delete(id);
    }

    // ============================================================================
    // Accounts
    // ============================================================================

    getAllAccounts(): Account[] {
        return Array.from(this.accounts.values());
    }

    getAccountByCode(code: string): Account | undefined {
        return this.accounts.get(code);
    }

    // ============================================================================
    // Validation
    // ============================================================================

    accountExists(code: string): boolean {
        return this.accounts.has(code);
    }

    referenceExists(reference: string): boolean {
        return Array.from(this.journalEntries.values())
            .some(entry => entry.reference === reference);
    }
}

// Singleton instance
export const db = new Database();
