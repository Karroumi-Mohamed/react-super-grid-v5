/**
 * ERP Accounting Module REST API Server
 *
 * A TypeScript/Express server for testing React Super Grid with real accounting data
 */

import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import morgan from 'morgan';
import dotenv from 'dotenv';
import { db } from './database';
import {
    CreateJournalEntryDto,
    UpdateJournalEntryDto,
    ApiResponse,
    ApiErrorResponse,
    BulkCreateRequest,
    JournalEntry,
    JournalEntryResponse
} from './types';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 8080;

const toJournalEntryResponse = (entry: JournalEntry): JournalEntryResponse => ({
    ...entry,
    debit: entry.debit === 0 ? null : entry.debit,
    credit: entry.credit === 0 ? null : entry.credit,
});

// ============================================================================
// Middleware
// ============================================================================

app.use(cors({
    origin: process.env.CORS_ORIGIN || 'http://localhost:5173',
    credentials: true
}));

app.use(express.json());
app.use(morgan('dev'));

// Error handling middleware
app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
    console.error('Error:', err);
    res.status(500).json({
        error: err.message || 'Internal server error'
    } as ApiErrorResponse);
});

// ============================================================================
// Routes
// ============================================================================

/**
 * GET /api/health
 * Health check endpoint
 */
app.get('/api/health', (req: Request, res: Response) => {
    res.json({
        status: 'UP',
        timestamp: new Date().toISOString(),
        service: 'ERP Accounting Module',
        version: '1.0.0'
    });
});

/**
 * GET /api/journal-entries
 * Get all journal entries with optional sorting
 */
app.get('/api/journal-entries', (req: Request, res: Response) => {
    const sortBy = (req.query.sort as string) || 'id';
    const order = (req.query.order as 'asc' | 'desc') || 'asc';

    console.log(`GET /api/journal-entries - sort: ${sortBy}, order: ${order}`);

    const entries = db.getAllJournalEntries(sortBy, order);
    const responseEntries = entries.map(toJournalEntryResponse);

    res.json({
        data: responseEntries
    } as ApiResponse<JournalEntryResponse[]>);
});

/**
 * GET /api/journal-entries/:id
 * Get a single journal entry by ID
 */
app.get('/api/journal-entries/:id', (req: Request, res: Response) => {
    const id = parseInt(req.params.id);

    console.log(`GET /api/journal-entries/${id}`);

    const entry = db.getJournalEntryById(id);

    if (!entry) {
        return res.status(404).json({
            error: 'Journal entry not found',
            code: 'NOT_FOUND'
        } as ApiErrorResponse);
    }

    res.json({
        data: toJournalEntryResponse(entry)
    } as ApiResponse<JournalEntryResponse>);
});

/**
 * POST /api/journal-entries
 * Create a new journal entry
 */
app.post('/api/journal-entries', (req: Request, res: Response) => {
    const dto: CreateJournalEntryDto = req.body;

    console.log('POST /api/journal-entries', dto);

    // Validation
    if (!dto.accountCode || !dto.date || !dto.description) {
        return res.status(400).json({
            error: 'Missing required fields: accountCode, date, description',
            code: 'VALIDATION_ERROR'
        } as ApiErrorResponse);
    }

    if (!db.accountExists(dto.accountCode)) {
        return res.status(400).json({
            error: `Account code ${dto.accountCode} does not exist`,
            field: 'accountCode',
            code: 'INVALID_ACCOUNT'
        } as ApiErrorResponse);
    }

    if (dto.debit < 0 || dto.credit < 0) {
        return res.status(400).json({
            error: 'Debit and credit amounts must be non-negative',
            code: 'INVALID_AMOUNT'
        } as ApiErrorResponse);
    }

    // Business rule: Either debit or credit must be non-zero, but not both
    if ((dto.debit > 0 && dto.credit > 0) || (dto.debit === 0 && dto.credit === 0)) {
        return res.status(400).json({
            error: 'Entry must have either debit or credit (not both or neither)',
            code: 'INVALID_ENTRY'
        } as ApiErrorResponse);
    }

    const entry = db.createJournalEntry({
        ...dto,
        status: dto.status || 'draft',
        reference: dto.reference || `REF-${Date.now()}`
    });

    res.status(201).json({
        data: toJournalEntryResponse(entry)
    } as ApiResponse<JournalEntryResponse>);
});

/**
 * POST /api/journal-entries/bulk
 * Create multiple journal entries at once
 */
