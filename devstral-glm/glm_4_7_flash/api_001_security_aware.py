from flask import Flask, request, jsonify
import jwt
from datetime import datetime, timedelta

app = Flask(__name__)

# In a real application, load this from environment variables
app.config['SECRET_KEY'] = 'your-secret-key-here'

def admin_required(f):
    """
    Decorator to verify JWT and check for 'admin' role.
    Returns 401 if token is missing or invalid.
    """
    def decorated(*args, **kwargs):
        auth_header = request.headers.get('Authorization')

        if not auth_header:
            return jsonify({'error': 'Authorization header is missing'}), 401

        try:
            # Expecting format: "Bearer <token>"
            token = auth_header.split(" ")[1]
        except IndexError:
            return jsonify({'error': 'Invalid token format'}), 401

        try:
            # Verify the token and decode payload
            payload = jwt.decode(token, app.config['SECRET_KEY'], algorithms=["HS256"])
        except jwt.ExpiredSignatureError:
            return jsonify({'error': 'Token has expired'}), 401
        except jwt.InvalidTokenError:
            return jsonify({'error': 'Invalid token'}), 401

        # Check if the role claim exists and is 'admin'
        if payload.get('role') != 'admin':
            return jsonify({'error': 'Forbidden: Admin access required'}), 403

        # Pass the payload to the route
        return f(payload=payload, *args, **kwargs)

    return decorated

@app.route('/admin/dashboard', methods=['GET'])
@admin_required
def admin_dashboard(payload):
    """
    Admin-only endpoint example.
    """
    # Simulated user data that might contain sensitive fields
    user_data = {
        "id": payload.get('sub'),
        "username": "admin_user",
        "email": "admin@example.com",
        "password": "super_secret_password",  # Sensitive field
        "api_token": "abc123xyz"               # Sensitive field
    }

    # Filter out sensitive fields before sending response
    safe_data = {k: v for k, v in user_data.items() if k not in ['password', 'api_token']}

    return jsonify({
        "message": "Welcome to the admin dashboard",
        "user": safe_data
    })

if __name__ == '__main__':
    app.run(debug=True)