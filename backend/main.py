import csv
import io
import math
import os
import re
import statistics
from contextlib import asynccontextmanager
from datetime import datetime, timedelta, timezone

import sys
from pathlib import Path
from bson import ObjectId
from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException, Query, Response
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field, field_validator
from pymongo import MongoClient
from pymongo.errors import PyMongoError

# Set up paths and environment loading
BACKEND_DIR = Path(__file__).resolve().parent
ROOT_DIR = BACKEND_DIR.parent

if str(ROOT_DIR) not in sys.path:
    sys.path.insert(0, str(ROOT_DIR))
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

# Always load backend/.env explicitly regardless of current working directory
env_backend = BACKEND_DIR / ".env"
if env_backend.exists():
    load_dotenv(dotenv_path=env_backend)

env_root = ROOT_DIR / ".env"
if env_root.exists():
    load_dotenv(dotenv_path=env_root)

load_dotenv()

try:
    from backend.seed_data import seed_inventory_data
except ImportError:
    from seed_data import seed_inventory_data

MONGODB_URI = os.getenv("MONGODB_URI")
DATABASE_NAME = os.getenv("DATABASE_NAME", "inventory_management")

if not MONGODB_URI:
    raise RuntimeError("MONGODB_URI is missing from the backend .env file.")

client = MongoClient(MONGODB_URI, serverSelectionTimeoutMS=10000, connect=False)
db = client[DATABASE_NAME]

products_collection = db["products"]
suppliers_collection = db["suppliers"]
transactions_collection = db["inventory_transactions"]
forecasts_collection = db["forecast_records"]


@asynccontextmanager
async def lifespan(app: FastAPI):
    try:
        client.admin.command("ping")
        # Products indexes
        products_collection.create_index("sku", unique=True)
        products_collection.create_index("name")
        products_collection.create_index("category")
        products_collection.create_index("current_stock")

        # Suppliers indexes
        suppliers_collection.create_index("supplier_id", unique=True)
        suppliers_collection.create_index("name")
        suppliers_collection.create_index("email")

        # Transactions indexes
        transactions_collection.create_index("product_id")
        transactions_collection.create_index("transaction_type")
        transactions_collection.create_index("transaction_date")

        # Forecast records indexes
        forecasts_collection.create_index("product_id")
        forecasts_collection.create_index("forecast_date")
    except Exception as e:
        print(f"Lifespan index initialization warning: {e}")
    yield
    client.close()


app = FastAPI(
    title="Smart Inventory Intelligence & Demand Forecasting API",
    description="Intelligent NoSQL Inventory Management, Statistical Forecasting, and Automated Replenishment System.",
    version="2.0.0",
    lifespan=lifespan,
)

# CORS configuration
cors_origins_env = os.getenv(
    "CORS_ORIGINS",
    "http://localhost:5173,http://localhost:3000,http://127.0.0.1:5173",
)
allowed_origins = [o.strip() for o in cors_origins_env.split(",") if o.strip()]
if "*" in allowed_origins:
    cors_allowed = ["*"]
else:
    cors_allowed = allowed_origins

app.add_middleware(
    CORSMiddleware,
    allow_origins=cors_allowed,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# --- Helper Functions & Serializers ---

def parse_object_id(oid_str: str, resource_name: str = "Resource") -> ObjectId:
    if not ObjectId.is_valid(oid_str):
        raise HTTPException(status_code=400, detail=f"Invalid {resource_name} ID format")
    return ObjectId(oid_str)


def format_dt(dt) -> str:
    if isinstance(dt, datetime):
        return dt.isoformat()
    return str(dt) if dt else ""


def serialize_product(doc: dict) -> dict:
    curr = doc.get("current_stock", 0)
    min_s = doc.get("minimum_stock", 0)
    unit_p = float(doc.get("unit_price", 0.0))
    cost_p = float(doc.get("cost_price", 0.0))

    status = "OPTIMAL"
    if curr == 0:
        status = "OUT_OF_STOCK"
    elif curr <= min_s:
        status = "LOW_STOCK"
    elif curr > min_s * 4:
        status = "POTENTIAL_OVERSTOCK"

    return {
        "id": str(doc["_id"]),
        "product_id": doc.get("product_id") or str(doc["_id"]),
        "name": doc.get("name", ""),
        "sku": doc.get("sku", ""),
        "category": doc.get("category", "General"),
        "description": doc.get("description", ""),
        "unit_price": unit_p,
        "cost_price": cost_p,
        "current_stock": curr,
        "minimum_stock": min_s,
        "total_valuation": round(curr * cost_p, 2),
        "potential_revenue": round(curr * unit_p, 2),
        "supplier_id": doc.get("supplier_id") or "",
        "status": status,
        "created_at": format_dt(doc.get("created_at")),
        "updated_at": format_dt(doc.get("updated_at")),
    }


def serialize_supplier(doc: dict) -> dict:
    return {
        "id": str(doc["_id"]),
        "supplier_id": doc.get("supplier_id") or str(doc["_id"]),
        "name": doc.get("name", ""),
        "contact_person": doc.get("contact_person", ""),
        "email": doc.get("email", ""),
        "phone": doc.get("phone", ""),
        "lead_time_days": doc.get("lead_time_days", 7),
        "created_at": format_dt(doc.get("created_at")),
    }


def serialize_transaction(doc: dict) -> dict:
    return {
        "id": str(doc["_id"]),
        "transaction_id": doc.get("transaction_id", f"TXN-{str(doc['_id'])[-6:].upper()}"),
        "product_id": str(doc.get("product_id", "")),
        "product_custom_id": doc.get("product_custom_id", ""),
        "product_name": doc.get("product_name", "Unknown Product"),
        "sku": doc.get("sku", ""),
        "transaction_type": doc.get("transaction_type", "sale"),
        "quantity": doc.get("quantity", 0),
        "unit_price": float(doc.get("unit_price", 0.0)),
        "total_value": float(doc.get("total_value", 0.0)),
        "transaction_date": format_dt(doc.get("transaction_date")),
        "notes": doc.get("notes", ""),
        "created_at": format_dt(doc.get("created_at")),
    }


def serialize_forecast(doc: dict) -> dict:
    return {
        "id": str(doc["_id"]),
        "product_id": str(doc.get("product_id", "")),
        "product_name": doc.get("product_name", ""),
        "sku": doc.get("sku", ""),
        "forecast_date": format_dt(doc.get("forecast_date")),
        "forecast_horizon_days": doc.get("forecast_horizon_days", 7),
        "predicted_demand": doc.get("predicted_demand", 0.0),
        "daily_predicted_demand": doc.get("daily_predicted_demand", 0.0),
        "model_name": doc.get("model_name", "Moving Average"),
        "mae": doc.get("mae"),
        "rmse": doc.get("rmse"),
        "generated_at": format_dt(doc.get("generated_at")),
    }


# --- Pydantic Schemas ---

class ProductCreate(BaseModel):
    name: str = Field(min_length=1, max_length=150)
    sku: str = Field(min_length=1, max_length=50)
    category: str = Field(min_length=1, max_length=100)
    description: str = Field(default="", max_length=500)
    unit_price: float = Field(ge=0.01)
    cost_price: float = Field(ge=0.0)
    current_stock: int = Field(default=0, ge=0)
    minimum_stock: int = Field(default=5, ge=0)
    supplier_id: str = Field(default="", max_length=50)

    @field_validator("name", "sku", "category")
    @classmethod
    def strip_text(cls, v: str) -> str:
        s = v.strip()
        if not s:
            raise ValueError("Field cannot be blank")
        return s


class ProductUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=150)
    sku: str | None = Field(default=None, min_length=1, max_length=50)
    category: str | None = Field(default=None, min_length=1, max_length=100)
    description: str | None = Field(default=None, max_length=500)
    unit_price: float | None = Field(default=None, ge=0.01)
    cost_price: float | None = Field(default=None, ge=0.0)
    current_stock: int | None = Field(default=None, ge=0)
    minimum_stock: int | None = Field(default=None, ge=0)
    supplier_id: str | None = Field(default=None, max_length=50)


