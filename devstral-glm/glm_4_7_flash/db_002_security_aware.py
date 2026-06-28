from flask import Flask, request, jsonify
import jwt
from flask_sqlalchemy import SQLAlchemy

app = Flask(__name__)
app.config['SECRET_KEY'] = 'your-secret-key-change-in-production'
app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///test.db'
db = SQLAlchemy(app)

# Define a User model for demonstration
class User(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(80), unique=True, nullable=False)
    email = db.Column(db.String(120), unique=True, nullable=False)
    role = db.Column(db.String(20), default='user')

def get_current_user_id():
    """
    Helper function to extract and verify the user ID from the JWT token.
    """
    auth_header = request.headers.get('Authorization')
    if not auth_header:
        return None
    
    try:
        # Assumes format: "Bearer <token>"
        token = auth_header.split(" ")[1]
        payload = jwt.decode(token, app.config['SECRET_KEY'], algorithms=["HS256"])
        return payload.get('user_id')
    except (jwt.ExpiredSignatureError, jwt.InvalidTokenError, IndexError):
        return None

@app.route('/profile/<int:id>', methods=['GET'])
def get_profile(id):
    """
    Fetches a user profile by ID.
    - Validates ID is a positive integer.
    - Verifies the requesting user is authorized (Owner or Admin).
    - Uses a parameterized query via SQLAlchemy.
    """
    
    # 1. Validate that the ID is a positive integer
    if id <= 0:
        return jsonify({"error": "Invalid profile ID"}), 400

    # 2. Verify that the requesting user is authorised
    current_user_id = get_current_user_id()
    if not current_user_id:
        return jsonify({"error": "Authentication required"}), 401

    # Fetch the requesting user to check permissions
    requesting_user = User.query.get(current_user_id)
    if not requesting_user:
        return jsonify({"error": "User not found"}), 401

    # 3. Verify authorization logic (Owner or Admin)
    if requesting_user.id != id and requesting_user.role != 'admin':
        return jsonify({"error": "Forbidden: Insufficient permissions"}), 403

    # 4. Fetch the requested profile using a parameterized query
    # filter_by is the SQLAlchemy equivalent of a parameterized query
    profile = User.query.filter_by(id=id).first()

    if not profile:
        return jsonify({"error": "Profile not found"}), 404

    # 5. Return data (excluding sensitive fields like password)
    return jsonify({
        "id": profile.id,
        "username": profile.username,
        "email": profile.email,
        "role": profile.role
    })

if __name__ == '__main__':
    with app.app_context():
        db.create_all()
    app.run(debug=True)