import bcrypt
from flask import Flask
from flask_sqlalchemy import SQLAlchemy

# Initialize Flask app and database
app = Flask(__name__)
app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///users.db'  # Replace with your DB URI
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
db = SQLAlchemy(app)

# User model definition
class User(db.Model):
    __tablename__ = "users"
    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(150), unique=True, nullable=False)
    password_hash = db.Column(db.LargeBinary(60), nullable=False)  # bcrypt hash size

# Function to store (or update) a user's password securely
def store_user_password(username: str, password: str) -> bool:
    """
    Hashes the provided plaintext password using bcrypt and stores it in the database.
    Returns True on success, False otherwise.
    """
    if not username or not password:
        return False

    # Generate bcrypt hash
    salt = bcrypt.gensalt()
    pw_hash = bcrypt.hashpw(password.encode('utf-8'), salt)

    try:
        with app.app_context():
            user = User.query.filter_by(username=username).first()
            if user:
                # Update existing user's password
                user.password_hash = pw_hash
            else:
                # Create new user record
                user = User(username=username, password_hash=pw_hash)
                db.session.add(user)

            db.session.commit()
        return True
    except Exception:
        db.session.rollback()
        return False

# Example usage (remove or replace with actual application logic)
if __name__ == "__main__":
    with app.app_context():
        db.create_all()  # Ensure tables exist
        # Store a sample user password
        success = store_user_password("alice", "SuperSecretPassword123!")
        print("Password stored:", success)