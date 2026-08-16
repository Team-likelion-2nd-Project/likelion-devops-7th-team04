"""LangChain chat chain: prompt template + history + Ollama.

This is the "LLM Service" from CLAUDE.md's Chatbot / AI subsystem section —
it orchestrates one chat turn (prompt assembly, optional retrieved context,
the Ollama call) behind the HTTP contract in main.py.

RAG retrieval (S3 Vectors / Neptune) is not implemented yet.
`_retrieve_context` is the extension point: swap its body for a real
retriever call and the returned context flows straight into the prompt
without any change to the HTTP contract.
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


async def generate_reply(message: str, history: list[ChatMessage]) -> str:
    """Orchestrate one turn: (future) retrieve context, then call the LLM."""
    context = _retrieve_context(message)
    prompt_message = message if context is None else f"{message}\n\nContext:\n{context}"

    result = await _chain.ainvoke(
        {"message": prompt_message, "history": _to_langchain_messages(history)}
    )
    return result.content
