import os
import time
import sqlite3
import secrets
import hashlib
import base64
from urllib.parse import urlencode

import requests
import jwt
from jwt import PyJWKClient
from flask import Flask, redirect, request, session, jsonify, make_response, g

app = Flask(__name__)
app.secret_key = os.environ.get("FLASK_SECRET_KEY", secrets.token_urlsafe(32))

GOOGLE_CLIENT_ID = os.environ["GOOGLE_CLIENT_ID"]
GOOGLE_CLIENT_SECRET = os.environ["GOOGLE_CLIENT_SECRET"]
GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth"
GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token"
GOOGLE_JWKS_URL = "https://www.googleapis.com/oauth2/v3/certs"

APP_JWT_SECRET = os.environ.get("APP_JWT_SECRET", app.secret_key)
APP_JWT_ALGORITHM = "HS256"
APP_JWT_TTL_SECONDS = int(os.environ.get("APP_JWT_TTL_SECONDS", "3600"))

DATABASE_PATH = os.environ.get("DATABASE_PATH", "app.db")
FRONTEND_SUCCESS_URL = os.environ.get("FRONTEND_SUCCESS_URL", "/me")
FRONTEND_ERROR_URL = os.environ.get("FRONTEND_ERROR_URL", "/login?error=google_oauth_failed")


def get_db():
    if "db" not in g:
        g.db = sqlite3.connect(DATABASE_PATH)
        g.db.row_factory = sqlite3.Row
    return g.db


@app.teardown_appcontext
def close_db(_exc):
    db = g.pop("db", None)
    if db is not None:
        db.close()


def init_db():
    db = get_db()
    db.execute(
        """
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            google_sub TEXT NOT NULL UNIQUE,
            email TEXT NOT NULL,
            email_verified INTEGER NOT NULL DEFAULT 0,
            name TEXT,
            picture TEXT,
            created_at INTEGER NOT NULL,
            updated_at INTEGER NOT NULL
        )
        """
    )
    db.commit()


@app.before_request
def ensure_db():
    init_db()


def external_url_for_google_callback():
    configured = os.environ.get("GOOGLE_REDIRECT_URI")
    if configured:
        return configured
    return request.url_root.rstrip("/") + "/auth/google/callback"


def base64url_sha256(value: str) -> str:
    digest = hashlib.sha256(value.encode("ascii")).digest()
    return base64.urlsafe_b64encode(digest).rstrip(b"=").decode("ascii")


def create_or_update_user(claims: dict) -> sqlite3.Row:
    now = int(time.time())
    google_sub = claims["sub"]
    email = claims.get("email", "")
    email_verified = 1 if claims.get("email_verified") else 0
    name = claims.get("name")
    picture = claims.get("picture")

    db = get_db()
    existing = db.execute(
        "SELECT * FROM users WHERE google_sub = ?",
        (google_sub,),
    ).fetchone()

    if existing:
        db.execute(
            """
            UPDATE users
            SET email = ?, email_verified = ?, name = ?, picture = ?, updated_at = ?
            WHERE google_sub = ?
            """,
            (email, email_verified, name, picture, now, google_sub),
        )
    else:
        db.execute(
            """
            INSERT INTO users (
                google_sub, email, email_verified, name, picture, created_at, updated_at
            )
            VALUES (?, ?, ?, ?, ?, ?, ?)
            """,
            (google_sub, email, email_verified, name, picture, now, now),
        )

    db.commit()
    return db.execute(
        "SELECT * FROM users WHERE google_sub = ?",
        (google_sub,),
    ).fetchone()


def create_app_jwt(user: sqlite3.Row) -> str:
    now = int(time.time())
    payload = {
        "sub": str(user["id"]),
        "google_sub": user["google_sub"],
        "email": user["email"],
        "iat": now,
        "exp": now + APP_JWT_TTL_SECONDS,
    }
    return jwt.encode(payload, APP_JWT_SECRET, algorithm=APP_JWT_ALGORITHM)


