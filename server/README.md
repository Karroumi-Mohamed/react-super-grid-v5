# ERP Accounting Module - REST API Server

A TypeScript/Express server for testing React Super Grid with real accounting data from an ERP system.

## Features

- 📊 **Journal Entries Management** - Create, read, update, delete accounting journal entries
- 📚 **Chart of Accounts** - Predefined accounting structure (Assets, Liabilities, Equity, Revenue, Expenses)
- 💼 **Double-Entry Bookkeeping** - Proper debit/credit accounting rules
- 🔄 **Bulk Operations** - Create multiple journal entries at once
- 🎯 **RESTful API** - Clean, standard REST endpoints
- ✅ **Validation** - Business rule validation for accounting entries
- 🚀 **TypeScript** - Full type safety
- 💾 **In-Memory Database** - No setup required, data resets on restart

## Quick Start

### 1. Install Dependencies

```bash
cd server
npm install
# or
bun install
```

### 2. Set Up Environment

```bash
cp .env.example .env
```

Edit `.env` if needed (default values work for Vite dev server).

### 3. Start the Server

```bash
npm run dev
# or
bun run dev
```

The server will start on `http://localhost:8080`

### 4. Test the API

```bash
# Health check
curl http://localhost:8080/api/health

# Get all journal entries
curl http://localhost:8080/api/journal-entries

# Get chart of accounts
curl http://localhost:8080/api/accounts
```

## API Documentation

### Base URL

```
http://localhost:8080/api
```

### Endpoints

#### Health Check

```http
GET /api/health
```

**Response:**
```json
{
  "status": "UP",
  "timestamp": "2025-10-02T10:30:00.000Z",
  "service": "ERP Accounting Module",
  "version": "1.0.0"
}
```

---

#### Get All Journal Entries

```http
GET /api/journal-entries?sort=date&order=desc
```

**Query Parameters:**
- `sort` - Sort by field (id, date, accountCode, description, debit, credit)
- `order` - Sort order (asc, desc)

**Response:**
```json
{
  "data": [
    {
      "id": 1,
      "date": "2025-09-01",
      "accountCode": "1000",
      "accountName": "Cash",
      "description": "Initial capital investment",
      "debit": 100000,
      "credit": 0,
      "balance": 100000,
      "reference": "INV-001",
      "status": "posted",
      "createdBy": "admin",
      "createdAt": "2025-10-02T10:00:00.000Z",
      "updatedAt": "2025-10-02T10:00:00.000Z"
    }
  ]
}
```

---

#### Get Journal Entry by ID

```http
GET /api/journal-entries/:id
```

**Response:**
```json
{
  "data": {
    "id": 1,
    "date": "2025-09-01",
    "accountCode": "1000",
    "accountName": "Cash",
    "description": "Initial capital investment",
    "debit": 100000,
    "credit": 0,
    "balance": 100000,
    "reference": "INV-001",
    "status": "posted"
  }
}
```

---

#### Create Journal Entry

```http
POST /api/journal-entries
Content-Type: application/json

{
  "date": "2025-10-02",
  "accountCode": "5300",
  "accountName": "Utilities Expense",
  "description": "Electric bill for September",
  "debit": 450,
  "credit": 0,
  "reference": "UTIL-001",
  "status": "draft"
}
```

**Validation Rules:**
- Either `debit` or `credit` must be non-zero (not both, not neither)
- Both amounts must be non-negative
- `accountCode` must exist in chart of accounts
- Required fields: `date`, `accountCode`, `description`

**Response:**
```json
{
  "data": {
    "id": 11,
    "date": "2025-10-02",
    "accountCode": "5300",
    "accountName": "Utilities Expense",
    "description": "Electric bill for September",
    "debit": 450,
    "credit": 0,
    "balance": 450,
    "reference": "UTIL-001",
    "status": "draft",
    "createdBy": "system",
    "createdAt": "2025-10-02T10:30:00.000Z",
    "updatedAt": "2025-10-02T10:30:00.000Z"
  }
}
```

---

#### Bulk Create Journal Entries

```http
POST /api/journal-entries/bulk
Content-Type: application/json

{
  "rows": [
    {
      "date": "2025-10-02",
      "accountCode": "5300",
      "accountName": "Utilities Expense",
      "description": "Electric bill",
      "debit": 450,
      "credit": 0
    },
    {
      "date": "2025-10-02",
      "accountCode": "1000",
      "accountName": "Cash",
      "description": "Electric bill payment",
      "debit": 0,
      "credit": 450
    }
  ]
}
```

**Response:**
```json
{
  "data": [
    { "id": 11, "date": "2025-10-02", "accountCode": "5300", ... },
    { "id": 12, "date": "2025-10-02", "accountCode": "1000", ... }
  ]
}
```

---

#### Update Journal Entry

```http
PATCH /api/journal-entries/:id
Content-Type: application/json

{
  "description": "Updated description",
  "status": "posted"
}
```

**Response:**
```json
{
  "data": {
    "id": 11,
    "description": "Updated description",
    "status": "posted",
    ...
  }
}
```

---

#### Delete Journal Entry

```http
DELETE /api/journal-entries/:id
```

**Response:**
```json
{
  "message": "Journal entry deleted successfully",
  "id": 11
}
```

---

#### Get Chart of Accounts

```http
GET /api/accounts
```

**Response:**
```json
{
  "data": [
    {
      "code": "1000",
      "name": "Cash",
      "type": "asset",
      "balance": 50000
    },
    {
      "code": "5100",
      "name": "Salaries Expense",
      "type": "expense",
      "balance": 0
    }
  ]
}
```

