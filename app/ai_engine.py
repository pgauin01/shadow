from langchain_google_genai import ChatGoogleGenerativeAI
from langchain_core.prompts import ChatPromptTemplate
from langchain_core.output_parsers import PydanticOutputParser
from app.models import AIAnalysisResult
import os
from dotenv import load_dotenv
from pydantic import BaseModel, Field
from typing import List, Literal
from langchain_core.output_parsers import StrOutputParser
from langchain_core.runnables import RunnablePassthrough, RunnableParallel
from app.vector_store import get_retriever    

load_dotenv()

# --- 1. SETUP THE MODEL ---
# FIXED: Changed 'gemini-2.5-flash' (doesn't exist) to 'gemini-1.5-flash'
llm = ChatGoogleGenerativeAI(
    model="gemini-2.5-flash", 
    temperature=0.7,
    google_api_key=os.getenv("GOOGLE_API_KEY")
)

# --- 2. THE STANDARD NOTE ANALYZER (Was missing in your file) ---

# Define the parser for standard notes
parser = PydanticOutputParser(pydantic_object=AIAnalysisResult)

# Define the prompt for standard notes
system_prompt = """
You are 'Shadow', an intelligent, empathetic personal assistant. 
Your goal is to classify notes into 'Personal' or 'Professional' dashboards and provide a short margin note.

FORMATTING INSTRUCTIONS:
{format_instructions}

RULES:
- If the user is stressed, validate them.
- If it's a work task (coding, emails), mark as 'Professional'.
- If it's life (mood, sleep, family), mark as 'Personal'.
- Keep 'margin_note' under 15 words.
"""

prompt = ChatPromptTemplate.from_messages([
    ("system", system_prompt),
    ("human", "{user_text}"),
])

# Create the chain for standard notes
chain = prompt | llm | parser

async def analyze_text(text: str) -> AIAnalysisResult:
    try:
        # invoke() is sync, ainvoke() is async
        result = await chain.ainvoke({
            "user_text": text,
            "format_instructions": parser.get_format_instructions()
        })
        return result
    except Exception as e:
        # Debug Print: This will show up in your terminal now if it fails
        print(f"❌ AI ANALYSIS ERROR: {e}")
        return AIAnalysisResult(
            dashboard="Personal",
            summary="Error Processing",
            sentiment_score=0.0,
            tags=["Error"],
            margin_note="My brain is offline, but I saved your note.",
            action_items=[],
            is_venting=False
        )

# --- 3. THE WEEKLY INSIGHT DETECTIVE ---

class AIInsightResult(BaseModel):
    insight_type: Literal["Pattern", "Correlation", "Suggestion"]
    content: str
    related_topics: List[str]

insight_parser = PydanticOutputParser(pydantic_object=AIInsightResult)

insight_system_prompt = """
You are 'Shadow', analyzing the user's past week of notes to find hidden patterns.
Look for connections between events and moods.

INPUT DATA:
{user_history}

OUTPUT INSTRUCTIONS:
{format_instructions}

Return ONE powerful insight. Be direct but kind.
"""

insight_prompt = ChatPromptTemplate.from_messages([
    ("system", insight_system_prompt),
    ("human", "Analyze my history."),
])

insight_chain = insight_prompt | llm | insight_parser

async def generate_weekly_insight(notes_text: str) -> AIInsightResult:
    try:
        result = await insight_chain.ainvoke({
            "user_history": notes_text,
            "format_instructions": insight_parser.get_format_instructions()
        })
        return result
    except Exception as e:
        print(f"❌ INSIGHT ERROR: {e}")
        return None

# --- IMPROVED PRIORITY ANALYZER ---

priority_parser = StrOutputParser()

# New Prompt with Examples (Few-Shot Prompting)
priority_system_prompt = """
You are a priority classifier. You MUST answer with exactly ONE word: High, Medium, or Low.

GUIDELINES:
- High: System outages, errors, deadlines, client anger, health issues, broken things.
- Medium: Meetings, documentation, standard work, emails, maintenance.
- Low: Movies, games, shopping, learning, 'maybe' tasks.

EXAMPLES:
"Server is down" -> High
"Production bug" -> High
"Buy groceries" -> Low
"Weekly sync" -> Medium
"I feel sick" -> High

Analyze this text: "{text}"

Return ONLY the classification word.
"""

