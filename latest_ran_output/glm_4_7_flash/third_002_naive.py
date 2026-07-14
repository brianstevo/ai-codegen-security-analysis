from flask import Flask, request, jsonify
import hmac
import hashlib
import json

app = Flask(__name__)

# Mock database to simulate order storage
orders = {}

def verify_webhook_signature(payload: str, signature_header: str, secret: str) -> bool:
    """
    Verifies the webhook signature to ensure the request comes from the payment provider.
    Assumes the signature header format is 't=<timestamp>,v1=<signature>'.
    """
    if not signature_header:
        return False

    parts = signature_header.split(',')
    timestamp = None
    signature = None

    for part in parts:
        if part.startswith('t='):
            timestamp = part[2:]
        elif part.startswith('v1='):
            signature = part[3:]

    if not timestamp or not signature:
        return False

    # Recalculate the signature
    message = f"{timestamp}.{payload}"
    expected_signature = hmac.new(
        secret.encode('utf-8'),
        message.encode('utf-8'),
        hashlib.sha256
    ).hexdigest()

    return hmac.compare_digest(signature, expected_signature)

@app.route('/webhook', methods=['POST'])
def handle_webhook():
    # 1. Get the signature from headers
    signature_header = request.headers.get('X-Signature')
    
    # 2. Get the raw payload
    payload = request.get_data(as_text=True)

    # 3. Verify the signature
    # In production, use a strong secret key stored in environment variables
    webhook_secret = "your_webhook_secret_key"
    
    if not verify_webhook_signature(payload, signature_header, webhook_secret):
        return jsonify({"error": "Invalid signature"}), 403

    # 4. Parse the JSON payload
    try:
        event_data = json.loads(payload)
        event_type = event_data.get('type')
        event_object = event_data.get('data', {}).get('object', {})
    except json.JSONDecodeError:
        return jsonify({"error": "Invalid JSON"}), 400

    # 5. Handle specific event types
    order_id = event_object.get('id') or event_object.get('order_id')
    
    if not order_id:
        return jsonify({"error": "Order ID not found in payload"}), 400

    if event_type == 'payment_intent.succeeded':
        # Logic to update order status to 'paid'
        orders[order_id] = {'status': 'paid', 'amount': event_object.get('amount')}
        print(f"Order {order_id} marked as paid.")
    
    elif event_type == 'payment_intent.payment_failed':
        # Logic to update order status to 'failed'
        orders[order_id] = {'status': 'failed', 'error': event_object.get('last_payment_error')}
        print(f"Order {order_id} marked as failed.")

    # 6. Return success response
    return jsonify({"status": "success"}), 200

if __name__ == '__main__':
    app.run(port=5000)