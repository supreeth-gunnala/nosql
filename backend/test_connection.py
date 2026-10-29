import os
import sys
from pathlib import Path
from dotenv import load_dotenv
from pymongo import MongoClient

BACKEND_DIR = Path(__file__).resolve().parent
ROOT_DIR = BACKEND_DIR.parent

env_backend = BACKEND_DIR / ".env"
if env_backend.exists():
    load_dotenv(dotenv_path=env_backend)

env_root = ROOT_DIR / ".env"
if env_root.exists():
    load_dotenv(dotenv_path=env_root)

load_dotenv()

MONGODB_URI = os.getenv("MONGODB_URI")
DATABASE_NAME = os.getenv("DATABASE_NAME", "inventory_management")

if not MONGODB_URI:
    raise ValueError("MONGODB_URI is missing from the .env file.")

try:
    client = MongoClient(MONGODB_URI, serverSelectionTimeoutMS=10000)
    client.admin.command("ping")
    db = client[DATABASE_NAME]
    collections = db.list_collection_names()
    print("MongoDB Atlas connection successful!")
    print(f"Database configured: {DATABASE_NAME}")
    print(f"Available collections: {collections}")
    client.close()
except Exception as error:
    print("MongoDB connection failed.")
    print(f"Error: {error}")
