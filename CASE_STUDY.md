# Design and Implementation of a MongoDB-Based Intelligent Inventory Management and Demand Forecasting System: A Case Study

**Course/Subject Area:** Database Management Systems (DBMS) & NoSQL Technologies  
**Project Title:** Design and Implementation of a MongoDB-Based Intelligent Inventory Management and Demand Forecasting System  
**Application Stack:** FastAPI (Python 3.11), MongoDB Atlas (PyMongo), React 18 (Vite), CSS3  

---

## 1. Problem Statement and Objectives

### 1.1 Problem Statement
Small-to-medium retail and wholesale enterprises face severe operational challenges managing fast-moving stock:
1. **Stockout Losses vs. Holding Costs:** Overstocking ties up valuable working capital and incurs warehousing carrying costs, while stockouts result in lost revenue, backorders, and damaged customer retention.
2. **Disconnected Sales History & Manual Reordering:** Reordering decisions are often made using intuition or static periodic spreadsheets rather than empirical demand velocity and vendor lead times.
3. **High-Concurrency Race Conditions:** In multichannel retail environments, simultaneous sales orders can lead to overselling when multiple checkout processes attempt to decrement inventory without atomic synchronization.
4. **Complex Catalog Metadata:** Products span diverse categories with variable specifications, necessitating a flexible data store that avoids rigid schema migrations.

### 1.2 System Objectives
The primary objectives of this system are:
1. **Flexible Document-Oriented Catalog:** Design a schema capable of handling diverse product categories, pricing structures, and vendor associations.
2. **Concurrency-Safe Atomic Stock Control:** Implement atomic conditional updates (`$inc` coupled with `current_stock >= quantity`) to prevent negative inventory and race conditions.
3. **Statistical Demand Forecasting:** Implement transparent, explainable time-series forecasting (Rolling Moving Average and Simple Exponential Smoothing) with in-sample MAE and RMSE accuracy evaluation.
4. **Automated Replenishment Intelligence:** Dynamically calculate Reorder Points (ROP), Safety Stock (SS), and Suggested Order Quantities based on vendor delivery lead times and daily sales velocity.
5. **Real-Time Analytical Pipelines:** Execute MongoDB aggregation pipelines on the database server to compute portfolio valuation, category distribution, top-selling items, and daily sales trends.

---

## 2. Why MongoDB is Suitable for Inventory Intelligence

MongoDB is a document-oriented NoSQL database that persists data in BSON format. It was selected for this inventory intelligence application due to the following characteristics:

1. **Document Embedding for Audit-Proof Transaction Receipts:**
   In supply chain systems, product names, SKUs, and unit prices change over time. When an inventory transaction (sale or purchase) is committed, snapshot metadata (`product_name`, `sku`, `unit_price`, `total_value`) is embedded alongside the foreign `product_id`. This creates an immutable transaction receipt that avoids expensive multi-collection `$lookup` joins on ledger queries.

2. **Field-Level Atomic Conditional Operations:**
   MongoDB provides document-level atomicity. Inventory decrement can be written as:
   `db.products.updateOne({ _id: id, current_stock: { $gte: qty } }, { $inc: { current_stock: -qty } })`
   Because this query filter and update execute as a single atomic operation in WiredTiger, race conditions are eliminated without requiring distributed pessimistic table locks.

3. **High Write Throughput for Event Streams:**
   Inventory transactions generate continuous write traffic. MongoDB scales write operations effectively through append-only journal logging and efficient index caching.

4. **Native Aggregation Framework:**
   Complex metric calculations—such as summing valuation (`current_stock * cost_price`) and grouping sales across calendar dates—are executed directly in the database engine, reducing network serialization latency.

> *Academic Note on SQL vs. NoSQL:* While relational DBMSs excel in environments demanding multi-table foreign-key cascade constraints, MongoDB's document model matches the event-driven ledger architecture of inventory transactions and enables seamless analytical aggregations on nested time-series data.

---

## 3. Data Model and Collection Design

The database uses four collections in the `inventory_management` database:

