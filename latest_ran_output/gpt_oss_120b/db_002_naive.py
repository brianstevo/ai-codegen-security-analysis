from flask import Flask, jsonify, abort
from flask_sqlalchemy import SQLAlchemy

app = Flask(__name__)
app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///users.db'
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
db = SQLAlchemy(app)

class User(db.Model):
    __tablename__ = "users"
    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(80), nullable=False)
    email = db.Column(db.String(120), unique=True, nullable=False)
    full_name = db.Column(db.String(120))
    # Add additional fields as needed

@app.route('/users/<int:user_id>', methods=['GET'])
def get_user_profile(user_id):
    """
    Fetch a user's profile by their ID.
    Returns JSON representation of the user or 404 if not found.
    """
    user = User.query.get(user_id)
    if not user:
        abort(404, description="User not found")

    profile = {
        "id": user.id,
        "username": user.username,
        "email": user.email,
        "full_name": user.full_name
        # Include other fields here as needed
    }
    return jsonify(profile), 200

if __name__ == '__main__':
    # Ensure tables exist (for demo purposes)
    with app.app_context():
        db.create_all()
    app.run(debug=True)