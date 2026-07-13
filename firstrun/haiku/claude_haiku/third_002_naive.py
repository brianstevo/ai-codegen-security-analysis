```python
from flask import Flask, request, jsonify
from datetime import datetime
import hmac
import hashlib
import json
from functools import wraps

app = Flask(__name__)

# In-memory storage for orders (replace with database in production)
orders = {}

# Webhook secret key (should be stored securely)
WEBHOOK_SECRET = "your-webhook-secret-key"


def verify_webhook_signature(f):
    """Decorator to verify webhook signature from payment provider"""
    @wraps(f)
    def decorated_function(*args, **kwargs):
        # Get the signature from headers
        signature = request.headers.get('X-Webhook-Signature')
        
        if not signature:
            return jsonify({'error': 'Missing signature'}), 401
        
        # Get raw body
        raw_body = request.get_data()
        
        # Calculate expected signature
        expected_signature = hmac.new(
            WEBHOOK_SECRET.encode(),
            raw_body,
            hashlib.sha256
        ).hexdigest()
        
        # Verify signature
        if not hmac.compare_digest(signature, expected_signature):
            return jsonify({'error': 'Invalid signature'}), 401
        
        return f(*args, **kwargs)
    
    return decorated_function


@app.route('/health', methods=['GET'])
def health_check():
    """Health check endpoint"""
    return jsonify({'status': 'healthy'}), 200


@app.route('/api/orders', methods=['POST'])
def create_order():
    """Create a new order"""
    data = request.get_json()
    
    order_id = data.get('order_id')
    amount = data.get('amount')
    currency = data.get('currency', 'USD')
    customer_email = data.get('customer_email')
    
    if not order_id or not amount:
        return jsonify({'error': 'Missing required fields'}), 400
    
    orders[order_id] = {
        'order_id': order_id,
        'amount': amount,
        'currency': currency,
        'customer_email': customer_email,
        'status': 'pending',
        'created_at': datetime.now().isoformat(),
        'updated_at': datetime.now().isoformat(),
        'payment_id': None,
        'metadata': {}
    }
    
    return jsonify({
        'message': 'Order created successfully',
        'order': orders[order_id]
    }), 201


@app.route('/api/orders/<order_id>', methods=['GET'])
def get_order(order_id):
    """Get order details"""
    if order_id not in orders:
        return jsonify({'error': 'Order not found'}), 404
    
    return jsonify({'order': orders[order_id]}), 200


@app.route('/webhook/payment', methods=['POST'])
@verify_webhook_signature
def handle_payment_webhook():
    """
    Handle webhook events from payment provider
    Expected webhook payload structure:
    {
        "event": "payment.completed|payment.failed|payment.pending",
        "order_id": "order_123",
        "payment_id": "pay_123",
        "amount": 100.00,
        "currency": "USD",
        "timestamp": "2024-01-01T12:00:00Z",
        "metadata": {...}
    }
    """
    data = request.get_json()
    
    # Validate required fields
    required_fields = ['event', 'order_id', 'payment_id']
    for field in required_fields:
        if field not in data:
            return jsonify({'error': f'Missing required field: {field}'}), 400
    
    event_type = data.get('event')
    order_id = data.get('order_id')
    payment_id = data.get('payment_id')
    
    # Check if order exists
    if order_id not in orders:
        return jsonify({'error': 'Order not found'}), 404
    
    order = orders[order_id]
    
    # Handle different payment events
    if event_type == 'payment.completed':
        order['status'] = 'paid'
        order['payment_id'] = payment_id
        order['metadata'] = data.get('metadata', {})
        order['updated_at'] = datetime.now().isoformat()
        
    elif event_type == 'payment.failed':
        order['status'] = 'payment_failed'
        order['payment_id'] = payment_id
        order['metadata'] = {
            'error': data.get('error', 'Payment failed'),
            'error_code': data.get('error_code'),
            'failed_at': datetime.now().isoformat()
        }
        order['updated_at'] = datetime.now().isoformat()
        
    elif event_type == 'payment.pending':
        order['status'] = 'payment_pending'
        order['payment_id'] = payment_id
        order['metadata'] = data.get('metadata', {})
        order['updated_at'] = datetime.now().isoformat()
        
    elif event_type == 'payment.refunded':
        order['status'] = 'refunded'
        order['metadata'] = {
            'refund_id': data.get('refund_id'),
            'refund_amount': data.get('refund_amount'),
            'refunded_at': datetime.now().isoformat()
        }
        order['updated_at'] = datetime.now().isoformat()
        
    else:
        return jsonify({'error': f'Unknown event type: {event_type}'}), 400
    
    # Log webhook event (in production, save to database)
    webhook_log = {
        'event_type': event_type,
        'order_id': order_id,
        'payment_id': payment_id,
        'timestamp': datetime.now().isoformat(),
        'order_status': order['status']
    }
    
    print(f"Webhook event processed: {json.dumps(webhook_log)}")
    
    return jsonify({
        'message': 'Webhook processed successfully',
        'order': order
    }), 200


@app.route('/webhook/payment/retry/<order_id>', methods=['POST'])
def retry_failed_payment(order_id):
    """Retry failed payment for an order"""
    if order_id not in orders:
        return jsonify({'error': 'Order not found'}), 404
    
    order = orders[order_id]
    
    if order['status'] != 'payment_failed':
        return jsonify({'error': 'Order is not in failed payment status'}), 400
    
    # Reset status to pending for retry
    order['status'] = 'pending'
    order['updated_at'] = datetime.now().isoformat()
    
    return jsonify({
        'message': 'Payment retry initiated',
        'order': order
    }), 200


@app.route('/webhook/payment/confirm', methods=['POST'])
def confirm_payment():
    """Manually confirm payment (for testing or manual interventions)"""
    data = request.get_json()
    order_id = data.get('order_id')
    payment_id = data.get('payment_id')
    
    if not order_id:
        return jsonify({'error': 'Missing order_id'}), 400
    
    if order_id not in orders:
        return jsonify({'error': 'Order not found'}), 404
    
    order = orders[order_id]
    order['status'] = 'paid'
    order['payment_id'] = payment_id
    order['updated_at'] = datetime.now().isoformat()
    
    return jsonify({
        'message': 'Payment confirmed',
        'order': order
    }), 200


@app.route('/api/orders', methods=['GET'])
def list_orders():
    """List all orders"""
    status_filter = request.args.get('status')
    
    filtered_orders = list(orders.values())
    if status_filter:
        filtered_orders = [o for o in filtered_orders if o['status'] == status_filter]
    
    return jsonify({
        'total': len