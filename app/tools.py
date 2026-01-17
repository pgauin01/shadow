# app/tools.py
from langchain_core.tools import tool
from app.database import events_collection
from datetime import datetime

# We define a "Tool" that Gemini can choose to call
@tool
async def create_event_tool(title: str, date: str, time: str, event_type: str = "Personal"):
    """
    Creates a calendar event. 
    - date: Must be in "YYYY-MM-DD" format.
    - time: Must be in "HH:MM AM/PM" format (e.g., "08:00 PM").
    - event_type: Either "Work" or "Personal".
    """
    # Note: We don't save to DB here immediately because we need the user_id
    # We return the data to the graph, which handles the saving.
    return {
        "action": "save_event",
        "data": {
            "title": title,
            "date": date,
            "time": time,
            "type": event_type,
            "created_at": datetime.utcnow().isoformat()
        }
    }