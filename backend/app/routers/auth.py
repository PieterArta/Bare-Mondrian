import secrets
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from google.oauth2 import id_token
from google.auth.transport import requests

from app.core.config import settings
from app.core.database import get_db
from app.core.security import get_password_hash, verify_password, create_access_token
from app.models.user import User
from app.schemas.user_schema import AuthResponse, GoogleAuthPayload, UserLogin, UserRegister, UserResponse

router = APIRouter()


# ---------------------------------------------------------------------------
# GET /api/auth/  — health-check
# ---------------------------------------------------------------------------
@router.get("/", summary="Auth status check")
def get_auth_status():
    return {"message": "Auth endpoint is active"}


# ---------------------------------------------------------------------------
# POST /api/auth/register
# ---------------------------------------------------------------------------
@router.post(
    "/register",
    response_model=AuthResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Register a new customer account",
)
def register(payload: UserRegister, db: Session = Depends(get_db)):
    # Prevent duplicate emails
    existing = db.query(User).filter(User.email == payload.email.lower()).first()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="An account with this email address already exists.",
        )

    hashed_pw = get_password_hash(payload.password)

    user = User(
        full_name=payload.full_name,
        email=payload.email.lower(),
        phone=payload.phone,
        hashed_password=hashed_pw,
        role="customer",
    )
    db.add(user)
    db.commit()
    db.refresh(user)

    # Determine effective role (admin-whitelist check)
    effective_role = _resolve_role(user.email, user.role)

    token = create_access_token(
        data={"sub": user.email, "email": user.email, "role": effective_role}
    )

    return AuthResponse(
        access_token=token,
        user=UserResponse.model_validate(user),
    )


# ---------------------------------------------------------------------------
# POST /api/auth/login
# ---------------------------------------------------------------------------
@router.post(
    "/login",
    response_model=AuthResponse,
    summary="Login and receive a JWT token",
)
def login(payload: UserLogin, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == payload.email.lower()).first()

    if not user or not verify_password(payload.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    # Check admin whitelist to promote role if applicable
    effective_role = _resolve_role(user.email, user.role)

    token = create_access_token(
        data={
            "sub": user.email,
            "email": user.email,
            "role": effective_role,
            "name": user.full_name,
        }
    )

    return AuthResponse(
        access_token=token,
        user=UserResponse.model_validate(user),
    )


# ---------------------------------------------------------------------------
# POST /api/auth/google
# ---------------------------------------------------------------------------
@router.post(
    "/google",
    response_model=AuthResponse,
    summary="Authenticate via Google OAuth 2.0 ID Token",
)
def google_login(payload: GoogleAuthPayload, db: Session = Depends(get_db)):
    token_str = payload.token
    if not token_str:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Missing Google credential or id_token.",
        )

    # Verify Google ID token against Google Client ID
    try:
        id_info = id_token.verify_oauth2_token(
            token_str,
            requests.Request(),
            audience=settings.GOOGLE_CLIENT_ID if settings.GOOGLE_CLIENT_ID != "GOOGLE_CLIENT_ID_PLACEHOLDER" else None,
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Invalid or expired Google token: {str(e)}",
            headers={"WWW-Authenticate": "Bearer"},
        )

    email = id_info.get("email")
    if not email:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Google token does not contain a valid email address.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    email_clean = email.strip().lower()
    full_name = id_info.get("name") or email_clean.split("@")[0]

    # Check if user already exists in database
    user = db.query(User).filter(User.email == email_clean).first()

    if not user:
        # TODO: If custom database/user model attributes change, wire them up here
        hashed_pw = get_password_hash("GOOGLE_OAUTH_" + secrets.token_hex(16))
        user = User(
            full_name=full_name,
            email=email_clean,
            phone=None,
            hashed_password=hashed_pw,
            role="customer",
        )
        db.add(user)
        db.commit()
        db.refresh(user)

    effective_role = _resolve_role(user.email, user.role)

    token = create_access_token(
        data={
            "sub": user.email,
            "email": user.email,
            "role": effective_role,
            "name": user.full_name,
        }
    )

    return AuthResponse(
        access_token=token,
        user=UserResponse.model_validate(user),
    )


# ---------------------------------------------------------------------------
# Internal helpers
# ---------------------------------------------------------------------------
def _resolve_role(email: str, stored_role: str) -> str:
    """
    Returns 'admin' if the email is in the ADMIN_EMAILS whitelist,
    otherwise returns the role stored in the database.
    """
    if email.strip().lower() in settings.admin_emails_list:
        return "admin"
    return stored_role
