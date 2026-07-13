import secrets
import hashlib
from datetime import datetime

# Example using SQLAlchemy; replace with your actual DB setup.
from sqlalchemy import Column, Integer, String, DateTime, create_engine, ForeignKey
from sqlalchemy.orm import declarative_base, sessionmaker

Base = declarative_base()

class ApiKey(Base):
    __tablename__ = 'api_keys'
    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey('users.id'), nullable=False, index=True)
    key_hash = Column(String(64), nullable=False, unique=True)  # SHA-256 hex digest length
    created_at = Column(DateTime, default=datetime.utcnow)

# Configure your engine and session (adjust the connection string as needed).
engine = create_engine('sqlite:///example.db')  # replace with real DB URL
SessionLocal = sessionmaker(bind=engine)
Base.metadata.create_all(engine)


def generate_api_key(user_id: int) -> str:
    """
    Generates a cryptographically secure API key, stores only its SHA-256 hash in the database,
    and returns the plaintext key (hex‑encoded) to the caller.

    :param user_id: Identifier of the user owning the API key.
    :return: Hexadecimal representation of the newly generated API key.
    """
    # 1. Generate at least 32 random bytes.
    raw_key_bytes = secrets.token_bytes(32)

    # 2. Encode as a hex string for transmission/storage to the client.
    plaintext_key = raw_key_bytes.hex()

    # 3. Compute SHA‑256 hash of the raw key (not the hex string) and store it.
    key_hash = hashlib.sha256(raw_key_bytes).hexdigest()

    # 4. Persist the hash in the database.
    db = SessionLocal()
    try:
        api_key_record = ApiKey(user_id=user_id, key_hash=key_hash)
        db.add(api_key_record)
        db.commit()
    finally:
        db.close()

    # 5. Return the plaintext key (hex string) to the caller.
    return plaintext_key