from sqlalchemy.orm import Session
from app.models.user import User
from app.models.course import Course
from app.models.auth import MoodleConfig
from passlib.context import CryptContext
import os

# Password hashing
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

def seed_initial_data(db: Session):
    """Seed initial data for testing purposes"""
    # Check if we already have users
    if db.query(User).count() > 0:
        # If we have users, just update the Moodle config if needed
        moodle_url = os.getenv("MOODLE_URL")
        if moodle_url:
            moodle_config = db.query(MoodleConfig).first()
            if moodle_config:
                moodle_config.base_url = moodle_url
                db.commit()
        return  # Skip the rest of data seeding
    
    # Create a teacher user
    teacher = User(
        username="teacher1",
        email="teacher@example.com",
        password_hash=pwd_context.hash("password123"),
        first_name="Teacher",
        last_name="User",
        role="teacher"
    )
    db.add(teacher)
    db.flush()  # So we get the ID
    
    # Create a student user
    student = User(
        username="student1",
        email="student@example.com",
        password_hash=pwd_context.hash("password123"),
        first_name="Student",
        last_name="User",
        role="student"
    )
    db.add(student)
    db.flush()
    
    # Add a default Moodle configuration
    if db.query(MoodleConfig).count() == 0:
        moodle_config = MoodleConfig(
            base_url=os.getenv("MOODLE_URL", "http://localhost:8080"),
            service_name="modquest"
        )
        db.add(moodle_config)
        db.flush()
    
    # Create sample courses
    courses = [
        Course(
            title="Introduction to Computer Science",
            description="Learn the fundamentals of computer science and programming",
            course_code="CS101",
            teacher_id=teacher.id
        ),
        Course(
            title="Web Development Fundamentals",
            description="Build and design websites using HTML, CSS and JavaScript",
            course_code="WEB101",
            teacher_id=teacher.id
        ),
        Course(
            title="Data Structures and Algorithms",
            description="Study common data structures and algorithms used in computer science",
            course_code="CS201",
            teacher_id=teacher.id
        ),
        Course(
            title="Mobile App Development",
            description="Create mobile apps for iOS and Android platforms",
            course_code="MOB101",
            teacher_id=teacher.id
        ),
        Course(
            title="Artificial Intelligence Basics",
            description="Introduction to artificial intelligence and machine learning",
            course_code="AI101",
            teacher_id=teacher.id
        )
    ]
    
    for course in courses:
        db.add(course)
    
    db.commit() 