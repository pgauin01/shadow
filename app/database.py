import motor.motor_asyncio
import os
from dotenv import load_dotenv

load_dotenv()

# Get URL from .env file
MONGO_URL = os.getenv("MONGO_URL", "mongodb://localhost:27017")
DB_NAME = "shadow_db"

client = motor.motor_asyncio.AsyncIOMotorClient(MONGO_URL)
db = client[DB_NAME]

# Collections
notes_collection = db["cards"]
user_collection = db["users"]
events_collection = db["events"]
patterns_collection = db["patterns"]

# Quick check function
async def ping_db():
    try:
        await client.admin.command('ping')
        print("✅ MongoDB Connected Successfully!")
    except Exception as e:
        print(f"❌ MongoDB Connection Failed: {e}")