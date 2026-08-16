# langchain_rag/n8n/ — orchestration workflow

Implements the `N8N_WEBHOOK_URL` contract `backend/apps/chat-bot-service/src/n8n/n8n.client.ts` already calls (`{sessionId?, userId?, message, history}` in, `{reply}` out). Nothing pointed at that URL until now.

`workflows/chat-orchestration.json` is the workflow, five nodes:

```
Webhook (POST /webhook/chat)
  → Map to llm-service contract   (Code: USER/ASSISTANT → user/assistant, drops sessionId/userId)
  → Mock RAG (placeholder)        (Set: fixed placeholder string as `context`)
  → Call llm-service               (HTTP Request: POST llm-service:8000/chat)
  → Respond to Webhook             ({ reply })
```

**"Mock RAG (placeholder)"** stands in for a real S3 Vectors query — there's no populated vector index anywhere locally (that needs `infra/terraform/modules/ai_data`'s bucket plus actual embedded content, both out of scope here). It returns a fixed, clearly-labeled string as the `context` field instead of a real lookup. `langchain_rag/llm-service/app/chain.py` already accepts and uses that field, so swapping this one node for a real S3 Vectors query node later is a drop-in replacement — nothing else in the workflow, or in `llm-service`, needs to change.

## Running locally

```bash
docker compose -f ../docker-compose.yml up --build   # or: cd .. && docker compose up --build
```

Brings up `ollama`, `llm-service`, `n8n`, and `n8n-init` (imports the workflow once, active, into `n8n`'s DB).

**If the webhook 404s** (`n8n` had already finished booting before `n8n-init` wrote the active workflow — see the comment in `../docker-compose.yml`), run:

```bash
docker compose -f ../docker-compose.yml restart n8n
```

You can also open `http://localhost:5678` and check the workflow is listed and its "Active" toggle is on.

If that doesn't fix it, check whether `n8n-init` actually succeeded in the
first place — `docker compose -f ../docker-compose.yml logs n8n-init` should
show a successful import, not an error/non-zero exit. If it failed outright,
restarting `n8n` won't help (there was never a workflow to activate); fix
whatever broke the import and re-run `docker compose -f ../docker-compose.yml up n8n-init`.

## Testing (no local S3 Vectors — see above)

**(a) Full-path orchestration test** — mimics `n8n.client.ts`'s exact request shape against the webhook:

```bash
curl -X POST http://localhost:5678/webhook/chat -H 'Content-Type: application/json' \
  -d '{"sessionId":"test-session","userId":1,"message":"안녕하세요, 예약 가능한 방 있나요?","history":[{"role":"USER","content":"안녕하세요"},{"role":"ASSISTANT","content":"안녕하세요! 무엇을 도와드릴까요?"}]}'
```

Expect `{"reply": "..."}` — proves the whole local chain (n8n → llm-service → Ollama) end-to-end, including the uppercase→lowercase role mapping and the mock-context hand-off, without touching AWS.

**(b) Context-injection test** — verifies the mechanism the mock (and later, real) RAG node relies on actually reaches the prompt, independent of n8n, by calling `llm-service` directly and asking the model to echo back what it was given:

```bash
curl -X POST http://localhost:8001/chat -H 'Content-Type: application/json' \
  -d '{"message":"컨텍스트에 있는 문장을 그대로 반복해줘.","history":[],"context":"TEST-CONTEXT-12345"}'
```

(Host port `8001` — see the port-mapping comment in `../docker-compose.yml`; the internal call n8n makes above still uses `llm-service:8000`.)

Expect the reply to contain `TEST-CONTEXT-12345`, confirming `context` is actually wired into the prompt sent to Ollama.

Both tests validate *plumbing and wiring only* — not retrieval grounding/quality, since there's no real content behind the mock context.

## Not in scope here

A real S3 Vectors retrieval node, deploying n8n anywhere (this is a local-only Docker Compose instance), and pointing `backend/.env`'s `N8N_WEBHOOK_URL` at this instance to test the full `chat-bot-service` → n8n chain (you can do that manually — `N8N_WEBHOOK_URL=http://localhost:5678/webhook/chat` — but it isn't wired up automatically, to keep this stack independent of the `backend/` one, same as `llm-service`/`ollama`).
