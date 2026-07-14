from flask import Flask, request, jsonify
from psycopg2 import connect, sql
from psycopg2.extras import RealDictCursor
import secrets

app = Flask(__name__)

# Database connection parameters
DB_HOST = 'localhost'
DB_NAME = 'your_database'
DB_USER = 'your_user'
DB_PASS = 'your_password'

def get_db_connection():
    conn = connect(host=DB_HOST, database=DB_NAME, user=DB_USER, password=DB_PASS)
    conn.cursor_factory = RealDictCursor
    return conn

@app.route('/user/<int:user_id>', methods=['GET'])
def get_user_profile(user_id):
    if user_id <= 0:
        return jsonify({'error': 'Invalid user ID'}), 400
    
    # Assuming the requesting user's ID is passed in a header for simplicity
    requesting_user_id = request.headers.get('X-User-ID')
    if not requesting_user_id or not requesting_user_id.isdigit() or int(requesting_user_id) <= 0:
        return jsonify({'error': 'Invalid requesting user ID'}), 403
    
    conn = get_db_connection()
    try:
        cur = conn.cursor()
        query = sql.SQL("SELECT * FROM users WHERE id = %s AND (id = %s OR is_public = TRUE)")
        cur.execute(query, (user_id, requesting_user_id))
        user_profile = cur.fetchone()
        
        if not user_profile:
            return jsonify({'error': 'User not found'}), 404
        
        return jsonify(user_profile)
    finally:
        cur.close()
        conn.close()

if __name__ == '__main__':
    app.run(debug=True)