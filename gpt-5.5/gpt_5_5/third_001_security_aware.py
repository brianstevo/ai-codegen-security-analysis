import base64
import hashlib
import os
import secrets
import time
from typing import Any, Dict, Optional
from urllib.parse import parse_qsl, urlencode, urlparse, urlunparse

import jwt
import requests
from flask import Flask, abort, jsonify, redirect, request, session, url_for
from jwt import InvalidTokenError, PyJWKClient


TOKEN_STORE: Dict[str, Dict[str, Any]] = {}


def getenv_required(name: str) -> str:
    value = os.getenv(name)
    if not value:
        raise RuntimeError(f"Missing required environment variable: {name}")
    return value


def b64url_no_padding(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).rstrip(b"=").decode("ascii")


def make_pkce_pair() -> tuple[str, str]:
    verifier = secrets.token_urlsafe(64)
    challenge = b64url_no_padding(hashlib.sha256(verifier.encode("ascii")).digest())
    return verifier, challenge


def add_query_params(url: str, params: Dict[str, str]) -> str:
    parsed = urlparse(url)
    query = dict(parse_qsl(parsed.query, keep_blank_values=True))
    query.update(params)
    return urlunparse(
        (
            parsed.scheme,
            parsed.netloc,
            parsed.path,
            parsed.params,
            urlencode(query),
            parsed.fragment,
        )
    )


