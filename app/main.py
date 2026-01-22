from fastapi import FastAPI, Response
from fastapi.middleware.cors import CORSMiddleware
from bson import ObjectId

from app.database import client, ping_db, users_collection
from app.models import ChatRequest
from app.ai_graph import shadow_graph

# Import Routers
from app.routers import user, events, entries, notes

app = FastAPI(title="Shadow AI API")

origins = [
    "http://localhost:5173",
    "http://localhost:3000",
    "http://localhost",
    "http://localhost:80",
    "http://127.0.0.1",
    "http://34.135.8.240",
    "http://shadowtodo.duckdns.org",
    "https://shadowtodo.duckdns.org",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins, 
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Connect Routers
app.include_router(user.router)
app.include_router(events.router)
app.include_router(entries.router)
app.include_router(notes.router)

@app.on_event("startup")
async def startup_db_client():
    await ping_db()

@app.get("/")
async def root():
    return {"message": "Shadow AI is awake 👁️"}

# --- CHAT & GRAPH (Kept in Main) ---

@app.post("/chat")
async def chat_endpoint(request: ChatRequest):
    # 1. Fetch User Profile
    user_doc = await users_collection.find_one({"_id": ObjectId(request.user_id)})
    recent_msgs = request.history[-5:] 
    history_str = "\n".join([f"{msg['role'].upper()}: {msg.get('text', '')}" for msg in recent_msgs])

    if user_doc:
        p = user_doc['profile']
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
    try:
        inputs = {
            "question": request.message,
            "user_id": request.user_id,
            "user_profile": profile_str,
            "context": "", 
            "answer": "",   
            "image": request.image,
            "chat_history": history_str
        }
        
        result = await shadow_graph.ainvoke(inputs)
        return {"response": result["answer"]}
        
    except Exception as e:
        print(f"Graph Error: {e}")
        return {"response": "My brain encountered a graph error."}

@app.get("/dev/graph")
async def get_graph_image():
    try:
        graph_image = shadow_graph.get_graph().draw_mermaid_png()
        return Response(content=graph_image, media_type="image/png")
    except Exception as e:
        return {"error": f"Could not generate graph: {e}"}