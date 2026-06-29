```python
import os
import re
import sqlite3
import bcrypt
from flask import Flask, request, jsonify
from datetime import datetime

app = Flask(__name__)

DATABASE = "users.db"


def get_db_connection():
    """Create and return a database connection."""
    conn = sqlite3.connect(DATABASE)
    conn.row_factory = sqlite3.Row
    return conn


def init_db():
    """Initialize the database with the users table."""
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute(
        """
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT NOT NULL UNIQUE,
            email TEXT NOT NULL UNIQUE,
            password_hash TEXT NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    """
    )
    conn.commit()
    conn.close()


def validate_password_strength(password: str) -> tuple[bool, str]:
    """
    Validate password strength requirements.
    Returns a tuple of (is_valid: bool, message: str).
    """
    if len(password) < 12:
        return False, "Password must be at least 12 characters long."

    if len(password) > 128:
        return False, "Password must not exceed 128 characters."

    if not re.search(r"[A-Z]", password):
        return False, "Password must contain at least one uppercase letter."

    if not re.search(r"[a-z]", password):
        return False, "Password must contain at least one lowercase letter."

    if not re.search(r"\d", password):
        return False, "Password must contain at least one digit."

    if not re.search(r"[!@#$%^&*(),.?\":{}|<>]", password):
        return False, "Password must contain at least one special character."

    return True, "Password is valid."


def hash_password(password: str) -> str:
    """
    Hash a password using bcrypt with a secure salt.
    Returns the hashed password as a string.
    """
    # Generate a salt with a work factor of 12 (computationally expensive)
    salt = bcrypt.gensalt(rounds=12)

    # Hash the password with the generated salt
    password_bytes = password.encode("utf-8")
    hashed = bcrypt.hashpw(password_bytes, salt)

    return hashed.decode("utf-8")


def store_user_password(username: str, email: str, password: str) -> dict:
    """
    Store a user's hashed password in the database.

    Args:
        username: The user's username.
        email: The user's email address.
        password: The plain-text password to hash and store.

    Returns:
        A dictionary with success status and message.
    """
    # Validate inputs
    if not username or not username.strip():
        return {"success": False, "message": "Username cannot be empty."}

    if not email or not email.strip():
        return {"success": False, "message": "Email cannot be empty."}

    if not password:
        return {"success": False, "message": "Password cannot be empty."}

    # Validate email format
    email_pattern = r"^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$"
    if not re.match(email_pattern, email):
        return {"success": False, "message": "Invalid email format."}

    # Validate username (alphanumeric and underscores only)
    if not re.match(r"^[a-zA-Z0-9_]{3,30}$", username):
        return {
            "success": False,
            "message": "Username must be 3-30 characters and contain only letters, numbers, and underscores.",
        }

    # Validate password strength
    is_valid, validation_message = validate_password_strength(password)
    if not is_valid:
        return {"success": False, "message": validation_message}

    # Hash the password securely
    password_hash = hash_password(password)

    # Store in database
    conn = get_db_connection()
    try:
        cursor = conn.cursor()
        cursor.execute(
            """
            INSERT INTO users (username, email, password_hash, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?)
        """,
            (
                username.strip(),
                email.strip().lower(),
                password_hash,
                datetime.utcnow(),
                datetime.utcnow(),
            ),
        )
        conn.commit()
        user_id = cursor.lastrowid

        return {
            "success": True,
            "message": "User registered successfully.",
            "user_id": user_id,
        }

    except sqlite3.IntegrityError as e:
        if "username" in str(e):
            return {"success": False, "message": "Username already exists."}
        elif "email" in str(e):
            return {"success": False, "message": "Email already registered."}
        return {"success": False, "message": "User already exists."}

    except sqlite3.Error as e:
        return {"success": False, "message": f"Database error: {str(e)}"}

    finally:
        conn.close()


def update_user_password(username: str, new_password: str) -> dict:
    """
    Update an existing user's password in the database.

    Args:
        username: The user's username.
        new_password: The new plain-text password to hash and store.

    Returns:
        A dictionary with success status and message.
    """
    if not username or not new_password:
        return {"success": False, "message": "Username and new password are required."}

    # Validate new password strength
    is_valid, validation_message = validate_password_strength(new_password)
    if not is_valid:
        return {"success": False, "message": validation_message}

    # Hash the new password
    new_password_hash = hash_password(new_password)

    conn = get_db_connection()
    try:
        cursor = conn.cursor()
        cursor.execute(
            """
            UPDATE users
            SET password_hash = ?, updated_at = ?
            WHERE username = ?
        """,
            (new_password_hash, datetime.utcnow(), username),
        )
        conn.commit()

        if cursor.rowcount == 0:
            return {"success": False, "message": "User not found."}

        return {"success": True, "message": "Password updated successfully."}

    except sqlite3.Error as e:
        return {"success": False, "message": f"Database error: {str(e)}"}

    finally:
        conn.close()


def verify_user_password(username: str, password: str) -> dict:
    """
    Verify a user's password against the stored hash.

    Args:
        username: The user's username.
        password: The plain-text password to verify.

    Returns:
        A dictionary with success status and message.
    """
    if not username or not password:
        return {"success": False, "message": "Username and password are required."}

    conn = get_db_connection()
    try:
        cursor = conn.cursor()
        cursor.execute(
            "SELECT password_hash FROM users WHERE username = ?", (username,)
        )
        user = cursor.fetchone()

        if not user:
            # Use constant-time comparison to prevent timing attacks
            bcrypt.checkpw(b"dummy_password", bcrypt.hashpw(b"dummy", bcrypt.gensalt()))
            return {"success": False, "message": "Invalid username or password."}

        stored_hash = user["password_hash"].encode("utf-8")
        password_bytes = password.encode("utf-8")

        if bcrypt.checkpw(password_bytes, stored_hash):
            return {"success": True, "message": "Password verified successfully."}
        else:
            return {"success": False, "message": "Invalid username or password."}

    except sqlite3.Error as e:
        return {"success": False, "message": f"Database error