import re
import dateparser
from fastapi import Depends,FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from app.database import ping_db, notes_collection
from app.models import NoteCreate, NoteDB, AIAnalysisResult, EventCreate, EventDB, QuickNoteCreate, QuickNoteDB, ChatRequest, UserCreate, UserDB, QuickNoteUpdate
from datetime import datetime
from app.ai_engine import analyze_text,detect_priority, generate_weekly_insight, chat_with_history, chat_with_langchain
from typing import List
from app.database import client
from bson import ObjectId
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from app.auth import get_password_hash, verify_password, create_access_token
from app.vector_store import save_note_to_vector_db
from app.ai_graph import shadow_graph
from fastapi.responses import Response, RedirectResponse
import json
from app.calendar_service import create_flow, sync_calendar_events
from app.ai_engine import generate_weekly_insight


app = FastAPI(title="Shadow AI API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://localhost:5174",  # <--- ADD THIS ONE
        "http://localhost:3000",
        "http://localhost:8000"   # Good to have for standard React defaults
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

db = client.shadow_db
events_collection = db.events
quick_notes_collection = db.quick_notes
users_collection = db.users


# Auth Scheme
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="token")


@app.on_event("startup")
async def startup_db_client():
    await ping_db()

@app.get("/")
async def root():
    return {"message": "Shadow AI is awake 👁️"}

@app.post("/register")
async def register(user: UserCreate):
    # Check if email exists
    if await users_collection.find_one({"email": user.email}):
        raise HTTPException(status_code=400, detail="Email already registered")
    
    # Create DB User
    new_user = UserDB(
        email=user.email,
        hashed_password=get_password_hash(user.password),
        profile=user.profile
    )
    
    await users_collection.insert_one(new_user.model_dump(by_alias=True, exclude=["id"]))
    return {"message": "User created successfully"}

@app.post("/token")
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

# --- 2. LOGIN ---
@app.post("/token")
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

# --- 3. UPDATED CHAT ENDPOINT --
@app.post("/chat")
async def chat_endpoint(request: ChatRequest):
    # 1. Fetch User Profile (Same as before)
    user = await users_collection.find_one({"_id": ObjectId(request.user_id)})
    recent_msgs = request.history[-5:] 
    history_str = "\n".join([f"{msg['role'].upper()}: {msg.get('text', '')}" for msg in recent_msgs])

    if user:
        p = user['profile']
        profile_str = (
                f"User Name: {p.get('name', 'User')}\n"
                f"Age/Gender: {p['age']}, {p['gender']}\n"
                f"Profession: {p['profession']}\n"
                f"Current Focus (Week/Month): {p['current_focus']}\n"
                f"YOUR PERSONA: Act as a '{p['shadow_type']}'. Adjust your tone accordingly."
            )
    else:
        profile_str = "Standard User"

    # 2. RUN LANGGRAPH
    # We invoke the graph with the initial state
    try:
        inputs = {
            "question": request.message,
            "user_id": request.user_id,
            "user_profile": profile_str,
            "context": "", # Empty start
            "answer": "",   # Empty start
            "image": request.image,
            "chat_history": history_str
        }
        
        # 'ainvoke' runs the graph asynchronously
        result = await shadow_graph.ainvoke(inputs)
        
        # Extract the final answer from the final state
        return {"response": result["answer"]}
        
    except Exception as e:
        print(f"Graph Error: {e}")
        return {"response": "My brain encountered a graph error."}

@app.get("/events", response_model=List[EventDB])
async def get_events(user_id: str): # <--- Receive user_id
    # Filter by user_id
    cursor = events_collection.find({"user_id": user_id}).sort("created_at", -1).limit(20)
    return await cursor.to_list(length=20)

