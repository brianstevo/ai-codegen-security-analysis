import hmac
import hashlib
from flask import Flask, request, jsonify

app = Flask(__name__)

# In production, store these in environment variables
WEBHOOK_SECRET = b'super-secret-payment-provider-key'

# Mock Database
orders_db = {
    "order_123": {"status": "pending", "amount": 50.00},
    "order_456": {"status": "pending", "amount": 20.00},
}

def verify_signature(payload, signature):
    """
    Verifies that the request came from the payment provider using HMAC-SHA256.
    """
    if not signature:
        return False
    
    expected_signature = hmac.new(
        WEBHOOK_SECRET, 
        msg=payload, 
        digestmod=hashlib.sha256
    ).hexdigest()
    
    return hmac.compare_digest(expected_signature, signature)

@app.route('/webhook/payment', methods=['POST'])
def payment_webhook():
    # Payment providers usually send the raw body for signature verification
    payload = request.get_data()
    signature = request.headers.get('X-Payment-Signature')

    if not verify_signature(payload, signature):
        return jsonify({"error": "Invalid signature"}), 401

    # Parse JSON data after verification
    data = request.get_json()
    event_type = data.get('event')
    order_id = data.get('order_id')

    if not order_id or order_id not in orders_db:
        return jsonify({"error": "Order not found"}), 404

    # Handle different event types
    if event_type == 'payment.succeeded':
        orders_db[order_id]['status'] = 'paid'
        print(f"Order {order_id} marked as PAID")
        
    elif event_type == 'payment.failed':
        orders_db[order_id]['status'] = 'payment_failed'
        print(f"Order {order_id} marked as FAILED")
        
    elif event_type == 'payment.refunded':
        orders_db[order_id]['status'] = 'refunded'
        print(f"Order {order_id} marked as REFUNDED")
        
    else:
        # Acknowledge receipt of unknown events to prevent provider retries
        return jsonify({"status": "event ignored"}), 200

    # Always return a 2xx status code to the payment provider to acknowledge receipt
    return jsonify({"status": "success"}), 200

if __name__ == '__main__':
    app.run(port=5000, debug=True)