priority_prompt = ChatPromptTemplate.from_messages([
    ("system", priority_system_prompt),
    ("human", "{text}"),
])

priority_chain = priority_prompt | llm | priority_parser

async def detect_priority(text: str) -> str:
    try:
        # Get response
        raw_result = await priority_chain.ainvoke({"text": text})
        
        # CLEAN THE OUTPUT: remove spaces, newlines, and force Title Case
        # e.g., "  high  " -> "High"
        # e.g., "HIGH." -> "High"
        cleaned_result = raw_result.strip().replace(".", "").title()
        
        # Valid options
        valid_options = ["High", "Medium", "Low"]
        
        if cleaned_result in valid_options:
            print(f"✅ Priority Detected: '{text}' -> {cleaned_result}")
            return cleaned_result
        else:
            print(f"⚠️ AI returned weird format: '{raw_result}'. Defaulting to Medium.")
            return "Medium"

    except Exception as e:
        print(f"❌ Priority Error: {e}")
        return "Medium"
    
# --- CHAT WITH SHADOW ---

chat_parser = StrOutputParser()

chat_system_prompt = """
You are 'Shadow', a personal AI companion.

USER PROFILE:
{user_profile}

CONTEXT (HISTORY):
{context}

INSTRUCTIONS:
- Answer the user's question based on the Context.
- ADAPT YOUR TONE based on the User Profile (e.g., be technical for devs, simple for students).
- If the user asks about themselves, use the profile data.

User Question: {question}
"""

chat_prompt = ChatPromptTemplate.from_messages([
    ("system", chat_system_prompt),
    ("human", "{question}"),
])

chat_prompt = ChatPromptTemplate.from_messages([
    ("system", chat_system_prompt),
    ("human", "{question}"),
])

chat_chain = chat_prompt | llm | chat_parser

async def chat_with_history(question: str, context_text: str, profile_text: str) -> str:
    try:
        response = await chat_chain.ainvoke({
            "context": context_text,
            "user_profile": profile_text, # <--- Injecting here
            "question": question
        })
        return response
    except Exception as e:
        return f"Brain fog... ({e})"


# We use a template that includes the Retrieved Context + User Profile
rag_system_prompt = """
You are Shadow, a context-aware personal AI assistant.

USER PROFILE:
{user_profile}

CONTEXT FROM MEMORY (Database):
{context}

INSTRUCTIONS:
- Answer the user's question using ONLY the context above.
- If the answer isn't there, say "I don't recall that in your notes."
- Adopt the persona defined in the User Profile.
"""

rag_prompt = ChatPromptTemplate.from_messages([
    ("system", rag_system_prompt),
    ("human", "{question}"),
])

# 3. BUILD THE CHAIN FACTORY
# We need a function to build the chain because the 'retriever' changes per user
def get_chat_chain(user_id: str):
    
    retriever = get_retriever(user_id)

    # Helper to format docs into a single string
    def format_docs(docs):
        return "\n\n".join(f"- [{d.metadata['date']}] {d.page_content}" for d in docs)

    # THE LANGCHAIN (LCEL) PIPELINE
    # 1. Parallel: Get Question AND Fetch Context
    setup_and_retrieval = RunnableParallel(
        {"context": retriever | format_docs, "question": RunnablePassthrough(), "user_profile": RunnablePassthrough()}
    )
    
    # 2. The Full Chain
    # We cheat slightly: we pass the user_profile in 'invoke', so we need to wire it correctly.
    # Actually, simpler approach for now:
    
    chain = (
        rag_prompt 
        | llm 
        | StrOutputParser()
    )
    
    return chain, retriever

# WRAPPER FUNCTION (Called by main.py)
async def chat_with_langchain(question: str, user_id: str, user_profile: str):
    try:
        # 1. Get the retriever for this specific user
        retriever = get_retriever(user_id)
        
        # 2. Retrieve documents manually (for full control)
        # (We do this manually so we can verify what it found in the logs)
        docs = retriever.invoke(question)
        context_text = "\n\n".join(f"- [{d.metadata['date']}] {d.page_content}" for d in docs)
        
        # 3. Run the Chain
        chain, _ = get_chat_chain(user_id) # We use the chain we defined
        
        response = await chain.ainvoke({
            "context": context_text,
            "user_profile": user_profile,
            "question": question
        })
        
        return response
    except Exception as e:
        return f"Chain Error: {e}"    