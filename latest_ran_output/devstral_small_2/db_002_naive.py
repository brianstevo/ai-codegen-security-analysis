from flask import Flask, jsonify, request
import sqlite3

app = Flask(__name__)

def get_db_connection():
    conn = sqlite3.connect('database.db')
    conn.row_factory = sqlite3.Row
    return conn

@app.route('/profile/<int:user_id>', methods=['GET'])
def get_profile(user_id):
    conn = get_db_connection()
    profile = conn.execute('SELECT * FROM users WHERE id = ?', (user_id,)).fetchone()
    conn.close()

    if profile is None:
        return jsonify({'error': 'User not found'}), 404

    profile_dict = dict(profile)
    return jsonify(profile_dict)

if __name__ == '__main__':
    app.run(debug=True)