from typing import List
from datetime import datetime, timezone
from fastapi import APIRouter, HTTPException
from bson import ObjectId
from langchain_core.prompts import ChatPromptTemplate

from app.database import notes_collection, users_collection
from app.models import NoteDB, NoteCreate, QuickNoteUpdate, AIAnalysisResult
from app.ai_engine import analyze_text, generate_weekly_insight, llm
from app.vector_store import save_note_to_vector_db

router = APIRouter()

@router.get("/entries", response_model=List[NoteDB])
async def get_entries(user_id: str = "user_1"):
    # Fetch notes for this user, sorted by newest first
    cursor = notes_collection.find({"user_id": user_id}).sort("created_at", -1).limit(50)
    notes = await cursor.to_list(length=50)
    return notes    

@router.post("/entries", response_model=NoteDB)
async def create_entry(note: NoteCreate):
    # 1. Analyze the text (AI decides: Activity vs. Rant vs. Idea)
    ai_response = await analyze_text(note.raw_text)
    
    # 👇 NEW LOGIC: Override AI if user manually selected a type
    if note.manual_stream_type and note.manual_stream_type != "Auto":
        print(f"🔧 MANUAL OVERRIDE: Changing {ai_response.stream_type} -> {note.manual_stream_type.upper()}")
        # Force the type (Convert to UPPERCASE to match backend logic like "IDEA")
        ai_response.stream_type = note.manual_stream_type.upper()

    # 2. Create the Database Object
    new_note = NoteDB(
        user_id=note.user_id,
        raw_text=note.raw_text,
        ai_metadata=ai_response, 
        created_at=datetime.now(timezone.utc)
    )
    
    # 3. Save to MongoDB (The "Log") - ALWAYS SAVE HERE
    note_dict = new_note.model_dump(by_alias=True, exclude=["id"])
    result = await notes_collection.insert_one(note_dict)
    
    # 4. CONDITIONAL VECTOR STORAGE (The "Vault")
    should_embed = False
    
    # Case 1: Ideas are ALWAYS saved
    if ai_response.stream_type == "IDEA":
        should_embed = True
        print(f"💎 VAULT: Saving Idea to Vector DB: '{note.raw_text[:30]}...'")
        
    # Case 2: Rants are saved ONLY if they are significant
    elif ai_response.stream_type == "RANT" and ai_response.impact_score > 6:
        should_embed = True
        print(f"🔥 VAULT: Saving Major Rant (Score {ai_response.impact_score}) to Vector DB.")
        
    else:
        print(f"📉 VAULT: Skipping '{ai_response.stream_type}' (Low Signal/Activity).")

    if should_embed:
        note_id = str(result.inserted_id)
        date_str = new_note.created_at.strftime("%Y-%m-%d")
        await save_note_to_vector_db(note_id, note.raw_text, note.user_id, date_str)
    
    return await notes_collection.find_one({"_id": result.inserted_id})

@router.put("/entries/{entry_id}", response_model=NoteDB)
async def update_entry(entry_id: str, update: QuickNoteUpdate):
    # 1. Prepare the update data
    update_data = {}
    if update.stream_type:
        # Update the nested field in MongoDB
        update_data["ai_metadata.stream_type"] = update.stream_type

    if not update_data:
        raise HTTPException(status_code=400, detail="No fields to update")

    # 2. Perform the Update
    result = await notes_collection.update_one(
        {"_id": ObjectId(entry_id)},
        {"$set": update_data}
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Entry not found")

    # 3. Return the fresh document
    return await notes_collection.find_one({"_id": ObjectId(entry_id)})

@router.delete("/entries/{entry_id}")
async def delete_entry(entry_id: str):
    # Use ObjectId to convert string ID to Mongo ID
    result = await notes_collection.delete_one({"_id": ObjectId(entry_id)})
    if result.deleted_count == 1:
        return {"status": "deleted"}
    raise HTTPException(status_code=404, detail="Entry not found")

# --- INSIGHTS ---

@router.post("/insights/generate")
async def trigger_insight(user_id: str):
    # 1. Fetch User to check Cooldown
    user = await users_collection.find_one({"user_id": user_id})
    
    # Get today's date string (e.g., "2026-01-18")
    today_str = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    
    # CHECK: Has the user already generated an insight today?
    if user and user.get("last_insight_date") == today_str:
        raise HTTPException(
            status_code=429, # HTTP Status for "Too Many Requests"
            detail="Insight limit reached. You can generate a new analysis tomorrow."
        )

    # 2. Fetch last 10 notes (Existing Logic)
    cursor = notes_collection.find({"user_id": user_id}).sort("created_at", -1).limit(10)
    recent_notes = await cursor.to_list(length=10)
    
    if not recent_notes:
        return {"message": "Not enough data yet."}

    # 3. Prepare Text for AI (Existing Logic)
    history_text = "\n".join([
        f"- [{n['created_at'].strftime('%A')}] {n['ai_metadata']['dashboard']}: {n['raw_text']} (Sentiment: {n['ai_metadata']['sentiment_score']})"
        for n in recent_notes
    ])

    # 4. Ask the Detective (Existing Logic)
    insight = await generate_weekly_insight(history_text)
    
    if not insight:
        raise HTTPException(status_code=500, detail="AI failed to generate insight")

    # 5. Save the Insight Card (Existing Logic)
    insight_card = NoteDB(
        user_id=user_id,
        raw_text=insight.content,
        type="ai_insight",
        ai_metadata=AIAnalysisResult(
            dashboard="Both",
            summary="Weekly Pattern",
            sentiment_score=0.0,
            tags=["Insight", insight.insight_type],
            margin_note="I noticed this pattern looking at your history. 🕵️",
            is_venting=False,
            action_items=[]
        ),
        created_at=datetime.now(timezone.utc)
    )
    
    note_dict = insight_card.model_dump(by_alias=True, exclude=["id"])
    await notes_collection.insert_one(note_dict)
    
    # 6. CRITICAL: Update User's Last Insight Date
    await users_collection.update_one(
        {"user_id": user_id},
        {"$set": {"last_insight_date": today_str}},
        upsert=True
    )
    
    return {"status": "Insight generated", "insight": insight.content}

@router.get("/insights/daily-recap")
async def get_daily_recap(user_id: str):
    # 1. Calculate Today's Range
    today = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)
    
    # 2. CHECK: Has a recap already been generated today?
    existing_recap = await notes_collection.find_one({
        "user_id": user_id,
        "ai_metadata.stream_type": "Daily Recap",
        "created_at": {"$gte": today}
    })
    
    if existing_recap:
        return {"recap": existing_recap["ai_metadata"]["summary"]}

    # 3. If NOT, fetch logs and generate
    cursor = notes_collection.find({
        "user_id": user_id,
        "created_at": {"$gte": today},
        "ai_metadata.stream_type": {"$ne": "Daily Recap"}
    }).sort("created_at", 1)
    
    logs = await cursor.to_list(length=100)
    
    if not logs:
        return {"recap": "No activity logged yet today. Go do something! 🚀"}

    # Format logs for AI
    log_text = ""
    for log in logs:
        meta = log.get("ai_metadata", {})
        type_str = meta.get("stream_type", "Activity")
        time_str = log["created_at"].strftime("%I:%M %p")
        content = log["raw_text"]
        log_text += f"- [{time_str}] ({type_str}): {content}\n"

    system_prompt = """
    You are Shadow. Analyze the user's daily activity log.
    
    Output Format (Markdown):
    ## 📊 Daily Summary
    (2-3 sentences summarizing the day)
    
    ### ⚡ Highlights
    - (Bullet point of main achievement)
    - (Bullet point of creative idea)
    
    ### 🧘 Mood & Focus
    - **Mood Score:** X/10 (Brief explanation)
    - **Productivity:** X/10 (Brief explanation)
    
    > "Inspirational or witty closing quote based on their day."
    """
    
    prompt = ChatPromptTemplate.from_messages([
        ("system", system_prompt),
        ("human", f"Here is the log:\n\n{log_text}")
    ])
    
    chain = prompt | llm
    response = await chain.ainvoke({})
    recap_content = response.content
    
    # 4. SAVE THE RECAP TO DB
    new_recap_note = NoteDB(
        user_id=user_id,
        raw_text="Daily Recap Generated",
        ai_metadata=AIAnalysisResult(
            stream_type="Daily Recap",
            summary=recap_content,
            impact_score=10,
            ai_comment="Here is your daily summary.",
            tags=["Recap", "AI"]
        ),
        created_at=datetime.now(timezone.utc)
    )
    
    note_dict = new_recap_note.model_dump(by_alias=True, exclude=["id"])
    await notes_collection.insert_one(note_dict)
    
    return {"recap": recap_content}