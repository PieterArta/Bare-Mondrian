from typing import Dict, Any
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from app.core.config import settings
from app.core.security import decode_token

# HTTP Bearer security scheme for Authorization header extraction
security_bearer = HTTPBearer(auto_error=True)


def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security_bearer)
) -> Dict[str, Any]:
    """
    Extracts and validates the JWT access token from the Authorization Bearer header.
    Returns the decoded token payload dict if valid.
    """
    token = credentials.credentials
    payload = decode_token(token)
    
    if not payload:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Could not validate credentials or token has expired.",
            headers={"WWW-Authenticate": "Bearer"},
        )
        
    return payload


def require_admin(
    payload: Dict[str, Any] = Depends(get_current_user)
) -> Dict[str, Any]:
    """
    Dependency that enforces admin permissions:
    1. Checks if the token's role claim is "admin".
    2. Checks if the token's email is present in the ADMIN_EMAILS whitelist from config/env.
    Raises a 403 Forbidden error if either check fails.
    """
    role = payload.get("role")
    email = (payload.get("email") or payload.get("sub") or "").strip().lower()
    
    # Check 1: Role check
    if role != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access forbidden: Admin role required."
        )
        
    # Check 2: Email whitelist check
    allowed_admin_emails = settings.admin_emails_list
    if allowed_admin_emails and email not in allowed_admin_emails:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access forbidden: Email is not whitelisted as administrator."
        )
        
    return payload