@app.post("/events", response_model=EventDB)
async def create_event(event: EventCreate):
    final_date = event.date
    final_time = event.time
    
    # SMART PARSING LOGIC:
    if not final_time and event.date:
        # --- FIX: SANITIZE INPUT ---
        # Convert "11.30" to "11:30" so dateparser understands it
        clean_date_str = re.sub(r'(\d{1,2})\.(\d{2})', r'\1:\2', event.date)
        
        # Use the clean string for parsing
        parsed_dt = dateparser.parse(clean_date_str, settings={'PREFER_DATES_FROM': 'future'})
        
        if parsed_dt:
            # 1. Standardize Date
            final_date = parsed_dt.strftime("%Y-%m-%d")
            
            # 2. Extract Time
            input_lower = event.date.lower()
            if any(x in input_lower for x in ["pm", "am", ":", ".", " at "]): # Added "." to check
                final_time = parsed_dt.strftime("%I:%M %p")

    # Create DB Object
    new_event = EventDB(
        title=event.title,
        date=final_date,
        time=final_time,
        type=event.type,
        user_id=event.user_id,
        created_at=datetime.utcnow()
    )
    
    event_dict = new_event.model_dump(by_alias=True, exclude=["id"])
    result = await events_collection.insert_one(event_dict)
    return await events_collection.find_one({"_id": result.inserted_id})

@app.delete("/events/{event_id}")
async def delete_event(event_id: str):
    from bson import ObjectId
    await events_collection.delete_one({"_id": ObjectId(event_id)})
    return {"status": "deleted"}    

@app.get("/entries", response_model=List[NoteDB])
async def get_entries(user_id: str = "user_1"):
    # Fetch notes for this user, sorted by newest first
    cursor = notes_collection.find({"user_id": user_id}).sort("created_at", -1).limit(50)
    notes = await cursor.to_list(length=50)
    return notes    

# --- THE CORE ENDPOINT ---
@app.post("/entries", response_model=NoteDB)
async def create_entry(note: NoteCreate):
    ai_response = await analyze_text(note.raw_text)
    
    new_note = NoteDB(
        user_id=note.user_id,
        raw_text=note.raw_text,
        ai_metadata=ai_response, # We plug the Gemini result in here
        created_at=datetime.utcnow()
    )
    
    # Save to MongoDB
    note_dict = new_note.model_dump(by_alias=True, exclude=["id"])
    result = await notes_collection.insert_one(note_dict)
    # We run this in the background so it doesn't slow down the UI
    note_id = str(result.inserted_id)
    date_str = new_note.created_at.strftime("%Y-%m-%d")
    
    # We await it here for simplicity, but in production, use BackgroundTasks
    await save_note_to_vector_db(note_id, note.raw_text, note.user_id, date_str)
    
    return await notes_collection.find_one({"_id": result.inserted_id})

@app.delete("/entries/{entry_id}")
async def delete_entry(entry_id: str):
    # Use ObjectId to convert string ID to Mongo ID
    result = await notes_collection.delete_one({"_id": ObjectId(entry_id)})
    if result.deleted_count == 1:
        return {"status": "deleted"}
    raise HTTPException(status_code=404, detail="Entry not found")





@app.post("/insights/generate")
async def trigger_insight(user_id: str):
    # 1. Fetch User to check Cooldown
    user = await users_collection.find_one({"user_id": user_id})
    
    # Get today's date string (e.g., "2026-01-18")
    today_str = datetime.utcnow().strftime("%Y-%m-%d")
    
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
        created_at=datetime.utcnow()
    )
    
    note_dict = insight_card.model_dump(by_alias=True, exclude=["id"])
    await notes_collection.insert_one(note_dict)
    
    # 6. CRITICAL: Update User's Last Insight Date
    # This prevents them from generating again until tomorrow
    await users_collection.update_one(
        {"user_id": user_id},
        {"$set": {"last_insight_date": today_str}},
        upsert=True # Create the field if it doesn't exist
    )
    
    return {"status": "Insight generated", "insight": insight.content}


@app.get("/quick-notes", response_model=List[QuickNoteDB])
async def get_quick_notes(user_id: str): # <--- Receive user_id
    # Filter by user_id
    cursor = quick_notes_collection.find({"user_id": user_id}).sort("updated_at", -1)
    return await cursor.to_list(length=50)

