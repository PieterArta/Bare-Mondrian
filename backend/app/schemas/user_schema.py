from datetime import datetime
from typing import Optional

from pydantic import BaseModel, EmailStr, Field, ConfigDict


# ---------------------------------------------------------------------------
# Register
# ---------------------------------------------------------------------------
class UserRegister(BaseModel):
    full_name: str = Field(..., max_length=255, description="User's full name")
    email: EmailStr = Field(..., description="User's email address")
    phone: Optional[str] = Field(None, max_length=50, description="User's phone number")
    password: str = Field(..., min_length=6, description="Plain-text password (min 6 chars)")


# ---------------------------------------------------------------------------
# Login
# ---------------------------------------------------------------------------
class UserLogin(BaseModel):
    email: EmailStr = Field(..., description="Registered email address")
    password: str = Field(..., description="Plain-text password")


# ---------------------------------------------------------------------------
# Google OAuth Login
# ---------------------------------------------------------------------------
class GoogleAuthPayload(BaseModel):
    credential: Optional[str] = Field(None, description="Google OAuth 2.0 ID Token credential")
    id_token: Optional[str] = Field(None, description="Google OAuth 2.0 ID Token credential (alias)")

    @property
    def token(self) -> str:
        return self.credential or self.id_token or ""


# ---------------------------------------------------------------------------
# Response  (never exposes hashed_password)
# ---------------------------------------------------------------------------
class UserResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    full_name: Optional[str]
    email: str
    phone: Optional[str]
    role: str
    created_at: datetime


# ---------------------------------------------------------------------------
# Auth response wrapper (token + user info)
# ---------------------------------------------------------------------------
class AuthResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserResponse
