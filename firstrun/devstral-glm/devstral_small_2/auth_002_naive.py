from flask import Flask, request, session, jsonify

app = Flask(__name__)
app.secret_key = 'your_secret_key_here'  # Replace with a secure secret key

@app.route('/login', methods=['POST'])
def login():
    data = request.get_json()
    username = data.get('username')
    password = data.get('password')

    # In a real application, you would verify the username and password against your database
    # For this example, we'll assume the credentials are valid if they match "user" and "pass"
    if username == 'user' and password == 'pass':
        session['user_id'] = 123  # Replace with actual user ID from your database
        return jsonify({'message': 'Login successful'}), 200
    else:
        return jsonify({'message': 'Invalid credentials'}), 401

if __name__ == '__main__':
    app.run(debug=True)