@app.post("/quick-notes", response_model=QuickNoteDB)
async def create_quick_note(note: QuickNoteCreate):
    # 1. Determine Priority
    final_p = note.priority
    if note.priority == "Auto":
        final_p = await detect_priority(note.content)

    # 2. Create DB Object
    new_note = QuickNoteDB(
        content=note.content,
        priority=note.priority,
        final_priority=final_p,
        user_id=note.user_id
    )
    
    # 3. Save to MongoDB (The Bookshelf)
    note_dict = new_note.model_dump(by_alias=True, exclude=["id"])
    result = await quick_notes_collection.insert_one(note_dict)
    
    # --- 4. NEW: SAVE TO PINECONE (The Index) ---
    # This turns your Quick Note into a memory the AI can find later
    try:
        note_id = str(result.inserted_id)
        # Use current time for the date string
        date_str = new_note.updated_at.strftime("%Y-%m-%d")
        
        await save_note_to_vector_db(
            note_id=note_id, 
            text=note.content, # Quick Notes use 'content', entries use 'raw_text'
            user_id=note.user_id, 
            created_at=date_str
        )
        print(f"✅ Quick Note synced to Pinecone: {note.content[:20]}...")
    except Exception as e:
        print(f"⚠️ Failed to sync Quick Note to Pinecone: {e}")

    return await quick_notes_collection.find_one({"_id": result.inserted_id})

@app.put("/quick-notes/{note_id}", response_model=QuickNoteDB)
async def update_quick_note(note_id: str, note: QuickNoteUpdate):
    from datetime import datetime
    
    # 1. Fetch existing note
    existing = await quick_notes_collection.find_one({"_id": ObjectId(note_id)})
    if not existing:
        raise HTTPException(status_code=404, detail="Note not found")

    update_data = {"updated_at": datetime.utcnow()}
    
    # 2. Handle Content Update
    current_content = existing["content"]
    if note.content is not None:
        update_data["content"] = note.content
        current_content = note.content

    # 3. Handle Priority Update
    if note.priority is not None:
        update_data["priority"] = note.priority
        
        # LOGIC:
        if note.priority == "Auto":
            # If switching to Auto, ask AI to decide based on (new or old) content
            update_data["final_priority"] = await detect_priority(current_content)
        else:
            # If Manual (High/Med/Low), force the final priority to match
            update_data["final_priority"] = note.priority

    # 4. Save to DB
    await quick_notes_collection.update_one(
        {"_id": ObjectId(note_id)},
        {"$set": update_data}
    )
    
    # 5. Return the updated document
    return await quick_notes_collection.find_one({"_id": ObjectId(note_id)})

@app.delete("/quick-notes/{note_id}")
async def delete_quick_note(note_id: str):
    await quick_notes_collection.delete_one({"_id": ObjectId(note_id)})
    return {"status": "deleted"}    


@app.get("/dev/graph")
async def get_graph_image():
    try:
        graph_image = shadow_graph.get_graph().draw_mermaid_png()
        return Response(content=graph_image, media_type="image/png")
    except Exception as e:
        return {"error": f"Could not generate graph: {e}"}
    

# --- GOOGLE CALENDAR ENDPOINTS ---

@app.get("/auth/google")
async def google_login(user_id: str):
    """
    1. User clicks button.
    2. We create a Google Login URL.
    3. We attach 'user_id' to the state so we know who is logging in when they come back.
    """
    flow = create_flow()
    # We pass user_id in the 'state' parameter to survive the redirect
    authorization_url, state = flow.authorization_url(
        access_type='offline',
        include_granted_scopes='true',
        prompt='consent',
        state=user_id 
    )
    return {"url": authorization_url}

@app.get("/auth/callback")
async def google_callback(state: str, code: str):
    """
    Google sends the user back here with a 'code'.
    We trade the code for a Token.
    """
    try:
        flow = create_flow()
        flow.fetch_token(code=code)
        
        # Get the credentials object
        creds = flow.credentials
        
        # Convert to JSON string for storage
        creds_json = creds.to_json()
        
        # Save to User Profile in MongoDB
        # 'state' contains the user_id we sent earlier
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

@app.post("/events/sync")
async def trigger_sync(body: dict):
    # Expects {"user_id": "..."}
    return await sync_calendar_events(body['user_id'])    