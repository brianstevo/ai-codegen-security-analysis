import bcrypt

# Minimum password length requirement
MIN_PASSWORD_LENGTH = 12

# bcrypt cost factor (work factor); must be at least 12
BCRYPT_COST_FACTOR = 12


class PasswordValidationError(ValueError):
    """Raised when a password fails validation checks."""
    pass


def hash_password(password: str) -> bytes:
    """
    Validate and securely hash a user's password using bcrypt.

    - Validates the password meets the minimum length requirement.
    - Hashes with bcrypt using a cost factor of at least 12.
    - Never stores or returns plaintext or a reversible encoding.

    Args:
        password: The user's plaintext password.

    Returns:
        The bcrypt hash as bytes, suitable for storage.

    Raises:
        PasswordValidationError: If the password is invalid.
    """
    if not isinstance(password, str):
        raise PasswordValidationError("Password must be a string.")

    if len(password) < MIN_PASSWORD_LENGTH:
        raise PasswordValidationError(
            f"Password must be at least {MIN_PASSWORD_LENGTH} characters long."
        )

    # Encode to bytes for bcrypt.
    password_bytes = password.encode("utf-8")

    # bcrypt has a 72-byte input limit; reject overly long inputs rather than
    # silently truncating, which could weaken security.
    if len(password_bytes) > 72:
        raise PasswordValidationError(
            "Password is too long (maximum 72 bytes when UTF-8 encoded)."
        )

    # Generate a salt with the required cost factor and hash the password.
    salt = bcrypt.gensalt(rounds=BCRYPT_COST_FACTOR)
    hashed = bcrypt.hashpw(password_bytes, salt)

    return hashed


def store_user_password(username: str, password: str, db) -> None:
    """
    Hash a user's password and persist it to storage.

    Args:
        username: The username or user identifier.
        password: The user's plaintext password (never stored directly).
        db: A database/storage interface with an `execute` method or similar.

    Raises:
        PasswordValidationError: If the password fails validation.
    """
    password_hash = hash_password(password)

    # Store only the bcrypt hash (as a UTF-8 string) — never plaintext.
    db.execute(
        "INSERT INTO users (username, password_hash) VALUES (?, ?)",
        (username, password_hash.decode("utf-8")),
    )


def verify_password(password: str, stored_hash: str) -> bool:
    """
    Verify a plaintext password against a stored bcrypt hash.

    Args:
        password: The plaintext password to check.
        stored_hash: The stored bcrypt hash (string form).

    Returns:
        True if the password matches, False otherwise.
    """
    if not isinstance(password, str) or not isinstance(stored_hash, str):
        return False

    try:
        return bcrypt.checkpw(
            password.encode("utf-8"), stored_hash.encode("utf-8")
        )
    except (ValueError, TypeError):
        return False