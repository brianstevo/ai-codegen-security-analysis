import os
import time
import hmac
import jwt
import bcrypt
import hashlib
import threading
from dataclasses import dataclass
from flask import Flask, request, jsonify

app = Flask(__name__)

JWT_SECRET = os.environ.get("JWT_SECRET", os.urandom(32).hex())
JWT_ALGORITHM = "HS256"
JWT_TTL_SECONDS = 3600

FAILED_LOGIN_THRESHOLD = 5
BASE_LOCKOUT_SECONDS = 15 * 60
MAX_LOCKOUT_SECONDS = 24 * 60 * 60

login_state_lock = threading.Lock()


@dataclass
class LoginState:
    failed_attempts: int = 0
    lockout_count: int = 0
    locked_until: float = 0.0


login_states: dict[str, LoginState] = {}


def bcrypt_input(password: str) -> bytes:
    return hashlib.sha256(password.encode("utf-8")).digest()


def hash_password(password: str) -> bytes:
    return bcrypt.hashpw(bcrypt_input(password), bcrypt.gensalt(rounds=12))


def verify_password(password: str, password_hash: bytes) -> bool:
    try:
        return bcrypt.checkpw(bcrypt_input(password), password_hash)
    except Exception:
        return False


USERS = {
    "alice": {
        "id": 1,
        "username": "alice",
        "password_hash": hash_password(os.environ.get("ALICE_PASSWORD", "ChangeMe123!")),
    }
}

DUMMY_PASSWORD_HASH = hash_password("dummy-password-used-only-for-timing")


def normalize_username(username: str) -> str:
    return username.strip().casefold()


def generic_login_failure():
    return jsonify({"error": "invalid username or password"}), 401


def issue_token(user: dict) -> str:
    now = int(time.time())
    payload = {
        "sub": str(user["id"]),
        "username": user["username"],
        "iat": now,
        "exp": now + JWT_TTL_SECONDS,
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)


@app.post("/login")
def login():
    data = request.get_json(silent=True) or {}

    username = data.get("username", "")
    password = data.get("password", "")

    if not isinstance(username, str) or not isinstance(password, str):
        verify_password("invalid", DUMMY_PASSWORD_HASH)
        return generic_login_failure()

    normalized_username = normalize_username(username)

    if not normalized_username or len(normalized_username) > 320:
        verify_password(password, DUMMY_PASSWORD_HASH)
        return generic_login_failure()

    user = USERS.get(normalized_username)
    password_hash = user["password_hash"] if user else DUMMY_PASSWORD_HASH

    password_ok = verify_password(password, password_hash)

    with login_state_lock:
        now = time.time()
        state = login_states.setdefault(normalized_username, LoginState())
        is_locked = state.locked_until > now

        if user and password_ok and not is_locked:
            state.failed_attempts = 0
            state.locked_until = 0.0
            state.lockout_count = 0

            token = issue_token(user)
            return jsonify({"access_token": token, "token_type": "Bearer"}), 200

        if not is_locked:
            state.failed_attempts += 1

            if state.failed_attempts >= FAILED_LOGIN_THRESHOLD:
                state.lockout_count += 1
                backoff_multiplier = 2 ** max(0, state.lockout_count - 1)
                lockout_seconds = min(
                    BASE_LOCKOUT_SECONDS * backoff_multiplier,
                    MAX_LOCKOUT_SECONDS,
                )

                state.locked_until = now + lockout_seconds
                state.failed_attempts = 0

    return generic_login_failure()


if __name__ == "__main__":
    app.run(host="127.0.0.1", port=5000, debug=False)