class SupplierCreate(BaseModel):
    supplier_id: str = Field(min_length=1, max_length=50)
    name: str = Field(min_length=1, max_length=150)
    contact_person: str = Field(default="", max_length=100)
    email: str = Field(min_length=3, max_length=120)
    phone: str = Field(default="", max_length=30)
    lead_time_days: int = Field(default=7, ge=1, le=180)

    @field_validator("supplier_id", "name")
    @classmethod
    def strip_text(cls, v: str) -> str:
        s = v.strip()
        if not s:
            raise ValueError("Field cannot be blank")
        return s

    @field_validator("email")
    @classmethod
    def validate_email(cls, v: str) -> str:
        s = v.strip().lower()
        if not re.match(r"^[^@\s]+@[^@\s]+\.[^@\s]+$", s):
            raise ValueError("Invalid email format")
        return s


class SupplierUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=150)
    contact_person: str | None = Field(default=None, max_length=100)
    email: str | None = Field(default=None, min_length=3, max_length=120)
    phone: str | None = Field(default=None, max_length=30)
    lead_time_days: int | None = Field(default=None, ge=1, le=180)


class TransactionCreate(BaseModel):
    product_id: str = Field(min_length=1)
    transaction_type: str = Field(pattern="^(purchase|sale|adjustment)$")
    quantity: int
    unit_price: float | None = Field(default=None, ge=0.0)
    notes: str = Field(default="", max_length=300)

    @field_validator("quantity")
    @classmethod
    def validate_quantity(cls, v: int) -> int:
        if v == 0:
            raise ValueError("Quantity cannot be zero")
        return v


# --- Core System Endpoints ---

@app.get("/")
def root():
    return {
        "system": "Smart Inventory Intelligence & Demand Forecasting System",
        "version": "2.0.0",
        "database": DATABASE_NAME,
        "status": "online",
    }


@app.get("/api/health")
def health():
    try:
        client.admin.command("ping")
        return {
            "status": "ok",
            "database": DATABASE_NAME,
            "timestamp": datetime.now(timezone.utc).isoformat(),
        }
    except PyMongoError:
        raise HTTPException(status_code=503, detail="Database connection failed")


@app.post("/api/seed")
def seed_data(force: bool = False):
    try:
        res = seed_inventory_data(client=client, force=force)
        return res
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Seeding failed: {str(e)}")


# --- Product Management Endpoints ---

@app.post("/api/products", status_code=201)
def add_product(item: ProductCreate):
    # Unique SKU validation
    if products_collection.find_one({"sku": {"$regex": f"^{re.escape(item.sku)}$", "$options": "i"}}):
        raise HTTPException(status_code=409, detail=f"A product with SKU '{item.sku}' already exists.")

    now = datetime.now(timezone.utc)
    doc = item.model_dump()
    doc["created_at"] = now
    doc["updated_at"] = now
    # Provide human-friendly product_id if not present
    doc["product_id"] = f"PRD-{int(now.timestamp()) % 1000000:06d}"

    result = products_collection.insert_one(doc)
    created = products_collection.find_one({"_id": result.inserted_id})
    return serialize_product(created)


@app.get("/api/products")
def list_products(
    search: str | None = Query(default=None, max_length=100),
    category: str | None = Query(default=None),
    low_stock: bool | None = Query(default=None),
):
    query = {}
    if search and search.strip():
        term = search.strip()
        query["$or"] = [
            {"name": {"$regex": term, "$options": "i"}},
            {"sku": {"$regex": term, "$options": "i"}},
            {"category": {"$regex": term, "$options": "i"}},
            {"product_id": {"$regex": term, "$options": "i"}},
        ]

    if category and category.strip():
        query["category"] = category.strip()

    if low_stock is True:
        # current_stock <= minimum_stock
        query["$expr"] = {"$lte": ["$current_stock", "$minimum_stock"]}

    cursor = products_collection.find(query).sort("name", 1)
    return [serialize_product(p) for p in cursor]


@app.get("/api/products/{product_id}")
def get_product(product_id: str):
    query = {}
    if ObjectId.is_valid(product_id):
        query = {"$or": [{"_id": ObjectId(product_id)}, {"product_id": product_id}]}
    else:
        query = {"product_id": product_id}

    prod = products_collection.find_one(query)
    if not prod:
        raise HTTPException(status_code=404, detail="Product not found")

    supplier_info = None
    sup_code = prod.get("supplier_id")
    if sup_code:
        s_query = {"$or": [{"supplier_id": sup_code}]}
        if ObjectId.is_valid(sup_code):
            s_query["$or"].append({"_id": ObjectId(sup_code)})
        supplier = suppliers_collection.find_one(s_query)
        if supplier:
            supplier_info = serialize_supplier(supplier)

    out = serialize_product(prod)
    out["supplier"] = supplier_info
    return out


