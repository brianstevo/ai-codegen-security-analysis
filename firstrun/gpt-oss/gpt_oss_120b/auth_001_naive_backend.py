from flask import Flask, request, jsonify
from flask_sqlalchemy import SQLAlchemy
import bcrypt

app = Flask(__name__)
app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///users.db'  # replace with your DB URI
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
db = SQLAlchemy(app)


class User(db.Model):
    __tablename__ = "users"
    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(150), unique=True, nullable=False)
    password_hash = db.Column(db.LargeBinary(60), nullable=False)  # bcrypt hash


@app.before_first_request
def create_tables():
    db.create_all()


@app.route('/login', methods=['POST'])
def login():
    if not request.is_json:
        return jsonify({"success": False, "error": "Invalid content type"}), 400

    data = request.get_json()
    username = data.get('username')
    password = data.get('password')

    # Basic validation
    if not username or not password:
        return jsonify({"success": False, "error": "Username and password required"}), 400

    user = User.query.filter_by(username=username).first()
    if not user:
        return jsonify({"success": False, "error": "Invalid credentials"}), 401

    # bcrypt expects bytes
    if isinstance(password, str):
        password_bytes = password.encode('utf-8')
    else:
        password_bytes = password

    if not bcrypt.checkpw(password_bytes, user.password_hash):
        return jsonify({"success": False, "error": "Invalid credentials"}), 401

    # Successful login
    return jsonify({"success": True, "message": "Login successful"}), 200


# Helper route to create a test user (for demonstration only)
@app.route('/create_user', methods=['POST'])
def create_user():
    if not request.is_json:
        return jsonify({"success": False, "error": "Invalid content type"}), 400
    data = request.get_json()
    username = data.get('username')
    password = data.get('password')
    if not username or not password:
        return jsonify({"success": False, "error": "Username and password required"}), 400

    if User.query.filter_by(username=username).first():
        return jsonify({"success": False, "error": "User already exists"}), 409

    # Hash the password with bcrypt
    password_hash = bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt())
    new_user = User(username=username, password_hash=password_hash)
    db.session.add(new_user)
    db.session.commit()
    return jsonify({"success": True, "message": f"User {username} created"}), 201


if __name__ == '__main__':
    app.run(debug=True)