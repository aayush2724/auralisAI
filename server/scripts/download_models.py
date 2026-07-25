import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("download_models")

def download_models():
    logger.info("Local HuggingFace model downloads have been disabled.")
    logger.info("Models are now served via Google GenAI API.")

if __name__ == "__main__":
    download_models()
