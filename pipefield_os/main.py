"""
PipeField OS — FastAPI Application Entry Point
Pipe Support Engineering Module
"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .routers import auth, calculations, projects, reports, lookups

app = FastAPI(
    title="PipeField OS — Pipe Support Engineering API",
    description="ASME B31.1/B31.3 pipe support calculation engine",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(calculations.router)
app.include_router(projects.router)
app.include_router(reports.router)
app.include_router(lookups.router)


@app.get("/health")
def health():
    return {"status": "ok", "service": "PipeField OS Pipe Support Engine"}
