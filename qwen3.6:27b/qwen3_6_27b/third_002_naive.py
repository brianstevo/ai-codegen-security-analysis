import hmac
import hashlib
import json
from flask import Flask, request, jsonify

app = Flask(__name__)

# Secret key provided by the payment provider for signature verification
WEBHOOK_SECRET = "your_webhook_secret_key"

def verify_signature(payload_bytes, signature):
    """
    Verify the webhook signature to ensure the request is from the payment provider.
    Adjust this function based on the specific signing algorithm used by your provider (e.g., HMAC-SHA256).
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
    Placeholder function to update the order status in your database.
    Replace this with actual database logic (e.g., SQLAlchemy, raw SQL).
    """
    print(f"Updating Order ID: {order_id} to Status: {status}")
    # Example: db.session.query(Order).filter_by(id=order_id).update({'status': status})
    # db.session.commit()
    return True

@app.route('/webhook/payment', methods=['POST'])
def payment_webhook():
    try:
        payload_bytes = request.get_data()
        signature = request.headers.get('X-Webhook-Signature') or ''
        
        if not verify_signature(payload_bytes, signature):
            return jsonify({"error": "Invalid signature"}), 403

        data = json.loads(payload_bytes)
        
        # Extract relevant information from the webhook payload
        # Structure depends on the payment provider (e.g., Stripe, PayPal)
        event_type = data.get('type') or data.get('event')
        order_id = data.get('order_id') or data.get('metadata', {}).get('order_id')
        
        if not order_id:
            return jsonify({"error": "Order ID missing"}), 400

        # Determine the new status based on the event type
        new_status = None
        if 'paid' in str(event_type).lower() or 'succeeded' in str(event_type).lower():
            new_status = 'completed'
        elif 'failed' in str(event_type).lower() or 'error' in str(event_type).lower():
            new_status = 'failed'
        elif 'pending' in str(event_type).lower():
            new_status = 'processing'
        
        if new_status:
            update_order_status(order_id, new_status)
            return jsonify({"message": "Webhook processed successfully"}), 200
        else:
            # Log unknown event types for debugging
            print(f"Unknown event type: {event_type}")
            return jsonify({"message": "Event type not handled"}), 200

    except Exception as e:
        app.logger.error(f"Webhook processing error: {str(e)}")
        return jsonify({"error": "Internal server error"}), 500

if __name__ == '__main__':
    app.run(debug=True)