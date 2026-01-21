from typing import TypedDict
from datetime import datetime
from langgraph.graph import StateGraph, END
from langchain_google_genai import ChatGoogleGenerativeAI
from langchain_core.messages import HumanMessage, SystemMessage
from app.vector_store import get_retriever
from app.tools import create_event_tool 
from app.database import events_collection 

# 1. DEFINE THE STATE
class ShadowState(TypedDict):
    question: str
    user_id: str
    user_profile: str
    context: str
    answer: str
    image: str | None
    chat_history: str

# 2. DEFINE THE NODES

def retrieve_node(state: ShadowState):
    """
    Worker 1: Fetches relevant documents from Pinecone.
    """
    print("--- GRAPH: RETRIEVING MEMORIES ---")
    question = state["question"]
    user_id = state["user_id"]
    
    retriever = get_retriever(user_id)
    docs = retriever.invoke(question)
    
    context_text = "\n\n".join(f"- [{d.metadata['date']}] {d.page_content}" for d in docs)
    
    return {"context": context_text}

async def generate_node(state: ShadowState):
    """
    Worker 2: Generates Answer OR Creates Event (Handles Text + Vision + Tools)
    """
    print("--- GRAPH: GENERATING ---")
    
    # Use 1.5-flash (Standard)
    llm = ChatGoogleGenerativeAI(model="gemini-2.5-flash", temperature=0.3)
    
    # A. BIND TOOLS (This is the missing link!)
    llm_with_tools = llm.bind_tools([create_event_tool])
    
    # B. Current Date Injection (Crucial for "next Friday")
    current_time = datetime.now().strftime("%A, %Y-%m-%d")
    
    # C. Prepare System Prompt
    system_prompt = f"""
    You are Shadow, a smart assistant dedicated to organizing the user's life.
    
    YOUR CORE MISSION:
    "I can assist you in creating calendar events (Work/Personal) and recalling information from your past ideas and logs. Just ask me to schedule something or ask about your recent thoughts."
    
    CURRENT DATE: {current_time}
    
    USER PROFILE:
    {state['user_profile']}
    
    CONTEXT FROM MEMORY:
    {state['context']}

    RECENT CONVERSATION HISTORY:
    {state['chat_history']}
    
    INSTRUCTIONS:
    1. If the user asks "What can you do?", reply with your CORE MISSION statement above.
    2. If the user provides a title, date, and time, IMMEDIATELY call the 'create_event_tool'.
    3. If the user asks about past ideas or logs, use the 'CONTEXT FROM MEMORY' section to answer.
    4. Infer the date and time based on 'CURRENT DATE'.
    """

    # D. Construct Messages
    messages = []
    
    if state.get("image"):
        print("📸 Vision Mode Activated")
        messages.append(HumanMessage(
            content=[
                {"type": "text", "text": system_prompt},
                {"type": "text", "text": f"User Question: {state['question']}"},
                {"type": "image_url", "image_url": state["image"]}
            ]
        ))
    else:
        # Text Only Mode
        messages.append(SystemMessage(content=system_prompt))
        messages.append(HumanMessage(content=state["question"]))

    # E. Run LLM
    response = await llm_with_tools.ainvoke(messages)
    
    # F. Check for Tool Calls (Event Creation)
    if response.tool_calls:
        tool_call = response.tool_calls[0]
        if tool_call["name"] == "create_event_tool":
            args = tool_call["args"]
            print(f"📅 Tool Triggered: {args}")
            
            # Save to MongoDB
            new_event = {
                "title": args["title"],
                "date": args["date"],
                "time": args["time"],
                "type": args.get("type", "Personal"),
                "user_id": state["user_id"],
                "created_at": datetime.utcnow()
            }
            await events_collection.insert_one(new_event)
            
            return {"answer": f"✅ I've scheduled '{args['title']}' for {args['date']} at {args['time']}."}
        # --- THE FIX STARTS HERE ---
    # G. Clean the Response (Handle List vs String)
    final_content = response.content
    
    if isinstance(final_content, list):
        # If it's a list, extract the 'text' from every block and join them
        # Example input: [{'type': 'text', 'text': 'Hello'}]
        # Example output: "Hello"
        clean_text = " ".join(
            [block['text'] for block in final_content if isinstance(block, dict) and 'text' in block]
        )
        return {"answer": clean_text}
    else:
        # It's already a simple string
        return {"answer": str(final_content)}

    # G. Return Normal Text Response
    return {"answer": response.content}

# 3. BUILD THE GRAPH FACTORY
def build_shadow_graph():
    workflow = StateGraph(ShadowState)
    
    workflow.add_node("retrieve", retrieve_node)
    workflow.add_node("generate", generate_node)
    
    workflow.set_entry_point("retrieve")
    workflow.add_edge("retrieve", "generate")
    workflow.add_edge("generate", END)
    
    return workflow.compile()

shadow_graph = build_shadow_graph()

# Optional: Print layout
print("--- GRAPH MERMAID SYNTAX ---")
try:
    print(shadow_graph.get_graph().draw_mermaid())
except:
    print("Could not draw graph")
print("----------------------------")