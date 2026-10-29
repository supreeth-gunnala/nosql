# Design and Implementation of a MongoDB-Based Intelligent Inventory Management and Demand Forecasting System

An academic mini-project demonstrating a full-stack, cloud-native **Intelligent Inventory Management and Demand Forecasting System** powered by **MongoDB Atlas**, **FastAPI (Python 3.11)**, and **React (Vite)**.

---

## 1. System Overview & Objectives

Small-to-medium businesses face continuous challenges balancing inventory holding costs with stockout risks. This application provides:
- **Real-Time Stock & Valuation Tracking:** Instant inventory valuation based on unit cost and physical quantity on hand.
- **Concurrency-Safe Stock Updates:** Atomic single-document modifications preventing overselling under concurrent checkout operations.
- **Statistical Demand Forecasting:** Explainable Moving Average and Simple Exponential Smoothing models with in-sample MAE and RMSE accuracy evaluation.
- **Automated Replenishment Decision Engine:** Dynamic Reorder Point (ROP) and Order-Up-To calculations utilizing vendor lead times and daily sales velocity.
- **Proactive Inventory Alerts:** Automated classification of critical stockouts, runout hazards, and demand surges.
- **Audit Ledger & CSV Data Export:** Transaction logs for purchases, sales, and cycle adjustments with instant CSV reports.

---

## 2. Technology Stack

