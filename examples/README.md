# React Super Grid - Examples

This directory contains example implementations showcasing different use cases for React Super Grid.

## Available Examples

### 📊 ERP Accounting Module (`AccountingExample.tsx`)

A complete ERP accounting module demonstrating journal entries management with real-time server synchronization.

**Features:**
- ✅ REST API integration with Express/TypeScript backend
- ✅ DraftPlugin for creating journal entries
- ✅ RestPlugin for automatic server synchronization
- ✅ Multi-cell editing
- ✅ Cell selection and keyboard navigation
- ✅ Real-time updates with debouncing
- ✅ Error handling and retry logic
- ✅ Double-entry bookkeeping validation

**Requires:**
- Backend server running (see `server/` directory)

**Quick Start:**

```bash
# Terminal 1 - Start backend server
cd server
npm install
npm run dev

# Terminal 2 - Start frontend (from project root)
npm run dev
```

Then open http://localhost:5173

**What You'll See:**
- Journal entries table with accounting data
- "+" button to add draft entries
- "Save" button to commit drafts to server
- Real-time cell editing with server sync
- Multi-cell selection and editing
- Stats dashboard showing entry count and server status

## How to Use This Example

### 1. Start the Backend Server

The accounting example requires the REST API server:

```bash
cd server
npm install  # or: bun install
npm run dev  # or: bun run dev
```

Server will start on `http://localhost:8080`

Verify it's running:
```bash
curl http://localhost:8080/api/health
```

### 2. Start the Frontend

From the project root:

```bash
npm run dev  # or: bun run dev
```

Frontend will start on `http://localhost:5173`

### 3. Try These Features

**Add Draft Entries:**
1. Click the "+ Add" button (top right)
2. Edit the new draft row
3. Click "Save" to commit to server

**Edit Existing Entries:**
1. Double-click any cell (or click and press Enter)
2. Type new value
3. Press Enter to save
4. Changes auto-save to server after 500ms

**Multi-Cell Edit:**
1. Click a cell
2. Hold Shift and click another cell to select range
3. Edit one cell in the selection
4. All selected cells update with the same value

**Navigate with Keyboard:**
- Arrow keys to move between cells
- Enter to edit
- Escape to cancel edit
- Tab to move to next cell

## API Endpoints Used

The example uses these endpoints:

- `GET /api/journal-entries` - Fetch all entries
- `POST /api/journal-entries` - Create entry
- `PATCH /api/journal-entries/:id` - Update entry
- `DELETE /api/journal-entries/:id` - Delete entry
- `POST /api/journal-entries/bulk` - Bulk create
- `GET /api/accounts` - Fetch chart of accounts

## Plugins Used

- **FocusPlugin** - Cell focus management
- **EditPlugin** - Cell editing logic
- **SelectPlugin** - Multi-cell selection
- **MultiEditPlugin** - Edit multiple cells at once
- **DraftPlugin** - Create draft rows in separate space
- **RestPlugin** - Server synchronization

## Configuration

### RestPlugin Configuration

Located in `AccountingExample.tsx`:

```typescript
const restConfig = {
    baseUrl: 'http://localhost:8080/api',
    auth: { type: 'none' },
    endpoints: {
        create: { method: 'POST', url: '...' },
        update: { method: 'PATCH', url: '...' },
        delete: { method: 'DELETE', url: '...' },
        bulkCreate: { method: 'POST', url: '...' }
    },
    errorHandling: {
        retry: { enabled: true, maxAttempts: 3 }
    },
    optimization: {
        debounceMs: 500,
        optimistic: true
    }
};
```

### Column Configuration

```typescript
const columns = [
    { key: 'date', header: 'Date', width: '120px', cell: TextCell },
    { key: 'accountCode', header: 'Account Code', width: '130px', cell: TextCell },
    { key: 'accountName', header: 'Account Name', width: '200px', cell: TextCell },
    { key: 'description', header: 'Description', width: '300px', cell: TextCell },
    { key: 'debit', header: 'Debit', width: '120px', cell: TextCell },
    { key: 'credit', header: 'Credit', width: '120px', cell: TextCell },
    // ... more columns
];
```

## Troubleshooting

### "Error Loading Data"

**Problem:** Frontend can't connect to backend

**Solution:**
1. Check backend is running: `curl http://localhost:8080/api/health`
2. Check CORS settings in `server/src/index.ts`
3. Check `API_BASE_URL` in `AccountingExample.tsx` matches server port

### "Port already in use"

**Backend (8080):**
```bash
lsof -i :8080
kill -9 <PID>
```

**Frontend (5173):**
```bash
lsof -i :5173
kill -9 <PID>
```

### Data not saving

1. Check browser console for errors
2. Check server console for API errors
3. Verify `debounceMs` is not too high (should be 500ms)
4. Check network tab in browser DevTools

### Draft entries not appearing

1. Make sure DraftPlugin is loaded: check toolbar for "+ Add" button
2. Check console for plugin initialization logs
3. Verify RestPlugin is initialized AFTER DraftPlugin in plugins array

## Architecture

```
┌─────────────────────────────────────────────┐
│         AccountingExample.tsx               │
│                                             │
│  ┌─────────────────────────────────────┐   │
│  │         SuperGrid                   │   │
│  │                                     │   │
│  │  Plugins:                           │   │
│  │  ├─ FocusPlugin                     │   │
│  │  ├─ EditPlugin                      │   │
│  │  ├─ SelectPlugin                    │   │
│  │  ├─ MultiEditPlugin                 │   │
│  │  ├─ DraftPlugin ──┐                 │   │
│  │  └─ RestPlugin ───┼─────────────────┼───┼──> Express Server
│  │                    │                 │   │    (port 8080)
│  │                    │                 │   │
│  │  DraftPlugin.onCommit()             │   │    ┌──────────────┐
│  │         └──calls──> RestPlugin      │   │    │  Database    │
│  │                      │               │   │    │ (in-memory)  │
│  │                      └──POST/PATCH──┼───┼───>│              │
│  │                                     │   │    └──────────────┘
│  └─────────────────────────────────────┘   │
│                                             │
└─────────────────────────────────────────────┘
```

## Next Steps

- [ ] Add authentication example (JWT)
- [ ] Add pagination example
- [ ] Add filtering and search example
- [ ] Add custom cell components example
- [ ] Add CSV import/export example
- [ ] Add validation example
- [ ] Add calculated fields example

## Contributing

To add a new example:

1. Create `examples/YourExample.tsx`
2. Add it to `examples/index.tsx`
3. Update this README
4. Test it works standalone
5. Document required setup

## Resources

- [RestPlugin Documentation](../src/SupperGrid/plugins/RestPlugin.ts)
- [DraftPlugin Documentation](../src/SupperGrid/plugins/DraftPlugin.ts)
- [Server API Documentation](../server/README.md)
- [Architecture Docs](../ARCHITECTURE.md)
