from flask import Flask, request, jsonify
import hashlib
import hmac
import json
from datetime import datetime

app = Flask(__name__)

# Secret key for verifying webhook signatures (should be stored securely in production)
WEBHOOK_SECRET = "your_webhook_secret_key"

# Mock order database (in production, use a real database)
orders_db = {
    "order_123": {"status": "pending", "amount": 99.99},
    "order_456": {"status": "paid", "amount": 49.50}
}

def verify_webhook_signature(payload, signature):
    """Verify the webhook signature to ensure it's from the payment provider"""
    if not signature:
        return False
    
    # Compute HMAC-SHA256 signature
    expected_signature = hmac.new(
        WEBHOOK_SECRET.encode(),
        payload,
        hashlib.sha256
    ).hexdigest()
    
    # Use constant-time comparison to prevent timing attacks
    return hmac.compare_digest(expected_signature, signature)

@app.route('/webhook/payment', methods=['POST'])
def payment_webhook():
    try:
        # Get raw request body and headers
        payload = request.get_data()
        signature = request.headers.get('X-Payment-Signature')
        
        # Verify webhook signature (important for security)
        if not verify_webhook_signature(payload, signature):
            return jsonify({"error": "Invalid signature"}), 401
        
        # Parse JSON data
        event_data = json.loads(payload.decode('utf-8'))
        
        # Extract relevant information from the webhook event
        order_id = event_data.get('order_id')
        payment_status = event_data.get('status')  # e.g., 'paid', 'failed', 'refunded'
        
        if not order_id or not payment_status:
            return jsonify({"error": "Missing required fields"}), 400
        
        # Update order status in database
        if order_id in orders_db:
            # Map payment provider statuses to internal statuses
            status_mapping = {
                'paid': 'completed',
                'failed': 'failed',
                'refunded': 'refunded',
                'pending': 'pending'
            }
            
            new_status = status_mapping.get(payment_status, payment_status)
            orders_db[order_id]['status'] = new_status
            
            # Log the update (in production, use proper logging)
            print(f"Updated order {order_id} status to {new_status}")
        else:
            return jsonify({"error": "Order not found"}), 404
        
        # Return success response
        return jsonify({
            "status": "success",
            "message": f"Order {order_id} updated to {orders_db[order_id]['status']}"
        }), 200
        
    except json.JSONDecodeError:
        return jsonify({"error": "Invalid JSON"}), 400
    except Exception as e:
        # Log the error in production
        print(f"Webhook processing error: {str(e)}")
        return jsonify({"error": "Internal server error"}), 500

if __name__ == '__main__':
    app.run(debug=True)