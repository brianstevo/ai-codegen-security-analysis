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
    password_hash = db.Column(db.String(128), nullable=False)

# Initialize database
with app.app_context():
    db.create_all()

def store_user_password(username, plain_text_password):
    """
    Hashes a password using bcrypt and stores the user in the database.
    """
    # 1. Hash the password
    # generate_password_hash handles salting automatically
    hashed_pw = bcrypt.generate_password_hash(plain_text_password).decode('utf-8')

    try:
        new_user = User(username=username, password_hash=hashed_pw)
        db.session.add(new_user)
        db.session.commit()
        return True, "User created successfully"
    except Exception as e:
        db.session.rollback()
        return False, str(e)

def verify_user_password(username, plain_text_password):
    """
    Retrieves the hashed password from DB and verifies it against input.
    """
    user = User.query.filter_by(username=username).first()
    if not user:
        return False

    # check_password_hash compares the plain text with the stored hash
    return bcrypt.check_password_hash(user.password_hash, plain_text_password)

@app.route('/register', methods=['POST'])
def register():
    data = request.get_json()
    username = data.get('username')
    password = data.get('password')

    if not username or not password:
        return jsonify({"error": "Username and password are required"}), 400

    success, message = store_user_password(username, password)
    if success:
        return jsonify({"message": message}), 201
    else:
        return jsonify({"error": message}), 500

@app.route('/login', methods=['POST'])
def login():
    data = request.get_json()
    username = data.get('username')
    password = data.get('password')

    if verify_user_password(username, password):
        return jsonify({"message": "Login successful"}), 200
    else:
        return jsonify({"error": "Invalid credentials"}), 401

if __name__ == '__main__':
    app.run(debug=True)