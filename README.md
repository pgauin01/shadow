# 🌑 Shadow AI - Your Context-Aware Digital Twin

**Shadow** is a next-generation Personal AI Assistant designed to be more than just a chatbot. It is a "Second Brain" that remembers your context, sees what you see, and proactively manages your schedule using Google Calendar integration.

Built with **FastAPI**, **React**, **LangGraph**, and **Google Gemini 2.5**.

---

## ⚡ Key Features

### 🧠 Cognitive Engine

- **Context-Aware Chat:** Maintains short-term conversation history to understand references (e.g., "Schedule _it_ for tomorrow").
- **Multimodal Vision:** Capable of analyzing images, screenshots, and photos uploaded by the user.
- **Persona Modes:** Toggles between "Professional" (Concise, helpful) and "Gamer" (Witty, casual) personalities.

### 📅 Calendar & Productivity

- **Natural Language Scheduling:** Create events by typing: _"Book a meeting with Dale for 8 PM tonight"_ (Uses **LLM Tool Calling**).
- **Google Calendar Sync:** Full OAuth 2.0 integration to fetch and display real-time Google Calendar events.
- **Proactive Alerts:** The AI actively monitors your schedule and injects "Heads Up" alerts into the chat 30 minutes before an event starts.

### 🛠️ Architecture

- **Agentic Workflow:** Powered by **LangGraph** to handle complex flows (Retrieve -> Reason -> Tool Call -> Answer).
- **Data Persistence:** Uses **MongoDB Atlas** for user profiles and event storage.

---

## 🏗️ Tech Stack

**Frontend**

- **Framework:** React (Vite)
- **Styling:** TailwindCSS
- **Icons:** Lucide React
- **HTTP Client:** Axios

**Backend**

- **API Framework:** FastAPI (Python)
- **AI Model:** Google Gemini 1.5 Flash
- **Orchestration:** LangChain / LangGraph
- **Database:** MongoDB / Motor (Async)
- **Authentication:** Google OAuth 2.0

---

## 🚀 Installation & Setup

### 1. Prerequisites

- Node.js (v18+)
- Python (v3.10+)
- MongoDB Atlas Account
- Google Cloud Console Project (for OAuth)

### 2. Backend Setup

```bash
# Clone the repository
git clone [https://github.com/yourusername/shadow-ai.git](https://github.com/yourusername/shadow-ai.git)
cd shadow-ai

# Create virtual environment
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate

# Install dependencies
pip install fastapi uvicorn motor langchain-google-genai langgraph python-dotenv google-auth-oauthlib google-api-python-client pillow

# Setup Google Credentials
# 1. Download your OAuth 2.0 Client Secret JSON from Google Cloud Console
# 2. Rename it to 'client_secret.json' and place it in the root folder


Environment Variables (.env)
Create a .env file in the root directory:

Code snippet


GOOGLE_API_KEY=your_gemini_api_key
MONGO_URI=your_mongodb_connection_string


3. Frontend Setup

Bash


cd src # (or wherever your vite app is located)
npm install


4. Running the App
Start Backend (Terminal 1):

Bash


# Runs on http://localhost:8000
python -m uvicorn app.main:app --reload


Start Frontend (Terminal 2):

Bash


# Runs on http://localhost:5173
npm run dev


📂 Project Structure

Bash


/shadow-ai
├── /app                    # Backend Logic
│   ├── main.py             # API Entry Points & OAuth Routes
│   ├── ai_graph.py         # The Brain (LangGraph Nodes & Edges)
│   ├── tools.py            # AI Tools (create_event_tool)
│   ├── models.py           # Pydantic Data Models
│   ├── database.py         # MongoDB Connection & Collections
│   ├── calendar_service.py # Google Calendar Sync Logic
│   └── vector_store.py     # (Future) RAG/Memory Logic
├── /src                    # Frontend UI
│   ├── App.jsx             # Main Application Logic
│   ├── main.jsx            # Entry Point
│   └── index.css           # Tailwind Imports
├── client_secret.json      # Google OAuth Credentials (IGNORED IN GIT)
├── requirements.txt        # Python Dependencies
└── README.md               # Project Documentation


🔌 API Endpoints
Method
Endpoint
Description
POST
/chat
Main chat interface. Handles text, images, and history.
GET
/auth/google
Initiates Google OAuth flow.
GET
/auth/callback
Google redirect callback to exchange tokens.
POST
/events/sync
Manually triggers a calendar sync.

🔮 Roadmap
[ ] Long-Term Memory (RAG): Integrate Pinecone to store notes and past conversations.
[ ] Event Deletion: Add UI to delete events from MongoDB.
[ ] Voice Mode: Implement Speech-to-Text and Text-to-Speech.
[ ] Docker Support: Containerize the application for easy deployment.
Developed by Praful | 2026
```
