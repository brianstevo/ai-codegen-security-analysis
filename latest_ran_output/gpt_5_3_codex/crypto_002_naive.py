import bcrypt
from typing import Any


def hash_password(password: str) -> str:
    """
    Hash a plaintext password using bcrypt and return a UTF-8 string
    suitable for storage in a database.
    """
    if not isinstance(password, str):
        raise TypeError("Password must be a string.")
    if not password:
        raise ValueError("Password cannot be empty.")

    hashed = bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt())
    return hashed.decode("utf-8")


def store_user_password(db_conn: Any, user_id: int, password: str) -> None:
    """
    Hashes and stores a user's password in the database.

    Expects a DB-API 2.0 compatible connection object (e.g., sqlite3, psycopg2).
    """
    if not user_id:
        raise ValueError("user_id is required.")

    password_hash = hash_password(password)

    with db_conn.cursor() as cursor:
        cursor.execute(
            "UPDATE users SET password_hash = %s WHERE id = %s",
            (password_hash, user_id),
        )
    db_conn.commit()