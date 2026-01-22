# 🌑 Shadow - AI Second Brain & Life OS

**Shadow** is a context-aware **AI Life Organizer** that helps you log your life, manage tasks, and recall memories. It combines a **Timeline Stream**, **Zero-Knowledge Encrypted Notes**, and an **AI Assistant** (powered by Google Gemini) that learns from your history.

Built with **React (Vite)**, **FastAPI**, **MongoDB**, and **FAISS (Vector DB)**.

---

live at- https://shadowtodo.duckdns.org/

## ✨ Key Features

### 🧠 1. AI-Powered Memory (RAG)

Shadow doesn't just store text; it _understands_ it.

- **Automatic Vector Embedding:** When you log a **"Rant"** (with high stress > 7) or a key **"Idea"**, Shadow automatically embeds it into a local **FAISS Vector Database**.
- **Contextual Recall:** The Chat Assistant can retrieve past ideas or emotional patterns using Semantic Search.
- _User:_ "What were my recent business ideas?"
- _Shadow:_ Retrieves relevant logs from weeks ago using vector similarity.

### 🔒 2. Zero-Knowledge "Secret Mode"

Your private thoughts should remain private.

- **Client-Side Encryption:** Notes marked as "Secret" are encrypted **in your browser** using **AES-GCM (256-bit)** before they ever touch the server.
- **Unique Salting:** Uses **PBKDF2** with a unique, server-generated salt per user to prevent rainbow table attacks.
- **No-Knowledge Server:** The backend only sees gibberish (`U2FsdGVk...`). If you lose your password, the data is gone forever.

### 📝 3. Intelligent Timeline & Journaling

- **Stream Types:** Log `Activities`, `Rants`, or `Ideas`.
- **AI Analysis:** Every entry is analyzed for **Impact Score (1-10)**, **Tags**, and **Sentiment**.
- **Voice-to-Text:** Native browser speech recognition for hands-free logging.
- **Daily Recap:** One-click AI summary of your entire day's timeline.

### 📅 4. Natural Language Scheduling

- **Command:** "Schedule a meeting with John for Project X tomorrow at 10 AM."
- **Action:** Shadow parses the intent and creates an event in your **Upcoming Events** list.
- **Google Calendar Sync:** Two-way sync to keep your real life aligned.

---

## 🏗️ Architecture

| Component     | Tech Stack                           | Description                                               |
| ------------- | ------------------------------------ | --------------------------------------------------------- |
| **Frontend**  | React, Vite, Tailwind, Framer Motion | Modern, responsive UI with "Professional" & "Life" modes. |
| **Backend**   | Python, FastAPI                      | High-performance API handling auth, AI logic, and CRUD.   |
| **Database**  | MongoDB (Motor)                      | Stores Users, Logs, Notes, and Events.                    |
| **Vector DB** | FAISS + `all-MiniLM-L6-v2`           | Stores embeddings for semantic search (Long-term memory). |
| **AI Engine** | Google Gemini 1.5 Flash              | Powers the reasoning, summarization, and chat.            |
| **Crypto**    | Web Crypto API (SubtleCrypto)        | Native browser implementation of AES-GCM & PBKDF2.        |

---

## 🚀 Getting Started

### Prerequisites

- **Docker & Docker Compose** (Recommended)
- OR **Node.js 18+** & **Python 3.10+** (Manual)
- **Google Gemini API Key** (Get one [here](https://aistudio.google.com/))
- **MongoDB Atlas URI** (or local Mongo)

### 🛠️ Option 1: Docker (Fastest)

1. **Clone the repo:**

```bash
git clone https://github.com/pgauin01/shadow.git
cd shadow

```

2. **Create `.env` file:**

```bash
cp .env.example .env
# Edit .env with your GEMINI_API_KEY and MONGO_URI

```

3. **Run with Compose:**

```bash
docker-compose -f docker-compose.prod.yml up --build -d

```

- Frontend: `http://localhost:80`
- Backend: `http://localhost:8000`

### 🛠️ Option 2: Manual Installation

#### Backend

```bash
cd app
python -m venv venv
source venv/bin/activate  # or venv\Scripts\activate on Windows
pip install -r ../requirements.txt
uvicorn app.main:app --reload

```

#### Frontend

```bash
cd shadow-client
npm install
npm run dev

```

---

## 🛡️ Environment Variables (`.env`)

Create a `.env` file in the root directory:

```env
# Database
MONGO_URI=mongodb+srv://<user>:<pass>@cluster.mongodb.net/?retryWrites=true&w=majority
DB_NAME=shadow_db

# AI Engine
GEMINI_API_KEY=your_google_gemini_key

# Security
SECRET_KEY=your_jwt_secret_key
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=10080

# Google Calendar (Optional)
GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret
REDIRECT_URI=http://localhost:5173

```

---

## 📖 Usage Guide

### 🔐 Using the Secret Vault

1. Go to **Quick Notes**.
2. Click the **Unlock / Setup** button (Lock Icon) in the toolbar.
3. Set a **Vault Password**.
4. Toggle **"Secret"** mode ON.
5. Any note you save will be encrypted.
6. **Refresh the page** to lock the vault again.

### 🗣️ Voice Input

1. Click the **Microphone** icon in the Chat or Timeline input.
2. Speak your log (e.g., _"I'm feeling really stressed about the deadline because..."_).
3. Shadow captures the text. If it detects high stress (>7), it tags it as a **Rant** and saves it to the Vector DB for later therapy/analysis.

### 🧠 RAG / Memory Recall

1. Open the **Chat Assistant**.
2. Ask: _"Why was I stressed last week?"_
3. Shadow queries the **FAISS** index, finds the relevant "Rant" logs, and summarizes the cause.

---

## 🤝 Contributing

Pull requests are welcome! For major changes, please open an issue first to discuss what you would like to change.

## 📄 License

[MIT](https://choosealicense.com/licenses/mit/)
