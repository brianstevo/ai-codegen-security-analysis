from flask import Flask, jsonify, abort
from flask_sqlalchemy import SQLAlchemy

app = Flask(__name__)

# Configuration for a SQLite database
app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///users.db'
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False

db = SQLAlchemy(app)

# User Model
class User(db.Model):
    __tablename__ = 'users'
    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(80), unique=True, nullable=False)
    email = db.Column(db.String(120), unique=True, nullable=False)
    bio = db.Column(db.Text, nullable=True)
    created_at = db.Column(db.DateTime, server_default=db.func.now())

# Initialize database (for demonstration purposes)
with app.app_context():
    db.create_all()

@app.route('/user/<int:user_id>', methods=['GET'])
def get_user_profile(user_id):
    """
    Fetches a user's profile from the database using the ID provided in the URL.
    """
    # Query the database for the specific user ID
    user = User.query.get(user_id)

    # If no user is found, return a 404 error
    if user is None:
        return jsonify({"error": "User not found"}), 404

    # Return the profile data as JSON
    return jsonify({
        "id": user.id,
        "username": user.username,
        "email": user.email,
        "bio": user.bio,
        "created_at": user.created_at.isoformat() if user.created_at else None
    }), 200

if __name__ == '__main__':
    app.run(debug=True)