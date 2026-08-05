"""
auralis/src/config.py
───────────────────────
Centralized configuration loader.
This module ensures the .env file is loaded properly across local development, testing, and CI.
"""

from pathlib import Path


def load_environment() -> None:
    """Load environment variables from the project .env file if it exists."""
    try:
        from dotenv import load_dotenv

        # Load the .env file from the project root (Auralis-main/.env)
        # __file__ is server/src/config.py -> parent x3 is Auralis-main/
        _dotenv_path = Path(__file__).parent.parent.parent / ".env"
        load_dotenv(dotenv_path=_dotenv_path, override=False)
    except ImportError:
        pass  # python-dotenv not installed; rely on env vars being set externally


load_environment()
