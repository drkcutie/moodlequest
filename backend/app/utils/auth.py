from datetime import datetime, timedelta
from typing import Optional, Union, Dict, Any
from jose import jwt, JWTError
from passlib.context import CryptContext
from fastapi import Depends, HTTPException, status, Request
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.orm import Session
from app.database.connection import get_db
from app.models.user import User
from app.models.auth import Token as TokenModel
from app.schemas.auth import TokenData
import logging

logger = logging.getLogger(__name__)

# Secret key for JWT - should be loaded from environment in production
SECRET_KEY = "09d25e094faa6ca2556c818166b7a9563b93f7099f6f0f4caa6cf63b88e8d3e7"
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 30
REFRESH_TOKEN_EXPIRE_DAYS = 7

# Password hashing
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

# OAuth2 bearer token scheme
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="api/auth/token")


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verify if the plain password matches the hashed password."""
    return pwd_context.verify(plain_password, hashed_password)


def get_password_hash(password: str) -> str:
    """Hash a password."""
    return pwd_context.hash(password)


def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    """
    Create a JWT access token.
    
    Args:
        data: Data to encode in the JWT
        expires_delta: Token expiration time
        
    Returns:
        JWT token string
    """
    to_encode = data.copy()
    
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
        
    to_encode.update({"exp": expire})
    
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)


def create_refresh_token(data: dict) -> str:
    """
    Create a JWT refresh token with longer expiry.
    
    Args:
        data: Data to encode in the JWT
        
    Returns:
        JWT refresh token string
    """
    to_encode = data.copy()
    expire = datetime.utcnow() + timedelta(days=REFRESH_TOKEN_EXPIRE_DAYS)
    to_encode.update({"exp": expire})
    
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)


async def get_current_user(
    token: str = Depends(oauth2_scheme), 
    db: Session = Depends(get_db)
) -> User:
    """
    Validate the access token and return the current user.
    
    Args:
        token: JWT token
        db: Database session
        
    Returns:
        Current user or raises an exception
    """
    # ===========================================================================
    # TEMPORARY MODIFICATION FOR DEVELOPMENT: Bypassing authentication
    # This code automatically returns a dummy teacher user without authentication.
    # REMEMBER TO RESTORE THE ORIGINAL CODE WHEN AUTHENTICATION IS NEEDED AGAIN.
    # ===========================================================================
    
    # Look for an existing teacher user
    dummy_user = db.query(User).filter(User.role == "teacher").first()
    
    # If no teacher user exists, create one
    if not dummy_user:
        dummy_user = User(
            username="dev-teacher",
            email="dev-teacher@example.com",
            password_hash=get_password_hash("password"),  # Using a simple password for development
            first_name="Development",
            last_name="Teacher",
            role="teacher",
            is_active=True,
            user_token="dev-token-123",  # Dummy token for Moodle API calls
            moodle_user_id=1  # Dummy Moodle user ID
        )
        db.add(dummy_user)
        db.commit()
        db.refresh(dummy_user)
        logger.warning("Created dummy teacher user for development purposes")
    
    return dummy_user
    
    # ===========================================================================
    # ORIGINAL AUTHENTICATION CODE - COMMENTED OUT TEMPORARILY
    # Uncomment this and remove the dummy user code above when authentication is needed again
    # ===========================================================================
    """
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    
    try:
        # Decode the JWT
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        username: str = payload.get("sub")
        
        if username is None:
            raise credentials_exception
            
        token_data = TokenData(username=username)
        
    except JWTError:
        raise credentials_exception
        
    # Get the user from the database
    user = db.query(User).filter(User.username == token_data.username).first()
    
    if user is None:
        raise credentials_exception
        
    # Check if token is in the blacklist
    db_token = db.query(TokenModel).filter(
        TokenModel.token == token,
        TokenModel.revoked == True
    ).first()
    
    if db_token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token has been revoked",
            headers={"WWW-Authenticate": "Bearer"},
        )
        
    return user
    """


async def get_current_active_user(
    current_user: User = Depends(get_current_user)
) -> User:
    """
    Check if the current user is active.
    
    Args:
        current_user: Current authenticated user
        
    Returns:
        Current active user or raises an exception
    """
    if not current_user.is_active:
        raise HTTPException(status_code=400, detail="Inactive user")
        
    return current_user


async def get_current_user_from_moodle_token(
    request: Request,
    db: Session = Depends(get_db)
) -> User:
    """
    Get current user from moodleToken cookie or Authorization header.
    
    Args:
        request: FastAPI request object to access cookies and headers
        db: Database session
        
    Returns:
        Current user based on moodleToken
    """
    # Try to get moodleToken from cookies first
    token = request.cookies.get("moodleToken")
    
    # If not in cookies, try Authorization header as fallback for development
    if not token:
        auth_header = request.headers.get("Authorization")
        if auth_header and auth_header.startswith("Bearer "):
            token = auth_header.replace("Bearer ", "")
    
    if not token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="No Moodle token found in cookies or Authorization header. Please login first."
        )

    # Look up user by their moodle token
    user = db.query(User).filter(User.user_token == token).first()
    
    if not user:
        # For development/testing, create or use a dummy user if no user found
        logger.warning(f"No user found for token {token[:10]}..., using dummy user for development")
        dummy_user = db.query(User).filter(User.username == "dev-student").first()
        
        if not dummy_user:
            # Create dummy student user for testing
            dummy_user = User(
                username="dev-student",
                email="dev-student@example.com",
                password_hash=get_password_hash("password"),
                first_name="Development",
                last_name="Student",
                role="student",
                is_active=True,
                user_token=token,
                moodle_user_id=2
            )
            db.add(dummy_user)
            db.commit()
            db.refresh(dummy_user)
            logger.info("Created dummy student user for testing virtual pets")
        else:
            # Update dummy user's token
            dummy_user.user_token = token
            db.commit()
            db.refresh(dummy_user)
        
        return dummy_user
    
    logger.info(f"Authenticated user: {user.username} (ID: {user.id}, Moodle ID: {user.moodle_user_id})")
    return user


def store_token(
    db: Session, 
    token: str, 
    user_id: int, 
    token_type: str, 
    expires_at: datetime
) -> TokenModel:
    """
    Store a token in the database.
    
    Args:
        db: Database session
        token: Token string
        user_id: User ID
        token_type: Token type ("access" or "refresh")
        expires_at: Token expiration datetime
        
    Returns:
        Created token model
    """
    # Check if token already exists in database
    existing_token = db.query(TokenModel).filter(TokenModel.token == token).first()
    
    if existing_token:
        # Token already exists, update its properties
        existing_token.user_id = user_id
        existing_token.token_type = token_type
        existing_token.expires_at = expires_at
        existing_token.revoked = False  # Ensure it's not revoked
        db.commit()
        db.refresh(existing_token)
        return existing_token
    
    # Token doesn't exist, create a new one
    db_token = TokenModel(
        token=token,
        user_id=user_id,
        token_type=token_type,
        expires_at=expires_at
    )
    
    db.add(db_token)
    db.commit()
    db.refresh(db_token)
    
    return db_token


def revoke_token(db: Session, token: str) -> bool:
    """
    Revoke a token by marking it as revoked in the database.
    
    Args:
        db: Database session
        token: Token string to revoke
        
    Returns:
        True if token was revoked, False otherwise
    """
    db_token = db.query(TokenModel).filter(TokenModel.token == token).first()
    
    if db_token:
        db_token.revoked = True
        db.commit()
        return True
        
    return False


def get_role_required(required_role: str):
    """
    Create a dependency that requires a specific role.
    
    Args:
        required_role: Required role (e.g., "admin", "teacher", "student")
        
    Returns:
        Dependency function
    """
    async def role_checker(current_user: User = Depends(get_current_active_user)):
        if required_role == "admin" and current_user.role != "admin":
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Insufficient permissions"
            )
            
        if required_role == "teacher" and current_user.role not in ["admin", "teacher"]:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Insufficient permissions"
            )
            
        return current_user
        
    return role_checker 


async def validate_moodle_token(token: str, moodle_service: Any) -> bool:
    """
    Validate if a Moodle token is still valid.
    
    Args:
        token: Moodle token to validate
        moodle_service: Initialized MoodleService instance
        
    Returns:
        True if token is valid, False otherwise
    """
    if not token:
        logger.warning("No token provided for validation")
        return False
    
    logger.info(f"Validating Moodle token against {moodle_service.base_url}")
    
    try:
        user_info_result = await moodle_service.get_user_info(token)
        is_valid = user_info_result.get("success", False)
        
        if is_valid:
            logger.info(f"Token validation successful")
        else:
            error_msg = user_info_result.get("error", "Unknown error")
            logger.warning(f"Token validation failed: {error_msg}")
            
        return is_valid
    except Exception as exc:
        logger.error(f"Error validating token: {str(exc)}")
        return False 