from flask import Flask, jsonify, request
import sqlite3

app = Flask(__name__)
DATABASE = 'users.db'

def get_db_connection():
    conn = sqlite3.connect(DATABASE)
    conn.row_factory = sqlite3.Row
    return conn

@app.route('/user/<int:user_id>', methods=['GET'])
def get_user_profile(user_id):
    try:
        conn = get_db_connection()
        user = conn.execute('SELECT * FROM users WHERE id = ?', (user_id,)).fetchone()
        conn.close()
        
        if user is None:
            return jsonify({'error': 'User not found'}), 404
        
        # Convert Row object to dictionary for JSON serialization
        user_dict = dict(user)
        return jsonify(user_dict), 200
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

if __name__ == '__main__':
    app.run(debug=True)