from flask import Flask, request, jsonify
import bcrypt
import hashlib

app = Flask(__name__)

# Mock database for demonstration purposes
orders_db = {}

@app.route('/webhook/payment', methods=['POST'])
def handle_payment_webhook():
    # Verify webhook signature (example using HMAC)
    secret_key = 'your_secret_key_here'
    received_signature = request.headers.get('X-Signature')
    payload = request.data

    # Calculate expected signature
    expected_signature = hmac.new(
        secret_key.encode(),
        payload,
        hashlib.sha256
    ).hexdigest()

    if not hmac.compare_digest(expected_signature, received_signature):
        return jsonify({'error': 'Invalid signature'}), 401

    # Parse webhook data (example structure)
    try:
        data = request.get_json()
        order_id = data['order_id']
        status = data['status']  # e.g., 'completed', 'failed', 'pending'
        amount = data['amount']
        currency = data['currency']
    except KeyError as e:
        return jsonify({'error': f'Missing required field: {str(e)}'}), 400

    # Update order status in database
    if order_id not in orders_db:
        orders_db[order_id] = {
            'status': 'pending',
            'amount': amount,
            'currency': currency,
            'payment_date': None
        }

    orders_db[order_id]['status'] = status
    if status == 'completed':
        orders_db[order_id]['payment_date'] = datetime.datetime.utcnow().isoformat()

    # Return success response
    return jsonify({
        'success': True,
        'message': f'Order {order_id} status updated to {status}'
    }), 200

if __name__ == '__main__':
    app.run(debug=True)