def verify_google_id_token(id_token: str, expected_nonce: str) -> dict:
    jwk_client = PyJWKClient(GOOGLE_JWKS_URL)
    signing_key = jwk_client.get_signing_key_from_jwt(id_token)

    claims = jwt.decode(
        id_token,
        signing_key.key,
        algorithms=["RS256"],
        audience=GOOGLE_CLIENT_ID,
        options={"require": ["sub", "aud", "exp", "iat"], "verify_iss": False},
    )

    if claims.get("iss") not in ("https://accounts.google.com", "accounts.google.com"):
        raise jwt.InvalidIssuerError("Invalid Google issuer")

    if claims.get("nonce") != expected_nonce:
        raise jwt.InvalidTokenError("Invalid nonce")

    return claims


@app.get("/login/google")
def login_with_google():
    state = secrets.token_urlsafe(32)
    nonce = secrets.token_urlsafe(32)
    code_verifier = secrets.token_urlsafe(64)
    code_challenge = base64url_sha256(code_verifier)

    session["google_oauth_state"] = state
    session["google_oauth_nonce"] = nonce
    session["google_oauth_code_verifier"] = code_verifier

    params = {
        "client_id": GOOGLE_CLIENT_ID,
        "redirect_uri": external_url_for_google_callback(),
        "response_type": "code",
        "scope": "openid email profile",
        "state": state,
        "nonce": nonce,
        "code_challenge": code_challenge,
        "code_challenge_method": "S256",
        "prompt": "select_account",
    }

    return redirect(f"{GOOGLE_AUTH_URL}?{urlencode(params)}")


@app.get("/auth/google/callback")
def google_oauth_callback():
    error = request.args.get("error")
    if error:
        return redirect(FRONTEND_ERROR_URL)

    code = request.args.get("code")
    state = request.args.get("state")

    expected_state = session.pop("google_oauth_state", None)
    expected_nonce = session.pop("google_oauth_nonce", None)
    code_verifier = session.pop("google_oauth_code_verifier", None)

    if not code or not state or not expected_state or not secrets.compare_digest(state, expected_state):
        return redirect(FRONTEND_ERROR_URL)

    if not expected_nonce or not code_verifier:
        return redirect(FRONTEND_ERROR_URL)

    token_response = requests.post(
        GOOGLE_TOKEN_URL,
        data={
            "code": code,
            "client_id": GOOGLE_CLIENT_ID,
            "client_secret": GOOGLE_CLIENT_SECRET,
            "redirect_uri": external_url_for_google_callback(),
            "grant_type": "authorization_code",
            "code_verifier": code_verifier,
        },
        timeout=10,
    )

    if not token_response.ok:
        return redirect(FRONTEND_ERROR_URL)

    token_data = token_response.json()
    google_id_token = token_data.get("id_token")

    if not google_id_token:
        return redirect(FRONTEND_ERROR_URL)

    try:
        claims = verify_google_id_token(google_id_token, expected_nonce)
    except jwt.PyJWTError:
        return redirect(FRONTEND_ERROR_URL)

    user = create_or_update_user(claims)
    app_token = create_app_jwt(user)

    response = make_response(redirect(FRONTEND_SUCCESS_URL))
    response.set_cookie(
        "access_token",
        app_token,
        max_age=APP_JWT_TTL_SECONDS,
        httponly=True,
        secure=os.environ.get("FLASK_ENV") == "production",
        samesite="Lax",
    )
    return response


@app.get("/me")
def me():
    token = request.cookies.get("access_token")
    if not token:
        return jsonify({"error": "unauthorized"}), 401

    try:
        payload = jwt.decode(token, APP_JWT_SECRET, algorithms=[APP_JWT_ALGORITHM])
    except jwt.PyJWTError:
        return jsonify({"error": "unauthorized"}), 401

    user = get_db().execute(
        "SELECT id, email, email_verified, name, picture FROM users WHERE id = ?",
        (payload["sub"],),
    ).fetchone()

    if not user:
        return jsonify({"error": "unauthorized"}), 401

    return jsonify(dict(user))


@app.post("/logout")
def logout():
    response = jsonify({"ok": True})
    response.delete_cookie("access_token")
    return response


if __name__ == "__main__":
    app.run(debug=os.environ.get("FLASK_ENV") != "production")