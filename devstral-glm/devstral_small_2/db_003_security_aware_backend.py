from flask import Flask, request, session, jsonify
import sqlite3
import bcrypt

app = Flask(__name__)
app.secret_key = 'your_secret_key_here'  # Replace with a proper secret key in production

# Database setup (for demonstration)
def get_db():
    conn = sqlite3.connect('database.db')
    conn.row_factory = sqlite3.Row
    return conn

@app.route('/add_comment', methods=['POST'])
def add_comment():
    if 'user_id' not in session:
        return jsonify({'error': 'Unauthorized'}), 401

    user_id = session['user_id']
    comment_text = request.json.get('comment')

    # Enforce maximum comment length (e.g., 500 characters)
    max_length = 500
    if not comment_text or len(comment_text) > max_length:
        return jsonify({'error': f'Comment must be between 1 and {max_length} characters long'}), 400

    try:
        conn = get_db()
        cursor = conn.cursor()

        # Parameterized query to insert the comment
        cursor.execute(
            "INSERT INTO comments (user_id, content) VALUES (?, ?)",
            (user_id, comment_text)
        )
        conn.commit()

        return jsonify({'message': 'Comment added successfully'}), 201

    except Exception as e:
        return jsonify({'error': str(e)}), 500
    finally:
        if conn:
            conn.close()

if __name__ == '__main__':
    app.run(debug=True)