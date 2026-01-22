import re
from typing import List
from datetime import datetime, timezone
from fastapi import APIRouter, Response
from fastapi.responses import RedirectResponse
from bson import ObjectId
import dateparser

from app.database import events_collection, users_collection
from app.models import EventDB, EventCreate
from app.calendar_service import create_flow, sync_calendar_events

router = APIRouter()

@router.get("/events", response_model=List[EventDB])
async def get_events(user_id: str):
    # 1. Get Today's Date (YYYY-MM-DD)
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    
    # 2. Query MongoDB
    cursor = events_collection.find({
        "user_id": user_id,
        "date": {"$gte": today} 
    }).sort("date", 1).limit(20)
    
    return await cursor.to_list(length=20)

@router.post("/events", response_model=EventDB)
async def create_event(event: EventCreate):
    final_date = event.date
    final_time = event.time
    
    # SMART PARSING LOGIC:
    if not final_time and event.date:
        # Convert "11.30" to "11:30" so dateparser understands it
        clean_date_str = re.sub(r'(\d{1,2})\.(\d{2})', r'\1:\2', event.date)
        
        # Use the clean string for parsing
        parsed_dt = dateparser.parse(clean_date_str, settings={'PREFER_DATES_FROM': 'future'})
        
        if parsed_dt:
            # 1. Standardize Date
            final_date = parsed_dt.strftime("%Y-%m-%d")
            
            # 2. Extract Time
            input_lower = event.date.lower()
            if any(x in input_lower for x in ["pm", "am", ":", ".", " at "]):
                final_time = parsed_dt.strftime("%I:%M %p")

    # Create DB Object
    new_event = EventDB(
        title=event.title,
        date=final_date,
        time=final_time,
        type=event.type,
        user_id=event.user_id,
        created_at=datetime.now(timezone.utc)
    )
    
    event_dict = new_event.model_dump(by_alias=True, exclude=["id"])
    result = await events_collection.insert_one(event_dict)
    return await events_collection.find_one({"_id": result.inserted_id})

@router.delete("/events/{event_id}")
async def delete_event(event_id: str):
    await events_collection.delete_one({"_id": ObjectId(event_id)})
    return {"status": "deleted"}    

@router.post("/events/sync")
async def trigger_sync(body: dict):
    # Expects {"user_id": "..."}
    return await sync_calendar_events(body['user_id'])    

# --- GOOGLE AUTH FLOW ---

@router.get("/auth/google")
async def google_login(user_id: str):
    flow = create_flow()
    # We pass user_id in the 'state' parameter to survive the redirect
    authorization_url, state = flow.authorization_url(
        access_type='offline',
        include_granted_scopes='true',
        prompt='consent',
        state=user_id 
    )
    return {"url": authorization_url}

@router.get("/auth/callback")
async def google_callback(state: str, code: str):
    try:
        flow = create_flow()
        flow.fetch_token(code=code)
        
        # Get the credentials object
        creds = flow.credentials
        
        # Convert to JSON string for storage
        creds_json = creds.to_json()
        
        # Save to User Profile in MongoDB
        user_id = state 
        await users_collection.update_one(
            {"_id": ObjectId(user_id)},
            {"$set": {"google_token": creds_json}}
        )
        
        # Trigger an immediate sync!
        await sync_calendar_events(user_id)
        
        # Redirect back to your Frontend App
        return RedirectResponse(url="http://localhost:5173?status=synced")
        
    except Exception as e:
        return {"error": f"Auth failed: {str(e)}"}