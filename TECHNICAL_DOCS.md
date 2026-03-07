# ⚙️ Shadow OS - Technical Architecture & Developer Guide

## 1. System Overview

Shadow OS is a full-stack web application designed as an AI-powered life organizer. It features a "Bicameral" persona system (Shadow for productivity, Zenith for wellness), a Zero-Knowledge Encrypted Vault for private notes, and a Retrieval-Augmented Generation (RAG) pipeline to give the AI long-term memory.

### Core Tech Stack

Frontend: React (Vite), Tailwind CSS, Framer Motion.

Backend: Python, FastAPI, Motor (Async MongoDB).

AI & RAG: Google Gemini 1.5 Flash, LangChain, LangGraph, Pinecone Vector DB.

Security: Web Crypto API (AES-GCM 256-bit, PBKDF2), Argon2 password hashing.

---

## 2. Frontend Architecture (shadow-client/)

### A. Semantic Theming Engine

The app UI dynamically switches between two visual themes without passing inline styles or props:

Implementation: Colors are defined as CSS Variables in index.css (e.g., --bg-card, --text-primary).

Tailwind Mapping: tailwind.config.js maps these variables to utility classes like bg-theme-card.

State Control: App.jsx manages a single mode state (Shadow or Zenith). It applies a root class (.theme-shadow or .theme-zenith) to the top-level `<div>`, cascading the theme across the entire application instantly.

---

### B. Zero-Knowledge Crypto Vault (util/crypto.js)

Handles client-side encryption for notes marked as "Secret" so the backend never sees plain text.

Key Derivation: Takes the user's plain-text password and a database-stored vault_salt. Uses PBKDF2 with 100,000 iterations to generate a cryptographic key.

Encryption: Uses AES-GCM with a randomized 12-byte Initialization Vector (IV).

Storage: The IV is prepended to the ciphertext, converted to base64, and sent to the FastAPI backend.

---

### C. Chat Overlay (ChatOverlay.jsx)

Voice Input: Uses the native browser SpeechRecognition API for hands-free dictation.

Explicit State Passing: When sending a message to the backend (/chat), it explicitly passes the active UI mode so the AI instantly matches the current theme.

---

## 3. Backend Architecture (app/)

### A. The Bicameral AI Engine (ai_engine.py)

This is the core of the application's intelligence, using ChatGoogleGenerativeAI (Gemini 1.5 Flash).

The Memory Wall (filter_docs_by_persona):

When a user queries the AI, the RAG system fetches relevant historical logs from Pinecone.

If the user is in Shadow Mode, the filter explicitly drops documents tagged as Rant or Daily Recap to prevent emotional noise from polluting productivity tasks.

If the user is in Zenith Mode, the filter allows all documents through, giving the AI a holistic view of the user's emotional and professional state.

Stream Processor (analyze_text):

Uses LangChain's PydanticOutputParser to force the LLM to classify incoming text logs into strict JSON structures: ACTIVITY, RANT, or IDEA.

---

### B. Vector Database Integration (vector_store.py)

Uses PineconeVectorStore and GoogleGenerativeAIEmbeddings (models/embedding-001).

Security Filter: The retriever applies a hard filter (`{"user_id": user_id}`) during similarity searches. This ensures an AI chain can mathematically never retrieve data belonging to another user.

---

### C. Data Models (models.py)

Uses Pydantic for validation and serialization.

UserProfile: Tracks shadow_type (default persona), workspaces, and vault_salt.

ChatRequest: Accepts history, image, and the dynamic mode override from the frontend.

---

### D. LangGraph Orchestrator (ai_graph.py)

Manages the state machine for the chat interface. It dictates the flow of execution:

Receives input and history.

Decides whether to query the Vector DB (RAG) or handle a standard conversational request.

Formats the prompt, calls Gemini, and returns the generated answer to the FastAPI endpoint.

---

## 4. API Endpoints Overview

POST /chat: The main AI interaction hub. Passes request.mode and request.history to LangGraph.

GET /auth/google: Initiates the Google Calendar OAuth2 flow.

/entries, /events, /quick-notes: Standard async CRUD routers connected to MongoDB.
