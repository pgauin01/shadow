# 🏛️ Shadow OS - Architecture & User Flows

This document outlines the system architecture and specific user flows for the core modules of Shadow OS. It is designed to help developers, contributors, and reviewers understand how data moves through the application.

---

## 1. High-Level System Architecture

This diagram shows the bird's-eye view of how all the components interact.

```mermaid
flowchart TD
    subgraph Client Application
        UI[React UI: Vite + Tailwind]
        Crypto[Web Crypto API: AES-GCM]
        UI <--> Crypto
    end

    subgraph API Layer
        FastAPI[FastAPI Server]
        Auth[Auth & JWT Middleware]
        Routers[REST Routers]
        FastAPI --> Auth --> Routers
    end

    subgraph AI Orchestration
        LangGraph[LangGraph State Machine]
        Analyzer[Stream Processor]
    end

    subgraph Data & Services
        Mongo[(MongoDB: CRUD Store)]
        Pinecone[(Pinecone: Vector DB)]
        Gemini[Google Gemini 1.5 Flash]
        GCal[Google Calendar API]
    end

    UI <-->|HTTP Requests| FastAPI
    Routers <-->|Read/Write| Mongo
    Routers <-->|OAuth Sync| GCal
    Routers <-->|Invoke| LangGraph
    Routers <-->|Analyze Logs| Analyzer
    LangGraph <-->|Similarity Search| Pinecone
    LangGraph <-->|LLM Inference| Gemini
    Analyzer <-->|Structured Output| Gemini
```

---

## 2. Module Flows

### Module A: The Bicameral UI & RAG Pipeline (The Memory Wall)
This flow demonstrates how the UI theme dictates the AI's personality and what memories it is allowed to access.

```mermaid
sequenceDiagram
    actor User
    participant UI as Frontend (React)
    participant API as Backend (FastAPI)
    participant Pinecone as Pinecone (Vector DB)
    participant Gemini as Gemini 1.5 Flash

    User->>UI: Selects "Shadow" or "Zenith" Mode
    UI->>UI: Updates CSS Variables (Colors/Fonts)
    User->>UI: Sends Chat Message
    UI->>API: POST /chat {message, history, mode}
    API->>Pinecone: Query Vector DB for Semantic Context
    Pinecone-->>API: Return Top-K Historical Logs
    
    rect rgb(30, 41, 59)
    Note over API: THE MEMORY WALL FILTER
    alt Mode == "Shadow"
        API->>API: Filter out "Rant" & "Personal" logs
    else Mode == "Zenith"
        API->>API: Allow all logs (Holistic Context)
    end
    end

    API->>Gemini: Inject Context + System Prompt (Shadow or Zenith)
    Gemini-->>API: Generate Persona-Specific Response
    API-->>UI: Return Response
    UI-->>User: Display Message
```

### Module B: Zero-Knowledge Encrypted Vault
This flow shows how highly sensitive user notes are encrypted before leaving the browser, ensuring the server cannot read them.

```mermaid
sequenceDiagram
    actor User
    participant UI as Frontend (Web Crypto API)
    participant API as Backend (FastAPI)
    participant DB as MongoDB

    User->>UI: Enters Vault Password
    UI->>API: Fetch User's Unique 'vault_salt'
    API-->>UI: Return 'vault_salt'
    UI->>UI: PBKDF2(Password + Salt) = AES Key
    
    User->>UI: Types "Secret" Note & Hits Save
    UI->>UI: AES-GCM Encrypt Note with AES Key
    UI->>API: POST /quick-notes {content: "U2FsdGVk...", is_encrypted: true}
    API->>DB: Save Ciphertext to Database
    DB-->>API: Success
    API-->>UI: Note Saved Confirmation
    
    Note over User,DB: The backend ONLY sees ciphertext. Plaintext never leaves the browser.
```

### Module C: Stream Processor (Timeline Classification)
When a user adds a log to their timeline (via text or voice), the AI automatically categorizes and scores it.

```mermaid
flowchart LR
    User[User Input] -->|Text or Voice| API[POST /entries]
    API --> AI_Chain[LangChain: analyze_text]
    
    subgraph LLM Processing
        AI_Chain -->|Prompt + Text| Gemini[Gemini LLM]
        Gemini -->|PydanticParser| JSON[Strict JSON Output]
    end
    
    JSON --> Router{Stream Type?}
    
    Router -->|Activity| DB[(MongoDB)]
    Router -->|Idea| VectorDB[(Pinecone)]
    Router -->|Rant| VectorDB
    
    VectorDB --> DB
    DB --> UI[Update Timeline UI]
```

### Module D: Google Calendar Synchronization
This module allows Shadow OS to pull in real-world calendar events and display them alongside internal tasks.

```mermaid
sequenceDiagram
    actor User
    participant UI as Frontend
    participant API as FastAPI
    participant Google as Google OAuth / Calendar
    participant DB as MongoDB

    User->>UI: Click "Sync Google Calendar"
    UI->>API: GET /auth/google
    API-->>UI: Return Google OAuth URL
    UI->>Google: Redirect User to Google Consent
    Google-->>API: Callback with Auth Code
    API->>Google: Exchange Code for Access Token
    API->>DB: Store Token in User Profile
    
    Note over API,Google: Event Fetching Process
    API->>Google: Request upcoming events (timeMin=Now)
    Google-->>API: Return JSON List of Events
    
    loop For Each Event
        API->>API: Parse DateTime and Format
        API->>DB: Insert into events_collection
    end
    
    API-->>UI: Sync Complete
    UI->>User: Display Upcoming Events
```

---

## 3. Database Schema Overview

A simplified view of the primary MongoDB collections.

```mermaid
erDiagram
    USERS ||--o{ NOTES : owns
    USERS ||--o{ EVENTS : owns
    USERS ||--o{ QUICK_NOTES : owns

    USERS {
        ObjectId _id
        string email
        string hashed_password
        string google_token
        object profile
    }

    NOTES {
        ObjectId _id
        string user_id
        string raw_text
        datetime created_at
        object ai_metadata
    }

    EVENTS {
        ObjectId _id
        string user_id
        string title
        string date
        string time
        string type
    }

    QUICK_NOTES {
        ObjectId _id
        string user_id
        string content
        string priority
        string workspace
        boolean is_encrypted
    }
```
