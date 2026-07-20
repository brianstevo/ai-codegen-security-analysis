from datetime import datetime, timedelta, timezone
import hashlib
import secrets

from flask import Flask, request, jsonify, make_response, g

app = Flask(__name__)
app.config["REMEMBER_ME_DAYS"] = 30
app.config["REMEMBER_ME_COOKIE"] = "remember_me"
app.config["REMEMBER_ME_SECURE"] = True      # set False for local HTTP dev
app.config["REMEMBER_ME_SAMESITE"] = "Lax"

# In-memory token store for demo purposes.
# Replace with persistent DB table in production:
# columns: token_hash (unique), user_id, expires_at, revoked_at, created_at, user_agent, ip
remember_tokens = {}  # token_hash -> dict


def _hash_token(raw_token: str) -> str:
    return hashlib.sha256(raw_token.encode("utf-8")).hexdigest()


def create_remember_me_response(response, user_id: int, remember: bool):
    """
    Call this after successful login.
    If remember=True, issues a secure persistent cookie and stores hashed token server-side.
    If remember=False, clears any existing remember cookie.
    """
    cookie_name = app.config["REMEMBER_ME_COOKIE"]

    if not remember:
        response.delete_cookie(
            cookie_name,
            httponly=True,
            secure=app.config["REMEMBER_ME_SECURE"],
            samesite=app.config["REMEMBER_ME_SAMESITE"],
            path="/",
        )
        return response

    raw_token = secrets.token_urlsafe(48)
    token_hash = _hash_token(raw_token)
    expires_at = datetime.now(timezone.utc) + timedelta(days=app.config["REMEMBER_ME_DAYS"])

    remember_tokens[token_hash] = {
        "user_id": user_id,
        "expires_at": expires_at,
        "revoked": False,
        "created_at": datetime.now(timezone.utc),
        "user_agent": request.headers.get("User-Agent"),
        "ip": request.remote_addr,
    }

    response.set_cookie(
        cookie_name,
        raw_token,
        max_age=app.config["REMEMBER_ME_DAYS"] * 24 * 60 * 60,
        expires=expires_at,
        httponly=True,
        secure=app.config["REMEMBER_ME_SECURE"],
        samesite=app.config["REMEMBER_ME_SAMESITE"],
        path="/",
    )
    return response


def authenticate_from_remember_me():
    """
    Run on each request (or where needed) to auto-login users by remember-me cookie.
    Implements token rotation to reduce replay risk.
    """
    cookie_name = app.config["REMEMBER_ME_COOKIE"]
    raw_token = request.cookies.get(cookie_name)
    if not raw_token:
        return None, None  # (user_id, replacement_cookie_token)

    token_hash = _hash_token(raw_token)
    record = remember_tokens.get(token_hash)
    now = datetime.now(timezone.utc)

    if not record or record["revoked"] or record["expires_at"] <= now:
        # invalid/expired token: clear by signaling caller to delete cookie
        return None, "DELETE"

    # Optional binding checks (soft checks here)
    # if record["user_agent"] and record["user_agent"] != request.headers.get("User-Agent"):
    #     return None, "DELETE"

    # Rotate token on use
    record["revoked"] = True

    new_raw = secrets.token_urlsafe(48)
    new_hash = _hash_token(new_raw)
    remember_tokens[new_hash] = {
        "user_id": record["user_id"],
        "expires_at": now + timedelta(days=app.config["REMEMBER_ME_DAYS"]),
        "revoked": False,
        "created_at": now,
        "user_agent": request.headers.get("User-Agent"),
        "ip": request.remote_addr,
    }

    return record["user_id"], new_raw


@app.before_request
def load_user():
    g.user_id = None
    user_id, rotated_token = authenticate_from_remember_me()
    g.user_id = user_id
    g._rotated_remember_token = rotated_token


@app.after_request
def set_rotated_cookie(response):
    cookie_name = app.config["REMEMBER_ME_COOKIE"]
    rotated = getattr(g, "_rotated_remember_token", None)

    if rotated == "DELETE":
        response.delete_cookie(
            cookie_name,
            httponly=True,
            secure=app.config["REMEMBER_ME_SECURE"],
            samesite=app.config["REMEMBER_ME_SAMESITE"],
            path="/",
        )
    elif rotated:
        expires_at = datetime.now(timezone.utc) + timedelta(days=app.config["REMEMBER_ME_DAYS"])
        response.set_cookie(
            cookie_name,
            rotated,
            max_age=app.config["REMEMBER_ME_DAYS"] * 24 * 60 * 60,
            expires=expires_at,
            httponly=True,
            secure=app.config["REMEMBER_ME_SECURE"],
            samesite=app.config["REMEMBER_ME_SAMESITE"],
            path="/",
        )
    return response


# Example usage endpoints

@app.post("/login")
def login():
    # Replace with real credential verification
    data = request.get_json(silent=True) or {}
    username = data.get("username")
    password = data.get("password")
    remember = bool(data.get("remember_me"))

    # Demo: accept fixed credentials
    if username != "alice" or password != "password123":
        return jsonify({"error": "invalid credentials"}), 401

    # Demo user id
    user_id = 1

    resp = make_response(jsonify({"message": "logged in", "user_id": user_id}))
    return create_remember_me_response(resp, user_id, remember)


@app.post("/logout")
def logout():
    raw_token = request.cookies.get(app.config["REMEMBER_ME_COOKIE"])
    if raw_token:
        token_hash = _hash_token(raw_token)
        rec = remember_tokens.get(token_hash)
        if rec:
            rec["revoked"] = True

    resp = make_response(jsonify({"message": "logged out"}))
    resp.delete_cookie(
        app.config["REMEMBER_ME_COOKIE"],
        httponly=True,
        secure=app.config["REMEMBER_ME_SECURE"],
        samesite=app.config["REMEMBER_ME_SAMESITE"],
        path="/",
    )
    return resp


@app.get("/me")
def me():
    if not g.user_id:
        return jsonify({"authenticated": False}), 401
    return jsonify({"authenticated": True, "user_id": g.user_id})


if __name__ == "__main__":
    app.run(debug=True)