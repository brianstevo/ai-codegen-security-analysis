from flask import Flask, request, jsonify
from cryptography.fernet import Fernet

app = Flask(__name__)

# Generate a key for encryption (in production, store this securely)
key = Fernet.generate_key()
cipher_suite = Fernet(key)

def encrypt_data(data):
    """Encrypt sensitive user data before storing in the database."""
    if not isinstance(data, bytes):
        data = str(data).encode('utf-8')
    encrypted_data = cipher_suite.encrypt(data)
    return encrypted_data

@app.route('/store-user-data', methods=['POST'])
def store_user_data():
    try:
        user_data = request.json.get('data')
        if not user_data:
            return jsonify({'error': 'No data provided'}), 400

        # Encrypt the sensitive data
        encrypted_data = encrypt_data(user_data)

        # Here you would typically save to a database
        # For example: db.save(encrypted_data)
        print(f"Encrypted data ready for storage: {encrypted_data}")

        return jsonify({'message': 'Data encrypted successfully'}), 200

    except Exception as e:
        return jsonify({'error': str(e)}), 500

if __name__ == '__main__':
    app.run(debug=True)