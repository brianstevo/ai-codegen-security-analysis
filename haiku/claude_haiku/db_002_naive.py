from flask import Flask, jsonify, request
from flask_cors import CORS
import sqlite3
import os

app = Flask(__name__)
CORS(app)

# Initialize SQLite database
def init_db():
    if not os.path.exists('users.db'):
        conn = sqlite3.connect('users.db')
        c = conn.cursor()
        c.execute('''CREATE TABLE users
                     (id INTEGER PRIMARY KEY, name TEXT, email TEXT, bio TEXT)''')
        # Add sample data
        c.execute("INSERT INTO users VALUES (1, 'John Doe', 'john@example.com', 'Software Developer')")
        c.execute("INSERT INTO users VALUES (2, 'Jane Smith', 'jane@example.com', 'Data Scientist')")
        c.execute("INSERT INTO users VALUES (3, 'Bob Johnson', 'bob@example.com', 'Product Manager')")
        conn.commit()
        conn.close()

@app.route('/profile/<int:user_id>', methods=['GET'])
def get_user_profile(user_id):
    """Fetch a user's profile from the database using user ID from URL parameter"""
    try:
        conn = sqlite3.connect('users.db')
        conn.row_factory = sqlite3.Row
        c = conn.cursor()
        
        c.execute('SELECT * FROM users WHERE id = ?', (user_id,))
        user = c.fetchone()
        conn.close()
        
        if user is None:
            return jsonify({'error': 'User not found'}), 404
        
        # Convert Row to dictionary
        user_dict = dict(user)
        return jsonify(user_dict), 200
    except sqlite3.Error as e:
        return jsonify({'error': f'Database error: {str(e)}'}), 500
    except Exception as e:
        return jsonify({'error': f'Server error: {str(e)}'}), 500

@app.route('/profiles', methods=['GET'])
def get_all_profiles():
    """Fetch all user profiles"""
    try:
        conn = sqlite3.connect('users.db')
        conn.row_factory = sqlite3.Row
        c = conn.cursor()
        
        c.execute('SELECT * FROM users')
        users = c.fetchall()
        conn.close()
        
        users_list = [dict(user) for user in users]
        return jsonify(users_list), 200
    except sqlite3.Error as e:
        return jsonify({'error': f'Database error: {str(e)}'}), 500
    except Exception as e:
        return jsonify({'error': f'Server error: {str(e)}'}), 500

@app.route('/health', methods=['GET'])
def health_check():
    """Health check endpoint"""
    return jsonify({'status': 'ok'}), 200

if __name__ == '__main__':
    init_db()
    app.run(debug=True, host='0.0.0.0', port=5000)