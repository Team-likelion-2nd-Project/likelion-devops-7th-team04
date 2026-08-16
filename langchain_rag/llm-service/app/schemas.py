"""Request/response models for the llm-service HTTP API."""

from typing import Literal

from pydantic import BaseModel, Field


class ChatMessage(BaseModel):
    """A single turn in the conversation history."""

    role: Literal["user", "assistant"]
    content: str


class ChatRequest(BaseModel):
    """Request body for POST /chat."""

    message: str = Field(..., min_length=1, description="The user's latest message.")
    history: list[ChatMessage] = Field(
        default_factory=list,
        description="Prior turns, oldest first. Empty for a fresh/anonymous conversation.",
    )
    context: str | None = Field(
        default=None,
        description=(
            "Retrieved context to ground the reply in, supplied by the caller "
            "(e.g. n8n's RAG step). When omitted, chain.py falls back to its "
            "own (currently stub) retrieval hook."
        ),
    )


class ChatResponse(BaseModel):
    """Response body for POST /chat."""

    reply: str
