"""
main.py — FastAPI application entry point.

Responsibilities:
 - Create all database tables on startup (dev convenience; use Alembic for prod)
 - Register CORS middleware
 - Register all CRUD routers
 - Provide a health-check endpoint
"""

from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.database import engine
import app.models  # noqa: F401 — ensures all models are registered with Base
from app.database import Base
from app.routers import rooms, departments, exam_sessions, exam_entries, plans


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Create DB tables before the app starts serving requests."""
    Base.metadata.create_all(bind=engine)
    yield


app = FastAPI(
    title="Exam Seating Arrangement System",
    description="API for generating and managing exam seating plans for an engineering college.",
    version="1.0.0",
    lifespan=lifespan,
)

# ── CORS ──────────────────────────────────────────────────────────────────────
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Routers ───────────────────────────────────────────────────────────────────
API_PREFIX = "/api/v1"

app.include_router(rooms.router, prefix=API_PREFIX)
app.include_router(departments.router, prefix=API_PREFIX)
app.include_router(exam_sessions.router, prefix=API_PREFIX)
app.include_router(exam_entries.router, prefix=API_PREFIX)
app.include_router(plans.router, prefix=API_PREFIX)


# ── Health check ──────────────────────────────────────────────────────────────
@app.get("/health", tags=["Health"])
def health():
    return {"status": "ok", "version": "1.0.0"}
