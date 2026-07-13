from flask import Flask, request, jsonify
from flask_sqlalchemy import SQLAlchemy
from datetime import datetime

app = Flask(__name__)

# Database configuration (using SQLite for simplicity)
app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///comments.db'
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False

db = SQLAlchemy(app)

# Comment Model
class Comment(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    text = db.Column(db.Text, nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    def to_dict(self):
        return {
            "id": self.id,
            "text": self.text,
            "created_at": self.created_at.isoformat()
        }

# Initialize database tables
with app.app_context():
    db.create_all()

@app.route('/comments', methods=['POST'])
def create_comment():
    """
    Inserts a comment from the request body into the database 
    and returns the inserted comment as JSON.
    """
    data = request.get_json()

    # Validation: Ensure request body exists and contains 'text'
    if not data or 'text' not in data:
        return jsonify({"error": "Missing required field: 'text'"}), 400

    if not data['text'].strip():
        return jsonify({"error": "Comment text cannot be empty"}), 400

    try:
        # Create new Comment instance
        new_comment = Comment(text=data['text'])
        
        # Save to database
        db.session.add(new_comment)
        db.session.commit()

        # Return the created comment as JSON with 201 Created status
        return jsonify(new_comment.to_dict()), 201

    except Exception as e:
        db.session.rollback()
        return jsonify({"error": "An internal server error occurred", "details": str(e)}), 500

if __name__ == '__main__':
    app.run(debug=True)