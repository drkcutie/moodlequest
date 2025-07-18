from sqlalchemy.orm import Session, joinedload
from sqlalchemy import desc, asc, func, and_, case
from typing import List, Optional, Dict, Any
from datetime import datetime, timedelta
from decimal import Decimal

from app.models.leaderboard import (
    Leaderboard, 
    LeaderboardEntry, 
    StudentProgress, 
    ExperiencePoint
)
from app.models.user import User
from app.models.course import Course
from app.schemas.leaderboard import (
    LeaderboardCreate, 
    LeaderboardUpdate,
    StudentProgressCreate,
    StudentProgressUpdate,
    ExperiencePointCreate,
    LeaderboardFilter,
    StudentProgressFilter
)

# Leaderboard CRUD operations
def create_leaderboard(db: Session, leaderboard: LeaderboardCreate) -> Leaderboard:
    """Create a new leaderboard"""
    db_leaderboard = Leaderboard(**leaderboard.model_dump())
    db.add(db_leaderboard)
    db.commit()
    db.refresh(db_leaderboard)
    return db_leaderboard

def get_leaderboard(db: Session, leaderboard_id: int) -> Optional[Leaderboard]:
    """Get a leaderboard by ID with entries"""
    return db.query(Leaderboard).options(
        joinedload(Leaderboard.entries).joinedload(LeaderboardEntry.user)
    ).filter(Leaderboard.leaderboard_id == leaderboard_id).first()

def get_leaderboards(db: Session, filters: LeaderboardFilter) -> List[Leaderboard]:
    """Get leaderboards with filtering"""
    query = db.query(Leaderboard)
    
    if filters.course_id:
        query = query.filter(Leaderboard.course_id == filters.course_id)
    if filters.metric_type:
        query = query.filter(Leaderboard.metric_type == filters.metric_type)
    if filters.timeframe:
        query = query.filter(Leaderboard.timeframe == filters.timeframe)
    if filters.is_active is not None:
        query = query.filter(Leaderboard.is_active == filters.is_active)
    
    return query.offset(filters.offset).limit(filters.limit).all()

def update_leaderboard(db: Session, leaderboard_id: int, leaderboard_update: LeaderboardUpdate) -> Optional[Leaderboard]:
    """Update a leaderboard"""
    db_leaderboard = db.query(Leaderboard).filter(Leaderboard.leaderboard_id == leaderboard_id).first()
    if not db_leaderboard:
        return None
    
    update_data = leaderboard_update.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(db_leaderboard, field, value)
    
    db_leaderboard.last_updated = datetime.utcnow()
    db.commit()
    db.refresh(db_leaderboard)
    return db_leaderboard

def delete_leaderboard(db: Session, leaderboard_id: int) -> bool:
    """Delete a leaderboard"""
    db_leaderboard = db.query(Leaderboard).filter(Leaderboard.leaderboard_id == leaderboard_id).first()
    if not db_leaderboard:
        return False
    
    db.delete(db_leaderboard)
    db.commit()
    return True

# Student Progress CRUD operations
def create_or_update_student_progress(db: Session, progress: StudentProgressCreate) -> StudentProgress:
    """Create or update student progress"""
    existing = db.query(StudentProgress).filter(
        and_(
            StudentProgress.user_id == progress.user_id,
            StudentProgress.course_id == progress.course_id
        )
    ).first()
    
    if existing:
        # Update existing progress
        for field, value in progress.model_dump().items():
            if hasattr(existing, field) and value is not None:
                setattr(existing, field, value)
        existing.last_updated = datetime.utcnow()
        db.commit()
        db.refresh(existing)
        return existing
    else:
        # Create new progress
        db_progress = StudentProgress(**progress.model_dump())
        db.add(db_progress)
        db.commit()
        db.refresh(db_progress)
        return db_progress

def get_student_progress(db: Session, user_id: int, course_id: int) -> Optional[StudentProgress]:
    """Get student progress for a specific user and course"""
    return db.query(StudentProgress).filter(
        and_(
            StudentProgress.user_id == user_id,
            StudentProgress.course_id == course_id
        )
    ).first()