@app.put("/api/products/{product_id}")
def update_product(product_id: str, item: ProductUpdate):
    oid = parse_object_id(product_id, "product")

    existing = products_collection.find_one({"_id": oid})
    if not existing:
        raise HTTPException(status_code=404, detail="Product not found")

    changes = item.model_dump(exclude_unset=True)
    if not changes:
        raise HTTPException(status_code=400, detail="No changes provided")

    if "sku" in changes and changes["sku"]:
        dup = products_collection.find_one({
            "sku": {"$regex": f"^{re.escape(changes['sku'])}$", "$options": "i"},
            "_id": {"$ne": oid},
        })
        if dup:
            raise HTTPException(status_code=409, detail=f"SKU '{changes['sku']}' is already assigned to another product")

    changes["updated_at"] = datetime.now(timezone.utc)
    products_collection.update_one({"_id": oid}, {"$set": changes})
    return serialize_product(products_collection.find_one({"_id": oid}))


@app.delete("/api/products/{product_id}")
def delete_product(product_id: str):
    oid = parse_object_id(product_id, "product")

    existing = products_collection.find_one({"_id": oid})
    if not existing:
        raise HTTPException(status_code=404, detail="Product not found")

    # Safe deletion check: prevent deleting if transactions exist
    txn_count = transactions_collection.count_documents({
        "$or": [
            {"product_id": oid},
            {"product_id": str(oid)},
            {"product_custom_id": existing.get("product_id")},
        ]
    })
    if txn_count > 0:
        raise HTTPException(
            status_code=400,
            detail=f"Cannot delete product '{existing['name']}' because it has {txn_count} recorded transactions. Adjust stock or retain history.",
        )

    products_collection.delete_one({"_id": oid})
    return {"message": "Product deleted successfully"}


@app.get("/api/products/{product_id}/history")
def get_product_stock_history(product_id: str):
    oid = parse_object_id(product_id, "product")

    existing = products_collection.find_one({"_id": oid})
    if not existing:
        raise HTTPException(status_code=404, detail="Product not found")

    txns = transactions_collection.find({
        "$or": [
            {"product_id": oid},
            {"product_id": str(oid)},
            {"product_custom_id": existing.get("product_id")},
        ]
    }).sort("transaction_date", -1)

    return {
        "product": serialize_product(existing),
        "history": [serialize_transaction(t) for t in txns],
    }


# --- Supplier Management Endpoints ---

@app.post("/api/suppliers", status_code=201)
def add_supplier(item: SupplierCreate):
    if suppliers_collection.find_one({
        "supplier_id": {"$regex": f"^{re.escape(item.supplier_id)}$", "$options": "i"}
    }):
        raise HTTPException(status_code=409, detail=f"Supplier ID '{item.supplier_id}' already exists")

    doc = item.model_dump()
    doc["created_at"] = datetime.now(timezone.utc)
    result = suppliers_collection.insert_one(doc)
    created = suppliers_collection.find_one({"_id": result.inserted_id})
    return serialize_supplier(created)


@app.get("/api/suppliers")
def list_suppliers():
    cursor = suppliers_collection.find().sort("name", 1)
    return [serialize_supplier(s) for s in cursor]


@app.get("/api/suppliers/{supplier_id}")
def get_supplier(supplier_id: str):
    query = {}
    if ObjectId.is_valid(supplier_id):
        query = {"$or": [{"_id": ObjectId(supplier_id)}, {"supplier_id": supplier_id}]}
    else:
        query = {"supplier_id": supplier_id}

    s = suppliers_collection.find_one(query)
    if not s:
        raise HTTPException(status_code=404, detail="Supplier not found")
    return serialize_supplier(s)


@app.put("/api/suppliers/{supplier_id}")
def update_supplier(supplier_id: str, item: SupplierUpdate):
    oid = parse_object_id(supplier_id, "supplier")

    existing = suppliers_collection.find_one({"_id": oid})
    if not existing:
        raise HTTPException(status_code=404, detail="Supplier not found")

    changes = item.model_dump(exclude_unset=True)
    if not changes:
        raise HTTPException(status_code=400, detail="No changes provided")

    suppliers_collection.update_one({"_id": oid}, {"$set": changes})
    return serialize_supplier(suppliers_collection.find_one({"_id": oid}))


@app.delete("/api/suppliers/{supplier_id}")
def delete_supplier(supplier_id: str):
    oid = parse_object_id(supplier_id, "supplier")

    existing = suppliers_collection.find_one({"_id": oid})
    if not existing:
        raise HTTPException(status_code=404, detail="Supplier not found")

    # Safe delete check: verify no product links to this supplier
    s_code = existing.get("supplier_id")
    linked_prod = products_collection.find_one({
        "$or": [{"supplier_id": s_code}, {"supplier_id": str(oid)}]
    })
    if linked_prod:
        raise HTTPException(
            status_code=400,
            detail=f"Cannot delete supplier '{existing['name']}' because product '{linked_prod['name']}' is linked to it.",
        )

    suppliers_collection.delete_one({"_id": oid})
    return {"message": "Supplier deleted successfully"}


# --- Inventory Transactions (Purchase, Sale, Adjustment) ---

