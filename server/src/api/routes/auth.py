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
import os
from datetime import timedelta

from fastapi import APIRouter, Body, Depends, HTTPException, Request, Response, status
from fastapi.responses import RedirectResponse
from fastapi.security import OAuth2PasswordRequestForm

from src.api.auth import (
    ACCESS_TOKEN_EXPIRE_MINUTES,
    authenticate_user,
    build_google_authorize_url,
    create_access_token,
    create_user,
    exchange_google_code,
    get_user_by_email,
)
from src.api.schemas import SignupRequest, TokenResponse, UserResponse
from src.utils.limiter import limiter

logger = logging.getLogger("auralis.api.auth")
router = APIRouter(prefix="/auth", tags=["Authentication"])


@router.post(
    "/signup",
    response_model=UserResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create an email/password account.",
    responses={
        409: {"description": "An account with this email already exists."},
    },
)
@limiter.limit("5/minute")
async def signup_with_email(
    request: Request,
    payload: SignupRequest = Body(...),
) -> UserResponse:
    user = await create_user(
        email=payload.email.strip().lower(), password=payload.password
    )
    return UserResponse(id=user.id, email=user.email, role=user.role)


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
@limiter.limit("5/minute")
async def login_for_access_token(
    request: Request,
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
            "workspace_id": user.workspace_id,
        },
        expires_delta=timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES),
    )

    logger.info("Issued token for %s (role=%s)", user.email, user.role)
    return TokenResponse(access_token=token, token_type="bearer")


@router.get(
    "/google/start",
    summary="Begin Google OAuth sign-in or sign-up.",
)
async def google_oauth_start() -> Response:
    authorize_url = build_google_authorize_url(state="auralis-google")
    return RedirectResponse(
        authorize_url, status_code=status.HTTP_307_TEMPORARY_REDIRECT
    )


@router.get(
    "/google/callback",
    summary="Google OAuth callback endpoint.",
)
async def google_oauth_callback(
    code: str | None = None, state: str | None = None
) -> Response:
    if not code:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Missing Google OAuth code.",
        )

    claims = await exchange_google_code(code)
    email = (claims.get("email") or "").strip().lower()
    email_verified = bool(claims.get("email_verified"))

    if not email or not email_verified:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Google account email is not verified.",
        )

    existing = await get_user_by_email(email)
    if existing is None:
        user = await create_user(email=email, password=f"google:{claims.get('sub')}")
    else:
        from src.api.auth import User

        user = User(
            id=existing["id"],
            email=existing["email"],
            role=existing["role"],
            workspace_id="default_tenant",
        )

    token = create_access_token(
        data={
            "sub": user.id,
            "email": user.email,
            "role": user.role,
            "workspace_id": user.workspace_id,
        },
        expires_delta=timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES),
    )
    frontend_url = os.getenv("FRONTEND_URL", "http://localhost:4000").rstrip("/")
    return RedirectResponse(
        url=f"{frontend_url}/?token={token}",
        status_code=status.HTTP_307_TEMPORARY_REDIRECT,
    )
