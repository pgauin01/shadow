from fastapi import APIRouter, Depends, HTTPException
from fastapi.security import OAuth2PasswordRequestForm
from bson import ObjectId
import secrets

from app.database import users_collection
from app.models import UserCreate, UserDB, ModeUpdate, WorkspaceUpdate
from app.auth import get_password_hash, verify_password, create_access_token

router = APIRouter()

@router.post("/register")
async def register(user: UserCreate):
    # Check if email exists
    if await users_collection.find_one({"email": user.email}):
        raise HTTPException(status_code=400, detail="Email already registered")
    
    # 👇 NEW: Generate Unique Salt for this user
    # This 32-char hex string (16 bytes) will be sent to frontend on login
    if not user.profile.vault_salt:
        user.profile.vault_salt = secrets.token_hex(16)

    # Create DB User
    new_user = UserDB(
        email=user.email,
        hashed_password=get_password_hash(user.password),
        profile=user.profile # This now includes the vault_salt
    )
    
    await users_collection.insert_one(new_user.model_dump(by_alias=True, exclude=["id"]))
    return {"message": "User created successfully"}

@router.post("/token")
async def login(form_data: OAuth2PasswordRequestForm = Depends()):
    print(f"🔍 LOGIN ATTEMPT: Email={form_data.username}")
    
    # 1. Check if user exists
    user = await users_collection.find_one({"email": form_data.username})
    
    if not user:
        print("❌ Login Failed: User not found in DB.")
        raise HTTPException(status_code=400, detail="User not found")
    
    print("✅ User found in DB. Verifying password...")

    # 2. Check password
    is_valid = verify_password(form_data.password, user["hashed_password"])
    
    if not is_valid:
        print(f"❌ Login Failed: Password hash mismatch.")
        print(f"   Input: {form_data.password}")
        print(f"   Stored Hash: {user['hashed_password']}")
        raise HTTPException(status_code=400, detail="Wrong password")
    
    print("✅ Password verified! Generating token.")
    
    # Create Token
    access_token = create_access_token(data={"sub": user["email"]})
    return {
        "access_token": access_token, 
        "token_type": "bearer",
        "user_id": str(user["_id"]),
        "profile": user["profile"]
    }

@router.get("/users/{user_id}", response_model=UserDB)
async def get_user_profile(user_id: str):
    user = await users_collection.find_one({"_id": ObjectId(user_id)})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return user    

@router.put("/users/{user_id}/mode")
async def update_shadow_mode(user_id: str, update: ModeUpdate):
    # Update the nested 'profile.shadow_type' field
    result = await users_collection.update_one(
        {"_id": ObjectId(user_id)},
        {"$set": {"profile.shadow_type": update.shadow_type}}
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="User not found")
        
    return {"status": "updated", "current_mode": update.shadow_type}

@router.put("/users/{user_id}/workspaces")
async def update_workspaces(user_id: str, update: WorkspaceUpdate):
    # Update the list in MongoDB
    result = await users_collection.update_one(
        {"_id": ObjectId(user_id)},
        {"$set": {"profile.workspaces": update.workspaces}}
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="User not found")
        
    return {"status": "updated", "workspaces": update.workspaces}