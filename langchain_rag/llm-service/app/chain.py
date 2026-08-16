"""LangChain chat chain: prompt template + history + Ollama.

This is the "LLM Service" from CLAUDE.md's Chatbot / AI subsystem section —
it orchestrates one chat turn (prompt assembly, optional retrieved context,
the Ollama call) behind the HTTP contract in main.py.

RAG retrieval (S3 Vectors / Neptune) is not implemented yet. Per the
intended architecture, retrieval is n8n's job — its workflow (see
langchain_rag/n8n/) does the lookup and passes the result in as the
`context` field on POST /chat. `_retrieve_context` below is only a fallback
for when this service is called directly (curl, no n8n in front) so it stays
independently testable; swap its body for a real retriever call if this
service is ever meant to do its own retrieval too.
"""

import os

from langchain_core.messages import AIMessage, HumanMessage
from langchain_core.prompts import ChatPromptTemplate, MessagesPlaceholder
from langchain_ollama import ChatOllama

from .schemas import ChatMessage

OLLAMA_BASE_URL = os.getenv("OLLAMA_BASE_URL", "http://localhost:11434")
OLLAMA_MODEL = os.getenv("OLLAMA_MODEL", "qwen2.5:7b-instruct")

SYSTEM_PROMPT = (
    "You are a helpful assistant for a hotel booking service. "
    "Answer concisely and in the same language the user writes in."
)

_llm = ChatOllama(base_url=OLLAMA_BASE_URL, model=OLLAMA_MODEL)

_prompt = ChatPromptTemplate.from_messages(
    [
        ("system", SYSTEM_PROMPT),
        MessagesPlaceholder("history"),
        ("human", "{message}"),
    ]
)

_chain = _prompt | _llm


def _retrieve_context(message: str) -> str | None:
    """Stub retrieval hook — real S3 Vectors/Neptune RAG lookup goes here later."""
    return None


def _to_langchain_messages(history: list[ChatMessage]) -> list[HumanMessage | AIMessage]:
    converted: list[HumanMessage | AIMessage] = []
    for turn in history:
        if turn.role == "user":
            converted.append(HumanMessage(content=turn.content))
        else:
            converted.append(AIMessage(content=turn.content))
    return converted


async def generate_reply(
    message: str, history: list[ChatMessage], context: str | None = None
) -> str:
    """Orchestrate one turn: use the caller-supplied context if given, else
    fall back to the local retrieval stub, then call the LLM."""
    if context is None:
        context = _retrieve_context(message)
    prompt_message = message if context is None else f"{message}\n\nContext:\n{context}"

    result = await _chain.ainvoke(
        {"message": prompt_message, "history": _to_langchain_messages(history)}
    )
    return result.content