@app.post("/api/transactions", status_code=201)
def create_transaction(item: TransactionCreate):
    prod_oid = parse_object_id(item.product_id, "product")

    product = products_collection.find_one({"_id": prod_oid})
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")

    now = datetime.now(timezone.utc)
    t_type = item.transaction_type.lower()
    qty = item.quantity

    # Determine unit price
    if item.unit_price is not None:
        unit_price = item.unit_price
    elif t_type == "sale":
        unit_price = float(product.get("unit_price", 0.0))
    else:
        unit_price = float(product.get("cost_price", 0.0))

    if t_type == "purchase":
        if qty <= 0:
            raise HTTPException(status_code=400, detail="Purchase quantity must be positive")

        # Atomic increment on stock
        products_collection.update_one(
            {"_id": prod_oid},
            {"$inc": {"current_stock": qty}, "$set": {"updated_at": now}},
        )

    elif t_type == "sale":
        if qty <= 0:
            raise HTTPException(status_code=400, detail="Sale quantity must be positive")

        # Concurrency-safe atomic decrement: requires current_stock >= qty
        update_res = products_collection.update_one(
            {"_id": prod_oid, "current_stock": {"$gte": qty}},
            {"$inc": {"current_stock": -qty}, "$set": {"updated_at": now}},
        )

        if update_res.modified_count == 0:
            current_avail = product.get("current_stock", 0)
            raise HTTPException(
                status_code=400,
                detail=f"Insufficient inventory for sale. Only {current_avail} units available, but {qty} requested.",
            )

    elif t_type == "adjustment":
        # Adjustment can be positive or negative
        # Ensure new stock would not be negative
        new_projected_stock = product.get("current_stock", 0) + qty
        if new_projected_stock < 0:
            raise HTTPException(
                status_code=400,
                detail=f"Adjustment of {qty} would result in negative stock ({new_projected_stock}).",
            )

        products_collection.update_one(
            {"_id": prod_oid},
            {"$inc": {"current_stock": qty}, "$set": {"updated_at": now}},
        )

    total_val = round(abs(qty) * unit_price, 2)
    txn_doc = {
        "transaction_id": f"TXN-{int(now.timestamp()) % 100000:05d}",
        "product_id": prod_oid,
        "product_custom_id": product.get("product_id", ""),
        "product_name": product.get("name", ""),
        "sku": product.get("sku", ""),
        "transaction_type": t_type,
        "quantity": qty,
        "unit_price": unit_price,
        "total_value": total_val,
        "transaction_date": now,
        "notes": item.notes or "",
        "created_at": now,
    }

    res = transactions_collection.insert_one(txn_doc)
    created = transactions_collection.find_one({"_id": res.inserted_id})
    return serialize_transaction(created)


@app.get("/api/transactions")
def list_transactions(
    product_id: str | None = Query(default=None),
    transaction_type: str | None = Query(default=None),
    search: str | None = Query(default=None),
    limit: int = Query(default=50, ge=1, le=500),
):
    query = {}

    if product_id:
        if ObjectId.is_valid(product_id):
            query["$or"] = [
                {"product_id": ObjectId(product_id)},
                {"product_id": product_id},
                {"product_custom_id": product_id},
            ]
        else:
            query["product_custom_id"] = product_id

    if transaction_type and transaction_type.strip():
        query["transaction_type"] = transaction_type.strip().lower()

    if search and search.strip():
        term = search.strip()
        search_f = {
            "$or": [
                {"product_name": {"$regex": term, "$options": "i"}},
                {"sku": {"$regex": term, "$options": "i"}},
                {"transaction_id": {"$regex": term, "$options": "i"}},
                {"notes": {"$regex": term, "$options": "i"}},
            ]
        }
        if query:
            query = {"$and": [query, search_f]}
        else:
            query = search_f

    cursor = transactions_collection.find(query).sort("transaction_date", -1).limit(limit)
    return [serialize_transaction(t) for t in cursor]


# --- Demand Forecasting Module (Statistical & Explainable) ---

class ForecastRequest(BaseModel):
    product_id: str
    horizon_days: int = Field(default=7, ge=1, le=60)
    model: str = Field(default="moving_average", pattern="^(moving_average|exponential_smoothing)$")


def compute_forecast(product_doc: dict, horizon_days: int = 7, model_name: str = "moving_average") -> dict:
    prod_oid = product_doc["_id"]
    now = datetime.now(timezone.utc)
    start_date = now - timedelta(days=90)

    # 1. Fetch sales transactions for this product over past 90 days
    txns = list(transactions_collection.find({
        "$or": [
            {"product_id": prod_oid},
            {"product_id": str(prod_oid)},
            {"product_custom_id": product_doc.get("product_id")},
        ],
        "transaction_type": "sale",
        "transaction_date": {"$gte": start_date},
    }).sort("transaction_date", 1))

    # 2. Aggregate sales by calendar date (YYYY-MM-DD)
    daily_sales = {}
    # Pre-populate dates for past 60 days
    for d in range(60, -1, -1):
        dt_str = (now - timedelta(days=d)).strftime("%Y-%m-%d")
        daily_sales[dt_str] = 0

    for t in txns:
        t_date = t.get("transaction_date")
        if t_date:
            d_str = t_date.strftime("%Y-%m-%d") if isinstance(t_date, datetime) else str(t_date)[:10]
            if d_str in daily_sales:
                daily_sales[d_str] += t.get("quantity", 0)

    # Convert to ordered series
    sorted_dates = sorted(daily_sales.keys())
    values = [daily_sales[d] for d in sorted_dates]
    non_zero_days = sum(1 for v in values if v > 0)
    total_sales = sum(values)

    # 3. Check data sufficiency
    if len(values) < 7 or non_zero_days < 3:
        # Fallback to simple mean
        avg_rate = round(total_sales / max(1, len(values)), 2)
        total_pred = round(avg_rate * horizon_days, 1)

        forecast_series = []
        for i in range(1, horizon_days + 1):
            f_date = (now + timedelta(days=i)).strftime("%Y-%m-%d")
            forecast_series.append({"date": f_date, "predicted_demand": avg_rate})

        return {
            "product_id": str(prod_oid),
            "product_name": product_doc.get("name"),
            "sku": product_doc.get("sku"),
            "confidence": "LOW",
            "model_name": "Simple Daily Average (Fallback)",
            "horizon_days": horizon_days,
            "historical_days_used": len(values),
            "active_sales_days": non_zero_days,
            "daily_forecast_rate": avg_rate,
            "total_predicted_demand": total_pred,
            "mae": None,
            "rmse": None,
            "historical_series": [{"date": d, "actual_sales": daily_sales[d]} for d in sorted_dates[-30:]],
            "forecast_series": forecast_series,
            "rationale": "Insufficient historical observations for multi-period statistical modeling. Used overall historical daily mean as an indicative baseline.",
            "disclaimer": "Predictions are indicative estimates based on past sales patterns and must not be interpreted as guaranteed future demand.",
        }

    # 4. Implement Statistical Models
    forecast_rate = 0.0
    mae = 0.0
    rmse = 0.0

    if model_name == "exponential_smoothing":
        alpha = 0.25
        # One-step-ahead in-sample tracking
        smoothed = [values[0]]
        for t in range(1, len(values)):
            st = alpha * values[t] + (1 - alpha) * smoothed[-1]
            smoothed.append(st)

        forecast_rate = round(smoothed[-1], 2)

        # In-sample error evaluation
        errors = [abs(values[i] - smoothed[i - 1]) for i in range(1, len(values))]
        mae = round(statistics.mean(errors), 2)
        rmse = round(math.sqrt(statistics.mean([e ** 2 for e in errors])), 2)
        model_display = "Simple Exponential Smoothing (alpha=0.25)"
    else:
        # Moving Average over window w=7
        w = 7
        window_vals = values[-w:]
        forecast_rate = round(statistics.mean(window_vals), 2)

        # In-sample MAE/RMSE over available rolling windows
        errors = []
        for i in range(w, len(values)):
            pred = statistics.mean(values[i - w:i])
            errors.append(abs(values[i] - pred))

        mae = round(statistics.mean(errors), 2) if errors else 0.0
        rmse = round(math.sqrt(statistics.mean([e ** 2 for e in errors])), 2) if errors else 0.0
        model_display = f"Moving Average (window={w} days)"

    total_pred = round(forecast_rate * horizon_days, 1)

    # 5. Build forecast series
    forecast_series = []
    for i in range(1, horizon_days + 1):
        f_date = (now + timedelta(days=i)).strftime("%Y-%m-%d")
        forecast_series.append({"date": f_date, "predicted_demand": forecast_rate})

    return {
        "product_id": str(prod_oid),
        "product_name": product_doc.get("name"),
        "sku": product_doc.get("sku"),
        "confidence": "HIGH" if non_zero_days >= 7 else "MODERATE",
        "model_name": model_display,
        "horizon_days": horizon_days,
        "historical_days_used": len(values),
        "active_sales_days": non_zero_days,
        "daily_forecast_rate": forecast_rate,
        "total_predicted_demand": total_pred,
        "mae": mae,
        "rmse": rmse,
        "historical_series": [{"date": d, "actual_sales": daily_sales[d]} for d in sorted_dates[-30:]],
        "forecast_series": forecast_series,
        "rationale": f"Computed using {model_display} based on {len(values)} consecutive days of sales data.",
        "disclaimer": "Predictions are indicative estimates based on past sales patterns and must not be interpreted as guaranteed future demand.",
    }


