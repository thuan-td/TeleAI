from fastapi import Depends, FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.auth import require_admin, require_user
from app.routers import agent_config, auth, calls, kb, leads, web_calls, webhooks

app = FastAPI(title="TeleApo Clone MVP")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(calls.router, dependencies=[Depends(require_user)])
app.include_router(web_calls.router, dependencies=[Depends(require_admin)])
app.include_router(leads.router, dependencies=[Depends(require_user)])
app.include_router(webhooks.router)
app.include_router(agent_config.router, dependencies=[Depends(require_admin)])
# kb.router is NOT gated here — see the comment above retell_query_knowledge_base
# in app/routers/kb.py for why (that one endpoint has no session-cookie auth).
app.include_router(kb.router)


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}
