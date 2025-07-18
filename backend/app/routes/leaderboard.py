from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session
from typing import List, Optional
import logging

from app.database.connection import get_db
from app.utils.auth import get_current_active_user, get_role_required
from app.models.user import User
from app.schemas.leaderboard import (
    LeaderboardResponse,
    LeaderboardCreate,
    LeaderboardUpdate,
    LeaderboardEntryResponse,
    StudentProgressResponse,
    StudentProgressCreate,
    StudentProgressUpdate,
    ExperiencePointCreate,
    ExperiencePointResponse,
    TopStudentResponse,
    CourseLeaderboardResponse,
    LeaderboardFilter,
    StudentProgressFilter,
    LeaderboardSummary
)

from app.crud.leaderboard import (
    create_leaderboard,
    get_leaderboard,
    get_leaderboards,
    update_leaderboard,
    delete_leaderboard,
    create_or_update_student_progress,
    get_student_progress,
    get_students_progress,
    create_experience_point,
    calculate_leaderboard_rankings,
    get_top_students_by_course,
    get_global_top_students
)

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/leaderboard", tags=["leaderboard"])

# Leaderboard Management Routes (Admin/Teacher only)
@router.post("/", response_model=LeaderboardResponse)
async def create_new_leaderboard(
    leaderboard: LeaderboardCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_role_required(["admin", "teacher"]))
):
    """Create a new leaderboard (Admin/Teacher only)"""
    try:
        db_leaderboard = create_leaderboard(db, leaderboard)
        return db_leaderboard
    except Exception as e:
        logger.error(f"Error creating leaderboard: {e}")
        raise HTTPException(status_code=500, detail="Failed to create leaderboard")

@router.get("/{leaderboard_id}", response_model=LeaderboardResponse)
async def get_leaderboard_by_id(
    leaderboard_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Get a specific leaderboard with its entries"""
    db_leaderboard = get_leaderboard(db, leaderboard_id)
    if not db_leaderboard:
        raise HTTPException(status_code=404, detail="Leaderboard not found")
    
    # Convert to response format with user details
    entries = []
    for entry in db_leaderboard.entries:
        entry_response = LeaderboardEntryResponse(
            entry_id=entry.entry_id,
            leaderboard_id=entry.leaderboard_id,
            user_id=entry.user_id,
            score=entry.score,
            rank=entry.rank,
            last_updated=entry.last_updated,
            username=entry.user.username if entry.user else None,
            first_name=entry.user.first_name if entry.user else None,
            last_name=entry.user.last_name if entry.user else None,
            profile_image_url=entry.user.profile_image_url if entry.user else None
        )
        entries.append(entry_response)
    
    return LeaderboardResponse(
        leaderboard_id=db_leaderboard.leaderboard_id,
        name=db_leaderboard.name,
        description=db_leaderboard.description,
        course_id=db_leaderboard.course_id,
        metric_type=db_leaderboard.metric_type,
        timeframe=db_leaderboard.timeframe,
        is_active=db_leaderboard.is_active,
        created_at=db_leaderboard.created_at,
        last_updated=db_leaderboard.last_updated,
        entries=entries
    )

@router.get("/", response_model=List[LeaderboardResponse])
async def get_leaderboards_list(
    course_id: Optional[int] = Query(None, description="Filter by course ID"),
    metric_type: Optional[str] = Query(None, description="Filter by metric type"),
    timeframe: Optional[str] = Query(None, description="Filter by timeframe"),
    is_active: Optional[bool] = Query(True, description="Filter by active status"),
    limit: int = Query(50, description="Maximum number of results"),
    offset: int = Query(0, description="Number of results to skip"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Get list of leaderboards with filtering options"""
    filters = LeaderboardFilter(
        course_id=course_id,
        metric_type=metric_type,
        timeframe=timeframe,
        is_active=is_active,
        limit=limit,
        offset=offset
    )
    
    leaderboards = get_leaderboards(db, filters)
    
    # Convert to response format
    responses = []
    for leaderboard in leaderboards:
        entries = []
        for entry in leaderboard.entries:
            entry_response = LeaderboardEntryResponse(
                entry_id=entry.entry_id,
                leaderboard_id=entry.leaderboard_id,
                user_id=entry.user_id,
                score=entry.score,
                rank=entry.rank,
                last_updated=entry.last_updated,
                username=entry.user.username if entry.user else None,
                first_name=entry.user.first_name if entry.user else None,
                last_name=entry.user.last_name if entry.user else None,
                profile_image_url=entry.user.profile_image_url if entry.user else None
            )
            entries.append(entry_response)
        
        response = LeaderboardResponse(
            leaderboard_id=leaderboard.leaderboard_id,
            name=leaderboard.name,
            description=leaderboard.description,
            course_id=leaderboard.course_id,
            metric_type=leaderboard.metric_type,
            timeframe=leaderboard.timeframe,
            is_active=leaderboard.is_active,
            created_at=leaderboard.created_at,
            last_updated=leaderboard.last_updated,
            entries=entries
        )
        responses.append(response)
    
    return responses

@router.put("/{leaderboard_id}", response_model=LeaderboardResponse)
async def update_leaderboard_by_id(
    leaderboard_id: int,
    leaderboard_update: LeaderboardUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_role_required(["admin", "teacher"]))
):
    """Update a leaderboard (Admin/Teacher only)"""
    db_leaderboard = update_leaderboard(db, leaderboard_id, leaderboard_update)
    if not db_leaderboard:
        raise HTTPException(status_code=404, detail="Leaderboard not found")
    return db_leaderboard