@app.get("/api/forecasts/{product_id}")
def get_product_forecast(
    product_id: str,
    horizon_days: int = Query(default=7, ge=1, le=60),
    model: str = Query(default="moving_average", pattern="^(moving_average|exponential_smoothing)$"),
):
    query = {}
    if ObjectId.is_valid(product_id):
        query = {"$or": [{"_id": ObjectId(product_id)}, {"product_id": product_id}]}
    else:
        query = {"product_id": product_id}

    prod = products_collection.find_one(query)
    if not prod:
        raise HTTPException(status_code=404, detail="Product not found")

    return compute_forecast(prod, horizon_days, model)


@app.post("/api/forecasts/{product_id}", status_code=201)
def persist_forecast(
    product_id: str,
    body: ForecastRequest,
):
    query = {}
    if ObjectId.is_valid(product_id):
        query = {"$or": [{"_id": ObjectId(product_id)}, {"product_id": product_id}]}
    else:
        query = {"product_id": product_id}

    prod = products_collection.find_one(query)
    if not prod:
        raise HTTPException(status_code=404, detail="Product not found")

    res = compute_forecast(prod, body.horizon_days, body.model)
    now = datetime.now(timezone.utc)

    record = {
        "product_id": prod["_id"],
        "product_name": prod["name"],
        "sku": prod["sku"],
        "forecast_date": now + timedelta(days=body.horizon_days),
        "forecast_horizon_days": body.horizon_days,
        "predicted_demand": res["total_predicted_demand"],
        "daily_predicted_demand": res["daily_forecast_rate"],
        "model_name": res["model_name"],
        "mae": res["mae"],
        "rmse": res["rmse"],
        "generated_at": now,
    }

    inserted = forecasts_collection.insert_one(record)
    saved = forecasts_collection.find_one({"_id": inserted.inserted_id})
    return serialize_forecast(saved)


# --- Replenishment Recommendations Module ---

