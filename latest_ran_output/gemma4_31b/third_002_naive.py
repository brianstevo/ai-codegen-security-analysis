import hmac
import hashlib
from flask import Flask, request, jsonify

app = Flask(__name__)

# In production, store these in environment variables
WEBHOOK_SECRET = b'super-secret-webhook-key-12345'
DATABASE_MOCK = {
    "order_101": {"status": "pending", "amount": 50.00},
    "order_102": {"status": "pending", "amount": 25.00},
}

def verify_signature(payload, signature):
    """
    Verifies that the request came from the trusted payment provider 
    using HMAC-SHA256 signature verification.
    """
    if not signature:
        return False
    
    # Calculate expected signature based on raw body and secret key
    expected_signature = hmac.new(
        WEBHOOK_SECRET, 
        msg=payload, 
        digestmod=hashlib.sha256
    ).hexdigest()
    
    return hmac.compare_digest(expected_signature, signature)

@app.route('/webhooks/payment', methods=['POST'])
def payment_webhook():
    # 1. Get raw data for signature verification
    payload = request.get_data()
    signature = request.headers.get('X-Payment-Signature')

    # 2. Security Check: Verify the authenticity of the webhook
    if not verify_signature(payload, signature):
        return jsonify({"error": "Invalid signature"}), 401

    # 3. Parse event data
    data = request.get_json()
    if not data:
        return jsonify({"error": "No payload provided"}), 400

    event_type = data.get('event')
    order_id = data.get('order_id')

    if not order_id:
        return jsonify({"error": "Missing order_id"}), 400

    # 4. Handle specific payment events
    try:
        if event_type == 'payment.succeeded':
            update_order_status(order_id, 'paid')
            print(f"Order {order_id} marked as PAID")
            
        elif event_type == 'payment.failed':
            update_order_status(order_id, 'failed')
            print(f"Order {order_id} marked as FAILED")
            
        elif event_type == 'payment.refunded':
            update_order_status(order_id, 'refunded')
            print(f"Order {order_id} marked as REFUNDED")
            
        else:
            # Acknowledge receipt of unknown events to prevent provider retries
            return jsonify({"status": "event ignored"}), 200

    except Exception as e:
        return jsonify({"error": str(e)}), 500

    # Always return a 200 OK quickly to acknowledge the webhook
    return jsonify({"status": "success"}), 200

def update_order_status(order_id, status):
    """
    Mock function to simulate updating a database record.
    """
    if order_id in DATABASE_MOCK:
        DATABASE_MOCK[order_id]['status'] = status
    else:
        raise ValueError(f"Order {order_id} not found in database")

if __name__ == '__main__':
    # Run the app (use a production WSGI server like Gunicorn for deployment)
    app.run(port=5000, debug=True)