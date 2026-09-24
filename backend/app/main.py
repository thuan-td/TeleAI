from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.routers import agent_config, calls, kb, leads, web_calls, webhooks

app = FastAPI(title="TeleApo Clone MVP")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(calls.router)
app.include_router(web_calls.router)
app.include_router(leads.router)
app.include_router(webhooks.router)
app.include_router(agent_config.router)
app.include_router(kb.router)


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}
