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
    1. Checks if the token's role claim is "admin", OR
    2. Checks if the token's email is in the ADMIN_EMAILS whitelist.
    """
    role = payload.get("role")
    email = (payload.get("email") or payload.get("sub") or "").strip().lower()
    
    allowed_admin_emails = settings.admin_emails_list
    is_whitelisted = bool(allowed_admin_emails and email in allowed_admin_emails)
    is_admin_role = (role == "admin")

    if not (is_admin_role or is_whitelisted):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access forbidden: Admin permissions required."
        )
        
    return payload
