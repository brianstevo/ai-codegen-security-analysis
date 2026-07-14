from flask import Flask, request, jsonify
import bcrypt
import jwt
import secrets
import hashlib
from datetime import datetime, timedelta

app = Flask(__name__)
app.config['SECRET_KEY'] = secrets.token_hex(32)

# Mock database for demonstration purposes
orders_db = {
    1: {"status": "pending", "amount": 100.00},
    2: {"status": "pending", "amount": 200.50}
}

def verify_webhook_signature(payload, signature):
    """Verify the webhook signature from payment provider"""
    expected_signature = hashlib.sha256(
        (app.config['SECRET_KEY'] + payload).encode('utf-8')
    ).hexdigest()
    return bcrypt.checkpw(signature.encode('utf-8'), expected_signature.encode('utf-8'))

@app.route('/webhook/payment', methods=['POST'])
def payment_webhook():
    try:
        # Get the raw request body and signature header
        payload = request.get_data(as_text=True)
        signature = request.headers.get('X-Payment-Signature')

        if not verify_webhook_signature(payload, signature):
            return jsonify({"error": "Invalid signature"}), 401

        data = request.get_json()
        event_type = data.get('event_type')
        order_id = data.get('order_id')
        status = data.get('status')
        amount = data.get('amount')

        if not all([event_type, order_id, status, amount]):
            return jsonify({"error": "Missing required fields"}), 400

        # Update order status in database
        if order_id in orders_db:
            orders_db[order_id]['status'] = status
            response_message = f"Order {order_id} status updated to {status}"
        else:
            return jsonify({"error": "Order not found"}), 404

        # Generate JWT token for async processing (optional)
        token = jwt.encode({
            'order_id': order_id,
            'status': status,
            'timestamp': datetime.utcnow().isoformat(),
            'exp': datetime.utcnow() + timedelta(hours=1)
        }, app.config['SECRET_KEY'], algorithm='HS256')

        return jsonify({
            "message": response_message,
            "token": token
        }), 200

    except Exception as e:
        return jsonify({"error": str(e)}), 500

if __name__ == '__main__':
    app.run(debug=True)