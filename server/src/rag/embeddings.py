import os


def get_embeddings():
    """
    Return the embeddings client to use for this environment.

    Production (ENVIRONMENT=production, set in render.yaml): Gemini's hosted
    embedding API — no local server required.

    Local/dev (default): Ollama, if you have it running locally. Falls back
    to Gemini automatically if OLLAMA_BASE_URL/Ollama isn't reachable —
    or you can force Gemini locally too by setting ENVIRONMENT=production
    in your local .env.
    """
    if os.getenv("ENVIRONMENT", "development") == "production":
        from langchain_google_genai import GoogleGenerativeAIEmbeddings
        return GoogleGenerativeAIEmbeddings(
            model=os.getenv("GEMINI_EMBED_MODEL", "models/text-embedding-004"),
            google_api_key=os.getenv("GEMINI_API_KEY"),
        )

    from langchain_ollama import OllamaEmbeddings
    return OllamaEmbeddings(
        model=os.getenv("OLLAMA_EMBED_MODEL", "nomic-embed-text"),
        base_url=os.getenv("OLLAMA_BASE_URL", "http://localhost:11434"),
    )
