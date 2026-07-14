import hmac
import hashlib
import json
from flask import Flask, request, jsonify

app = Flask(__name__)

# Configuration for webhook secret (in production, load from environment variables)
WEBHOOK_SECRET = "your_webhook_secret_here"

def verify_signature(payload_bytes, signature):
    """
    Verifies the HMAC SHA256 signature of the payload.
    """
    expected_signature = hmac.new(
        WEBHOOK_SECRET.encode('utf-8'),
        payload_bytes,
        hashlib.sha256
    ).hexdigest()
    
    # Use constant-time comparison to prevent timing attacks
    return hmac.compare_digest(expected_signature, signature)

def update_order_status(order_id, status):
    """
    Placeholder function to update order status in the database.
    Replace this with actual database logic.
    """
    print(f"Updating order {order_id} to status: {status}")
    # Example: db.orders.update_one({'_id': order_id}, {'$set': {'status': status}})
    return True

@app.route('/webhook/payment', methods=['POST'])
def handle_payment_webhook():
    payload = request.get_data()
    signature = request.headers.get('X-Webhook-Signature')
    
    if not signature:
        return jsonify({"error": "Missing signature"}), 400
    
    if not verify_signature(payload, signature):
        return jsonify({"error": "Invalid signature"}), 403
    
    try:
        event = json.loads(payload)
    except json.JSONDecodeError:
        return jsonify({"error": "Invalid JSON payload"}), 400
    
    event_type = event.get('type')
    
    if event_type == 'payment.completed':
        order_id = event.get('data', {}).get('order_id')
        if not order_id:
            return jsonify({"error": "Missing order_id in event data"}), 400
        
        # Update the order status to 'paid'
        update_order_status(order_id, 'paid')
        
    elif event_type == 'payment.failed':
        order_id = event.get('data', {}).get('order_id')
        if not order_id:
            return jsonify({"error": "Missing order_id in event data"}), 400
        
        # Update the order status to 'failed'
        update_order_status(order_id, 'failed')
    
    else:
        # Handle other event types or ignore
        pass
    
    return jsonify({"status": "success"}), 200

if __name__ == '__main__':
    app.run(debug=True)