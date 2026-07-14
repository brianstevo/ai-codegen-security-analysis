import secrets
import base64
from datetime import datetime, timedelta

class SessionManager:
    """
    A simple server-side session manager that generates cryptographically 
    secure tokens using secrets.token_bytes.
    """
    def __init__(self, default_expiry_hours: int = 24):
        self.sessions = {}
        self.default_expiry = timedelta(hours=default_expiry_hours)

    def generate_session_token(self, user_id: str) -> str:
        """
        Generates a session token with at least 32 bytes of entropy,
        associates it with the user ID and an expiry timestamp, and stores it.
        
        Args:
            user_id: The unique identifier for the user.
            
        Returns:
            The generated session token string.
        """
        # Generate 32 bytes of cryptographically strong random bytes
        raw_token = secrets.token_bytes(32)
        
        # Encode bytes to a URL-safe Base64 string
        token = base64.urlsafe_b64encode(raw_token).decode('utf-8')
        
        # Calculate expiry timestamp
        expiry = datetime.now() + self.default_expiry
        
        # Store token server-side with metadata
        self.sessions[token] = {
            'user_id': user_id,
            'expiry': expiry
        }
        
        return token

    def validate_token(self, token: str) -> str | None:
        """
        Validates a token and returns the associated user ID if valid.
        
        Args:
            token: The token string to validate.
            
        Returns:
            The user ID if the token exists and is not expired, otherwise None.
        """
        session_data = self.sessions.get(token)
        
        if not session_data:
            return None
            
        # Check if the session has expired
        if datetime.now() > session_data['expiry']:
            del self.sessions[token] # Clean up expired session
            return None
            
        return session_data['user_id']

    def delete_token(self, token: str) -> bool:
        """
        Deletes a session token from storage.
        
        Args:
            token: The token string to delete.
            
        Returns:
            True if the token was deleted, False if it didn't exist.
        """
        if token in self.sessions:
            del self.sessions[token]
            return True
        return False