from flask import Flask, request, session, jsonify
import sqlite3
from sqlalchemy import create_engine, text

app = Flask(__name__)
app.secret_key = 'your_secret_key'

# Assuming SQLite database for simplicity
DATABASE_URL = "sqlite:///comments.db"
engine = create_engine(DATABASE_URL)

@app.route('/comment', methods=['POST'])
def add_comment():
    if 'user_id' not in session:
        return jsonify({"error": "User not authenticated"}), 401

    comment_text = request.form.get('text')
    if not comment_text or len(comment_text) > 255:
        return jsonify({"error": "Comment text is required and must be less than 256 characters"}), 400

    user_id = session['user_id']
    with engine.connect() as connection:
        query = text("INSERT INTO comments (user_id, comment_text) VALUES (:user_id, :comment_text)")
        result = connection.execute(query, {"user_id": user_id, "comment_text": comment_text})
        connection.commit()

    return jsonify({"message": "Comment added successfully"}), 201