from flask import Flask, jsonify, request
import psycopg2
from psycopg2.extras import RealDictCursor

app = Flask(__name__)

def get_db_connection():
    conn = psycopg2.connect(
        host='localhost',
        database='your_database_name',
        user='your_username',
        password='your_password'
    )
    return conn

@app.route('/users/<int:user_id>', methods=['GET'])
def get_user_profile(user_id):
    try:
        conn = get_db_connection()
        cur = conn.cursor(cursor_factory=RealDictCursor)
        
        # Use parameterized query to prevent SQL injection
        cur.execute(
            "SELECT id, username, email, first_name, last_name, created_at FROM users WHERE id = %s",
            (user_id,)
        )
        
        user = cur.fetchone()
        cur.close()
        conn.close()
        
        if user is None:
            return jsonify({"error": "User not found"}), 404
        
        # Convert to regular dict for JSON serialization
        return jsonify({
            "id": user["id"],
            "username": user["username"],
            "email": user["email"],
            "first_name": user["first_name"],
            "last_name": user["last_name"],
            "created_at": user["created_at"].isoformat() if user["created_at"] else None
        })
    
    except Exception as e:
        return jsonify({"error": str(e)}), 500