- **Frontend:** React 18, Vite, CSS3, Lucide Icons, Pure SVG Data Visualization
- **Backend:** Python 3.11, FastAPI, Pydantic v2, PyMongo, Standard Library `statistics` and `math`
- **Database:** MongoDB Atlas (M0 Free Tier / Serverless Replica Set)
- **Deployment:**
  - Frontend: [Vercel](https://vercel.com)
  - Backend: [Render](https://render.com)
  - Database: [MongoDB Atlas](https://www.mongodb.com/cloud/atlas)

---

## 3. MongoDB Collections Structure

The system utilizes four collections in the `inventory_management` database:

1. **`products`**: Product catalog documents containing `name`, `sku` (unique), `category`, `unit_price`, `cost_price`, `current_stock`, `minimum_stock`, and `supplier_id`.
2. **`suppliers`**: Vendor profiles with `supplier_id` (unique), `name`, `contact_person`, `email`, `phone`, and `lead_time_days`.
3. **`inventory_transactions`**: Ledger entries recording `purchase`, `sale`, and `adjustment` events with immutable embedded product metadata.
4. **`forecast_records`**: Persistent snapshots of projected multi-day demand calculations and accuracy metrics.

---

## 4. REST API Endpoints

### System & Seeding
- `GET /api/health` — Cluster connection health check.
- `POST /api/seed?force=true` — Populates 20 realistic products, 4 suppliers, and 75 days of sales transactions.

### Dashboard & Analytics
- `GET /api/dashboard` — High-level KPI metrics, category valuation breakdown, 14-day sales velocity, and recent ledger entries.

### Products
- `GET /api/products` — List catalog products (supports `search`, `category`, `low_stock` filters).
- `POST /api/products` — Add a product with unique SKU and price validation.
- `GET /api/products/{id}` — Fetch product details with linked vendor information.
- `PUT /api/products/{id}` — Update product attributes and thresholds.
- `DELETE /api/products/{id}` — Delete product (prevented if transaction history exists).
- `GET /api/products/{id}/history` — Full chronological stock movement timeline.

### Suppliers
- `GET /api/suppliers` — List all registered vendors.
- `POST /api/suppliers` — Register a vendor with delivery lead time.
- `PUT /api/suppliers/{id}` — Update supplier record.
- `DELETE /api/suppliers/{id}` — Delete supplier (prevented if linked to active products).

### Inventory Transactions
- `GET /api/transactions` — Query transaction ledger (filtered by type, product, or search).
- `POST /api/transactions` — Record stock movements:
  - **Purchase:** Atomically increments `current_stock`.
  - **Sale:** Concurrency-safe decrement (`current_stock >= quantity`). Rejects sales on insufficient inventory.
  - **Adjustment:** Records physical cycle audit corrections.

### Forecasting & Replenishment
- `GET /api/forecasts/{product_id}` — Generates statistical demand forecast (`moving_average` or `exponential_smoothing`) with MAE/RMSE metrics.
- `POST /api/forecasts/{product_id}` — Persists forecast snapshot into MongoDB.
- `GET /api/recommendations` — Automated replenishment calculations (Safety Stock, ROP, Target Stock, Suggested Order Quantity).
- `GET /api/alerts` — Active inventory exceptions (Stockout, Low Stock, Runout Hazard, Demand Surge).

### Reports & Export
- `GET /api/reports` — Comprehensive supplier and inventory matrix.
- `GET /api/reports/export-csv?report_type=inventory|sales|recommendations` — Downloadable CSV export.

---

## 5. Local Setup and Execution

### Prerequisites
- Python 3.11+
- Node.js 18+ and npm
- A MongoDB Atlas cluster connection string

---

### Backend Setup

1. **Navigate to the backend directory and activate the virtual environment:**
   - Windows PowerShell:
     ```powershell
     cd backend
     ..\.venv\Scripts\Activate.ps1
     ```
   - Linux/macOS:
     ```bash
     cd backend
     source ../.venv/bin/activate
     ```

2. **Install Python dependencies:**
   ```bash
   pip install -r requirements.txt
   ```

3. **Configure Environment Variables:**
   Create or edit `backend/.env`:
   ```env
   MONGODB_URI=mongodb+srv://<username>:<password>@<cluster-url>/?retryWrites=true&w=majority
   DATABASE_NAME=inventory_management
   CORS_ORIGINS=http://localhost:5173,http://localhost:3000,http://127.0.0.1:5173
   ```

4. **Verify MongoDB Atlas Connection:**
   ```bash
   python test_connection.py
   ```

5. **Start the FastAPI Backend:**
   From the repository root:
   ```bash
   uvicorn backend.main:app --reload --port 8000
   ```
   Interactive Swagger documentation is available at `http://localhost:8000/docs`.

---

### Frontend Setup

1. **Navigate to the frontend directory:**
   ```bash
   cd frontend
   ```

2. **Install frontend dependencies:**
   ```bash
   npm install
   ```

3. **Start the Vite Development Server:**
   ```bash
   npm run dev
   ```
   Open `http://localhost:5173` in your browser.

---

### Loading Demonstration Data

You can load 20 realistic products, 4 suppliers, and 75 days of synthetic transaction history via either:
1. **Web UI:** Click the **"Load Synthetic Demo Data"** banner on the Dashboard tab.
2. **CLI Script:**
   ```powershell
   python backend/seed_data.py
   ```

---

## 6. Running Automated Tests

A comprehensive suite of 19 automated tests verifies CRUD operations, atomic stock deductions, duplicate prevention, demand forecasting math, and replenishment logic using isolated database mocks:

```powershell
.\.venv\Scripts\python.exe -m unittest discover -s tests -p "test_*.py"
```

**Expected Result:**
```
Ran 19 tests in 0.029s
OK
```

---

## 7. Frontend Production Build

Test the production frontend bundle locally:
```powershell
cd frontend
npm run build
```

The optimized static assets are emitted into `frontend/dist/`.

---

## 8. Online Deployment Guide

### Step 1: MongoDB Atlas Configuration
1. In [MongoDB Atlas](https://cloud.mongodb.com/), navigate to **Network Access** and verify IP `0.0.0.0/0` (Allow Access from Anywhere) is configured so Render can establish connection.
2. In **Database Access**, verify your database user has `readWrite` permissions on `inventory_management`.

### Step 2: Deploy Backend to Render
1. Create a **New Web Service** connected to your repository on [Render](https://dashboard.render.com/).
2. Service Settings:
   - **Environment:** `Python 3`
   - **Build Command:** `pip install -r backend/requirements.txt`
   - **Start Command:** `uvicorn backend.main:app --host 0.0.0.0 --port $PORT`
3. Environment Variables:
   - `MONGODB_URI`: `<Your MongoDB Atlas connection URI>`
   - `DATABASE_NAME`: `inventory_management`
   - `CORS_ORIGINS`: `http://localhost:5173,https://<your-app>.vercel.app`
4. Copy your live Render URL (e.g., `https://smart-inventory-api.onrender.com`).

### Step 3: Deploy Frontend to Vercel
1. In [Vercel](https://vercel.com/), click **Add New > Project** and import the repository.
2. In settings:
   - **Framework Preset:** `Vite`
   - **Root Directory:** `frontend`
   - **Build Command:** `npm run build`
   - **Output Directory:** `dist`
3. Add Environment Variable:
   - `VITE_API_URL`: `https://smart-inventory-api.onrender.com` (your Render backend URL)
4. Deploy and verify. Update the `CORS_ORIGINS` variable on Render with your newly assigned Vercel URL.

---

## 9. Academic Case Study Report

For a complete academic analysis detailing:
- Document vs relational data modeling trade-offs
- Concurrency-safe atomic conditional update patterns
- Time-series demand forecasting formulas (Moving Average and Exponential Smoothing)
- Replenishment inventory mathematics (Safety Stock and Reorder Points)
- Full test evaluation matrix and academic limitations

Please refer to the detailed report in [`CASE_STUDY.md`](file:///c:/Users/user/Downloads/LibraryManagementNoSQL/CASE_STUDY.md).
