# 🚀 Quick Start - ERP Accounting Example

Get the React Super Grid ERP Accounting example up and running in 2 minutes.

## Prerequisites

- Node.js 18+ (or Bun)
- A terminal

## Setup in 3 Steps

### 1. Install Dependencies

```bash
# Install frontend dependencies (from project root)
npm install
# or: bun install

# Install backend dependencies
cd server
npm install
# or: bun install
cd ..
```

### 2. Start the Backend Server

```bash
# In terminal 1
cd server
npm run dev
# or: bun run dev
```

You should see:
```
🚀 ERP Accounting Module API Server
=====================================
📍 Server running at: http://localhost:8080
🏥 Health check: http://localhost:8080/api/health
```

### 3. Start the Frontend

```bash
# In terminal 2 (from project root)
npm run dev
# or: bun run dev
```

You should see:
```
  ➜  Local:   http://localhost:5173/
```

## Open in Browser

Navigate to **http://localhost:5173**

You should see the ERP Accounting Module with journal entries!

## What You Can Do

✅ **View journal entries** - See 10 pre-loaded accounting transactions

✅ **Edit cells** - Double-click any cell to edit (changes auto-save to server)

✅ **Add draft entries** - Click "+ Add" button (top right)

✅ **Save drafts** - Click "Save" to commit draft entries to server

✅ **Multi-cell edit** - Select multiple cells (Shift+Click) and edit one to update all

✅ **Navigate with keyboard** - Arrow keys, Enter to edit, Escape to cancel

## Architecture

```
Frontend (React)              Backend (Express)
─────────────────            ──────────────────

SuperGrid                     REST API
  ├─ FocusPlugin                /api/journal-entries
  ├─ EditPlugin                 /api/accounts
  ├─ SelectPlugin
  ├─ MultiEditPlugin          In-Memory Database
  ├─ DraftPlugin ─────────┐     ├─ Journal Entries
  └─ RestPlugin ──────────┼────>├─ Chart of Accounts
                          │     └─ Accounting Rules
                          │
                    (HTTP REST)
```

## Testing

### Test Backend API

```bash
# Health check
curl http://localhost:8080/api/health

# Get journal entries
curl http://localhost:8080/api/journal-entries

# Get chart of accounts
curl http://localhost:8080/api/accounts
```

### Test Frontend

1. **Edit a cell**:
   - Double-click any description cell
   - Change the text
   - Press Enter
   - Check server console - you should see a PATCH request

2. **Add a draft**:
   - Click "+ Add" button
   - Edit the new row
   - Click "Save"
   - New entry appears in table with server-assigned ID

3. **Multi-edit**:
   - Click the status cell of first row
   - Shift+Click the status cell of third row
   - Edit one of the selected cells to "posted"
   - All selected cells update

## Troubleshooting

### Backend won't start

**"Port 8080 already in use"**
```bash
lsof -i :8080
kill -9 <PID>
```

### Frontend won't start

**"Port 5173 already in use"**
```bash
lsof -i :5173
kill -9 <PID>
```

### "Error Loading Data"

1. Backend not running → Start it: `cd server && npm run dev`
2. Wrong port → Check `API_BASE_URL` in `examples/AccountingExample.tsx`
3. CORS issue → Check `server/src/index.ts` CORS config

### Changes not saving

1. Check browser console (F12) for errors
2. Check server console for API errors
3. Wait 500ms - changes are debounced

## Next Steps

📚 **Read the full documentation**:
- [Examples README](./examples/README.md) - Detailed feature guide
- [Server README](./server/README.md) - API documentation
- [RestPlugin Examples](./src/SupperGrid/plugins/RestPlugin.examples.ts) - Configuration examples

🎨 **Customize**:
- Add more columns to the grid
- Add validation rules
- Add calculated fields
- Add authentication

🚀 **Deploy**:
- Connect to real database (PostgreSQL, MySQL)
- Add authentication (JWT)
- Add pagination
- Add search and filtering

## File Structure

```
react-super-grid-v5/
├── examples/
│   ├── AccountingExample.tsx    ← Main example
│   ├── index.tsx               ← Examples registry
│   └── README.md               ← Examples documentation
│
├── server/
│   ├── src/
│   │   ├── index.ts           ← Express server
│   │   ├── database.ts        ← In-memory DB
│   │   └── types.ts           ← TypeScript types
│   ├── package.json
│   └── README.md              ← Server documentation
│
├── src/
│   ├── App.tsx                ← Main app (uses AccountingExample)
│   └── SupperGrid/
│       ├── plugins/
│       │   ├── RestPlugin.ts         ← Server integration
│       │   ├── RestPlugin.examples.ts ← Config examples
│       │   └── DraftPlugin.ts        ← Draft management
│       └── cells/
│           └── TextCell.tsx   ← Text input cell
│
└── QUICKSTART.md              ← This file!
```

## Support

Having issues? Check these resources:

1. [Examples README](./examples/README.md) - Common issues
2. [Server README](./server/README.md) - API troubleshooting
3. Browser console (F12) - Frontend errors
4. Server terminal - Backend errors

## Success Indicators

✅ Backend terminal shows:
```
🚀 ERP Accounting Module API Server
📍 Server running at: http://localhost:8080
```

✅ Frontend terminal shows:
```
➜  Local:   http://localhost:5173/
```

✅ Browser shows:
```
📊 ERP Accounting Module
Total Entries: 10
🟢 Connected
```

✅ Console shows no errors

## Happy Coding! 🎉

You now have a fully functional ERP accounting module with:
- Real-time server synchronization
- Draft entry management
- Multi-cell editing
- Keyboard navigation
- Error handling
- Retry logic

Start exploring and building your own features!
