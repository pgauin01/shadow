# 🔌 Shadow OS - API Documentation

This document outlines the core REST API endpoints provided by the Shadow OS FastAPI backend.

## Base URL
Local Development: `http://localhost:8000`

## Authentication
Most endpoints require a valid JWT Access Token passed in the `Authorization` header as a Bearer token.
*Example: `Authorization: Bearer <your_token>`*

---

## 🤖 1. AI & Chat Operations

### `POST /chat`
The primary endpoint for interacting with the LangGraph orchestrated AI assistant.

**Request Body (`application/json`):**
```json
{
  "user_id": "65b2a1c9e4b0a1234567890a",
  "message": "Schedule a meeting for tomorrow at 10 AM.",
  "mode": "Shadow", 
  "history": [
    {"role": "user", "text": "Hello"},
    {"role": "model", "text": "Hi, how can I help?"}
  ],
  "image": null
}
```
*Note: `mode` can be "Shadow" or "Zenith". This bypasses the DB setting to ensure instant personality swapping.*

**Response (`200 OK`):**
```json
{
  "response": "Event scheduled for tomorrow at 10:00 AM."
}
```

---

## 🔐 2. Quick Notes (Zero-Knowledge Vault)

### `POST /quick-notes/`
Creates a new quick note. If `is_encrypted` is true, the `content` must be pre-encrypted by the client using AES-GCM.

**Request Body (`application/json`):**
```json
{
  "user_id": "65b2a1c9e4b0a1234567890a",
  "content": "U2FsdGVkX19x/8/8...[cipher_text]...",
  "priority": "High",
  "workspace": "Main",
  "is_encrypted": true
}
```

### `GET /quick-notes/`
Retrieves all notes for a specific user.

**Query Parameters:**
* `user_id` (string, required)

**Response (`200 OK`):**
```json
[
  {
    "_id": "65b3f2...",
    "content": "U2FsdGVkX19x...",
    "priority": "High",
    "workspace": "Main",
    "is_encrypted": true,
    "updated_at": "2026-03-07T10:00:00Z"
  }
]
```

---

## 📅 3. Events & Calendar Sync

### `GET /auth/google`
Initiates the OAuth2 flow to connect the user's Google Calendar.

**Query Parameters:**
* `user_id` (string, required)

**Response (`200 OK`):**
```json
{
  "url": "[https://accounts.google.com/o/oauth2/auth?client_id=](https://accounts.google.com/o/oauth2/auth?client_id=)..."
}
```

### `GET /events`
Retrieves upcoming scheduled events (both internal and Google Calendar synced).

**Query Parameters:**
* `user_id` (string, required)

**Response (`200 OK`):**
```json
[
  {
    "_id": "65b3f5...",
    "title": "Project X Meeting",
    "date": "2026-03-08",
    "time": "10:00 AM",
    "type": "Work"
  }
]
```

---

## 🧠 4. Diagnostics

### `GET /dev/graph`
Returns a Mermaid.js generated PNG representation of the current LangGraph state machine. Useful for debugging AI routing logic.

**Response:** `image/png`
