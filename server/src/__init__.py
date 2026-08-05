"""
auralis/src
"""

# Import the centralized config first to ensure environment variables
# are loaded before any other submodules in src evaluate os.getenv()
import src.config  # noqa: F401
