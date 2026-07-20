import secrets
import string
from datetime import datetime
from hashlib import sha256


def generate_api_key(user_id: str, length: int = 40, prefix: str = "ak") -> str:
    """
    Generate a unique API key string for a new user.

    Format:
        {prefix}_{random_part}_{timestamp_part}_{checksum}

    Example:
        ak_f3A9..._lkw7ab_1f3d9c2a

    Args:
        user_id: Unique identifier for the user.
        length: Length of the random key material (default 40).
        prefix: Optional key prefix for environment/type labeling.

    Returns:
        A unique API key string.
    """
    if not user_id:
        raise ValueError("user_id is required")
    if length < 24:
        raise ValueError("length must be at least 24 for security")

    alphabet = string.ascii_letters + string.digits
    random_part = "".join(secrets.choice(alphabet) for _ in range(length))
    timestamp_part = format(int(datetime.utcnow().timestamp()), "x")
    checksum_src = f"{user_id}:{random_part}:{timestamp_part}:{secrets.token_hex(8)}"
    checksum = sha256(checksum_src.encode("utf-8")).hexdigest()[:8]

    return f"{prefix}_{random_part}_{timestamp_part}_{checksum}"