```python
import os
import datetime
import logging
from flask import Flask, request, jsonify
from flask_sqlalchemy import SQLAlchemy
from flask_limiter import Limiter
from flask_limiter.util import get_remote_address
import bcrypt
import jwt
from functools import wraps

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = Flask(__name__)

# Configuration
app.config['SECRET_KEY'] = os.environ.get('SECRET_KEY', os.urandom(32))
app.config['SQLALCHEMY_DATABASE_URI'] = os.environ.get(
    'DATABASE_URL', 'sqlite:///users.db'
)
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
app.config['JWT_EXPIRATION_HOURS'] = int(os.environ.get('JWT_EXPIRATION_HOURS', 1))

db = SQLAlchemy(app)

# Rate limiting: max 10 login attempts per minute per IP
limiter = Limiter(
    app=app,
    key_func=get_remote_address,
    default_limits=["200 per day", "50 per hour"]
)

# ---------------------------------------------------------------------------
# Database Model
# ---------------------------------------------------------------------------

class User(db.Model):
    __tablename__ = 'users'

    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(80), unique=True, nullable=False, index=True)
    password_hash = db.Column(db.String(128), nullable=False)
    is_active = db.Column(db.Boolean, default=True, nullable=False)
    failed_attempts = db.Column(db.Integer, default=0, nullable=False)
    locked_until = db.Column(db.DateTime, nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.datetime.utcnow)
    last_login = db.Column(db.DateTime, nullable=True)

    def set_password(self, plain_password: str) -> None:
        """Hash and store the password using bcrypt."""
        salt = bcrypt.gensalt(rounds=12)
        self.password_hash = bcrypt.hashpw(
            plain_password.encode('utf-8'), salt
        ).decode('utf-8')

    def check_password(self, plain_password: str) -> bool:
        """Verify a plain-text password against the stored hash."""
        return bcrypt.checkpw(
            plain_password.encode('utf-8'),
            self.password_hash.encode('utf-8')
        )

    def is_locked(self) -> bool:
        """Return True if the account is currently locked out."""
        if self.locked_until and datetime.datetime.utcnow() < self.locked_until:
            return True
        return False

    def record_failed_attempt(self, max_attempts: int = 5, lockout_minutes: int = 15) -> None:
        """Increment failed attempts and lock account if threshold exceeded."""
        self.failed_attempts += 1
        if self.failed_attempts >= max_attempts:
            self.locked_until = (
                datetime.datetime.utcnow()
                + datetime.timedelta(minutes=lockout_minutes)
            )
            logger.warning("Account '%s' locked after %d failed attempts.", self.username, self.failed_attempts)
        db.session.commit()

    def reset_failed_attempts(self) -> None:
        """Clear failed attempt counter and lockout on successful login."""
        self.failed_attempts = 0
        self.locked_until = None
        self.last_login = datetime.datetime.utcnow()
        db.session.commit()

# ---------------------------------------------------------------------------
# JWT Helper
# ---------------------------------------------------------------------------

def generate_token(user: User) -> str:
    """Generate a signed JWT for the authenticated user."""
    payload = {
        'sub': user.id,
        'username': user.username,
        'iat': datetime.datetime.utcnow(),
        'exp': datetime.datetime.utcnow() + datetime.timedelta(
            hours=app.config['JWT_EXPIRATION_HOURS']
        )
    }
    token = jwt.encode(payload, app.config['SECRET_KEY'], algorithm='HS256')
    return token

def token_required(f):
    """Decorator to protect routes that require a valid JWT."""
    @wraps(f)
    def decorated(*args, **kwargs):
        auth_header = request.headers.get('Authorization', '')
        if not auth_header.startswith('Bearer '):
            return jsonify({'success': False, 'message': 'Missing or invalid token.'}), 401
        token = auth_header.split(' ', 1)[1]
        try:
            payload = jwt.decode(
                token, app.config['SECRET_KEY'], algorithms=['HS256']
            )
            request.current_user_id = payload['sub']
            request.current_username = payload['username']
        except jwt.ExpiredSignatureError:
            return jsonify({'success': False, 'message': 'Token has expired.'}), 401
        except jwt.InvalidTokenError:
            return jsonify({'success': False, 'message': 'Invalid token.'}), 401
        return f(*args, **kwargs)
    return decorated

# ---------------------------------------------------------------------------
# Input Validation
# ---------------------------------------------------------------------------

def validate_login_payload(data: dict) -> tuple[bool, str]:
    """
    Validate the structure and basic constraints of the login payload.
    Returns (is_valid, error_message).
    """
    if not isinstance(data, dict):
        return False, 'Request body must be a JSON object.'

    username = data.get('username')
    password = data.get('password')

    if not username or not isinstance(username, str):
        return False, 'Username is required and must be a string.'
    if not password or not isinstance(password, str):
        return False, 'Password is required and must be a string.'
    if len(username) > 80:
        return False, 'Username must not exceed 80 characters.'
    if len(password) > 256:
        return False, 'Password must not exceed 256 characters.'

    return True, ''

# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------

@app.route('/api/login', methods=['POST'])
@limiter.limit("10 per minute")
def login():
    """
    Authenticate a user with username and password.

    Expects JSON body:
        { "username": "<str>", "password": "<str>" }

    Returns:
        200  { "success": true,  "token": "<jwt>", "message": "Login successful." }
        400  { "success": false, "message": "<validation error>" }
        401  { "success": false, "message": "Invalid credentials." }
        403  { "success": false, "message": "Account locked. Try again later." }
        429  Rate-limit response
        500  { "success": false, "message": "An internal error occurred." }
    """
    # --- Parse body ---
    data = request.get_json(silent=True)
    if data is None:
        return jsonify({'success': False, 'message': 'Request body must be valid JSON.'}), 400

    # --- Validate payload ---
    is_valid, error_msg = validate_login_payload(data)
    if not is_valid:
        return jsonify({'success': False, 'message': error_msg}), 400

    username: str = data['username'].strip()
    password: str = data['password']

    try:
        # --- Fetch user (case-insensitive username lookup) ---
        user = User.query.filter(
            db.func.lower(User.username) == username.lower()
        ).first()

        # Use a generic error to avoid username enumeration
        generic_error = jsonify({'success': False, 'message': 'Invalid credentials.'})

        if user is None or not user.is_active:
            # Still perform a dummy bcrypt check to prevent timing attacks
            bcrypt.checkpw(b'dummy', bcrypt.hashpw(b'dummy', bcrypt.gensalt()))
            logger.info("Login failed: user '%s' not found or inactive.", username)
            return generic_error,