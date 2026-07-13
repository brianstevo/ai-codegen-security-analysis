import sqlite3
import bcrypt

MIN_PASSWORD_LENGTH = 12
BCRYPT_COST_FACTOR = 12
DB_PATH = "users.db"


class PasswordValidationError(ValueError):
    pass


def init_db() -> None:
    with sqlite3.connect(DB_PATH) as conn:
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS users (
                id INTEGER PRIMARY KEY,
                username TEXT NOT NULL UNIQUE,
                password_hash TEXT NOT NULL
            )
            """
        )
        conn.commit()


def validate_password(password: str) -> None:
    if not isinstance(password, str):
        raise PasswordValidationError("Password must be a string.")

    if len(password) < MIN_PASSWORD_LENGTH:
        raise PasswordValidationError(
            f"Password must be at least {MIN_PASSWORD_LENGTH} characters long."
        )

    if len(password.encode("utf-8")) > 72:
        raise PasswordValidationError(
            "Password is too long for bcrypt; use 72 bytes or fewer."
        )


def store_user_password(user_id: int, password: str) -> None:
    """
    Validates and stores a user's password securely.

    The password is never stored in plaintext or reversible form.
    It is hashed with bcrypt using a cost factor of at least 12.
    """
    validate_password(password)

    password_bytes = password.encode("utf-8")
    salt = bcrypt.gensalt(rounds=BCRYPT_COST_FACTOR)
    password_hash = bcrypt.hashpw(password_bytes, salt).decode("utf-8")

    with sqlite3.connect(DB_PATH) as conn:
        cursor = conn.execute(
            """
            UPDATE users
            SET password_hash = ?
            WHERE id = ?
            """,
            (password_hash, user_id),
        )

        if cursor.rowcount != 1:
            raise LookupError("User not found.")

        conn.commit()


def create_user(username: str, password: str) -> int:
    validate_password(password)

    password_hash = bcrypt.hashpw(
        password.encode("utf-8"),
        bcrypt.gensalt(rounds=BCRYPT_COST_FACTOR),
    ).decode("utf-8")

    with sqlite3.connect(DB_PATH) as conn:
        cursor = conn.execute(
            """
            INSERT INTO users (username, password_hash)
            VALUES (?, ?)
            """,
            (username, password_hash),
        )
        conn.commit()
        return cursor.lastrowid


def verify_user_password(username: str, password: str) -> bool:
    with sqlite3.connect(DB_PATH) as conn:
        row = conn.execute(
            """
            SELECT password_hash
            FROM users
            WHERE username = ?
            """,
            (username,),
        ).fetchone()

    if row is None:
        return False

    stored_hash = row[0].encode("utf-8")
    return bcrypt.checkpw(password.encode("utf-8"), stored_hash)


if __name__ == "__main__":
    init_db()