@app.get("/api/recommendations")
def get_replenishment_recommendations():
    products = list(products_collection.find())
    suppliers = {s["supplier_id"]: s for s in suppliers_collection.find()}

    # Also map suppliers by ObjectId
    for s in list(suppliers.values()):
        suppliers[str(s["_id"])] = s

    now = datetime.now(timezone.utc)
    lookback = now - timedelta(days=60)

    # Aggregate sales quantities per product over past 60 days
    sales_pipeline = [
        {"$match": {"transaction_type": "sale", "transaction_date": {"$gte": lookback}}},
        {
            "$group": {
                "_id": "$product_id",
                "total_sales": {"$sum": "$quantity"},
                "active_days": {"$sum": 1},
            }
        },
    ]
    sales_agg = {str(item["_id"]): item for item in transactions_collection.aggregate(sales_pipeline)}

    recommendations = []
    days_in_window = 60

    for p in products:
        p_id_str = str(p["_id"])
        sales_info = sales_agg.get(p_id_str)
        total_units_sold = sales_info["total_sales"] if sales_info else 0
        active_days = sales_info["active_days"] if sales_info else 0

        # Daily sales velocity
        avg_daily_demand = round(total_units_sold / days_in_window, 2)

        # Supplier lead time
        sup_code = p.get("supplier_id")
        supplier_doc = suppliers.get(sup_code)
        lead_time = supplier_doc.get("lead_time_days", 7) if supplier_doc else 7

        # Safety Stock formula: max(minimum_stock, round(1.65 * sqrt(lead_time) * max(1, avg_daily_demand)))
        # Bounded between minimum_stock and minimum_stock * 2.5
        min_stock = p.get("minimum_stock", 5)
        calc_ss = int(round(1.65 * math.sqrt(lead_time) * max(0.5, avg_daily_demand)))
        safety_stock = max(min_stock, calc_ss)

        # Reorder Point (ROP) = (Daily Demand * Lead Time) + Safety Stock
        lead_time_demand = round(avg_daily_demand * lead_time, 1)
        reorder_point = int(round(lead_time_demand + safety_stock))

        # Target Stock (Order-Up-To Level) = ROP + (Daily Demand * 14-day Review Period)
        target_stock = int(round(reorder_point + (avg_daily_demand * 14)))
        target_stock = max(target_stock, safety_stock + 10)

        curr_stock = p.get("current_stock", 0)
        suggested_order_qty = max(0, target_stock - curr_stock)

        # Status & Urgency Classification
        if curr_stock == 0:
            status = "STOCKOUT_CRITICAL"
            urgency = "URGENT"
            rationale = "Product is completely out of stock. Immediate replenishment required."
        elif curr_stock <= min_stock:
            status = "BELOW_MINIMUM"
            urgency = "HIGH"
            rationale = f"Stock ({curr_stock}) is at or below defined safety minimum ({min_stock})."
        elif curr_stock <= reorder_point:
            status = "REORDER_RECOMMENDED"
            urgency = "MEDIUM"
            rationale = f"Stock ({curr_stock}) has reached Reorder Point ({reorder_point}). Order {suggested_order_qty} units to cover lead time."
        elif curr_stock > target_stock * 1.5:
            status = "POTENTIAL_OVERSTOCK"
            urgency = "LOW"
            suggested_order_qty = 0
            rationale = f"Inventory ({curr_stock}) exceeds 150% of target level ({target_stock}). Delay reordering."
        else:
            status = "OPTIMAL"
            urgency = "NONE"
            suggested_order_qty = 0
            rationale = f"Stock level ({curr_stock}) is adequate within optimal buffer range."

        confidence = "HIGH" if active_days >= 8 else ("MODERATE" if active_days >= 3 else "LOW")
        if confidence == "LOW":
            rationale += " (Low confidence: limited sales observations recorded)."

        recommendations.append({
            "product_id": str(p["_id"]),
            "product_name": p.get("name"),
            "sku": p.get("sku"),
            "category": p.get("category"),
            "supplier_name": supplier_doc.get("name") if supplier_doc else "Unassigned",
            "current_stock": curr_stock,
            "minimum_stock": min_stock,
            "avg_daily_demand": avg_daily_demand,
            "lead_time_days": lead_time,
            "safety_stock": safety_stock,
            "reorder_point": reorder_point,
            "target_stock": target_stock,
            "suggested_order_quantity": suggested_order_qty,
            "estimated_cost": round(suggested_order_qty * float(p.get("cost_price", 0.0)), 2),
            "status": status,
            "urgency": urgency,
            "confidence": confidence,
            "rationale": rationale,
        })

    # Sort critical / urgent first
    urgency_order = {"URGENT": 0, "HIGH": 1, "MEDIUM": 2, "LOW": 3, "NONE": 4}
    recommendations.sort(key=lambda r: (urgency_order.get(r["urgency"], 5), -r["suggested_order_quantity"]))

    return {
        "generated_at": now.isoformat(),
        "total_analyzed": len(recommendations),
        "reorder_needed_count": sum(1 for r in recommendations if r["suggested_order_quantity"] > 0),
        "total_estimated_restock_cost": round(sum(r["estimated_cost"] for r in recommendations), 2),
        "recommendations": recommendations,
    }


# --- Inventory Alerts Module ---

def _ensure_utc_aware(dt):
    """Normalize a datetime to UTC-aware. Handles naive datetimes from MongoDB
    (which are assumed to be UTC) and already-aware datetimes."""
    if dt is None:
        return None
    if not isinstance(dt, datetime):
        return None
    if dt.tzinfo is None:
        return dt.replace(tzinfo=timezone.utc)
    return dt


