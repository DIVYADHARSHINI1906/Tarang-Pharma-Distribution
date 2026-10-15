import os
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from backend.app.config import settings
from backend.app.api.routes import router as api_router
from backend.app.rules.claims_service import claims_service


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: Load claims and metadata into memory
    claims_service.initialize()
    print(f"[{settings.PROJECT_NAME}] Service initialized with {len(claims_service.claims_store)} claims.")
    yield
    print(f"[{settings.PROJECT_NAME}] Shutting down.")


app = FastAPI(
    title=settings.PROJECT_NAME,
    description="Automated AI Expense Receipt Reading and Claim Policy Validation for Tarang Pharma Distribution",
    version="1.0.0",
    lifespan=lifespan
)

# CORS middleware for local frontend development
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include API routes
app.include_router(api_router, prefix="/api")


@app.get("/")
def root():
    return {
        "app": settings.PROJECT_NAME,
        "status": "online",
        "docs_url": "/docs",
        "health_check": "/api/health"
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("backend.app.main:app", host="127.0.0.1", port=8000, reload=True)
