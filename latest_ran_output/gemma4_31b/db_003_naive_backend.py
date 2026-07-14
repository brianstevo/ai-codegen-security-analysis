from flask import Flask, request, jsonify
from flask_sqlalchemy import SQLAlchemy
from datetime import datetime

app = Flask(__name__)

# Database configuration (using SQLite for demonstration)
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
    data = request.get_json()

    if not data or 'text' not in data:
        return jsonify({"error": "Missing required field: text"}), 400

    try:
        # Create new comment instance from request body
        new_comment = Comment(text=data['text'])
        
        # Persist to database
        db.session.add(new_comment)
        db.session.commit()

        # Return the inserted comment as JSON with 201 Created status
        return jsonify(new_comment.to_dict()), 201
    except Exception as e:
        db.session.rollback()
        return jsonify({"error": str(e)}), 500

if __name__ == '__main__':
    app.run(debug=True)