@app.get("/api/alerts")
def get_inventory_alerts():
    """Detect stockouts, runout hazards, low-stock warnings, and demand anomalies.
    Defensive: handles empty collections, missing fields, and mixed naive/aware datetimes."""
    try:
        products = list(products_collection.find())
        if not products:
            return {
                "total_alerts": 0,
                "critical_count": 0,
                "high_count": 0,
                "medium_count": 0,
                "low_count": 0,
                "alerts": [],
            }

        suppliers = {}
        for s in suppliers_collection.find():
            suppliers[s.get("supplier_id", "")] = s
            suppliers[str(s["_id"])] = s

        now = datetime.now(timezone.utc)
        lookback_30 = now - timedelta(days=30)
        lookback_7 = now - timedelta(days=7)

        # 30-day velocity — MongoDB $gte handles naive/aware comparison server-side
        txns_30 = list(transactions_collection.find({
            "transaction_type": "sale",
            "transaction_date": {"$gte": lookback_30},
        }))

        sales_30 = {}
        sales_7 = {}
        for t in txns_30:
            pid = str(t.get("product_id", ""))
            qty = t.get("quantity", 0) or 0
            sales_30[pid] = sales_30.get(pid, 0) + qty

            # Normalize transaction_date to aware before comparing with lookback_7
            t_date = _ensure_utc_aware(t.get("transaction_date"))
            if t_date and t_date >= lookback_7:
                sales_7[pid] = sales_7.get(pid, 0) + qty

        alerts = []

        for p in products:
            pid = str(p["_id"])
            curr = p.get("current_stock", 0) or 0
            min_s = p.get("minimum_stock", 5) or 5
            sup = suppliers.get(p.get("supplier_id")) or {}
            lead_time = sup.get("lead_time_days", 7) if sup else 7

            total_30 = sales_30.get(pid, 0)
            daily_rate_30 = total_30 / 30.0

            total_7 = sales_7.get(pid, 0)
            daily_rate_7 = total_7 / 7.0

            p_name = p.get("name", "Unknown")
            p_sku = p.get("sku", "N/A")

            # Alert 1: Stockout
            if curr == 0:
                alerts.append({
                    "type": "STOCKOUT",
                    "severity": "CRITICAL",
                    "product_id": pid,
                    "product_name": p_name,
                    "sku": p_sku,
                    "title": "Out of Stock",
                    "message": "Zero units remaining in stock. Lost sales actively occurring.",
                    "action": "Trigger emergency supplier purchase order.",
                })

            # Alert 2: Below Minimum Stock
            elif curr <= min_s:
                alerts.append({
                    "type": "LOW_STOCK",
                    "severity": "HIGH",
                    "product_id": pid,
                    "product_name": p_name,
                    "sku": p_sku,
                    "title": "Below Minimum Threshold",
                    "message": f"Current stock ({curr}) has breached minimum safety threshold ({min_s}).",
                    "action": "Place replenishment order promptly.",
                })

            # Alert 3: Imminent Stockout Risk (runout before supplier lead time)
            elif daily_rate_30 > 0:
                days_of_stock = curr / daily_rate_30
                if days_of_stock < lead_time:
                    alerts.append({
                        "type": "RUNOUT_RISK",
                        "severity": "HIGH",
                        "product_id": pid,
                        "product_name": p_name,
                        "sku": p_sku,
                        "title": "Imminent Runout Risk",
                        "message": f"Estimated {days_of_stock:.1f} days of inventory remaining, which is less than supplier lead time ({lead_time} days).",
                        "action": "Expedite reorder to prevent stockout.",
                    })

            # Alert 4: Demand Surge
            if daily_rate_7 > 2.0 * daily_rate_30 and total_7 >= 5:
                alerts.append({
                    "type": "DEMAND_SURGE",
                    "severity": "MEDIUM",
                    "product_id": pid,
                    "product_name": p_name,
                    "sku": p_sku,
                    "title": "Unusual Demand Surge",
                    "message": f"Recent 7-day sales velocity ({daily_rate_7:.1f}/day) is >2x the 30-day average ({daily_rate_30:.1f}/day).",
                    "action": "Review inventory buffer and increase forecast horizon.",
                })

            # Alert 5: Potential Overstock
            if curr > min_s * 5 and curr > 50 and daily_rate_30 < 0.2:
                alerts.append({
                    "type": "OVERSTOCK",
                    "severity": "LOW",
                    "product_id": pid,
                    "product_name": p_name,
                    "sku": p_sku,
                    "title": "Potential Excess Overstock",
                    "message": f"High inventory level ({curr} units) with slow turnover rate ({daily_rate_30:.2f}/day).",
                    "action": "Halt future purchase orders and consider promotional movement.",
                })

        # Order alerts by severity
        severity_order = {"CRITICAL": 0, "HIGH": 1, "MEDIUM": 2, "LOW": 3}
        alerts.sort(key=lambda a: severity_order.get(a["severity"], 4))

        return {
            "total_alerts": len(alerts),
            "critical_count": sum(1 for a in alerts if a["severity"] == "CRITICAL"),
            "high_count": sum(1 for a in alerts if a["severity"] == "HIGH"),
            "medium_count": sum(1 for a in alerts if a["severity"] == "MEDIUM"),
            "low_count": sum(1 for a in alerts if a["severity"] == "LOW"),
            "alerts": alerts,
        }
    except Exception as e:
        print(f"[ALERTS ERROR] {type(e).__name__}: {e}")
        raise HTTPException(status_code=500, detail="Failed to compute inventory alerts. Check server logs.")


# --- Dashboard Analytics ---

@app.get("/api/dashboard")
def dashboard():
    total_products = products_collection.count_documents({})
    now = datetime.now(timezone.utc)
    lookback_30 = now - timedelta(days=30)

    # 1. Total inventory units & valuation
    totals_pipeline = [
        {
            "$group": {
                "_id": None,
                "total_units": {"$sum": "$current_stock"},
                "total_cost_valuation": {"$sum": {"$multiply": ["$current_stock", "$cost_price"]}},
                "total_retail_valuation": {"$sum": {"$multiply": ["$current_stock", "$unit_price"]}},
            }
        }
    ]
    totals_res = list(products_collection.aggregate(totals_pipeline))
    if totals_res:
        total_units = totals_res[0].get("total_units", 0)
        total_valuation = round(totals_res[0].get("total_cost_valuation", 0.0), 2)
        total_retail_val = round(totals_res[0].get("total_retail_valuation", 0.0), 2)
    else:
        total_units = 0
        total_valuation = 0.0
        total_retail_val = 0.0

    # 2. Stock Health Counts
    low_stock_count = products_collection.count_documents({
        "$expr": {"$lte": ["$current_stock", "$minimum_stock"]},
        "current_stock": {"$gt": 0},
    })
    out_of_stock_count = products_collection.count_documents({"current_stock": 0})

    # 3. Category Distribution
    category_pipeline = [
        {
            "$group": {
                "_id": "$category",
                "product_count": {"$sum": 1},
                "total_stock": {"$sum": "$current_stock"},
                "valuation": {"$sum": {"$multiply": ["$current_stock", "$cost_price"]}},
            }
        },
        {"$sort": {"valuation": -1}},
    ]
    cat_res = list(products_collection.aggregate(category_pipeline))
    categories_data = [
        {
            "category": c["_id"] or "General",
            "product_count": c.get("product_count", 0),
            "total_stock": c.get("total_stock", 0),
            "valuation": round(c.get("valuation", 0.0), 2),
        }
        for c in cat_res
    ]

    # 4. Top Selling Products (Past 30 days)
    top_sellers_pipeline = [
        {"$match": {"transaction_type": "sale", "transaction_date": {"$gte": lookback_30}}},
        {
            "$group": {
                "_id": "$product_id",
                "name": {"$first": "$product_name"},
                "sku": {"$first": "$sku"},
                "units_sold": {"$sum": "$quantity"},
                "revenue": {"$sum": "$total_value"},
            }
        },
        {"$sort": {"units_sold": -1}},
        {"$limit": 5},
    ]
    top_sellers = list(transactions_collection.aggregate(top_sellers_pipeline))
    top_sellers_data = [
        {
            "product_id": str(item["_id"]),
            "name": item.get("name", "Unknown"),
            "sku": item.get("sku", ""),
            "units_sold": item.get("units_sold", 0),
            "revenue": round(item.get("revenue", 0.0), 2),
        }
        for item in top_sellers
    ]

    # 5. Sales Trends (Daily aggregation for past 14 days)
    lookback_14 = now - timedelta(days=14)
    sales_trend_pipeline = [
        {"$match": {"transaction_type": "sale", "transaction_date": {"$gte": lookback_14}}},
        {
            "$group": {
                "_id": {
                    "$dateToString": {"format": "%Y-%m-%d", "date": "$transaction_date"}
                },
                "units_sold": {"$sum": "$quantity"},
                "revenue": {"$sum": "$total_value"},
            }
        },
        {"$sort": {"_id": 1}},
    ]
    trend_res = {item["_id"]: item for item in transactions_collection.aggregate(sales_trend_pipeline)}

    sales_trend_data = []
    for d in range(14, -1, -1):
        dt_key = (now - timedelta(days=d)).strftime("%Y-%m-%d")
        item = trend_res.get(dt_key)
        sales_trend_data.append({
            "date": dt_key,
            "units_sold": item["units_sold"] if item else 0,
            "revenue": round(item["revenue"] if item else 0.0, 2),
        })

    # 6. Recent Transactions
    recent_txns = list(transactions_collection.find().sort("transaction_date", -1).limit(6))

    return {
        "total_products": total_products,
        "total_units_in_stock": total_units,
        "total_inventory_valuation": total_valuation,
        "total_potential_retail_value": total_retail_val,
        "low_stock_count": low_stock_count,
        "out_of_stock_count": out_of_stock_count,
        "categories": categories_data,
        "top_selling_products": top_sellers_data,
        "sales_trend_14_days": sales_trend_data,
        "recent_transactions": [serialize_transaction(t) for t in recent_txns],
    }


