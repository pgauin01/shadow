from pydantic import BaseModel, Field, ConfigDict, EmailStr, BeforeValidator
from typing import Any, Dict, List, Optional, Literal, Annotated
from datetime import datetime

# Helper for MongoDB ObjectIds
PyObjectId = Annotated[str, BeforeValidator(str)]

# --- 1. USER & PROFILE MODELS ---
class UserProfile(BaseModel):
    name: str
    age: int
    gender: str
    profession: str
    shadow_type: str # e.g. "Career Mode", "Zen Mode", etc.
    current_focus: str 

class UserCreate(BaseModel):
    email: EmailStr
    password: str
    profile: UserProfile

class UserDB(BaseModel):
    id: Optional[PyObjectId] = Field(alias="_id", default=None)
    email: str
    hashed_password: str
    profile: UserProfile
    created_at: datetime = Field(default_factory=datetime.utcnow)

    model_config = ConfigDict(populate_by_name=True, arbitrary_types_allowed=True)

# --- 2. NOTE MODELS ---
class AIAnalysisResult(BaseModel):
    dashboard: Literal["Personal", "Professional", "Both"]
    summary: str
    sentiment_score: float
    tags: List[str] = []
    margin_note: str
    action_items: List[str] = []
    is_venting: bool

class NoteCreate(BaseModel):
    raw_text: str
    user_id: str 

class NoteDB(BaseModel):
    id: Optional[PyObjectId] = Field(alias="_id", default=None) 
    user_id: str
    raw_text: str
    type: str = "user_note"
    created_at: datetime = Field(default_factory=datetime.utcnow)
    ai_metadata: AIAnalysisResult
    model_config = ConfigDict(populate_by_name=True, arbitrary_types_allowed=True)

# --- 3. EVENT MODELS ---
class EventCreate(BaseModel):
    title: str
    date: str
    type: Literal["Work", "Personal"]
    user_id: str
    time: Optional[str] = None

class EventDB(EventCreate):
    id: Optional[PyObjectId] = Field(alias="_id", default=None)
    created_at: datetime = Field(default_factory=datetime.utcnow)
    model_config = ConfigDict(populate_by_name=True, arbitrary_types_allowed=True)
    google_id: Optional[str] = None

# --- 4. QUICK NOTE MODELS ---
class QuickNoteCreate(BaseModel):
    content: str
    priority: Literal["High", "Medium", "Low", "Auto"] = None
    user_id: str

class QuickNoteUpdate(BaseModel):
    content: Optional[str] = None
    priority: Optional[Literal["High", "Medium", "Low", "Auto"]] = None

class QuickNoteDB(QuickNoteCreate):
    id: Optional[PyObjectId] = Field(alias="_id", default=None)
    updated_at: datetime = Field(default_factory=datetime.utcnow)
    final_priority: Literal["High", "Medium", "Low"] = "Medium"
    model_config = ConfigDict(populate_by_name=True, arbitrary_types_allowed=True)

# --- 5. CHAT REQUEST MODEL ---
class ChatRequest(BaseModel):
    message: str
    user_id: str
    image: Optional[str] = None
    history: List[Dict[str, Any]] = []