import os
import sys
from pathlib import Path
import random
from datetime import datetime, timedelta, timezone
from dotenv import load_dotenv
from pymongo import MongoClient
from bson import ObjectId

BACKEND_DIR = Path(__file__).resolve().parent
ROOT_DIR = BACKEND_DIR.parent

if str(ROOT_DIR) not in sys.path:
    sys.path.insert(0, str(ROOT_DIR))
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

env_backend = BACKEND_DIR / ".env"
if env_backend.exists():
    load_dotenv(dotenv_path=env_backend)

env_root = ROOT_DIR / ".env"
if env_root.exists():
    load_dotenv(dotenv_path=env_root)

load_dotenv()

MONGODB_URI = os.getenv("MONGODB_URI")
DATABASE_NAME = os.getenv("DATABASE_NAME", "inventory_management")


def seed_inventory_data(client=None, force=False):
    close_client = False
    if client is None:
        if not MONGODB_URI:
            raise RuntimeError("MONGODB_URI is not configured in backend/.env")
        client = MongoClient(MONGODB_URI, serverSelectionTimeoutMS=10000, connect=False)
        close_client = True

    db = client[DATABASE_NAME]
    products_col = db["products"]
    suppliers_col = db["suppliers"]
    transactions_col = db["inventory_transactions"]
    forecasts_col = db["forecast_records"]

    # Check if data already exists
    existing_count = products_col.count_documents({})
    if existing_count > 0 and not force:
        print(f"Products collection already contains {existing_count} items. Skipping seed (use force=True to re-seed).")
        if close_client:
            client.close()
        return {"status": "skipped", "message": f"Already seeded with {existing_count} products."}

    if force:
        print("Clearing existing inventory collections...")
        products_col.delete_many({})
        suppliers_col.delete_many({})
        transactions_col.delete_many({})
        forecasts_col.delete_many({})

    now = datetime.now(timezone.utc)

    # 1. Seed Suppliers
    suppliers_data = [
        {
            "_id": ObjectId("660000000000000000000101"),
            "supplier_id": "SUP-101",
            "name": "Apex Electronics Corp",
            "contact_person": "Sarah Chen",
            "email": "sarah@apexelectronics.com",
            "phone": "+1 555-0142",
            "lead_time_days": 5,
            "created_at": now - timedelta(days=120),
        },
        {
            "_id": ObjectId("660000000000000000000102"),
            "supplier_id": "SUP-102",
            "name": "Summit Office & Retail Supplies",
            "contact_person": "Marcus Vance",
            "email": "marcus@summitoffice.com",
            "phone": "+1 555-0188",
            "lead_time_days": 3,
            "created_at": now - timedelta(days=120),
        },
        {
            "_id": ObjectId("660000000000000000000103"),
            "supplier_id": "SUP-103",
            "name": "NexGen Hardware & Components",
            "contact_person": "David Miller",
            "email": "dmiller@nexgenparts.com",
            "phone": "+1 555-0193",
            "lead_time_days": 10,
            "created_at": now - timedelta(days=120),
        },
        {
            "_id": ObjectId("660000000000000000000104"),
            "supplier_id": "SUP-104",
            "name": "Pacific Tech Distributors",
            "contact_person": "Elena Rostova",
            "email": "elena@pacifictech.com",
            "phone": "+1 555-0177",
            "lead_time_days": 7,
            "created_at": now - timedelta(days=120),
        },
    ]
    suppliers_col.insert_many(suppliers_data)
    print(f"Inserted {len(suppliers_data)} suppliers.")

    # 2. Seed Products
    raw_products = [
        # Electronics
        ("PRD-1001", "Wireless Mechanical Keyboard", "ELEC-WKB-01", "Electronics", "Compact 75% hot-swappable keyboard with wireless 2.4G & Bluetooth", 89.99, 45.00, 32, 15, "SUP-101"),
        ("PRD-1002", "Ultra-Slim USB-C Hub 7-in-1", "ELEC-HUB-02", "Electronics", "Multiport adapter with 4K HDMI, 100W PD charging, and SD reader", 39.99, 18.50, 14, 20, "SUP-101"),
        ("PRD-1003", "Ergonomic Vertical Mouse", "ELEC-VMS-03", "Electronics", "Wireless ergonomic mouse with natural handshake angle and silent clicks", 49.99, 22.00, 28, 10, "SUP-101"),
        ("PRD-1004", "4K Ultra-HD Webcam with Dual Mics", "ELEC-WBC-04", "Electronics", "High resolution video streaming webcam with auto light correction", 79.99, 38.00, 8, 12, "SUP-101"),
        ("PRD-1005", "100W GaN Fast Charger", "ELEC-CHG-05", "Electronics", "Triple-port GaN fast charging wall adapter for laptops and phones", 45.00, 20.00, 45, 15, "SUP-101"),
        ("PRD-1006", "Noise-Canceling Bluetooth Headset", "ELEC-HDS-06", "Electronics", "Over-ear active noise canceling headphones with 40hr battery", 119.00, 55.00, 0, 10, "SUP-104"),
        # Office Supplies
        ("PRD-1007", "Executive Mesh Task Chair", "OFF-CHR-01", "Office Supplies", "High-back breathable mesh chair with adjustable lumbar support", 220.00, 110.00, 12, 5, "SUP-102"),
        ("PRD-1008", "Dual Monitor Arm Desk Mount", "OFF-MNT-02", "Office Supplies", "Gas spring dual screen desk mount supporting up to 32-inch monitors", 65.00, 30.00, 24, 8, "SUP-102"),
        ("PRD-1009", "Heavy-Duty Cross-Cut Paper Shredder", "OFF-SHR-03", "Office Supplies", "12-sheet cross cut shredder with thermal overload protection", 145.00, 75.00, 6, 8, "SUP-102"),
        ("PRD-1010", "Premium Laser Copy Paper (5000 Sheets)", "OFF-PPR-04", "Office Supplies", "20lb 92-bright multi-purpose office copy paper carton", 42.00, 24.00, 55, 20, "SUP-102"),
        ("PRD-1011", "Desk Cable Management Spine", "OFF-CBL-05", "Office Supplies", "Flexible attractive vertebrae cable organizer for standing desks", 24.99, 9.50, 60, 15, "SUP-102"),
        # Networking & Storage
        ("PRD-1012", "1TB NVMe PCIe 4.0 Internal SSD", "NET-SSD-01", "Networking", "Ultra high-speed M.2 solid state drive with 7000MB/s read speeds", 95.00, 52.00, 18, 15, "SUP-104"),
        ("PRD-1013", "2TB External Rugged Mobile HDD", "NET-HDD-02", "Networking", "Shock-resistant USB 3.2 portable backup hard drive", 85.00, 44.00, 22, 10, "SUP-104"),
        ("PRD-1014", "Gigabit 8-Port Managed Switch", "NET-SWT-03", "Networking", "Smart managed gigabit desktop ethernet switch with VLAN support", 68.00, 32.00, 15, 10, "SUP-103"),
        ("PRD-1015", "Wi-Fi 6 Mesh Router System (3-Pack)", "NET-RTR-04", "Networking", "Whole-home high throughput AX3000 mesh Wi-Fi system", 179.00, 92.00, 9, 10, "SUP-104"),
        ("PRD-1016", "Cat6 Shielded Patch Cable 50ft", "NET-CAT-05", "Networking", "High-performance Snagless RJ45 copper network patch cable", 18.50, 6.20, 85, 25, "SUP-103"),
        # Hardware & Industrial
        ("PRD-1017", "1500VA Battery Backup UPS", "IND-UPS-01", "Hardware", "Line-interactive uninterruptible power supply with LCD display", 189.00, 98.00, 7, 8, "SUP-103"),
        ("PRD-1018", "Anti-Static Workstation Mat 24x36", "IND-MAT-02", "Hardware", "ESD safe dissipative grounding workbench surface mat", 34.00, 14.00, 30, 10, "SUP-103"),
        ("PRD-1019", "Precision Electronic Screwdriver Kit", "IND-TLS-03", "Hardware", "64-in-1 magnetic repair tool set for laptops, phones & consoles", 29.99, 11.50, 42, 15, "SUP-103"),
        ("PRD-1020", "Industrial Handheld Thermal Label Printer", "IND-LBL-04", "Hardware", "Direct thermal barcode and shipping label portable printer", 89.00, 42.00, 11, 6, "SUP-102"),
    ]

    products_docs = []
    product_map = {}

    for idx, (p_id, name, sku, cat, desc, u_price, c_price, stock, min_stock, sup_id) in enumerate(raw_products):
        doc_id = ObjectId(f"6600000000000000000002{idx+1:02d}")
        doc = {
            "_id": doc_id,
            "product_id": p_id,
            "name": name,
            "sku": sku,
            "category": cat,
            "description": desc,
            "unit_price": float(u_price),
            "cost_price": float(c_price),
            "current_stock": int(stock),
            "minimum_stock": int(min_stock),
            "supplier_id": sup_id,
            "created_at": now - timedelta(days=90),
            "updated_at": now,
        }
        products_docs.append(doc)
        product_map[p_id] = doc

    products_col.insert_many(products_docs)
    print(f"Inserted {len(products_docs)} products.")

    # 3. Seed Realistic Historical Transactions (Past 75 days)
    random.seed(42)  # Deterministic synthetic data
    transactions = []
    txn_counter = 1

    # Initial purchases 80 days ago for all products
    for p in products_docs:
        initial_qty = p["current_stock"] + random.randint(40, 80)
        transactions.append({
            "_id": ObjectId(),
            "transaction_id": f"TXN-{txn_counter:05d}",
            "product_id": p["_id"],
            "product_custom_id": p["product_id"],
            "product_name": p["name"],
            "sku": p["sku"],
            "transaction_type": "purchase",
            "quantity": initial_qty,
            "unit_price": p["cost_price"],
            "total_value": round(initial_qty * p["cost_price"], 2),
            "transaction_date": now - timedelta(days=80, hours=random.randint(1, 10)),
            "notes": "Initial stock consignment receipt",
            "created_at": now - timedelta(days=80),
        })
        txn_counter += 1

    # Daily sales across past 75 days
    # Give some products high sales velocity, some moderate, some low
    for day_offset in range(75, 0, -1):
        txn_date = now - timedelta(days=day_offset, hours=random.randint(9, 18), minutes=random.randint(0, 59))
        day_of_week = txn_date.weekday()
        weekend_factor = 1.3 if day_of_week in (4, 5) else 1.0  # Slightly higher weekend sales

        # Pick 6-12 products that made sales on this day
        active_sample_size = random.randint(6, 12)
        sample_products = random.sample(products_docs, active_sample_size)

        for p in sample_products:
            # Base quantity between 1 and 4, modulated by weekend factor
            qty = max(1, int(random.randint(1, 4) * weekend_factor))
            transactions.append({
                "_id": ObjectId(),
                "transaction_id": f"TXN-{txn_counter:05d}",
                "product_id": p["_id"],
                "product_custom_id": p["product_id"],
                "product_name": p["name"],
                "sku": p["sku"],
                "transaction_type": "sale",
                "quantity": qty,
                "unit_price": p["unit_price"],
                "total_value": round(qty * p["unit_price"], 2),
                "transaction_date": txn_date,
                "notes": "Retail / online customer sale",
                "created_at": txn_date,
            })
            txn_counter += 1

    # Mid-period Restock Purchases (approx 30 and 15 days ago)
    for p in products_docs[:8]:
        restock_qty = random.randint(15, 30)
        transactions.append({
            "_id": ObjectId(),
            "transaction_id": f"TXN-{txn_counter:05d}",
            "product_id": p["_id"],
            "product_custom_id": p["product_id"],
            "product_name": p["name"],
            "sku": p["sku"],
            "transaction_type": "purchase",
            "quantity": restock_qty,
            "unit_price": p["cost_price"],
            "total_value": round(restock_qty * p["cost_price"], 2),
            "transaction_date": now - timedelta(days=25, hours=10),
            "notes": "Scheduled mid-quarter supplier replenishment",
            "created_at": now - timedelta(days=25),
        })
        txn_counter += 1

    # A couple of Inventory Adjustments (cycle counts / damage audit)
    adj_sample = products_docs[2:5]
    for p in adj_sample:
        adj_qty = random.choice([-2, -1, 1])
        transactions.append({
            "_id": ObjectId(),
            "transaction_id": f"TXN-{txn_counter:05d}",
            "product_id": p["_id"],
            "product_custom_id": p["product_id"],
            "product_name": p["name"],
            "sku": p["sku"],
            "transaction_type": "adjustment",
            "quantity": adj_qty,
            "unit_price": p["cost_price"],
            "total_value": round(abs(adj_qty) * p["cost_price"], 2),
            "transaction_date": now - timedelta(days=12, hours=14),
            "notes": "Routine physical cycle count audit adjustment",
            "created_at": now - timedelta(days=12),
        })
        txn_counter += 1

    transactions_col.insert_many(transactions)
    print(f"Inserted {len(transactions)} historical inventory transactions spanning 75 days.")

    if close_client:
        client.close()

    return {
        "status": "success",
        "suppliers_seeded": len(suppliers_data),
        "products_seeded": len(products_docs),
        "transactions_seeded": len(transactions),
        "message": "Realistic synthetic inventory data loaded successfully.",
    }


if __name__ == "__main__":
    seed_inventory_data(force=True)
