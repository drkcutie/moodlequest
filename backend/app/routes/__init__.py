# This file makes the routes directory a Python package 

# Import and make routers available
from app.routes.quests import router as quests_router  
from app.routes.auth import router as auth_router
from app.routes.enrollment import router as enrollments_router
from app.routes.badges import router as badges_router
from app.routes.activity_log import router as activity_log_router
from app.routes.progress import router as progress_router
# Import the routers directly to make them available at the package level
router = auth_router