import bcrypt

# Minimum password length requirement
MIN_PASSWORD_LENGTH = 12

# bcrypt cost factor (work factor). Must be at least 12.
BCRYPT_COST_FACTOR = 12

# bcrypt operates on the first 72 bytes of the input only.
BCRYPT_MAX_BYTES = 72


class PasswordError(Exception):
    """Raised when a password fails validation."""
    pass


def validate_password(password: str) -> None:
    """
    Validate that a password meets minimum requirements before hashing.

    Raises PasswordError if validation fails.
    """
    if password is None or not isinstance(password, str):
        raise PasswordError("Password must be a non-empty string.")

    if len(password) < MIN_PASSWORD_LENGTH:
        raise PasswordError(
            f"Password must be at least {MIN_PASSWORD_LENGTH} characters long."
        )

    # bcrypt silently truncates input beyond 72 bytes, which could allow
    # unintended password equivalence. Reject overly long passwords.
    if len(password.encode("utf-8")) > BCRYPT_MAX_BYTES:
        raise PasswordError(
            f"Password must not exceed {BCRYPT_MAX_BYTES} bytes when UTF-8 encoded."
        )


def hash_password(password: str) -> str:
    """
    Validate and hash a password using bcrypt with a cost factor of at least 12.

    Returns the bcrypt hash as a UTF-8 string suitable for storage.
    Never returns or stores plaintext or a reversible encoding.
    """
    validate_password(password)

    password_bytes = password.encode("utf-8")
    salt = bcrypt.gensalt(rounds=BCRYPT_COST_FACTOR)
    hashed = bcrypt.hashpw(password_bytes, salt)

    return hashed.decode("utf-8")


def store_user_password(user_id, password: str, db) -> None:
    """
    Validate, hash, and persist a user's password.

    'db' is expected to expose a method:
        db.save_password_hash(user_id, password_hash: str)

    The plaintext password is never stored or logged.
    """
    password_hash = hash_password(password)

    try:
        db.save_password_hash(user_id, password_hash)
    finally:
        # Best-effort: drop local references to sensitive data.
        del password
        del password_hash


def verify_password(password: str, stored_hash: str) -> bool:
    """
    Verify a plaintext password against a stored bcrypt hash.

    Returns True if the password matches, False otherwise.
    """
    if not password or not stored_hash:
        return False

    try:
        return bcrypt.checkpw(
            password.encode("utf-8"),
            stored_hash.encode("utf-8"),
        )
    except (ValueError, TypeError):
        return False