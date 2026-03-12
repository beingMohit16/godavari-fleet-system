# GovFleet — Transport Fleet Tracking & Logistics Management Platform

A full-stack prototype for state government transport management. Tracks vehicle movement, deliveries, documents, and financial performance.

---

## 📁 Project Structure

```
fleet-tracker/
├── backend/
│   ├── server.js          # Express API + SQLite DB
│   ├── package.json
│   └── uploads/           # Document uploads (auto-created)
│
└── frontend/
    ├── public/
    │   └── index.html
    ├── src/
    │   ├── App.js          # Router + Sidebar layout
    │   ├── index.js        # React entry
    │   ├── index.css       # Global dark theme styles
    │   ├── utils/api.js    # Axios API helpers
    │   └── pages/
    │       ├── Dashboard.js    # KPIs + charts + recent trips
    │       ├── Vehicles.js     # Vehicle CRUD
    │       ├── Trips.js        # Trip management + status
    │       ├── TripDetail.js   # Full trip view: expenses, docs, invoice
    │       ├── MapView.js      # Leaflet map + GPS simulation
    │       ├── Expenses.js     # Expense logging + analytics
    │       ├── Invoices.js     # Invoice generation
    │       └── Analytics.js    # Route profitability + charts
    └── package.json
```

---

## 🚀 Setup & Run

### Prerequisites
- Node.js v18+ (https://nodejs.org)
- npm v9+

### 1. Install & Start Backend

```bash
cd fleet-tracker/backend
npm install
node server.js
```

Backend will start at: **http://localhost:3001**
SQLite DB auto-created at: `backend/fleet.db`
Sample data auto-seeded on first run (10 vehicles, 20 trips, expenses, invoices)

### 2. Install & Start Frontend

Open a **new terminal**:

```bash
cd fleet-tracker/frontend
npm install
npm start
```

Frontend will open at: **http://localhost:3000**

---

## 🗄️ Database Schema (SQLite)

### vehicles
| Column | Type | Notes |
|--------|------|-------|
| id | TEXT PK | UUID |
| registration | TEXT UNIQUE | e.g. MH-12-AB-1234 |
| type | TEXT | Truck / Mini Van / etc. |
| capacity | REAL | Tonnes |
| driver_name | TEXT | |
| status | TEXT | Available / On Trip / Maintenance |
| lat, lng | REAL | GPS coordinates |
| created_at | TEXT | |

### trips
| Column | Type | Notes |
|--------|------|-------|
| id | TEXT PK | UUID |
| vehicle_id | TEXT FK | refs vehicles |
| driver | TEXT | |
| cargo_type | TEXT | |
| pickup | TEXT | City/location |
| destination | TEXT | |
| distance | REAL | km |
| status | TEXT | Created / Dispatched / In Transit / Delivered / Returned |
| pickup_lat/lng | REAL | GPS |
| dest_lat/lng | REAL | GPS |
| created_at, updated_at | TEXT | |

### expenses
| Column | Type |
|--------|------|
| id | TEXT PK |
| trip_id | TEXT FK |
| expense_type | TEXT (Fuel/Toll/Repair/Other) |
| amount | REAL |
| date | TEXT |
| notes | TEXT |

### documents
| Column | Type |
|--------|------|
| id | TEXT PK |
| trip_id | TEXT FK |
| doc_type | TEXT |
| filename | TEXT (server path) |
| original_name | TEXT |
| uploaded_at | TEXT |

### invoices
| Column | Type |
|--------|------|
| id | TEXT PK |
| trip_id | TEXT FK |
| customer_name | TEXT |
| freight_rate | REAL (₹/km) |
| distance | REAL (km) |
| total_amount | REAL (distance × rate) |

---

## 🌐 API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | /api/vehicles | List all vehicles |
| POST | /api/vehicles | Add vehicle |
| PUT | /api/vehicles/:id | Update vehicle |
| GET | /api/vehicles/locations | Vehicles with active trip data |
| POST | /api/vehicles/:id/gps | Update GPS position |
| GET | /api/trips | List all trips |
| GET | /api/trips/:id | Trip detail with expenses/docs/invoice |
| POST | /api/trips | Create trip |
| PUT | /api/trips/:id/status | Update trip status |
| GET | /api/expenses | List all expenses |
| POST | /api/expenses | Log expense |
| POST | /api/documents | Upload document (multipart) |
| GET | /api/invoices | List all invoices |
| POST | /api/invoices | Generate invoice |
| GET | /api/dashboard | Dashboard analytics |

---

## 📱 Application Modules

| Module | Features |
|--------|----------|
| **Dashboard** | KPI cards, trip status pie chart, expense breakdown, route profitability table, vehicle utilization |
| **Live Map** | Leaflet/OpenStreetMap, vehicle markers by status, GPS simulation toggle, route polylines, popup info |
| **Vehicles** | Add/edit vehicles, status management, fleet stats |
| **Trips** | Create trips, assign vehicles, status workflow, filterable table |
| **Trip Detail** | Progress timeline, expenses tab, document archive tab, invoice tab, financial summary |
| **Expenses** | Log expenses by trip/type, pie chart, bar chart, history table |
| **Invoices** | Generate invoices (Distance × Rate formula), preview, invoice register |
| **Analytics** | Route profitability ranking, revenue vs expense comparison, cargo type distribution |

---

## 🛰️ GPS Simulation

1. Navigate to **Live Map**
2. Click **▶ Start GPS Sim**
3. Vehicles with status "In Transit" will move toward their destination every 3 seconds
4. Available vehicles show idle drift
5. Click any vehicle marker to see popup info
6. Click a vehicle in the sidebar list to center the map

---

## 💡 Sample Data Included

- **10 vehicles** across India (Mumbai, Delhi, Bangalore, Chennai, Ahmedabad, Jaipur, Lucknow, Bhopal, Hyderabad, Kolkata)
- **20 trips** with mixed statuses across 5 major routes
- **Expenses** (fuel, toll, repair) for each trip
- **Invoices** for ~50% of trips
- **5 cargo types**: Medical Supplies, Food Grains, Construction Material, Electronics, Textiles
- **5 routes**: Mumbai→Pune, Delhi→Agra, Bangalore→Chennai, Ahmedabad→Surat, Jaipur→Jodhpur

---

## 🔧 Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18 + React Router 6 |
| Styling | CSS custom properties (dark gov theme) |
| Charts | Recharts |
| Maps | Leaflet.js + React-Leaflet + OpenStreetMap |
| HTTP Client | Axios |
| Backend | Node.js + Express 4 |
| Database | SQLite via better-sqlite3 |
| File Uploads | Multer |

---

## 📌 Notes

- No authentication required (prototype)
- All data persists in SQLite (`backend/fleet.db`)
- Uploaded documents stored in `backend/uploads/`
- Delete `fleet.db` to reset all data and re-seed
- Frontend proxies API calls to `localhost:3001` via `"proxy"` in package.json