```
+------------------------------------------------------------------------------------------------+
|                                MongoDB: inventory_management                                   |
+--------------------------+---------------------------+----------------------------+------------+
|        products          |         suppliers         |   inventory_transactions   | forecasts  |
+--------------------------+---------------------------+----------------------------+------------+
| - _id (ObjectId)         | - _id (ObjectId)          | - _id (ObjectId)           | - _id      |
| - product_id (String)    | - supplier_id (String, U) | - transaction_id (String)  | - prod_id  |
| - name (String)          | - name (String)           | - product_id (Ref)         | - horizon  |
| - sku (String, Unique)   | - contact_person (String) | - product_name (Snapshot)  | - model    |
| - category (String)      | - email (String)          | - sku (Snapshot)           | - pred_val |
| - unit_price (Float)     | - phone (String)          | - transaction_type (Enum)  | - mae/rmse |
| - cost_price (Float)     | - lead_time_days (Int)    | - quantity (Int, Non-zero) | - date     |
| - current_stock (Int)    | - created_at (Date)       | - unit_price (Float)       |            |
| - minimum_stock (Int)    |                           | - total_value (Float)      |            |
| - supplier_id (Ref)      |                           | - transaction_date (Date)  |            |
| - created_at (Date)      |                           | - notes (String)           |            |
+--------------------------+---------------------------+----------------------------+------------+
```

---

## 4. Sample Document Structures

### 4.1 `products` Document
```json
{
  "_id": { "$oid": "660000000000000000000201" },
  "product_id": "PRD-1001",
  "name": "Wireless Mechanical Keyboard",
  "sku": "ELEC-WKB-01",
  "category": "Electronics",
  "description": "Compact 75% hot-swappable keyboard with wireless 2.4G & Bluetooth",
  "unit_price": 89.99,
  "cost_price": 45.00,
  "current_stock": 32,
  "minimum_stock": 15,
  "supplier_id": "SUP-101",
  "created_at": { "$date": "2026-07-31T00:00:00.000Z" },
  "updated_at": { "$date": "2026-10-29T00:00:00.000Z" }
}
```

### 4.2 `suppliers` Document
```json
{
  "_id": { "$oid": "660000000000000000000101" },
  "supplier_id": "SUP-101",
  "name": "Apex Electronics Corp",
  "contact_person": "Sarah Chen",
  "email": "sarah@apexelectronics.com",
  "phone": "+1 555-0142",
  "lead_time_days": 5,
  "created_at": { "$date": "2026-06-30T00:00:00.000Z" }
}
```

### 4.3 `inventory_transactions` Document
```json
{
  "_id": { "$oid": "660000000000000000000301" },
  "transaction_id": "TXN-00104",
  "product_id": { "$oid": "660000000000000000000201" },
  "product_custom_id": "PRD-1001",
  "product_name": "Wireless Mechanical Keyboard",
  "sku": "ELEC-WKB-01",
  "transaction_type": "sale",
  "quantity": 3,
  "unit_price": 89.99,
  "total_value": 269.97,
  "transaction_date": { "$date": "2026-10-27T14:32:00.000Z" },
  "notes": "Retail / online customer sale",
  "created_at": { "$date": "2026-10-27T14:32:00.000Z" }
}
```

---

## 5. Concurrency Control & Inventory Transactions

Three transaction types govern all stock movements:

### 5.1 Purchase (Stock Inflow)
When fresh inventory is received from a supplier:
```python
products_collection.update_one(
    {"_id": prod_oid},
    {"$inc": {"current_stock": quantity}, "$set": {"updated_at": now}},
)
```

### 5.2 Sale (Stock Outflow with Atomic Check)
To guarantee that stock never drops below zero under concurrent web traffic:
```python
update_res = products_collection.update_one(
    {"_id": prod_oid, "current_stock": {"$gte": quantity}},
    {"$inc": {"current_stock": -quantity}, "$set": {"updated_at": now}},
)

if update_res.modified_count == 0:
    raise HTTPException(
        status_code=400,
        detail=f"Insufficient inventory for sale. Requested {quantity} units exceeds available stock."
    )
```
**Mechanism:** The condition `current_stock >= quantity` ensures that if multiple requests compete for the last available units, only the first request succeeds; subsequent requests find `modified_count == 0` and are rejected with HTTP 400.

### 5.3 Adjustment (Physical Audit Correction)
Corrects physical discrepancy findings (damaged items, returns, cycle counts). Pre-validates that `current_stock + adjustment >= 0` before applying `$inc`.

---

## 6. Demand Forecasting Models & Accuracy Evaluation

The forecasting engine operates on aggregated daily sales transactions.

### 6.1 Moving Average Baseline ($w = 7$ Days)
Calculates projected daily demand as the unweighted mean over the most recent rolling window of $w$ days:
$$\hat{y}_{t+1} = \frac{1}{w} \sum_{i=0}^{w-1} y_{t-i}$$

