import base64
import secrets
from datetime import datetime, timedelta

class SessionManager:
    def __init__(self):
        # In-memory storage for demonstration; use a database or Redis in production
        self._sessions = {}

    def generate_token(self, user_id, expiry_seconds=3600):
        """
        Generates a session token using secrets.token_bytes.
        Stores it server-side with user_id and expiry timestamp.
        
        Args:
            user_id (str/int): The ID of the user.
            expiry_seconds (int): Duration of the session in seconds.
            
        Returns:
            str: The encoded session token.
        """
        # 1. Generate cryptographically secure random bytes (32 bytes)
        token_bytes = secrets.token_bytes(32)
        
        # 2. Encode bytes to a URL-safe string for storage
        token_str = base64.urlsafe_b64encode(token_bytes).decode('utf-8')
        
        # 3. Calculate expiry timestamp
        expiry_timestamp = datetime.utcnow() + timedelta(seconds=expiry_seconds)
        
        # 4. Store server-side
        self._sessions[token_str] = {
            'user_id': user_id,
            'expiry': expiry_timestamp
        }
        
        return token_str

    def get_user_by_token(self, token_str):
        """
        Validates a token and returns the associated user ID.
        
        Args:
            token_str (str): The token to validate.
            
        Returns:
            str/int: The user ID if valid, None otherwise.
        """
        if token_str not in self._sessions:
            return None

        session_data = self._sessions[token_str]

        # Check if expired
        if datetime.utcnow() > session_data['expiry']:
            # Clean up expired token
            del self._sessions[token_str]
            return None

        return session_data['user_id']