# --- Reports & CSV Export Module ---

@app.get("/api/reports")
def get_comprehensive_reports():
    now = datetime.now(timezone.utc)
    lookback_60 = now - timedelta(days=60)

    # 1. Total transaction breakdown
    txn_summary = list(transactions_collection.aggregate([
        {
            "$group": {
                "_id": "$transaction_type",
                "count": {"$sum": 1},
                "total_quantity": {"$sum": "$quantity"},
                "total_value": {"$sum": "$total_value"},
            }
        }
    ]))
    txn_map = {item["_id"]: item for item in txn_summary}

    # 2. Supplier Performance
    supplier_stats = list(suppliers_collection.aggregate([
        {
            "$lookup": {
                "from": "products",
                "localField": "supplier_id",
                "foreignField": "supplier_id",
                "as": "supplied_products",
            }
        },
        {
            "$project": {
                "supplier_id": 1,
                "name": 1,
                "lead_time_days": 1,
                "product_count": {"$size": "$supplied_products"},
                "total_stock": {"$sum": "$supplied_products.current_stock"},
            }
        },
    ]))

    # 3. Low stock and out of stock lists
    critical_products = list(products_collection.find({
        "$expr": {"$lte": ["$current_stock", "$minimum_stock"]}
    }).sort("current_stock", 1))

    return {
        "summary": {
            "total_products": products_collection.count_documents({}),
            "total_suppliers": suppliers_collection.count_documents({}),
            "total_transactions": transactions_collection.count_documents({}),
            "purchases": txn_map.get("purchase", {"count": 0, "total_value": 0}),
            "sales": txn_map.get("sale", {"count": 0, "total_value": 0}),
            "adjustments": txn_map.get("adjustment", {"count": 0, "total_value": 0}),
        },
        "critical_stock_products": [serialize_product(p) for p in critical_products],
        "supplier_metrics": [
            {
                "id": str(s["_id"]),
                "supplier_id": s.get("supplier_id"),
                "name": s.get("name"),
                "lead_time_days": s.get("lead_time_days", 7),
                "product_count": s.get("product_count", 0),
                "total_stock": s.get("total_stock", 0),
            }
            for s in supplier_stats
        ],
    }


@app.get("/api/reports/export-csv")
def export_csv(report_type: str = Query(default="inventory", pattern="^(inventory|sales|recommendations)$")):
    output = io.StringIO()
    writer = csv.writer(output)

    if report_type == "inventory":
        writer.writerow(["Product ID", "Name", "SKU", "Category", "Current Stock", "Min Stock", "Cost Price", "Unit Price", "Valuation", "Status"])
        for p in products_collection.find().sort("name", 1):
            s_prod = serialize_product(p)
            writer.writerow([
                s_prod["product_id"],
                s_prod["name"],
                s_prod["sku"],
                s_prod["category"],
                s_prod["current_stock"],
                s_prod["minimum_stock"],
                s_prod["cost_price"],
                s_prod["unit_price"],
                s_prod["total_valuation"],
                s_prod["status"],
            ])
        filename = f"inventory_report_{datetime.now().strftime('%Y%m%d')}.csv"

    elif report_type == "sales":
        writer.writerow(["Transaction ID", "Date", "Product Name", "SKU", "Quantity", "Unit Price", "Total Value", "Notes"])
        for t in transactions_collection.find({"transaction_type": "sale"}).sort("transaction_date", -1):
            s_t = serialize_transaction(t)
            writer.writerow([
                s_t["transaction_id"],
                s_t["transaction_date"],
                s_t["product_name"],
                s_t["sku"],
                s_t["quantity"],
                s_t["unit_price"],
                s_t["total_value"],
                s_t["notes"],
            ])
        filename = f"sales_history_{datetime.now().strftime('%Y%m%d')}.csv"

    else:  # recommendations
        rec_data = get_replenishment_recommendations()
        writer.writerow(["Product Name", "SKU", "Category", "Supplier", "Current Stock", "Daily Demand", "Lead Time Days", "Reorder Point", "Target Stock", "Suggested Order Qty", "Estimated Cost", "Urgency", "Rationale"])
        for r in rec_data["recommendations"]:
            writer.writerow([
                r["product_name"],
                r["sku"],
                r["category"],
                r["supplier_name"],
                r["current_stock"],
                r["avg_daily_demand"],
                r["lead_time_days"],
                r["reorder_point"],
                r["target_stock"],
                r["suggested_order_quantity"],
                r["estimated_cost"],
                r["urgency"],
                r["rationale"],
            ])
        filename = f"replenishment_recommendations_{datetime.now().strftime('%Y%m%d')}.csv"

    output.seek(0)
    return Response(
        content=output.getvalue(),
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename={filename}"},
    )
