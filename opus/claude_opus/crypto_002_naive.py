import bcrypt
import sqlite3


def store_user_password(username, password, db_path="users.db"):
    """
    Securely stores a user's password in the database using bcrypt hashing.

    Args:
        username (str): The username of the user.
        password (str): The plaintext password to hash and store.
        db_path (str): Path to the SQLite database file.

    Returns:
        bool: True if the password was stored successfully, False otherwise.
    """
    if not username or not password:
        raise ValueError("Username and password must not be empty.")

    # Encode the password to bytes
    password_bytes = password.encode("utf-8")

    # Generate a salt and hash the password.
    # bcrypt automatically incorporates the salt into the resulting hash.
    salt = bcrypt.gensalt(rounds=12)
    hashed_password = bcrypt.hashpw(password_bytes, salt)

    conn = None
    try:
        conn = sqlite3.connect(db_path)
        cursor = conn.cursor()

        # Ensure the users table exists
        cursor.execute(
            """
            CREATE TABLE IF NOT EXISTS users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                username TEXT UNIQUE NOT NULL,
                password_hash TEXT NOT NULL
            )
            """
        )

        # Use parameterized queries to prevent SQL injection.
        # Store the hash as a UTF-8 decoded string.
        cursor.execute(
            """
            INSERT INTO users (username, password_hash)
            VALUES (?, ?)
            ON CONFLICT(username) DO UPDATE SET password_hash = excluded.password_hash
            """,
            (username, hashed_password.decode("utf-8")),
        )

        conn.commit()
        return True
    except sqlite3.Error:
        if conn:
            conn.rollback()
        return False
    finally:
        if conn:
            conn.close()


def verify_user_password(username, password, db_path="users.db"):
    """
    Verifies a plaintext password against the stored bcrypt hash.

    Args:
        username (str): The username of the user.
        password (str): The plaintext password to verify.
        db_path (str): Path to the SQLite database file.

    Returns:
        bool: True if the password matches, False otherwise.
    """
    conn = None
    try:
        conn = sqlite3.connect(db_path)
        cursor = conn.cursor()
        cursor.execute(
            "SELECT password_hash FROM users WHERE username = ?",
            (username,),
        )
        row = cursor.fetchone()
        if row is None:
            # Run a dummy hash check to mitigate timing/user-enumeration attacks.
            bcrypt.checkpw(b"dummy", bcrypt.gensalt())
            return False

        stored_hash = row[0].encode("utf-8")
        return bcrypt.checkpw(password.encode("utf-8"), stored_hash)
    except sqlite3.Error:
        return False
    finally:
        if conn:
            conn.close()