@router.delete("/{leaderboard_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_leaderboard_by_id(
    leaderboard_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_role_required(["admin", "teacher"]))
):
    """Delete a leaderboard (Admin/Teacher only)"""
    success = delete_leaderboard(db, leaderboard_id)
    if not success:
        raise HTTPException(status_code=404, detail="Leaderboard not found")

@router.post("/{leaderboard_id}/refresh", response_model=LeaderboardResponse)
async def refresh_leaderboard_rankings(
    leaderboard_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_role_required(["admin", "teacher"]))
):
    """Recalculate and update leaderboard rankings"""
    try:
        calculate_leaderboard_rankings(db, leaderboard_id)
        updated_leaderboard = get_leaderboard(db, leaderboard_id)
        if not updated_leaderboard:
            raise HTTPException(status_code=404, detail="Leaderboard not found")
        return updated_leaderboard
    except Exception as e:
        logger.error(f"Error refreshing leaderboard {leaderboard_id}: {e}")
        raise HTTPException(status_code=500, detail="Failed to refresh leaderboard")


# Top Students Routes
@router.get("/top-students/global", response_model=List[TopStudentResponse])
async def get_global_leaderboard(
    limit: int = Query(20, description="Number of top students to return"),
    timeframe: str = Query("all_time", description="Leaderboard time frame: daily, weekly, monthly, all_time"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Get global top students across all courses, filtered by time frame"""
    try:
        top_students = get_global_top_students(db, limit, timeframe)
        result = [TopStudentResponse(**student) for student in top_students]
        return result
    except Exception as e:
        logger.error(f"Error fetching global top students: {e}")
        raise HTTPException(status_code=500, detail="Failed to fetch global leaderboard")

@router.get("/top-students/course/{course_id}", response_model=List[TopStudentResponse])
async def get_course_leaderboard(
    course_id: int,
    limit: int = Query(10, description="Number of top students to return"),
    timeframe: str = Query("all_time", description="Leaderboard time frame: daily, weekly, monthly, all_time"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Get top students for a specific course, filtered by time frame"""
    try:
        top_students = get_top_students_by_course(db, course_id, limit, timeframe)
        return [TopStudentResponse(**student) for student in top_students]
    except Exception as e:
        logger.error(f"Error fetching course leaderboard for course {course_id}: {e}")
        raise HTTPException(status_code=500, detail="Failed to fetch course leaderboard")
        raise HTTPException(status_code=500, detail="Failed to fetch course leaderboard")

@router.get("/course/{course_id}/summary", response_model=CourseLeaderboardResponse)
async def get_course_leaderboard_summary(
    course_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Get course leaderboard summary with top students and available leaderboards"""
    try:
        # Get course information
        from app.models.course import Course
        course = db.query(Course).filter(Course.course_id == course_id).first()
        if not course:
            raise HTTPException(status_code=404, detail="Course not found")
        
        # Get course leaderboards
        filters = LeaderboardFilter(course_id=course_id, is_active=True)
        leaderboards = get_leaderboards(db, filters)
        
        leaderboard_summaries = []
        for lb in leaderboards:
            summary = LeaderboardSummary(
                leaderboard_id=lb.leaderboard_id,
                name=lb.name,
                metric_type=lb.metric_type,
                timeframe=lb.timeframe,
                total_participants=len(lb.entries),
                top_score=lb.entries[0].score if lb.entries else None,
                last_updated=lb.last_updated
            )
            leaderboard_summaries.append(summary)
        
        # Get top students
        top_students = get_top_students_by_course(db, course_id, 10)
        top_student_responses = [TopStudentResponse(**student) for student in top_students]
        
        return CourseLeaderboardResponse(
            course_id=course_id,
            course_name=course.title,
            leaderboards=leaderboard_summaries,
            top_students=top_student_responses
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching course leaderboard summary for course {course_id}: {e}")
        raise HTTPException(status_code=500, detail="Failed to fetch course summary")

# Student Progress Routes
@router.get("/progress/user/{user_id}/course/{course_id}", response_model=StudentProgressResponse)
async def get_user_progress(
    user_id: int,
    course_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Get student progress for a specific user and course"""
    # Check if current user can access this data
    if current_user.role not in ["admin", "teacher"] and current_user.id != user_id:
        raise HTTPException(status_code=403, detail="Not authorized to view this progress")
    
    progress = get_student_progress(db, user_id, course_id)
    if not progress:
        raise HTTPException(status_code=404, detail="Student progress not found")
    
    return StudentProgressResponse(
        progress_id=progress.progress_id,
        user_id=progress.user_id,
        course_id=progress.course_id,
        total_exp=progress.total_exp,
        quests_completed=progress.quests_completed,
        badges_earned=progress.badges_earned,
        engagement_score=progress.engagement_score,
        study_hours=progress.study_hours,
        last_activity=progress.last_activity,
        streak_days=progress.streak_days,
        last_updated=progress.last_updated,
        username=progress.user.username if progress.user else None,
        first_name=progress.user.first_name if progress.user else None,
        last_name=progress.user.last_name if progress.user else None
    )

@router.get("/progress/course/{course_id}", response_model=List[StudentProgressResponse])
async def get_course_progress(
    course_id: int,
    limit: int = Query(50, description="Maximum number of results"),
    offset: int = Query(0, description="Number of results to skip"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_role_required(["admin", "teacher"]))
):
    """Get all student progress for a specific course (Admin/Teacher only)"""
    filters = StudentProgressFilter(
        course_id=course_id,
        limit=limit,
        offset=offset
    )
    
    progress_list = get_students_progress(db, filters)
    
    responses = []
    for progress in progress_list:
        response = StudentProgressResponse(
            progress_id=progress.progress_id,
            user_id=progress.user_id,
            course_id=progress.course_id,
            total_exp=progress.total_exp,
            quests_completed=progress.quests_completed,
            badges_earned=progress.badges_earned,
            engagement_score=progress.engagement_score,
            study_hours=progress.study_hours,
            last_activity=progress.last_activity,
            streak_days=progress.streak_days,
            last_updated=progress.last_updated,
            username=progress.user.username if progress.user else None,
            first_name=progress.user.first_name if progress.user else None,
            last_name=progress.user.last_name if progress.user else None
        )
        responses.append(response)
    
    return responses

@router.post("/progress", response_model=StudentProgressResponse)
async def create_or_update_progress(
    progress: StudentProgressCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_role_required(["admin", "teacher"]))
):
    """Create or update student progress (Admin/Teacher only)"""
    try:
        db_progress = create_or_update_student_progress(db, progress)
        return StudentProgressResponse(
            progress_id=db_progress.progress_id,
            user_id=db_progress.user_id,
            course_id=db_progress.course_id,
            total_exp=db_progress.total_exp,
            quests_completed=db_progress.quests_completed,
            badges_earned=db_progress.badges_earned,
            engagement_score=db_progress.engagement_score,
            study_hours=db_progress.study_hours,
            last_activity=db_progress.last_activity,
            streak_days=db_progress.streak_days,
            last_updated=db_progress.last_updated,
            username=db_progress.user.username if db_progress.user else None,
            first_name=db_progress.user.first_name if db_progress.user else None,
            last_name=db_progress.user.last_name if db_progress.user else None
        )
    except Exception as e:
        logger.error(f"Error creating/updating student progress: {e}")
        raise HTTPException(status_code=500, detail="Failed to create/update progress")

# Experience Points Routes
@router.post("/experience", response_model=ExperiencePointResponse)
async def award_experience_points(
    exp_point: ExperiencePointCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_role_required(["admin", "teacher"]))
):
    """Award experience points to a student (Admin/Teacher only)"""
    try:
        # Set awarded_by to current user if not specified
        if not exp_point.awarded_by:
            exp_point.awarded_by = current_user.id
        
        db_exp = create_experience_point(db, exp_point)
        return ExperiencePointResponse(
            exp_id=db_exp.exp_id,
            user_id=db_exp.user_id,
            course_id=db_exp.course_id,
            amount=db_exp.amount,
            source_type=db_exp.source_type,
            source_id=db_exp.source_id,
            awarded_at=db_exp.awarded_at,
            awarded_by=db_exp.awarded_by,
            notes=db_exp.notes
        )
    except Exception as e:
        logger.error(f"Error awarding experience points: {e}")
        raise HTTPException(status_code=500, detail="Failed to award experience points") 