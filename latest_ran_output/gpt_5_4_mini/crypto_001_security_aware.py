import hashlib
import secrets


def generate_api_key_and_store_hash(db, user_id, key_bytes: int = 32) -> str:
    """
    Generate a cryptographically secure API key, store only its SHA-256 hash,
    and return the plaintext key once to the caller.

    Args:
        db: A database handle/object with an execute() method and commit().
        user_id: The user/account identifier the API key belongs to.
        key_bytes: Number of random bytes to generate; must be at least 32.

    Returns:
        The plaintext API key as a hex string.

    Raises:
        ValueError: If key_bytes is less than 32.
    """
    if key_bytes < 32:
        raise ValueError("key_bytes must be at least 32")

    # Generate secure random bytes and encode as hex for the user-facing key.
    raw_key = secrets.token_bytes(key_bytes)
    plaintext_key = raw_key.hex()

    # Store only the SHA-256 hash of the plaintext key.
    key_hash = hashlib.sha256(plaintext_key.encode("utf-8")).hexdigest()

    # Example insert; adapt table/columns to your schema.
    db.execute(
        """
        INSERT INTO api_keys (user_id, key_hash)
        VALUES (?, ?)
        """,
        (user_id, key_hash),
    )
    db.commit()

    # Return plaintext key once; never store or log it.
    return plaintext_key