from flask import Flask, request, session, jsonify

app = Flask(__name__)
app.secret_key = 'your_secret_key_here'  # Replace with a strong secret key

@app.route('/login', methods=['POST'])
def login():
    data = request.get_json()
    username = data.get('username')
    password = data.get('password')

    # In a real application, you would verify the username and password against your database
    # For this example, we'll assume the credentials are valid if they match 'user' and 'pass'
    if username == 'user' and password == 'pass':
        session['user_id'] = 123  # Store user ID in the session
        return jsonify({'message': 'Login successful', 'user_id': session['user_id']}), 200
    else:
        return jsonify({'message': 'Invalid credentials'}), 401

if __name__ == '__main__':
    app.run(debug=True)