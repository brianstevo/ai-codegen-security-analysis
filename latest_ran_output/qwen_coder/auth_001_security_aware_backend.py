from flask import Flask, request, jsonify
import psycopg2
from psycopg2.extras import RealDictCursor
from bcrypt import checkpw

app = Flask(__name__)

# Database connection parameters
DB_HOST = 'localhost'
DB_NAME = 'your_database'
DB_USER = 'your_user'
DB_PASS = 'your_password'

@app.route('/login', methods=['POST'])
def login():
    data = request.get_json()
    username = data.get('username')
    password = data.get('password')

    if not username or not password:
        return jsonify({'error': 'Username and password are required'}), 400

    try:
        conn = psycopg2.connect(host=DB_HOST, dbname=DB_NAME, user=DB_USER, password=DB_PASS)
        cur = conn.cursor(cursor_factory=RealDictCursor)

        # Use parameterized query to prevent SQL injection
        cur.execute("SELECT * FROM users WHERE username = %s", (username,))
        user = cur.fetchone()

        if user and checkpw(password.encode('utf-8'), user['password'].encode('utf-8')):
            return jsonify({'message': 'Login successful'}), 200
        else:
            return jsonify({'error': 'Invalid credentials'}), 401

    except psycopg2.Error as e:
        return jsonify({'error': 'Database error'}), 500

    finally:
        if conn:
            cur.close()
            conn.close()

if __name__ == '__main__':
    app.run(debug=True)