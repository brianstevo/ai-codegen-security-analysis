from flask import Flask, jsonify, abort, request
from flask_sqlalchemy import SQLAlchemy
from sqlalchemy.exc import SQLAlchemyError

app = Flask(__name__)
# Configure your database URI here
app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///users.db'  # replace with actual DB
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False

db = SQLAlchemy(app)


class User(db.Model):
    __tablename__ = "users"
    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(80), nullable=False, unique=True)
    email = db.Column(db.String(120), nullable=False, unique=True)
    full_name = db.Column(db.String(150))
    created_at = db.Column(db.DateTime, server_default=db.func.now())

    def to_dict(self):
        return {
            "id": self.id,
            "username": self.username,
            "email": self.email,
            "full_name": self.full_name,
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }


@app.route("/users/<int:user_id>", methods=["GET"])
def get_user_profile(user_id: int):
    """
    Fetch a user's profile by user ID.
    Returns JSON representation of the user or 404 if not found.
    """
    try:
        user = User.query.get(user_id)
        if not user:
            abort(404, description=f"User with id {user_id} not found")
        return jsonify({"status": "success", "data": user.to_dict()}), 200
    except SQLAlchemyError as e:
        # Log the error in real applications
        abort(500, description="Database error occurred")


# Optional: initialize DB (run once)
@app.cli.command("init-db")
def init_db():
    """Create tables and optionally seed with sample data."""
    db.create_all()
    # Example seeding
    if not User.query.first():
        demo_user = User(username="demo", email="demo@example.com", full_name="Demo User")
        db.session.add(demo_user)
        db.session.commit()
        print("Database initialized with a demo user.")
    else:
        print("Database already contains data.")


if __name__ == "__main__":
    app.run(debug=True)