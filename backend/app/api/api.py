from fastapi import APIRouter

from app.api.endpoints import users, auth, quests, courses, enrollment
from app.routes import webhooks, badges, virtual_pet

api_router = APIRouter()
api_router.include_router(auth.router, prefix="/auth", tags=["authentication"])
api_router.include_router(users.router, prefix="/users", tags=["users"])
api_router.include_router(quests.router, prefix="/quests", tags=["quests"])
api_router.include_router(courses.router, prefix="/courses", tags=["courses"]) 
api_router.include_router(enrollment.router, prefix="/enrollment", tags=["enrollment"])
api_router.include_router(webhooks.router, prefix="/webhooks", tags=["webhook"])
api_router.include_router(badges.router, prefix="/badges", tags=["badges"])
api_router.include_router(virtual_pet.router, prefix="/virtual-pet", tags=["virtual-pet"])