---

#### Get Account by Code

```http
GET /api/accounts/:code
```

**Response:**
```json
{
  "data": {
    "code": "1000",
    "name": "Cash",
    "type": "asset",
    "balance": 50000
  }
}
```

## Chart of Accounts

### Assets (1000-1999)
- `1000` - Cash
- `1100` - Accounts Receivable
- `1200` - Inventory
- `1500` - Equipment

### Liabilities (2000-2999)
- `2000` - Accounts Payable
- `2100` - Notes Payable
- `2200` - Accrued Expenses

### Equity (3000-3999)
- `3000` - Owner's Capital
- `3100` - Retained Earnings

### Revenue (4000-4999)
- `4000` - Sales Revenue
- `4100` - Service Revenue
- `4200` - Interest Income

### Expenses (5000-5999)
- `5000` - Cost of Goods Sold
- `5100` - Salaries Expense
- `5200` - Rent Expense
- `5300` - Utilities Expense
- `5400` - Office Supplies
- `5500` - Depreciation Expense

## Connecting to React Super Grid

Update your `App.tsx`:

```typescript
import { RestPlugin } from './SupperGrid/plugins/RestPlugin';
import { DraftPlugin } from './SupperGrid/plugins/DraftPlugin';

const restConfig = {
    baseUrl: 'http://localhost:8080/api',
    auth: { type: 'none' as const },
    endpoints: {
        create: {
            method: 'POST' as const,
            url: 'http://localhost:8080/api/journal-entries',
            transformResponse: (response) => response.data
        },
        update: {
            method: 'PATCH' as const,
            url: (rowId: string) => `http://localhost:8080/api/journal-entries/${rowId}`,
            transformRequest: (_rowId: string, columnKey: string, value: any) => ({
                [columnKey]: value
            }),
            transformResponse: (response) => response.data
        },
        delete: {
            method: 'DELETE' as const,
            url: (rowId: string) => `http://localhost:8080/api/journal-entries/${rowId}`
        },
        bulkCreate: {
            method: 'POST' as const,
            url: 'http://localhost:8080/api/journal-entries/bulk',
            transformRequest: (data: any[]) => ({ rows: data }),
            transformResponse: (response) => response.data
        }
    },
    errorHandling: {
        retry: { enabled: true, maxAttempts: 3 }
    },
    optimization: {
        debounceMs: 500,
        optimistic: true
    },
    debug: true
};

const restPlugin = new RestPlugin(restConfig);
const draftPlugin = new DraftPlugin();

// Define columns for accounting data
const columns = [
    { key: 'date', header: 'Date', width: '120px', cell: TextCell },
    { key: 'accountCode', header: 'Account Code', width: '120px', cell: TextCell },
    { key: 'accountName', header: 'Account Name', width: '200px', cell: TextCell },
    { key: 'description', header: 'Description', width: '300px', cell: TextCell },
    { key: 'debit', header: 'Debit', width: '120px', cell: TextCell },
    { key: 'credit', header: 'Credit', width: '120px', cell: TextCell },
    { key: 'reference', header: 'Reference', width: '120px', cell: TextCell },
    { key: 'status', header: 'Status', width: '100px', cell: TextCell },
];

// Fetch initial data
const [data, setData] = useState([]);

useEffect(() => {
    fetch('http://localhost:8080/api/journal-entries')
        .then(res => res.json())
        .then(result => setData(result.data));
}, []);

<SuperGrid
    data={data}
    config={columns}
    plugins={[focusPlugin, editPlugin, selectionPlugin, multiEditPlugin, draftPlugin, restPlugin]}
/>
```

## Sample Data

The server comes with 10 pre-loaded journal entries demonstrating:
- Initial capital investment
- Sales transactions
- Salary payments
- Rent expense
- Equipment purchase

All following proper double-entry bookkeeping principles.

## Development

### Project Structure

```
server/
├── src/
│   ├── index.ts           # Express server and routes
│   ├── database.ts        # In-memory database with sample data
│   └── types.ts           # TypeScript interfaces
├── package.json
├── tsconfig.json
└── README.md
```

### Available Scripts

- `npm run dev` - Start development server with auto-reload
- `npm run build` - Build TypeScript to JavaScript
- `npm start` - Start production server
- `npm run seed` - Reset database with sample data

### Adding More Data

Edit `src/database.ts` → `initializeSampleData()` method to add more journal entries.

## Error Codes

- `NOT_FOUND` - Resource not found
- `VALIDATION_ERROR` - Missing required fields
- `INVALID_ACCOUNT` - Account code doesn't exist
- `INVALID_AMOUNT` - Negative amounts not allowed
- `INVALID_ENTRY` - Double-entry bookkeeping rules violated
- `INVALID_REQUEST` - Malformed request body

## Troubleshooting

### Port already in use

```bash
# Kill process on port 8080
lsof -i :8080
kill -9 <PID>

# Or change port in .env
PORT=8081
```

### CORS errors

Edit `.env`:
```
CORS_ORIGIN=http://localhost:3000
```

Or update `src/index.ts` CORS configuration.

## Next Steps

- [ ] Add authentication (JWT)
- [ ] Add pagination for large datasets
- [ ] Add filtering by date range, account, status
- [ ] Add transaction validation (balanced entries)
- [ ] Add reporting endpoints (trial balance, income statement)
- [ ] Connect to real database (PostgreSQL)
- [ ] Add audit trail
- [ ] Add user management