def get_students_progress(db: Session, filters: StudentProgressFilter) -> List[StudentProgress]:
    """Get multiple student progress records with filtering"""
    query = db.query(StudentProgress).options(joinedload(StudentProgress.user))
    
    if filters.course_id:
        query = query.filter(StudentProgress.course_id == filters.course_id)
    if filters.user_id:
        query = query.filter(StudentProgress.user_id == filters.user_id)
    if filters.min_exp:
        query = query.filter(StudentProgress.total_exp >= filters.min_exp)
    if filters.min_quests:
        query = query.filter(StudentProgress.quests_completed >= filters.min_quests)
    
    return query.offset(filters.offset).limit(filters.limit).all()

# Experience Points CRUD operations
def create_experience_point(db: Session, exp_point: ExperiencePointCreate) -> ExperiencePoint:
    """Create a new experience point record"""
    db_exp = ExperiencePoint(**exp_point.model_dump())
    db.add(db_exp)
    db.commit()
    db.refresh(db_exp)
    
    # Update student progress
    if exp_point.course_id:
        update_student_total_exp(db, exp_point.user_id, exp_point.course_id)
    
    return db_exp

def update_student_total_exp(db: Session, user_id: int, course_id: int):
    """Update student's total experience points"""
    total_exp = db.query(func.sum(ExperiencePoint.amount)).filter(
        and_(
            ExperiencePoint.user_id == user_id,
            ExperiencePoint.course_id == course_id
        )
    ).scalar() or 0
    
    progress = get_student_progress(db, user_id, course_id)
    if progress:
        progress.total_exp = total_exp
        progress.last_updated = datetime.utcnow()
    else:
        # Create new progress record
        progress_data = StudentProgressCreate(
            user_id=user_id,
            course_id=course_id,
            total_exp=total_exp
        )
        create_or_update_student_progress(db, progress_data)
    
    db.commit()

# Leaderboard calculation and ranking functions
def calculate_leaderboard_rankings(db: Session, leaderboard_id: int) -> List[LeaderboardEntry]:
    """Calculate and update leaderboard rankings based on the metric type"""
    leaderboard = get_leaderboard(db, leaderboard_id)
    if not leaderboard:
        return []
    
    # Clear existing entries
    db.query(LeaderboardEntry).filter(LeaderboardEntry.leaderboard_id == leaderboard_id).delete()
    
    # Calculate scores based on metric type and timeframe
    scores = calculate_scores_for_leaderboard(db, leaderboard)
    
    # Create new entries with rankings
    entries = []
    for rank, (user_id, score) in enumerate(scores, 1):
        entry = LeaderboardEntry(
            leaderboard_id=leaderboard_id,
            user_id=user_id,
            score=Decimal(str(score)),
            rank=rank
        )
        db.add(entry)
        entries.append(entry)
    
    # Update leaderboard last_updated
    leaderboard.last_updated = datetime.utcnow()
    
    db.commit()
    return entries

def calculate_scores_for_leaderboard(db: Session, leaderboard: Leaderboard) -> List[tuple]:
    """Calculate scores for users based on leaderboard configuration"""
    metric_type = leaderboard.metric_type
    timeframe = leaderboard.timeframe
    course_id = leaderboard.course_id
    
    # Calculate date filter based on timeframe
    date_filter = get_date_filter_for_timeframe(timeframe)
    
    if metric_type == "exp":
        return calculate_exp_scores(db, course_id, date_filter)
    elif metric_type == "quests_completed":
        return calculate_quest_completion_scores(db, course_id, date_filter)
    elif metric_type == "badges_earned":
        return calculate_badge_scores(db, course_id, date_filter)
    elif metric_type == "engagement_score":
        return calculate_engagement_scores(db, course_id)
    else:
        return []

def get_date_filter_for_timeframe(timeframe: str) -> Optional[datetime]:
    """Get date filter based on timeframe"""
    now = datetime.utcnow()
    
    if timeframe == "weekly":
        return now - timedelta(days=7)
    elif timeframe == "monthly":
        return now - timedelta(days=30)
    elif timeframe == "all_time":
        return None
    else:
        return None

