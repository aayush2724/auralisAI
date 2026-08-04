import pytest
import uuid
from fastapi.testclient import TestClient
from src.memory.db import init_db, save_session, load_session, list_sessions, delete_session
from src.memory.memory import ConversationMemory
from src.api.main import app

@pytest.mark.asyncio
async def test_db_chat_history():
    await init_db()
    session_id = f"test_sess_{uuid.uuid4()}"
    owner_id = "test_owner"
    workspace_id = "default_tenant"

    facts = {
        "company_name": "TestCompany",
        "tools_mentioned": ["Salesforce"],
        "budget_signal": "$100k",
        "objections_raised": [],
    }

    messages = [
        {"role": "user", "content": "Hello, we use Salesforce.", "metadata": {}, "turn": 1},
        {"role": "assistant", "content": "I can help with Salesforce.", "metadata": {}, "turn": 2}
    ]

    # Test saving
    await save_session(session_id, facts, owner_id=owner_id, workspace_id=workspace_id, messages=messages)

    # Test loading
    loaded = await load_session(session_id, owner_id=owner_id, workspace_id=workspace_id)
    assert loaded is not None
    assert loaded["company_name"] == "TestCompany"
    assert loaded["tools_mentioned"] == ["Salesforce"]
    assert len(loaded["messages"]) == 2
    assert loaded["messages"][0]["content"] == "Hello, we use Salesforce."

    # Test listing
    sessions = await list_sessions(owner_id=owner_id, workspace_id=workspace_id)
    session_previews = [s for s in sessions if s["session_id"] == session_id]
    assert len(session_previews) == 1
    assert session_previews[0]["company_name"] == "TestCompany"
    assert session_previews[0]["preview"] == "Hello, we use Salesforce."

    # Test memory restore
    memory = await ConversationMemory.from_session(session_id, owner_id=owner_id)
    assert len(memory.get_messages()) == 2
    assert memory.get_messages()[0].content == "Hello, we use Salesforce."

    # Test deletion
    await delete_session(session_id)
    loaded_after_delete = await load_session(session_id, owner_id=owner_id, workspace_id=workspace_id)
    assert loaded_after_delete is None
