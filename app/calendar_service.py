import os
import json
from datetime import datetime, timedelta
from google_auth_oauthlib.flow import Flow
from google.oauth2.credentials import Credentials
from googleapiclient.discovery import build
from fastapi.responses import RedirectResponse
from app.database import user_collection, events_collection
from app.models import EventDB
from bson import ObjectId
from datetime import datetime

# 1. CONFIGURATION
# Allow HTTP for localhost testing (Remove this in production!)
os.environ['OAUTHLIB_INSECURE_TRANSPORT'] = '1'

CLIENT_SECRETS_FILE = "client_secret.json"
SCOPES = ['https://www.googleapis.com/auth/calendar.readonly']
REDIRECT_URI = "http://localhost:8000/auth/callback"

# 2. OAUTH FLOW HELPER
def create_flow():
    return Flow.from_client_secrets_file(
        CLIENT_SECRETS_FILE,
        scopes=SCOPES,
        redirect_uri=REDIRECT_URI
    )

async def sync_calendar_events(user_id: str):
    # A. Get User's Token (Same as before)
    user = await user_collection.find_one({"_id": ObjectId(user_id)})
    if not user or "google_token" not in user:
        return {"error": "User not connected to Google"}

    # B. Build Service (Same as before)
    creds_data = json.loads(user["google_token"])
    creds = Credentials.from_authorized_user_info(creds_data, SCOPES)
    service = build('calendar', 'v3', credentials=creds)

    # C. Fetch Events (Same as before)
    now = datetime.utcnow().isoformat() + 'Z'
    events_result = service.events().list(
        calendarId='primary', timeMin=now,
        maxResults=10, singleEvents=True,
        orderBy='startTime'
    ).execute()
    google_events = events_result.get('items', [])

    # D. Save with Time Formatting
    count = 0
    for g_event in google_events:
        existing = await events_collection.find_one({
            "user_id": user_id, 
            "google_id": g_event['id']
        })
        
        if not existing:
            # 1. Parse Start Time
            start_raw = g_event['start'].get('dateTime', g_event['start'].get('date'))
            
            # 2. Extract Date & Time
            event_date = start_raw # Default
            event_time = None
            
            if 'T' in start_raw:
                # Format: 2026-01-16T14:30:00+05:30
                dt_obj = datetime.fromisoformat(start_raw)
                event_date = dt_obj.strftime("%Y-%m-%d") # "2026-01-16"
                event_time = dt_obj.strftime("%I:%M %p") # "02:30 PM"
            else:
                # Format: 2026-01-16 (All Day Event)
                event_date = start_raw
                event_time = "All Day"

            new_event = {
                "title": g_event.get('summary', 'No Title'),
                "date": event_date,
                "time": event_time, # <--- Saving the clean time string
                "type": "Personal",
                "user_id": user_id,
                "google_id": g_event['id'],
                "created_at": datetime.utcnow()
            }
            await events_collection.insert_one(new_event)
            count += 1
            
    return {"message": f"Synced {count} new events"}