def calculate_exp_scores(db: Session, course_id: Optional[int], date_filter: Optional[datetime]) -> List[tuple]:
    """Calculate experience point scores"""
    query = db.query(
        ExperiencePoint.user_id,
        func.sum(ExperiencePoint.amount).label('total_exp')
    )
    
    if course_id:
        query = query.filter(ExperiencePoint.course_id == course_id)
    
    if date_filter:
        query = query.filter(ExperiencePoint.awarded_at >= date_filter)
    
    results = query.group_by(ExperiencePoint.user_id).order_by(desc('total_exp')).all()
    return [(user_id, total_exp) for user_id, total_exp in results]

def calculate_quest_completion_scores(db: Session, course_id: Optional[int], date_filter: Optional[datetime]) -> List[tuple]:
    """Calculate quest completion scores"""
    # This would need to be implemented based on your quest completion tracking
    # For now, using student_progress table
    query = db.query(
        StudentProgress.user_id,
        StudentProgress.quests_completed
    )
    
    if course_id:
        query = query.filter(StudentProgress.course_id == course_id)
    
    if date_filter:
        query = query.filter(StudentProgress.last_updated >= date_filter)
    
    results = query.order_by(desc(StudentProgress.quests_completed)).all()
    return [(user_id, quests_completed) for user_id, quests_completed in results]

def calculate_badge_scores(db: Session, course_id: Optional[int], date_filter: Optional[datetime]) -> List[tuple]:
    """Calculate badge earned scores"""
    query = db.query(
        StudentProgress.user_id,
        StudentProgress.badges_earned
    )
    
    if course_id:
        query = query.filter(StudentProgress.course_id == course_id)
    
    if date_filter:
        query = query.filter(StudentProgress.last_updated >= date_filter)
    
    results = query.order_by(desc(StudentProgress.badges_earned)).all()
    return [(user_id, badges_earned) for user_id, badges_earned in results]

def calculate_engagement_scores(db: Session, course_id: Optional[int]) -> List[tuple]:
    """Calculate engagement scores"""
    query = db.query(
        StudentProgress.user_id,
        StudentProgress.engagement_score
    ).filter(StudentProgress.engagement_score.isnot(None))
    
    if course_id:
        query = query.filter(StudentProgress.course_id == course_id)
    
    results = query.order_by(desc(StudentProgress.engagement_score)).all()
    return [(user_id, engagement_score) for user_id, engagement_score in results if engagement_score]

# Top students functions
    """Get top students for a specific course across all metrics"""
    # Get top students by experience points
    exp_query = db.query(
        StudentProgress.user_id,
        StudentProgress.total_exp,
        StudentProgress.quests_completed,
        StudentProgress.badges_earned,
        User.username,
        User.first_name,
        User.last_name,
        User.profile_image_url
    ).join(User, StudentProgress.user_id == User.id).filter(
        StudentProgress.course_id == course_id
    ).order_by(desc(StudentProgress.total_exp)).limit(limit)
    
    results = exp_query.all()
    
    top_students = []
    for i, (user_id, total_exp, quests_completed, badges_earned, username, first_name, last_name, profile_image_url) in enumerate(results, 1):
        top_students.append({
            "user_id": user_id,
            "username": username,
            "first_name": first_name,
            "last_name": last_name,
            "profile_image_url": profile_image_url,
            "score": Decimal(str(total_exp)) if total_exp else Decimal('0'),
            "rank": i,
            "total_exp": total_exp,
            "quests_completed": quests_completed,
            "badges_earned": badges_earned
        })
    
    return top_students

