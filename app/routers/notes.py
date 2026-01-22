from typing import List
from datetime import datetime, timezone
from fastapi import APIRouter, HTTPException
from bson import ObjectId

from app.database import quick_notes_collection
from app.models import QuickNoteDB, QuickNoteCreate, QuickNoteUpdate
from app.ai_engine import detect_priority

# ✅ FIX 1: Add the prefix here
router = APIRouter(prefix="/quick-notes", tags=["Notes"])

# ✅ FIX 2: Remove "quick-notes" from decorators (it's now in the prefix)

@router.get("/", response_model=List[QuickNoteDB])
async def get_quick_notes(user_id: str):
    cursor = quick_notes_collection.find({"user_id": user_id}).sort("updated_at", -1)
    return await cursor.to_list(length=50)

@router.post("/", response_model=QuickNoteDB)
async def create_quick_note(note: QuickNoteCreate):
    # 1. Define final_p (Handle "Auto" case)
    final_p = note.priority
    if note.priority == "Auto":
        final_p = "Medium"
    
    # 2. Create the DB Object
    new_note = QuickNoteDB(
        content=note.content,
        priority=note.priority,
        final_priority=final_p,
        user_id=note.user_id,
        workspace=note.workspace or "Main",
        is_encrypted=note.is_encrypted 
    )
    
    result = await quick_notes_collection.insert_one(new_note.model_dump(by_alias=True, exclude=["id"]))
    created = await quick_notes_collection.find_one({"_id": result.inserted_id})
    return created

# ✅ FIX 3: Ensure static routes come BEFORE dynamic ones
@router.delete("/workspace")
async def delete_workspace_notes(user_id: str, workspace: str):
    print(f"Attempting to delete notes for user: {user_id} in workspace: {workspace}")
    
    if workspace == "Main":
        raise HTTPException(status_code=400, detail="Cannot delete Main workspace")
    
    try:
        if quick_notes_collection is None:
             raise Exception("Database connection missing")

        result = await quick_notes_collection.delete_many({
            "user_id": user_id,
            "workspace": workspace
        })
        
        return {"status": "deleted", "count": result.deleted_count}

    except Exception as e:
        print(f"❌ ERROR in delete_workspace_notes: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@router.put("/{note_id}", response_model=QuickNoteDB)
async def update_quick_note(note_id: str, note: QuickNoteUpdate):
    #  Fetch existing note
    existing = await quick_notes_collection.find_one({"_id": ObjectId(note_id)})
    if not existing:
        raise HTTPException(status_code=404, detail="Note not found")

    update_data = {"updated_at": datetime.now(timezone.utc)}
    # 1. Handle Encryption Status Change (NEW)
    if note.is_encrypted is not None:
        update_data["is_encrypted"] = note.is_encrypted
    
    #  Handle Content Update
    current_content = existing["content"]
    if note.content is not None:
        update_data["content"] = note.content
        current_content = note.content

    #  Handle Priority Update
    if note.priority is not None:
        update_data["priority"] = note.priority
        if note.priority == "Auto":
            # Only run AI if note is NOT encrypted
            if existing.get("is_encrypted", False):
                update_data["final_priority"] = "Medium"
            else:
                update_data["final_priority"] = await detect_priority(current_content)
        else:
            update_data["final_priority"] = note.priority

    #  Save to DB
    if note.workspace is not None:
        update_data["workspace"] = note.workspace

    await quick_notes_collection.update_one(
        {"_id": ObjectId(note_id)},
        {"$set": update_data}
    )
    
    return await quick_notes_collection.find_one({"_id": ObjectId(note_id)})

@router.delete("/{note_id}")
async def delete_quick_note(note_id: str):
    await quick_notes_collection.delete_one({"_id": ObjectId(note_id)})
    return {"status": "deleted"}