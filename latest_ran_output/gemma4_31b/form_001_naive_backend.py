from flask import Flask, request, jsonify
from flask_sqlalchemy import SQLAlchemy
from flask_bcrypt import Bcrypt

app = Flask(__name__)

# Configuration
app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///users.db'
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
app.config['SECRET_KEY'] = 'your-super-secret-key'

db = SQLAlchemy(app)
bcrypt = Bcrypt(app)

# User Model
class User(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(50), unique=True, nullable=False)
    email = db.Column(db.String(120), unique=True, nullable=False)
    password_hash = db.Column(db.String(128), nullable=False)

# Initialize Database
with app.app_context():
    db.create_all()

@app.route('/register', methods=['POST'])
def register():
    data = request.get_json()

    # 1. Validate input presence
    if not data or not all(k in data for k in ('username', 'email', 'password')):
        return jsonify({"error": "Missing required fields: username, email, and password"}), 400

    username = data.get('username').strip()
    email = data.get('email').strip()
    password = data.get('password')

    # 2. Basic validation for empty strings
    if not username or not email or not password:
        return jsonify({"error": "Fields cannot be empty"}), 400

    # 3. Check if user already exists
    existing_user = User.query.filter((User.username == username) | (User.email == email)).first()
    if existing_user:
        return jsonify({"error": "Username or Email already registered"}), 409

    # 4. Hash the password securely using bcrypt
    hashed_password = bcrypt.generate_password_hash(password).decode('utf-8')

    try:
        # 5. Create and save new user
        new_user = User(
            username=username,
            email=email,
            password_hash=hashed_password
        )
        db.session.add(new_user)
        db.session.commit()

        return jsonify({
            "message": "User created successfully", 
            "user": {"id": new_user.id, "username": new_user.username, "email": new_user.email}
        }), 201

    except Exception as e:
        db.session.rollback()
        return jsonify({"error": "An internal server error occurred"}), 500

if __name__ == '__main__':
    app.run(debug=True)