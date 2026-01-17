import os
from langchain_google_genai import GoogleGenerativeAIEmbeddings
from langchain_pinecone import PineconeVectorStore

# 1. SETUP ENV VARS (LangChain looks for these automatically)

PINECONE_API_KEY = os.getenv("PINECONE_API_KEY")
GOOGLE_API_KEY = os.getenv("GOOGLE_API_KEY")


index_name = "shadow-memory"

# 2. SETUP EMBEDDINGS
embeddings = GoogleGenerativeAIEmbeddings(model="models/embedding-001")

# 3. INITIALIZE VECTOR STORE
# We initialize it once here so we can import it elsewhere
# Note: We don't need to manually create the index every time; 
# LangChain assumes it exists or we can check separately.
vectorstore = PineconeVectorStore(
    index_name=index_name,
    embedding=embeddings
)

async def save_note_to_vector_db(note_id: str, text: str, user_id: str, created_at: str):
    """
    LangChain handles the embedding conversion automatically.
    """
    try:
        # We use add_texts directly
        vectorstore.add_texts(
            texts=[text],
            metadatas=[{
                "user_id": user_id,
                "date": created_at,
                "text": text
            }],
            ids=[note_id] # We keep the MongoDB ID as the Vector ID
        )
        print(f"🧠 Note stored in Pinecone via LangChain: {note_id}")
    except Exception as e:
        print(f"⚠️ Vector DB Save Error: {e}")

def get_retriever(user_id: str):
    """
    Returns a 'Retriever' object specifically filtered for THIS user.
    This is the magic of LangChain - we pass this retriever into the AI chain.
    """
    return vectorstore.as_retriever(
        search_type="similarity",
        search_kwargs={
            "k": 5,
            "filter": {"user_id": user_id} # <--- SECURITY: Only search my notes
        }
    )