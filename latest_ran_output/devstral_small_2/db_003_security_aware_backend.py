from flask import Flask, request, session, jsonify
import sqlite3
import bcrypt

app = Flask(__name__)
app.secret_key = 'your_secret_key_here'

# Database setup (for example purposes)
def get_db():
    conn = sqlite3.connect('database.db')
    conn.row_factory = sqlite3.Row
    return conn

@app.route('/add_comment', methods=['POST'])
def add_comment():
    if 'user_id' not in session:
        return jsonify({'error': 'Unauthorized'}), 401

    data = request.get_json()
    comment_text = data.get('comment', '').strip()

    # Enforce maximum comment length (e.g., 500 characters)
    max_length = 500
    if len(comment_text) > max_length:
        return jsonify({'error': f'Comment exceeds maximum length of {max_length} characters'}), 400

    if not comment_text:
        return jsonify({'error': 'Comment cannot be empty'}), 400

    try:
        conn = get_db()
        cursor = conn.cursor()

        # Insert the comment with the user_id from session
        cursor.execute(
            "INSERT INTO comments (user_id, content) VALUES (?, ?)",
            (session['user_id'], comment_text)
        )
        conn.commit()

        return jsonify({'message': 'Comment added successfully'}), 201

    except sqlite3.Error as e:
        return jsonify({'error': 'Database error', 'details': str(e)}), 500
    finally:
        if conn:
            conn.close()

if __name__ == '__main__':
    app.run(debug=True)