app.post('/api/journal-entries/bulk', (req: Request, res: Response) => {
    const { rows }: BulkCreateRequest = req.body;

    console.log(`POST /api/journal-entries/bulk - ${rows.length} entries`);

    if (!rows || !Array.isArray(rows) || rows.length === 0) {
        return res.status(400).json({
            error: 'Request body must contain a "rows" array',
            code: 'INVALID_REQUEST'
        } as ApiErrorResponse);
    }

    // Validate all entries first
    for (const dto of rows) {
        if (!dto.accountCode || !dto.date || !dto.description) {
            return res.status(400).json({
                error: 'All entries must have accountCode, date, and description',
                code: 'VALIDATION_ERROR'
            } as ApiErrorResponse);
        }

        if (!db.accountExists(dto.accountCode)) {
            return res.status(400).json({
                error: `Account code ${dto.accountCode} does not exist`,
                field: 'accountCode',
                code: 'INVALID_ACCOUNT'
            } as ApiErrorResponse);
        }
    }

    const entries = db.createBulkJournalEntries(
        rows.map(dto => ({
            ...dto,
            status: dto.status || 'draft',
            reference: dto.reference || `REF-${Date.now()}`
        }))
    );

    res.status(201).json({
        data: entries.map(toJournalEntryResponse)
    } as ApiResponse<JournalEntryResponse[]>);
});

/**
 * PATCH /api/journal-entries/:id
 * Update a journal entry (partial update)
 */
app.patch('/api/journal-entries/:id', (req: Request, res: Response) => {
    const id = parseInt(req.params.id);
    const updates: UpdateJournalEntryDto = req.body;

    console.log(`PATCH /api/journal-entries/${id}`, updates);

    const existingEntry = db.getJournalEntryById(id);
    if (!existingEntry) {
        return res.status(404).json({
            error: 'Journal entry not found',
            code: 'NOT_FOUND'
        } as ApiErrorResponse);
    }

    // Validation
    if (updates.accountCode && !db.accountExists(updates.accountCode)) {
        return res.status(400).json({
            error: `Account code ${updates.accountCode} does not exist`,
            field: 'accountCode',
            code: 'INVALID_ACCOUNT'
        } as ApiErrorResponse);
    }

    if ((updates.debit !== undefined && updates.debit < 0) ||
        (updates.credit !== undefined && updates.credit < 0)) {
        return res.status(400).json({
            error: 'Debit and credit amounts must be non-negative',
            code: 'INVALID_AMOUNT'
        } as ApiErrorResponse);
    }

    const updatedEntry = db.updateJournalEntry(id, updates);

    if (!updatedEntry) {
        return res.status(404).json({
            error: 'Journal entry not found',
            code: 'NOT_FOUND'
        } as ApiErrorResponse);
    }

    res.json({
        data: toJournalEntryResponse(updatedEntry)
    } as ApiResponse<JournalEntryResponse>);
});

/**
 * DELETE /api/journal-entries/:id
 * Delete a journal entry
 */
app.delete('/api/journal-entries/:id', (req: Request, res: Response) => {
    const id = parseInt(req.params.id);

    console.log(`DELETE /api/journal-entries/${id}`);

    const entry = db.getJournalEntryById(id);
    if (!entry) {
        return res.status(404).json({
            error: 'Journal entry not found',
            code: 'NOT_FOUND'
        } as ApiErrorResponse);
    }

    const deleted = db.deleteJournalEntry(id);

    if (!deleted) {
        return res.status(404).json({
            error: 'Journal entry not found',
            code: 'NOT_FOUND'
        } as ApiErrorResponse);
    }

    res.json({
        message: 'Journal entry deleted successfully',
        id
    });
});

/**
 * GET /api/accounts
 * Get chart of accounts
 */
app.get('/api/accounts', (req: Request, res: Response) => {
    console.log('GET /api/accounts');

    const accounts = db.getAllAccounts();

    res.json({
        data: accounts
    } as ApiResponse<typeof accounts>);
});

/**
 * GET /api/accounts/:code
 * Get a single account by code
 */
app.get('/api/accounts/:code', (req: Request, res: Response) => {
    const code = req.params.code;

    console.log(`GET /api/accounts/${code}`);

    const account = db.getAccountByCode(code);

    if (!account) {
        return res.status(404).json({
            error: 'Account not found',
            code: 'NOT_FOUND'
        } as ApiErrorResponse);
    }

    res.json({
        data: account
    } as ApiResponse<typeof account>);
});

// ============================================================================
// Start Server
// ============================================================================

app.listen(PORT, () => {
    console.log('');
    console.log('🚀 ERP Accounting Module API Server');
    console.log('=====================================');
    console.log(`📍 Server running at: http://localhost:${PORT}`);
    console.log(`🏥 Health check: http://localhost:${PORT}/api/health`);
    console.log(`📊 Journal entries: http://localhost:${PORT}/api/journal-entries`);
    console.log(`📚 Accounts: http://localhost:${PORT}/api/accounts`);
    console.log('');
    console.log('Press Ctrl+C to stop the server');
    console.log('');
});
