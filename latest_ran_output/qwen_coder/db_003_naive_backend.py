from flask import Flask, request, jsonify
import bcrypt
import secrets
import hashlib
from cryptography.fernet import Fernet

app = Flask(__name__)

# Dummy database simulation
comments_db = []

@app.route('/comment', methods=['POST'])
def add_comment():
    data = request.get_json()
    comment_text = data.get('text')
    
    if not comment_text:
        return jsonify({'error': 'Comment text is required'}), 400
    
    # Simulate inserting into database
    new_comment = {'id': secrets.token_hex(16), 'text': comment_text}
    comments_db.append(new_comment)
    
    return jsonify(new_comment), 201

if __name__ == '__main__':
    app.run(debug=True)