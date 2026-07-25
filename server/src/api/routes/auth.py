"""
auralis/src/api/routes/auth.py
────────────────────────────────
POST /auth/token — OAuth2 password-grant token endpoint.

Returns a short-lived HS256 JWT that callers must include in the
Authorization header of every protected endpoint:

    Authorization: Bearer <token>

The JWT payload contains:
    sub   : user UUID (string)
    email : user email
    role  : "admin" | "sales_rep" | "viewer"
    exp   : expiry timestamp
"""

from __future__ import annotations

import logging
from datetime import timedelta

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm

from src.api.auth import (
    ACCESS_TOKEN_EXPIRE_MINUTES,
    authenticate_user,
    create_access_token,
)
from src.api.schemas import TokenResponse

logger = logging.getLogger("auralis.api.auth")
router = APIRouter(prefix="/auth", tags=["Authentication"])


@router.post(
    "/token",
    response_model=TokenResponse,
    summary="Obtain a Bearer access token (OAuth2 password grant).",
    description=(
        "Exchange email + password credentials for a signed JWT.\n\n"
        "Send the returned `access_token` in every subsequent request as:\n\n"
        "```\nAuthorization: Bearer <access_token>\n```\n\n"
        "Tokens expire after `ACCESS_TOKEN_EXPIRE_MINUTES` minutes "
        "(default: 60). Re-request a token when it expires."
    ),
    responses={
        401: {"description": "Incorrect email or password."},
    },
)
async def login_for_access_token(
    form_data: OAuth2PasswordRequestForm = Depends(),
) -> TokenResponse:
    """
    OAuth2 password-grant token endpoint.

    FastAPI's ``OAuth2PasswordRequestForm`` reads the body as
    ``application/x-www-form-urlencoded`` with fields ``username`` and
    ``password`` (standard OAuth2 naming; we treat ``username`` as email).
    """
    user = await authenticate_user(
        email=form_data.username,  # OAuth2 spec calls the field "username"
        password=form_data.password,
    )
    if user is None:
        logger.warning("Failed login attempt for: %s", form_data.username)
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    token = create_access_token(
        data={
            "sub": user.id,
            "email": user.email,
            "role": user.role,
        },
        expires_delta=timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES),
    )

    logger.info("Issued token for %s (role=%s)", user.email, user.role)
    return TokenResponse(access_token=token, token_type="bearer")
