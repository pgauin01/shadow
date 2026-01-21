🌑 Shadow AI - Your Context-Aware Digital Twin
Shadow is a next-generation Personal AI Assistant designed to be more than just a chatbot. It is a "Second Brain" that remembers your context, analyzes your daily logs, and proactively manages your schedule using Google Calendar integration.

Deployed and live at: http://shadowtodo.duckdns.org

⚡ Key Features
🧠 Cognitive Engine
Context-Aware Chat: Powered by LangGraph, Shadow maintains conversation history and user persona context to provide personalized responses.

Stream Analysis: Automatically categorizes user inputs into Activities (Logs), Rants (Venting), or Ideas (Sparks) using Gemini 1.5 Flash.

Persona Modes: Adaptable personality that switches between "Professional" (Concise) and "Gamer/Casual" (Witty) based on your profile settings.

📅 Calendar & Productivity
Natural Language Scheduling: Create events simply by typing: "Book a meeting with Dale for 8 PM tonight" (Uses LLM Tool Calling).

Google Calendar Sync: Full OAuth 2.0 integration to fetch and display real-time events.

Quick Notes & Priority: A dedicated "Bookshelf" for fleeting thoughts, with AI-powered Auto-Priority detection (High/Medium/Low).

📊 Insights & Memory
Daily Recap: Generates a midnight summary of your day's mood, productivity, and highlights.

Weekly Detective: Analyzes patterns in your logs to find correlations between your activities and mood.

Vector Vault: High-value "Ideas" and major "Rants" are automatically embedded and stored in a Vector Database for long-term recall.

🏗️ Tech Stack
Frontend
Framework: React 19 (Vite)

Styling: TailwindCSS + Framer Motion (Animations)

HTTP Client: Axios

Icons: Lucide React

Backend
Framework: FastAPI (Python 3.11+)

AI Model: Google Gemini 1.5 Flash

Orchestration: LangChain / LangGraph

Database: MongoDB Atlas (Async Motor)

Authentication: OAuth2 (JWT) + Google OAuth 2.0

Vector Store: Pinecone / Atlas Vector Search

Infrastructure
Deployment: Docker & Docker Compose

Hosting: Google Cloud Platform (Compute Engine)

Domain: DuckDNS with Custom CORS Configuration

🚀 Installation & Setup

1. Prerequisites
   Node.js (v18+)

Python (v3.10+)

MongoDB Atlas Account

Google Cloud Console Project (for OAuth)

2. Backend Setup
   Bash

# Clone the repository

git clone https://github.com/pgauin01/shadow

# Create virtual environment

python -m venv venv
source venv/bin/activate # On Windows: venv\Scripts\activate

# Install dependencies

pip install -r requirements.txt
Environment Variables: Create a .env file in the root directory:

Code snippet
GOOGLE_API_KEY=your_gemini_key
MONGO_URL=your_mongodb_connection_string
SECRET_KEY=your_jwt_secret_key
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=30
PINECONE_API_KEY=your_pinecone_key (Optional)
Google Credentials:

Download your OAuth 2.0 Client Secret JSON from Google Cloud Console.

Rename it to client_secret.json and place it in the root folder.

Run the Backend:

Bash

# Runs on http://localhost:8000

python -m uvicorn app.main:app --reload 3. Frontend Setup
Bash
cd shadow-client
npm install

# Run on http://localhost:5173

npm run dev
🐳 Docker Deployment
Shadow is ready for containerization.

Bash

# Build and Run Production Mode

docker compose -f docker-compose.prod.yml up -d --build
📂 Project Structure
Bash
/shadow-app
├── /app # Backend Logic
│ ├── main.py # API Entry Points & CORS
│ ├── ai_engine.py # Gemini 1.5 Prompts & Chains
│ ├── ai_graph.py # LangGraph State Machine
│ ├── auth.py # JWT Authentication
│ ├── database.py # MongoDB Connection
│ └── calendar_service.py # Google Calendar Sync
├── /shadow-client # Frontend UI
│ ├── src/components # React Components (Chat, Timeline, Auth)
│ └── src/utils.js # Helper functions
├── Dockerfile.backend # Python Container Config
├── Dockerfile.frontend # Nginx/React Container Config
└── docker-compose.prod.yml # Production Orchestration
🔮 Roadmap
[x] JWT Authentication: Secure login and registration.

[x] Daily Recap: AI generated summaries of daily logs.

[x] Docker Support: Full containerization for GCP deployment.

[ ] Voice Mode: Implement Speech-to-Text for hands-free logging.

[ ] Mobile App: PWA or React Native port and electron for web based....
