# langchain_rag/llm-service/ — LangChain HTTP orchestration API

The "LLM Service (FastAPI)" from `CLAUDE.md`'s Chatbot / AI subsystem
section: a FastAPI app that orchestrates one chat turn — prompt assembly
(with a stub hook for future RAG context) and the call to the self-hosted
Ollama node (`../ollama/`) — behind a small HTTP contract.

Nothing in `backend/` calls this yet. Per the intended architecture,
`chat-bot-service` calls **n8n**, and n8n is meant to call this service; n8n
itself doesn't exist yet, so today this is exercised directly (curl, or
later, an n8n HTTP Request node) rather than through the gRPC mesh.

## API

`POST /chat`

```json
// request
{ "message": "안녕하세요, 예약 가능한 방 있나요?", "history": [] }

// response
{ "reply": "..." }
```

`history` is a list of `{ "role": "user" | "assistant", "content": string }`,
oldest first.

`GET /health` — liveness check.

## Running locally

```bash
docker compose -f ../docker-compose.yml up --build   # or: cd .. && docker compose up --build
curl localhost:8000/health
curl localhost:8000/chat -X POST -H 'Content-Type: application/json' \
    -d '{"message": "안녕하세요, 예약 가능한 방 있나요?", "history": []}'
```

This builds both `../ollama` (the model-baked-in Ollama image) and this
service, and wires them together. First build takes a while (pulling the
model into the Ollama image); subsequent builds are cached.

To run this service against an Ollama instance you're already running some
other way, skip Compose and just point it at that instance:

```bash
cp .env.example .env   # then edit OLLAMA_BASE_URL/OLLAMA_MODEL if needed
pip install -r requirements.txt
uvicorn app.main:app --reload
```

## Not in scope here

Deploying either image to EKS — ECR push, an ArgoCD `Application`, Helm
values, GPU scheduling/autoscaling — is separate, later work; see
`CLAUDE.md`. So is the actual n8n workflow and real RAG retrieval (the
`_retrieve_context` hook in `app/chain.py` is a stub).
