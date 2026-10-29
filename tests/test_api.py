import os
import unittest
from datetime import datetime, timedelta, timezone
from unittest.mock import MagicMock, patch
from bson import ObjectId
from fastapi import HTTPException

# Set test environment URI before importing
os.environ["MONGODB_URI"] = "mongodb://127.0.0.1:27017"
os.environ["DATABASE_NAME"] = "test_inventory_db"

import backend.main as app_module


class TestInventoryIntelligenceBackend(unittest.TestCase):
    def setUp(self):
        self.prod_oid = ObjectId("660000000000000000000001")
        self.sup_oid = ObjectId("660000000000000000000002")
        self.txn_oid = ObjectId("660000000000000000000003")

        now = datetime.now(timezone.utc)

        self.sample_product = {
            "_id": self.prod_oid,
            "product_id": "PRD-1001",
            "name": "Wireless Mechanical Keyboard",
            "sku": "ELEC-WKB-01",
            "category": "Electronics",
            "description": "75% compact mechanical keyboard",
            "unit_price": 89.99,
            "cost_price": 45.00,
            "current_stock": 25,
            "minimum_stock": 10,
            "supplier_id": "SUP-101",
            "created_at": now - timedelta(days=60),
            "updated_at": now,
        }

        self.sample_supplier = {
            "_id": self.sup_oid,
            "supplier_id": "SUP-101",
            "name": "Apex Electronics Corp",
            "contact_person": "Sarah Chen",
            "email": "sarah@apexelectronics.com",
            "phone": "+1 555-0142",
            "lead_time_days": 5,
            "created_at": now - timedelta(days=90),
        }

        self.sample_sale_txn = {
            "_id": self.txn_oid,
            "transaction_id": "TXN-00001",
            "product_id": self.prod_oid,
            "product_custom_id": "PRD-1001",
            "product_name": "Wireless Mechanical Keyboard",
            "sku": "ELEC-WKB-01",
            "transaction_type": "sale",
            "quantity": 3,
            "unit_price": 89.99,
            "total_value": 269.97,
            "transaction_date": now - timedelta(days=2),
            "notes": "Retail customer sale",
            "created_at": now - timedelta(days=2),
        }

    # --- 1. Health Endpoint Tests ---

    @patch.object(app_module, "client")
    def test_health_ok(self, mock_client):
        mock_client.admin.command.return_value = {"ok": 1}
        res = app_module.health()
        self.assertEqual(res["status"], "ok")
        self.assertEqual(res["database"], "test_inventory_db")

    @patch.object(app_module, "client")
    def test_health_failure(self, mock_client):
        from pymongo.errors import PyMongoError
        mock_client.admin.command.side_effect = PyMongoError("Connection lost")
        with self.assertRaises(HTTPException) as ctx:
            app_module.health()
        self.assertEqual(ctx.exception.status_code, 503)

    # --- 2. Product Management Tests ---

    @patch.object(app_module.products_collection, "find_one")
    @patch.object(app_module.products_collection, "insert_one")
    def test_add_product_success(self, mock_insert, mock_find_one):
        mock_find_one.side_effect = [None, self.sample_product]
        mock_insert.return_value = MagicMock(inserted_id=self.prod_oid)

        item = app_module.ProductCreate(
            name="Wireless Mechanical Keyboard",
            sku="ELEC-WKB-01",
            category="Electronics",
            description="75% compact mechanical keyboard",
            unit_price=89.99,
            cost_price=45.00,
            current_stock=25,
            minimum_stock=10,
            supplier_id="SUP-101",
        )

        res = app_module.add_product(item)
        self.assertEqual(res["name"], "Wireless Mechanical Keyboard")
        self.assertEqual(res["sku"], "ELEC-WKB-01")
        self.assertEqual(res["current_stock"], 25)

    @patch.object(app_module.products_collection, "find_one")
    def test_add_product_duplicate_sku(self, mock_find_one):
        mock_find_one.return_value = self.sample_product

        item = app_module.ProductCreate(
            name="Another Keyboard",
            sku="ELEC-WKB-01",
            category="Electronics",
            unit_price=79.99,
            cost_price=40.00,
        )

        with self.assertRaises(HTTPException) as ctx:
            app_module.add_product(item)
        self.assertEqual(ctx.exception.status_code, 409)
        self.assertIn("already exists", ctx.exception.detail)

    def test_product_validation_error(self):
        with self.assertRaises(Exception):
            app_module.ProductCreate(
                name="   ",
                sku="INVALID-SKU",
                category="General",
                unit_price=-10.0,
            )

    @patch.object(app_module.products_collection, "find")
    def test_list_products_with_filter(self, mock_find):
        mock_cursor = MagicMock()
        mock_cursor.sort.return_value = [self.sample_product]
        mock_find.return_value = mock_cursor

        res = app_module.list_products(search="Keyboard", category="Electronics", low_stock=False)
        self.assertEqual(len(res), 1)
        self.assertEqual(res[0]["sku"], "ELEC-WKB-01")

    @patch.object(app_module.transactions_collection, "count_documents")
    @patch.object(app_module.products_collection, "find_one")
    def test_delete_product_prevented_when_history_exists(self, mock_find_prod, mock_cnt_txn):
        mock_find_prod.return_value = self.sample_product
        mock_cnt_txn.return_value = 5

        with self.assertRaises(HTTPException) as ctx:
            app_module.delete_product(str(self.prod_oid))
        self.assertEqual(ctx.exception.status_code, 400)
        self.assertIn("recorded transactions", ctx.exception.detail)

    @patch.object(app_module.transactions_collection, "count_documents")
    @patch.object(app_module.products_collection, "find_one")
    @patch.object(app_module.products_collection, "delete_one")
    def test_delete_product_success_when_clean(self, mock_del, mock_find_prod, mock_cnt_txn):
        mock_find_prod.return_value = self.sample_product
        mock_cnt_txn.return_value = 0

        res = app_module.delete_product(str(self.prod_oid))
        self.assertEqual(res["message"], "Product deleted successfully")

    # --- 3. Supplier Management Tests ---

    @patch.object(app_module.suppliers_collection, "find_one")
    @patch.object(app_module.suppliers_collection, "insert_one")
    def test_add_supplier_success(self, mock_insert, mock_find_one):
        mock_find_one.side_effect = [None, self.sample_supplier]
        mock_insert.return_value = MagicMock(inserted_id=self.sup_oid)

        item = app_module.SupplierCreate(
            supplier_id="SUP-101",
            name="Apex Electronics Corp",
            contact_person="Sarah Chen",
            email="sarah@apexelectronics.com",
            phone="+1 555-0142",
            lead_time_days=5,
        )

        res = app_module.add_supplier(item)
        self.assertEqual(res["supplier_id"], "SUP-101")
        self.assertEqual(res["lead_time_days"], 5)

    @patch.object(app_module.suppliers_collection, "find_one")
    @patch.object(app_module.products_collection, "find_one")
    def test_delete_supplier_prevented_when_linked(self, mock_find_prod, mock_find_sup):
        mock_find_sup.return_value = self.sample_supplier
        mock_find_prod.return_value = self.sample_product

        with self.assertRaises(HTTPException) as ctx:
            app_module.delete_supplier(str(self.sup_oid))
        self.assertEqual(ctx.exception.status_code, 400)
        self.assertIn("is linked to it", ctx.exception.detail)

    # --- 4. Inventory Transactions Tests ---

    @patch.object(app_module.products_collection, "find_one")
    @patch.object(app_module.products_collection, "update_one")
    @patch.object(app_module.transactions_collection, "insert_one")
    @patch.object(app_module.transactions_collection, "find_one")
    def test_purchase_increases_stock(self, mock_find_txn, mock_insert_txn, mock_update_prod, mock_find_prod):
        mock_find_prod.return_value = self.sample_product
        mock_update_prod.return_value = MagicMock(modified_count=1)
        mock_insert_txn.return_value = MagicMock(inserted_id=self.txn_oid)

        purchase_txn = dict(self.sample_sale_txn)
        purchase_txn["transaction_type"] = "purchase"
        purchase_txn["quantity"] = 20
        mock_find_txn.return_value = purchase_txn

        item = app_module.TransactionCreate(
            product_id=str(self.prod_oid),
            transaction_type="purchase",
            quantity=20,
            notes="Consignment delivery",
        )

        res = app_module.create_transaction(item)
        self.assertEqual(res["transaction_type"], "purchase")
        self.assertEqual(res["quantity"], 20)
        mock_update_prod.assert_called_once()

    @patch.object(app_module.products_collection, "find_one")
    @patch.object(app_module.products_collection, "update_one")
    @patch.object(app_module.transactions_collection, "insert_one")
    @patch.object(app_module.transactions_collection, "find_one")
    def test_sale_decreases_stock(self, mock_find_txn, mock_insert_txn, mock_update_prod, mock_find_prod):
        mock_find_prod.return_value = self.sample_product
        mock_update_prod.return_value = MagicMock(modified_count=1)
        mock_insert_txn.return_value = MagicMock(inserted_id=self.txn_oid)
        mock_find_txn.return_value = self.sample_sale_txn

        item = app_module.TransactionCreate(
            product_id=str(self.prod_oid),
            transaction_type="sale",
            quantity=3,
            notes="Retail customer sale",
        )

        res = app_module.create_transaction(item)
        self.assertEqual(res["transaction_type"], "sale")
        self.assertEqual(res["quantity"], 3)

    @patch.object(app_module.products_collection, "find_one")
    @patch.object(app_module.products_collection, "update_one")
    def test_sale_rejected_on_insufficient_stock(self, mock_update_prod, mock_find_prod):
        low_stock_prod = dict(self.sample_product)
        low_stock_prod["current_stock"] = 2
        mock_find_prod.return_value = low_stock_prod

        # modified_count = 0 simulates atomic condition failure (current_stock < requested)
        mock_update_prod.return_value = MagicMock(modified_count=0)

        item = app_module.TransactionCreate(
            product_id=str(self.prod_oid),
            transaction_type="sale",
            quantity=10,
        )

        with self.assertRaises(HTTPException) as ctx:
            app_module.create_transaction(item)
        self.assertEqual(ctx.exception.status_code, 400)
        self.assertIn("Insufficient inventory", ctx.exception.detail)

    @patch.object(app_module.products_collection, "find_one")
    def test_adjustment_rejects_negative_stock(self, mock_find_prod):
        mock_find_prod.return_value = self.sample_product  # current_stock = 25

        item = app_module.TransactionCreate(
            product_id=str(self.prod_oid),
            transaction_type="adjustment",
            quantity=-30,  # 25 - 30 = -5 (invalid)
        )

        with self.assertRaises(HTTPException) as ctx:
            app_module.create_transaction(item)
        self.assertEqual(ctx.exception.status_code, 400)
        self.assertIn("would result in negative stock", ctx.exception.detail)

    # --- 5. Demand Forecasting Tests ---

    @patch.object(app_module.products_collection, "find_one")
    @patch.object(app_module.transactions_collection, "find")
    def test_forecast_sufficient_data_moving_average(self, mock_find_txns, mock_find_prod):
        mock_find_prod.return_value = self.sample_product
        now = datetime.now(timezone.utc)

        # Generate 20 historical sales
        synth_txns = []
        for i in range(20, 0, -1):
            synth_txns.append({
                "transaction_type": "sale",
                "quantity": 2 if i % 2 == 0 else 4,
                "transaction_date": now - timedelta(days=i),
            })
        mock_cursor = MagicMock()
        mock_cursor.sort.return_value = synth_txns
        mock_find_txns.return_value = mock_cursor

        res = app_module.get_product_forecast(str(self.prod_oid), horizon_days=7, model="moving_average")
        self.assertEqual(res["product_name"], "Wireless Mechanical Keyboard")
        self.assertEqual(res["horizon_days"], 7)
        self.assertGreater(res["daily_forecast_rate"], 0.0)
        self.assertIsNotNone(res["mae"])
        self.assertIsNotNone(res["rmse"])
        self.assertIn("disclaimer", res)

    @patch.object(app_module.products_collection, "find_one")
    @patch.object(app_module.transactions_collection, "find")
    def test_forecast_insufficient_data_fallback(self, mock_find_txns, mock_find_prod):
        mock_find_prod.return_value = self.sample_product
        mock_cursor = MagicMock()
        mock_cursor.sort.return_value = []  # Zero sales history
        mock_find_txns.return_value = mock_cursor

        res = app_module.get_product_forecast(str(self.prod_oid), horizon_days=7)
        self.assertEqual(res["confidence"], "LOW")
        self.assertIn("Fallback", res["model_name"])
        self.assertIn("Insufficient", res["rationale"])

    # --- 6. Replenishment Recommendations Tests ---

    @patch.object(app_module.products_collection, "find")
    @patch.object(app_module.suppliers_collection, "find")
    @patch.object(app_module.transactions_collection, "aggregate")
    def test_replenishment_recommendations(self, mock_agg, mock_find_sup, mock_find_prod):
        mock_find_prod.return_value = [self.sample_product]
        mock_find_sup.return_value = [self.sample_supplier]
        mock_agg.return_value = [
            {"_id": self.prod_oid, "total_sales": 120, "active_days": 30}
        ]

        res = app_module.get_replenishment_recommendations()
        self.assertEqual(res["total_analyzed"], 1)
        rec = res["recommendations"][0]
        self.assertEqual(rec["product_name"], "Wireless Mechanical Keyboard")
        self.assertGreater(rec["reorder_point"], 0)
        self.assertIn("status", rec)
        self.assertIn("suggested_order_quantity", rec)

    # --- 7. Inventory Alerts Tests ---

    @patch.object(app_module.products_collection, "find")
    @patch.object(app_module.suppliers_collection, "find")
    @patch.object(app_module.transactions_collection, "find")
    def test_inventory_alerts(self, mock_txns_find, mock_find_sup, mock_find_prod):
        out_of_stock_item = dict(self.sample_product)
        out_of_stock_item["_id"] = ObjectId("660000000000000000000099")
        out_of_stock_item["name"] = "Out of Stock Headset"
        out_of_stock_item["current_stock"] = 0

        mock_find_prod.return_value = [self.sample_product, out_of_stock_item]
        mock_find_sup.return_value = [self.sample_supplier]
        mock_txns_find.return_value = []

        res = app_module.get_inventory_alerts()
        self.assertGreater(res["total_alerts"], 0)
        stockout_alerts = [a for a in res["alerts"] if a["type"] == "STOCKOUT"]
        self.assertEqual(len(stockout_alerts), 1)
        self.assertEqual(stockout_alerts[0]["severity"], "CRITICAL")

    # --- 8. Reports & CSV Export Tests ---

    @patch.object(app_module.products_collection, "find")
    def test_export_csv_inventory(self, mock_prod_find):
        mock_cursor = MagicMock()
        mock_cursor.sort.return_value = [self.sample_product]
        mock_prod_find.return_value = mock_cursor

        resp = app_module.export_csv("inventory")
        self.assertEqual(resp.media_type, "text/csv")
        content = resp.body.decode("utf-8")
        self.assertIn("Wireless Mechanical Keyboard", content)
        self.assertIn("ELEC-WKB-01", content)


if __name__ == "__main__":
    unittest.main()
