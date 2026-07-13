from flask import Flask, request, jsonify
import hashlib
import hmac
import json
import os
from datetime import datetime

app = Flask(__name__)

# Secret key for verifying webhook signatures (should be stored in environment variable)
WEBHOOK_SECRET = os.environ.get('WEBHOOK_SECRET', 'your-secret-key')

# Mock order database (in production, use a real database)
orders_db = {}

def verify_webhook_signature(payload, signature):
    """Verify the webhook signature to ensure it's from the payment provider"""
    if not signature:
        return False
    
    # Create HMAC signature using the payload and secret
    expected_signature = hmac.new(
        key=WEBHOOK_SECRET.encode(),
        msg=payload,
        digestmod=hashlib.sha256
    ).hexdigest()
    
    # Use constant-time comparison to prevent timing attacks
    return hmac.compare_digest(expected_signature, signature)

@app.route('/webhook/payment', methods=['POST'])
def payment_webhook():
    try:
        # Get raw request body for signature verification
        payload = request.get_data()
        
        # Extract signature from headers (commonly 'X-Signature' or similar)
        signature = request.headers.get('X-Signature') or request.headers.get('X-Payment-Signature')
        
        # Verify webhook signature
        if not verify_webhook_signature(payload, signature):
            return jsonify({'error': 'Invalid signature'}), 401
        
        # Parse JSON payload
        data = json.loads(payload)
        
        # Extract relevant information from the webhook event
        order_id = data.get('order_id')
        payment_status = data.get('status')  # e.g., 'paid', 'failed', 'refunded'
        transaction_id = data.get('transaction_id')
        amount = data.get('amount')
        
        if not order_id:
            return jsonify({'error': 'Missing order_id'}), 400
        
        # Update order status in database
        if order_id in orders_db:
            orders_db[order_id].update({
                'payment_status': payment_status,
                'transaction_id': transaction_id,
                'amount': amount,
                'updated_at': datetime.utcnow().isoformat()
            })
            
            # Log the update (in production, use proper logging)
            print(f"Updated order {order_id} to status: {payment_status}")
        else:
            # Create new order record if it doesn't exist
            orders_db[order_id] = {
                'order_id': order_id,
                'payment_status': payment_status,
                'transaction_id': transaction_id,
                'amount': amount,
                'created_at': datetime.utcnow().isoformat(),
                'updated_at': datetime.utcnow().isoformat()
            }
        
        # Return success response to acknowledge receipt
        return jsonify({'status': 'received'}), 200
        
    except json.JSONDecodeError:
        return jsonify({'error': 'Invalid JSON payload'}), 400
    except Exception as e:
        # Log the error in production
        print(f"Webhook processing error: {str(e)}")
        return jsonify({'error': 'Internal server error'}), 500

# Example route to check order status (for testing)
@app.route('/orders/<order_id>', methods=['GET'])
def get_order_status(order_id):
    if order_id in orders_db:
        return jsonify(orders_db[order_id]), 200
    else:
        return jsonify({'error': 'Order not found'}), 404

if __name__ == '__main__':
    app.run(debug=True, port=5000)