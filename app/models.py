from pydantic import BaseModel, Field, ConfigDict, EmailStr, BeforeValidator
from typing import Any, Dict, List, Optional, Literal, Annotated, Union
from datetime import datetime, timezone

# Helper for MongoDB ObjectIds
PyObjectId = Annotated[str, BeforeValidator(str)]

# --- 1. USER & PROFILE MODELS ---
class UserProfile(BaseModel):
    name: str
    age: int
    gender: str
    profession: str
    shadow_type: str = "Career Mode" # Added default
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
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    google_token: Optional[str] = None 

    model_config = ConfigDict(populate_by_name=True, arbitrary_types_allowed=True)

# --- 2. NOTE MODELS (FIXED FOR LEGACY DATA) ---
class AIAnalysisResult(BaseModel):
    # We provide DEFAULTS for everything so old data doesn't crash the app
    stream_type: str = Field(default="Activity", description="The category of the log")
    summary: str = Field(default="Legacy Entry", description="A clean, short summary")
    tags: List[str] = []
    
    impact_score: int = Field(default=5, description="1-10 Score")
    ai_comment: str = Field(default="Imported from legacy data.", description="Shadow remark")
    
    # Allow extra fields (like 'dashboard' or 'sentiment_score' from old version)
    model_config = ConfigDict(extra='ignore')

class NoteCreate(BaseModel):
    raw_text: str
    user_id: str 

class NoteDB(BaseModel):
    id: Optional[PyObjectId] = Field(alias="_id", default=None) 
    user_id: str
    raw_text: str
    type: str = "user_note" 
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    
    # This matches the structure above
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
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    model_config = ConfigDict(populate_by_name=True, arbitrary_types_allowed=True)
    google_id: Optional[str] = None

# --- 4. QUICK NOTE MODELS ---
class QuickNoteCreate(BaseModel):
    content: str
    priority: Optional[str] = "Medium" # Relaxed type to prevent errors
    user_id: str

class QuickNoteUpdate(BaseModel):
    content: Optional[str] = None
    priority: Optional[str] = None

class QuickNoteDB(QuickNoteCreate):
    id: Optional[PyObjectId] = Field(alias="_id", default=None)
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    final_priority: str = "Medium"
    model_config = ConfigDict(populate_by_name=True, arbitrary_types_allowed=True)

# --- 5. CHAT REQUEST MODEL ---
class ChatRequest(BaseModel):
    message: str
    user_id: str
    image: Optional[str] = None
    history: List[Dict[str, Any]] = []

# --- 6. MODE UPDATE MODEL ---
class ModeUpdate(BaseModel):
    shadow_type: str