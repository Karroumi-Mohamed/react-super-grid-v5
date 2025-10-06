/**
 * ERP Accounting Module Types
 *
 * Represents journal entries, accounts, and transactions
 * for a simple accounting system
 */

export interface JournalEntry {
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

export type JournalEntryResponse = Omit<JournalEntry, 'debit' | 'credit'> & {
    debit: number | null;
    credit: number | null;
};

export interface Account {
    code: string;
    name: string;
    type: 'asset' | 'liability' | 'equity' | 'revenue' | 'expense';
    balance: number;
}

export interface CreateJournalEntryDto {
    date: string;
    accountCode: string;
    accountName: string;
    description: string;
    debit: number;
    credit: number;
    reference?: string;
    status?: 'draft' | 'posted';
}

export interface UpdateJournalEntryDto {
    date?: string;
    accountCode?: string;
    accountName?: string;
    description?: string;
    debit?: number;
    credit?: number;
    reference?: string;
    status?: 'draft' | 'posted' | 'voided';
}

export interface ApiResponse<T> {
    data: T;
}

export interface ApiErrorResponse {
    error: string;
    field?: string;
    code?: string;
}

export interface BulkCreateRequest {
    rows: CreateJournalEntryDto[];
}

export type { JournalEntryResponse as JournalEntryDto };
