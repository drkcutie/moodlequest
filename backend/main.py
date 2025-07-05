import os
import logging
import urllib3
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import JSONResponse
from app.routes import quests, auth, enrollment, webhooks, leaderboard, notifications
from app.database.connection import engine, Base, SessionLocal
from app.database.seed import seed_initial_data
from app.models.auth import MoodleConfig

# Suppress SSL warnings for localhost development
urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)

# ============================================================================
# ⚠️ DEVELOPMENT WARNING: Authentication is currently DISABLED
# This configuration automatically logs in with a dummy teacher account
# Do not use this setup in production! Re-enable authentication when needed.
# See app/utils/auth.py and frontend/lib/auth-context.tsx
# ============================================================================

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
)
logger = logging.getLogger(__name__)

# Create tables if they don't exist
Base.metadata.create_all(bind=engine)

# Get Moodle URL from environment
moodle_url = os.getenv("MOODLE_URL")
if moodle_url:
    logger.info(f"Using Moodle URL from environment: {moodle_url}")
else:
    logger.warning("MOODLE_URL environment variable not set, using default")

# Seed initial data
with SessionLocal() as db:
    seed_initial_data(db)
    
    # Display current Moodle configuration
    moodle_config = db.query(MoodleConfig).first()
    if moodle_config:
        logger.info(f"Current Moodle configuration: URL={moodle_config.base_url}, Service={moodle_config.service_name}")
    else:
        logger.warning("No Moodle configuration found in database")

app = FastAPI(title="MoodleQuest API")

# List of allowed origins
origins = [
    "http://localhost:3000",  # Next.js default
    "http://127.0.0.1:3000",
    "http://127.0.0.1:3001",

    "http://localhost:8000",
    "http://127.0.0.1:8000",
    "http://localhost:5173",  # Vite default
    "http://127.0.0.1:5173",
]

# Configure CORS with specific origins
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_origin_regex=r"https://.*\.vercel\.app",  # Allow Vercel deployments
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"],
    allow_headers=["Content-Type", "Authorization", "Accept", "Origin", "X-Requested-With"],
    expose_headers=["Content-Length"],
    max_age=600,  # Cache preflight requests for 10 minutes
)

# Error handling middleware
@app.middleware("http")
async def errors_handling(request: Request, call_next):
    try:
        return await call_next(request)
    except Exception as exc:
        logger.error(f"Request error: {exc}")
        return JSONResponse(
            status_code=500,
            content={"detail": str(exc)},
            headers={
                "Access-Control-Allow-Origin": "*",
                "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
                "Access-Control-Allow-Headers": "Content-Type, Authorization",
            }
        )

# Mount static files directory
app.mount("/static", StaticFiles(directory="static"), name="static")

# Include routers
from app.routes import daily_quests
from app.routes.badges import router as badges_router 
from app.routes.activity_log import router as activity_log_router
from app.routes.virtual_pet import router as virtual_pet_router

app.include_router(quests.router, prefix="/api")
app.include_router(auth.router, prefix="/api")
app.include_router(enrollment.router, prefix="/api")
app.include_router(webhooks.router, prefix="/api")
app.include_router(leaderboard.router, prefix="/api")
app.include_router(daily_quests.router, prefix="/api")
app.include_router(notifications.router, prefix="/api")
app.include_router(badges_router, prefix="/api")
app.include_router(activity_log_router, prefix="/api")
app.include_router(virtual_pet_router, prefix="/api")

@app.get("/")
async def root():
    return {"message": "Welcome to MoodleQuest API"}

if __name__ == "__main__":
    import uvicorn
    logger.info(f"Starting MoodleQuest API server")
    uvicorn.run(app, host="0.0.0.0", port=8002)