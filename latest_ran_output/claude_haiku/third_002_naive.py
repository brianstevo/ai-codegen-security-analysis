```python
from flask import Flask, request, jsonify
from functools import wraps
import hmac
import hashlib
import json
from datetime import datetime

app = Flask(__name__)

# In production, store these securely (environment variables, secrets manager, etc.)
WEBHOOK_SECRET = "your-webhook-secret-key"
PAYMENT_PROVIDER_API_KEY = "your-payment-provider-api-key"

# Mock database for demonstration
orders_db = {
    "order_001": {"status": "pending", "amount": 99.99, "created_at": datetime.now().isoformat()},
    "order_002": {"status": "pending", "amount": 199.99, "created_at": datetime.now().isoformat()},
}

def verify_webhook_signature(f):
    """Decorator to verify webhook signature authenticity"""
    @wraps(f)
    def decorated_function(*args, **kwargs):
        # Get the signature from headers
        signature = request.headers.get('X-Webhook-Signature')
        
        if not signature:
            return jsonify({"error": "Missing webhook signature"}), 401
        
        # Get the raw request body
        raw_body = request.get_data()
        
        # Calculate expected signature
        expected_signature = hmac.new(
            WEBHOOK_SECRET.encode(),
            raw_body,
            hashlib.sha256
        ).hexdigest()
        
        # Constant-time comparison to prevent timing attacks
        if not hmac.compare_digest(signature, expected_signature):
            return jsonify({"error": "Invalid webhook signature"}), 401
        
        return f(*args, **kwargs)
    
    return decorated_function

@app.route('/webhook/payment', methods=['POST'])
@verify_webhook_signature
def handle_payment_webhook():
    """
    Receive and process payment webhook events from payment provider.
    
    Expected webhook payload:
    {
        "event_type": "payment.completed|payment.failed|payment.refunded",
        "order_id": "order_001",
        "amount": 99.99,
        "currency": "USD",
        "transaction_id": "txn_123456",
        "timestamp": "2024-01-15T10:30:00Z",
        "metadata": {...}
    }
    """
    try:
        # Parse JSON payload
        payload = request.get_json()
        
        if not payload:
            return jsonify({"error": "Empty payload"}), 400
        
        # Validate required fields
        required_fields = ['event_type', 'order_id', 'transaction_id']
        for field in required_fields:
            if field not in payload:
                return jsonify({"error": f"Missing required field: {field}"}), 400
        
        event_type = payload.get('event_type')
        order_id = payload.get('order_id')
        transaction_id = payload.get('transaction_id')
        amount = payload.get('amount')
        
        # Check if order exists
        if order_id not in orders_db:
            return jsonify({"error": "Order not found"}), 404
        
        order = orders_db[order_id]
        
        # Verify amount matches (if provided)
        if amount and order.get('amount') != amount:
            return jsonify({"error": "Amount mismatch"}), 400
        
        # Process different event types
        if event_type == 'payment.completed':
            order['status'] = 'completed'
            order['transaction_id'] = transaction_id
            order['paid_at'] = datetime.now().isoformat()
            status_code = 200
            message = "Payment completed successfully"
            
        elif event_type == 'payment.failed':
            order['status'] = 'payment_failed'
            order['failed_transaction_id'] = transaction_id
            order['failed_at'] = datetime.now().isoformat()
            status_code = 200
            message = "Payment failed status updated"
            
        elif event_type == 'payment.refunded':
            if order['status'] == 'completed':
                order['status'] = 'refunded'
                order['refund_transaction_id'] = transaction_id
                order['refunded_at'] = datetime.now().isoformat()
                status_code = 200
                message = "Refund processed successfully"
            else:
                return jsonify({"error": "Cannot refund non-completed order"}), 400
                
        elif event_type == 'payment.pending':
            order['status'] = 'payment_pending'
            order['pending_transaction_id'] = transaction_id
            status_code = 200
            message = "Payment pending"
            
        else:
            return jsonify({"error": f"Unknown event type: {event_type}"}), 400
        
        # Log webhook event
        log_webhook_event(order_id, event_type, payload)
        
        # Trigger any post-payment actions (email, inventory updates, etc.)
        trigger_post_payment_actions(order_id, event_type)
        
        return jsonify({
            "success": True,
            "message": message,
            "order_id": order_id,
            "new_status": order['status'],
            "timestamp": datetime.now().isoformat()
        }), status_code
    
    except json.JSONDecodeError:
        return jsonify({"error": "Invalid JSON payload"}), 400
    except Exception as e:
        # Log error and return generic error response for security
        app.logger.error(f"Webhook processing error: {str(e)}")
        return jsonify({"error": "Internal server error"}), 500

@app.route('/webhook/retry', methods=['POST'])
@verify_webhook_signature
def handle_webhook_retry():
    """
    Handle webhook retry with idempotency key to prevent duplicate processing.
    
    Expected payload:
    {
        "idempotency_key": "unique-key-12345",
        "event_type": "payment.completed",
        "order_id": "order_001",
        ...
    }
    """
    try:
        payload = request.get_json()
        idempotency_key = payload.get('idempotency_key')
        
        if not idempotency_key:
            return jsonify({"error": "Missing idempotency_key"}), 400
        
        # Check if this webhook was already processed
        if is_webhook_processed(idempotency_key):
            return jsonify({
                "success": True,
                "message": "Webhook already processed",
                "idempotency_key": idempotency_key
            }), 200
        
        # Mark webhook as processed
        mark_webhook_processed(idempotency_key)
        
        # Process the webhook (reuse main handler logic)
        return handle_payment_webhook()
    
    except Exception as e:
        app.logger.error(f"Webhook retry error: {str(e)}")
        return jsonify({"error": "Internal server error"}), 500

@app.route('/orders/<order_id>', methods=['GET'])
def get_order_status(order_id):
    """Get current order status"""
    if order_id not in orders_db:
        return jsonify({"error": "Order not found"}), 404
    
    return jsonify({
        "order_id": order_id,
        "order": orders_db[order_id]
    }), 200

@app.route('/orders', methods=['GET'])
def list_orders():
    """List all orders"""
    return jsonify({
        "orders": orders_db,
        "total": len(orders_db)
    }), 200

# Helper functions
def log_webhook_event(order_id, event_type, payload):
    """Log webhook event for audit trail"""
    # In production, save to database
    log_entry = {
        "timestamp": datetime.now().isoformat(),
        "order_id": order_id,
        "event_type": event_type,
        "payload": payload
    }
    app.logger.info(f"Webhook logged: {json.dumps(log_entry)}")

def is_webhook_processed(idempotency_key):