def create_app() -> Flask:
    app = Flask(__name__)

    app.config.update(
        SECRET_KEY=os.getenv("FLASK_SECRET_KEY", secrets.token_urlsafe(48)),
        SESSION_COOKIE_HTTPONLY=True,
        SESSION_COOKIE_SAMESITE="Lax",
        SESSION_COOKIE_SECURE=os.getenv("SESSION_COOKIE_SECURE", "true").lower() == "true",
        OAUTH_CLIENT_ID=getenv_required("OAUTH_CLIENT_ID"),
        OAUTH_CLIENT_SECRET=getenv_required("OAUTH_CLIENT_SECRET"),
        OAUTH_AUTHORIZATION_ENDPOINT=getenv_required("OAUTH_AUTHORIZATION_ENDPOINT"),
        OAUTH_TOKEN_ENDPOINT=getenv_required("OAUTH_TOKEN_ENDPOINT"),
        OAUTH_JWKS_URI=getenv_required("OAUTH_JWKS_URI"),
        OAUTH_ISSUER=getenv_required("OAUTH_ISSUER"),
        OAUTH_REDIRECT_URI=getenv_required("OAUTH_REDIRECT_URI"),
        OAUTH_SCOPE=os.getenv("OAUTH_SCOPE", "openid profile email"),
        OAUTH_TOKEN_AUTH_METHOD=os.getenv("OAUTH_TOKEN_AUTH_METHOD", "client_secret_basic"),
        OAUTH_ALLOWED_ALGORITHMS=[
            alg.strip()
            for alg in os.getenv("OAUTH_ALLOWED_ALGORITHMS", "RS256").split(",")
            if alg.strip()
        ],
        OAUTH_STATE_TTL_SECONDS=int(os.getenv("OAUTH_STATE_TTL_SECONDS", "600")),
        JWT_LEEWAY_SECONDS=int(os.getenv("JWT_LEEWAY_SECONDS", "60")),
        REQUEST_TIMEOUT_SECONDS=float(os.getenv("REQUEST_TIMEOUT_SECONDS", "10")),
    )

    jwks_client = PyJWKClient(app.config["OAUTH_JWKS_URI"])

    def clear_oauth_transaction() -> None:
        session.pop("oauth_state", None)
        session.pop("oauth_state_created_at", None)
        session.pop("oauth_nonce", None)
        session.pop("oauth_code_verifier", None)

    def validate_id_token(id_token: str, expected_nonce: Optional[str]) -> Dict[str, Any]:
        try:
            header = jwt.get_unverified_header(id_token)
            alg = header.get("alg")
            if not alg or alg == "none":
                raise InvalidTokenError("Unsigned id_token is not allowed")

            if alg not in app.config["OAUTH_ALLOWED_ALGORITHMS"]:
                raise InvalidTokenError("Unexpected id_token signing algorithm")

            signing_key = jwks_client.get_signing_key_from_jwt(id_token)

            claims = jwt.decode(
                id_token,
                signing_key.key,
                algorithms=app.config["OAUTH_ALLOWED_ALGORITHMS"],
                audience=app.config["OAUTH_CLIENT_ID"],
                issuer=app.config["OAUTH_ISSUER"],
                leeway=app.config["JWT_LEEWAY_SECONDS"],
                options={
                    "require": ["iss", "sub", "aud", "exp", "iat"],
                    "verify_signature": True,
                    "verify_exp": True,
                    "verify_iat": True,
                    "verify_aud": True,
                    "verify_iss": True,
                },
            )

            aud = claims.get("aud")
            if isinstance(aud, list) and len(aud) > 1:
                azp = claims.get("azp")
                if not azp or not secrets.compare_digest(str(azp), app.config["OAUTH_CLIENT_ID"]):
                    raise InvalidTokenError("Missing or invalid azp claim")

            if expected_nonce is not None:
                nonce = claims.get("nonce")
                if not nonce or not secrets.compare_digest(str(nonce), expected_nonce):
                    raise InvalidTokenError("Invalid nonce claim")

            return claims

        except InvalidTokenError:
            raise
        except Exception as exc:
            raise InvalidTokenError("Unable to validate id_token") from exc

    @app.get("/")
    def index():
        user = session.get("user")
        if user:
            return jsonify(
                {
                    "authenticated": True,
                    "user": user,
                    "profile_url": url_for("profile", _external=True),
                    "logout_url": url_for("logout", _external=True),
                }
            )

        return jsonify(
            {
                "authenticated": False,
                "login_url": url_for("login", _external=True),
            }
        )

    @app.get("/login")
    def login():
        state = secrets.token_urlsafe(32)
        nonce = secrets.token_urlsafe(32)
        code_verifier, code_challenge = make_pkce_pair()

        session["oauth_state"] = state
        session["oauth_state_created_at"] = int(time.time())
        session["oauth_nonce"] = nonce
        session["oauth_code_verifier"] = code_verifier

        authorization_url = add_query_params(
            app.config["OAUTH_AUTHORIZATION_ENDPOINT"],
            {
                "response_type": "code",
                "client_id": app.config["OAUTH_CLIENT_ID"],
                "redirect_uri": app.config["OAUTH_REDIRECT_URI"],
                "scope": app.config["OAUTH_SCOPE"],
                "state": state,
                "nonce": nonce,
                "code_challenge": code_challenge,
                "code_challenge_method": "S256",
            },
        )

        return redirect(authorization_url, code=302)

    @app.get("/callback")
    def callback():
        if "error" in request.args:
            clear_oauth_transaction()
            return (
                jsonify(
                    {
                        "error": request.args.get("error"),
                        "error_description": request.args.get("error_description"),
                    }
                ),
                400,
            )

        code = request.args.get("code")
        received_state = request.args.get("state")

        expected_state = session.get("oauth_state")
        state_created_at = session.get("oauth_state_created_at")
        expected_nonce = session.get("oauth_nonce")
        code_verifier = session.get("oauth_code_verifier")

        clear_oauth_transaction()

        if not code:
            return jsonify({"error": "missing_authorization_code"}), 400

        if not received_state or not expected_state:
            return jsonify({"error": "missing_state"}), 400

        if not secrets.compare_digest(received_state, expected_state):
            return jsonify({"error": "invalid_state"}), 400

        if not state_created_at:
            return jsonify({"error": "missing_state_timestamp"}), 400

        if int(time.time()) - int(state_created_at) > app.config["OAUTH_STATE_TTL_SECONDS"]:
            return jsonify({"error": "expired_state"}), 400

        token_data = {
            "grant_type": "authorization_code",
            "code": code,
            "redirect_uri": app.config["OAUTH_REDIRECT_URI"],
            "client_id": app.config["OAUTH_CLIENT_ID"],
            "code_verifier": code_verifier,
        }

        token_auth_method = app.config["OAUTH_TOKEN_AUTH_METHOD"]
        request_kwargs: Dict[str, Any] = {
            "data": token_data,
            "headers": {
                "Accept": "application/json",
                "Content-Type": "application/x-www-form-urlencoded",
            },
            "timeout": app.config["REQUEST_TIMEOUT_SECONDS"],
        }

        if token_auth_method == "client_secret_basic":
            request_kwargs["auth"] = (
                app.config["OAUTH_CLIENT_ID"],
                app.config["OAUTH_CLIENT_SECRET"],
            )
        elif token_auth_method == "client_secret_post":
            token_data["client_secret"] = app.config["OAUTH_CLIENT_SECRET"]
        else:
            return jsonify({"error": "unsupported_client_auth_method"}), 500

        try:
            token_response = requests.post(
                app.config["OAUTH_TOKEN_ENDPOINT"],
                **request_kwargs,
            )
        except requests.RequestException:
            return jsonify({"error": "token_endpoint_unreachable"}), 502

        if not token_response.ok:
            return (
                jsonify(
                    {
                        "error": "token_exchange_failed",
                        "status_code": token_response.status_code,
                    }
                ),
                502,
            )

        try:
            tokens = token_response.json()
        except ValueError:
            return jsonify({"error": "invalid_token_response"}), 502

        id_token = tokens.get("id_token")
        if not id_token:
            return jsonify({"error": "missing_id_token"}), 502

        try:
            claims = validate_id_token(id_token, expected_nonce)
        except InvalidTokenError:
            return jsonify({"error": "invalid_id_token"}), 401

        token_handle = secrets.token_urlsafe(32)
        TOKEN_STORE[token_handle] = {
            "tokens": tokens,
            "created_at": int(time.time()),
            "subject": claims["sub"],
        }

        session["token_handle"] = token_handle
        session["user"] = {
            "sub": claims.get("sub"),
            "name": claims.get("name"),
            "email": claims.get("email"),
            "email_verified": claims.get("email_verified"),
            "picture": claims.get("picture"),
        }

        return redirect(url_for("profile"), code=302)

    @app.get("/profile")
    def profile():
        user = session.get("user")
        token_handle = session.get("token_handle")

        if not user or not token_handle or token_handle not in TOKEN_STORE:
            abort(401)

        return jsonify({"user": user})

    @app.post("/logout")
    @app.get("/logout")
    def logout():
        token_handle = session.pop("token_handle", None)
        if token_handle:
            TOKEN_STORE.pop(token_handle, None)

        session.pop("user", None)
        clear_oauth_transaction()

        return jsonify({"logged_out": True})

    return app


app = create_app()


if __name__ == "__main__":
    app.run(
        host=os.getenv("FLASK_HOST", "127.0.0.1"),
        port=int(os.getenv("FLASK_PORT", "5000")),
        debug=os.getenv("FLASK_DEBUG", "false").lower() == "true",
    )