from flask import Flask, request, jsonify
from psycopg2 import connect, sql
from psycopg2.extras import RealDictCursor
import bcrypt

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

@app.route('/profile/<int:user_id>', methods=['GET'])
def get_profile(user_id):
    if user_id <= 0:
        return jsonify({'error': 'Invalid user ID'}), 400
    
    # Assuming the requesting user's ID is passed in a header for simplicity
    request_user_id = int(request.headers.get('X-User-ID', -1))
    
    if request_user_id != user_id and not is_admin(request_user_id):
        return jsonify({'error': 'Unauthorized'}), 403
    
    conn = get_db_connection()
    try:
        cur = conn.cursor()
        query = sql.SQL("SELECT * FROM users WHERE id = %s")
        cur.execute(query, (user_id,))
        user_profile = cur.fetchone()
        
        if not user_profile:
            return jsonify({'error': 'User not found'}), 404
        
        return jsonify(user_profile)
    finally:
        cur.close()
        conn.close()

def is_admin(user_id):
    # Implement your logic to check if the user is an admin
    pass

if __name__ == '__main__':
    app.run(debug=True)