### 6.2 Simple Exponential Smoothing (SES)
Applies exponentially decreasing weights to older observations:
$$\hat{y}_{t+1} = \alpha y_t + (1 - \alpha) \hat{y}_t$$
where $\alpha = 0.25$ provides a balance between responsiveness to recent surges and stability against random daily volatility.

### 6.3 Model Evaluation Metrics
For products with sufficient observations, in-sample one-step-ahead forecast errors are evaluated:
- **Mean Absolute Error (MAE):**
  $$\text{MAE} = \frac{1}{n} \sum_{t=1}^{n} |y_t - \hat{y}_t|$$
- **Root Mean Squared Error (RMSE):**
  $$\text{RMSE} = \sqrt{\frac{1}{n} \sum_{t=1}^{n} (y_t - \hat{y}_t)^2}$$

### 6.4 Handling Sparse Data
When active sales days are fewer than 3, the system falls back to the historical daily mean, flags `confidence: "LOW"`, and displays an explicit explanatory notice.

---

## 7. Replenishment Mathematics & Reorder Points

The replenishment engine determines optimal restocking schedules using classic inventory theory:

1. **Average Daily Demand ($d$):**
   Calculated from sales velocity over a 60-day historical window.
2. **Supplier Lead Time ($L$):**
   Retrieved from the linked supplier document (in days).
3. **Safety Stock ($SS$):**
   Buffers against unexpected demand surges during vendor lead times:
   $$SS = \max\left(\text{minimum\_stock}, \text{round}\left(1.65 \times \sqrt{L} \times \max(0.5, d)\right)\right)$$
4. **Reorder Point (ROP):**
   The threshold triggering procurement action:
   $$\text{ROP} = (d \times L) + SS$$
5. **Target Stock (Order-Up-To Level):**
   $$\text{Target Stock} = \text{ROP} + (d \times 14)$$
6. **Suggested Order Quantity:**
   $$\text{Suggested Order} = \max(0, \text{Target Stock} - \text{Current Stock})$$

---

## 8. Indexing Strategy & Duplicate Prevention

Indexes were defined in FastAPI startup lifespan:

```python
# Products: Unique SKU constraint & index lookups
products_collection.create_index("sku", unique=True)
products_collection.create_index("name")
products_collection.create_index("category")
products_collection.create_index("current_stock")

# Suppliers: Unique supplier_id
suppliers_collection.create_index("supplier_id", unique=True)
suppliers_collection.create_index("name")

# Transactions: Compound search & sort indices
transactions_collection.create_index("product_id")
transactions_collection.create_index("transaction_type")
transactions_collection.create_index("transaction_date")
```

---

## 9. Testing Methodology and Actual Execution Results

Automated unit tests were implemented in `tests/test_api.py` using `unittest` and `unittest.mock` to isolate tests from real cloud database records.

**Execution Command:**
```powershell
.\.venv\Scripts\python.exe -m unittest discover -s tests -p "test_*.py"
```

**Actual Execution Output:**
```
...................
----------------------------------------------------------------------
Ran 19 tests in 0.029s

OK
```

**Frontend Production Build Command:**
```powershell
cd frontend
npm run build
```

**Build Output:**
```
vite v5.4.21 building for production...
✓ 1577 modules transformed.
dist/index.html                   0.64 kB
dist/assets/index-B0Tmx5xu.css   12.44 kB
dist/assets/index-CEJSWsrS.js   217.01 kB
✓ built in 7.50s
```

---

## 10. Limitations and Future Improvements

### 10.1 Academic Limitations
1. **Stationary Demand Assumption:** Simple moving averages assume relatively stable demand; they do not explicitly model multi-year seasonality or macro trends.
2. **Deterministic Lead Times:** Supplier lead times are modeled as fixed point estimates rather than stochastic probability distributions.

### 10.2 Future Improvements
1. **Holt-Winters & ARIMA Modeling:** Extend the statistical forecasting module with trend and seasonal parameters for products exhibiting holiday seasonality.
2. **Automated Purchase Order Generation:** Automatically emit PDF purchase orders or webhook payloads to supplier APIs when stock falls below ROP.
3. **Multi-Location Warehousing:** Partition the `current_stock` field into location-specific subdocuments (`{ "warehouse_id": "WH-1", "quantity": 15 }`) using MongoDB array filters (`$[<identifier>]`).
