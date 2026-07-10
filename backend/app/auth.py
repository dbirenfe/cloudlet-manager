"""
Authentication middleware for RHBK (Keycloak) integration.
When Keycloak is configured, validates OIDC tokens and checks group membership.
When not configured, allows all requests (dev mode).
"""

from fastapi import Depends, HTTPException, Request, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from jose import jwt, JWTError
import httpx
from app.config import get_settings

security = HTTPBearer(auto_error=False)

_jwks_cache: dict | None = None


async def _get_jwks(keycloak_url: str, realm: str) -> dict:
    global _jwks_cache
    if _jwks_cache:
        return _jwks_cache
    url = f"{keycloak_url}/realms/{realm}/protocol/openid-connect/certs"
    async with httpx.AsyncClient(timeout=10) as client:
        resp = await client.get(url)
        resp.raise_for_status()
        _jwks_cache = resp.json()
        return _jwks_cache


async def get_current_user(
    request: Request,
    credentials: HTTPAuthorizationCredentials | None = Depends(security),
) -> dict:
    s = get_settings()

    if not s.keycloak_url or not s.keycloak_realm:
        return {"sub": "dev-user", "groups": [], "preferred_username": "dev-user"}

    if not credentials:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing authentication token",
        )

    try:
        jwks = await _get_jwks(s.keycloak_url, s.keycloak_realm)
        unverified_header = jwt.get_unverified_header(credentials.credentials)
        key = None
        for k in jwks.get("keys", []):
            if k["kid"] == unverified_header.get("kid"):
                key = k
                break
        if not key:
            raise HTTPException(status_code=401, detail="Invalid token signing key")

        payload = jwt.decode(
            credentials.credentials,
            key,
            algorithms=["RS256"],
            audience=s.keycloak_client_id,
            options={
                "verify_aud": bool(s.keycloak_client_id),
                "verify_at_hash": False,
            },
        )
    except JWTError as e:
        raise HTTPException(status_code=401, detail=f"Token validation failed: {e}")

    if s.allowed_groups:
        user_groups = payload.get("groups", [])
        if not any(g in s.allowed_groups for g in user_groups):
            raise HTTPException(status_code=403, detail="User not in allowed groups")

    return payload