def get_top_students_by_course(db: Session, course_id: int, limit: int = 10, timeframe: str = "all_time") -> List[Dict[str, Any]]:
    """Get top students for a specific course across all metrics, filtered by time frame"""
    from datetime import datetime, timedelta
    # Calculate date filter
    now = datetime.utcnow()
    if timeframe == "daily":
        start_date = now.replace(hour=0, minute=0, second=0, microsecond=0)
    elif timeframe == "weekly":
        start_date = (now - timedelta(days=now.weekday())).replace(hour=0, minute=0, second=0, microsecond=0)
    elif timeframe == "monthly":
        start_date = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    else:
        start_date = None
    exp_query = db.query(
        StudentProgress.user_id,
        StudentProgress.total_exp,
        StudentProgress.quests_completed,
        StudentProgress.badges_earned,
        User.username,
        User.first_name,
        User.last_name,
        User.profile_image_url
    ).join(User, StudentProgress.user_id == User.id).filter(
        StudentProgress.course_id == course_id
    )
    if start_date:
        exp_query = exp_query.filter(StudentProgress.last_activity >= start_date)
    exp_query = exp_query.order_by(desc(StudentProgress.total_exp)).limit(limit)
    results = exp_query.all()
    top_students = []
    for i, (user_id, total_exp, quests_completed, badges_earned, username, first_name, last_name, profile_image_url) in enumerate(results, 1):
        top_students.append({
            "user_id": user_id,
            "username": username,
            "first_name": first_name,
            "last_name": last_name,
            "profile_image_url": profile_image_url,
            "score": Decimal(str(total_exp)) if total_exp else Decimal('0'),
            "rank": i,
            "total_exp": total_exp,
            "quests_completed": quests_completed,
            "badges_earned": badges_earned
        })
    return top_students
    """Get global top students across all courses"""
    query = db.query(
        StudentProgress.user_id,
        func.sum(StudentProgress.total_exp).label('total_exp'),
        func.sum(StudentProgress.quests_completed).label('total_quests'),
        func.sum(StudentProgress.badges_earned).label('total_badges'),
        User.username,
        User.first_name,
        User.last_name,
        User.profile_image_url
    ).join(User, StudentProgress.user_id == User.id).group_by(
        StudentProgress.user_id,
        User.username,
        User.first_name,
        User.last_name,
        User.profile_image_url
    ).order_by(desc('total_exp')).limit(limit)
    
    results = query.all()
    
    top_students = []
    for i, (user_id, total_exp, total_quests, total_badges, username, first_name, last_name, profile_image_url) in enumerate(results, 1):
        top_students.append({
            "user_id": user_id,
            "username": username,
            "first_name": first_name,
            "last_name": last_name,
            "profile_image_url": profile_image_url,
            "score": Decimal(str(total_exp)) if total_exp else Decimal('0'),
            "rank": i,
            "total_exp": total_exp,
            "quests_completed": total_quests,
            "badges_earned": total_badges
        })
    
    return top_students 
def get_global_top_students(db: Session, limit: int = 20, timeframe: str = "all_time") -> List[Dict[str, Any]]:
    """Get global top students across all courses, filtered by time frame"""
    from datetime import datetime, timedelta
    now = datetime.utcnow()
    if timeframe == "daily":
        start_date = now.replace(hour=0, minute=0, second=0, microsecond=0)
    elif timeframe == "weekly":
        start_date = (now - timedelta(days=now.weekday())).replace(hour=0, minute=0, second=0, microsecond=0)
    elif timeframe == "monthly":
        start_date = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    else:
        start_date = None
    query = db.query(
        StudentProgress.user_id,
        func.sum(StudentProgress.total_exp).label('total_exp'),
        func.sum(StudentProgress.quests_completed).label('total_quests'),
        func.sum(StudentProgress.badges_earned).label('total_badges'),
        User.username,
        User.first_name,
        User.last_name,
        User.profile_image_url
    ).join(User, StudentProgress.user_id == User.id)
    if start_date:
        query = query.filter(StudentProgress.last_activity >= start_date)
    query = query.group_by(
        StudentProgress.user_id,
        User.username,
        User.first_name,
        User.last_name,
        User.profile_image_url
    ).order_by(desc('total_exp')).limit(limit)
    results = query.all()
    top_students = []
    for i, (user_id, total_exp, total_quests, total_badges, username, first_name, last_name, profile_image_url) in enumerate(results, 1):
        top_students.append({
            "user_id": user_id,
            "username": username,
            "first_name": first_name,
            "last_name": last_name,
            "profile_image_url": profile_image_url,
            "score": Decimal(str(total_exp)) if total_exp else Decimal('0'),
            "rank": i,
            "total_exp": total_exp,
            "quests_completed": total_quests,
            "badges_earned": total_badges
        })
    return top_students