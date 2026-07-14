// webhook.js
require('dotenv').config();
const express = require('express');
const crypto = require('crypto');
const mongoose = require('mongoose');

// ---------- DB Setup ----------
mongoose.connect(process.env.MONGODB_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
});
const orderSchema = new mongoose.Schema({
    providerOrderId: { type: String, required: true, unique: true },
    status: { type: String, enum: ['pending', 'paid', 'failed', 'refunded'], default: 'pending' },
    amount: Number,
    currency: String,
    updatedAt: Date,
});
const Order = mongoose.model('Order', orderSchema);

// ---------- Express App ----------
const app = express();
const PORT = process.env.PORT || 3000;

// Raw body parser for webhook verification
app.use('/webhook', express.raw({ type: 'application/json' }));

// Helper: verify HMAC signature (assumes provider sends SHA256 HMAC in header)
function verifySignature(rawBody, signatureHeader) {
    const secret = Buffer.from(process.env.WEBHOOK_SECRET, 'utf8');
    const computed = crypto.createHmac('sha256', secret).update(rawBody).digest('hex');

    // Use timingSafeEqual to prevent timing attacks
    const sigBuffer = Buffer.from(signatureHeader, 'utf8');
    const compBuffer = Buffer.from(computed, 'utf8');
    if (sigBuffer.length !== compBuffer.length) return false;
    return crypto.timingSafeEqual(sigBuffer, compBuffer);
}

// ---------- Webhook Route ----------
app.post('/webhook', async (req, res) => {
    const signature = req.headers['x-payment-signature'];
    if (!signature) {
        console.warn('Missing signature header');
        return res.status(400).send('Signature required');
    }

    // Verify payload integrity
    if (!verifySignature(req.body, signature)) {
        console.warn('Invalid webhook signature');
        return res.status(401).send('Invalid signature');
    }

    let event;
    try {
        event = JSON.parse(req.body.toString());
    } catch (err) {
        console.error('Failed to parse webhook payload', err);
        return res.status(400).send('Invalid JSON');
    }

    // Expected event structure:
    // { type: 'payment_succeeded' | 'payment_failed' | 'refund_processed',
    //   data: { order_id: string, amount: number, currency: string } }
    const { type, data } = event;
    if (!type || !data?.order_id) {
        console.warn('Malformed webhook event');
        return res.status(400).send('Bad payload');
    }

    try {
        const order = await Order.findOne({ providerOrderId: data.order_id });
        if (!order) {
            console.warn(`Order not found for provider ID ${data.order_id}`);
            // Optionally create a placeholder order or ignore
            return res.status(404).send('Order not found');
        }

        switch (type) {
            case 'payment_succeeded':
                order.status = 'paid';
                break;
            case 'payment_failed':
                order.status = 'failed';
                break;
            case 'refund_processed':
                order.status = 'refunded';
                break;
            default:
                console.info(`Unhandled webhook type: ${type}`);
                // Acknowledge anyway
                return res.status(200).send('Event ignored');
        }

        order.amount = data.amount ?? order.amount;
        order.currency = data.currency ?? order.currency;
        order.updatedAt = new Date();

        await order.save();
        console.info(`Order ${order.providerOrderId} updated to status ${order.status}`);
        return res.status(200).send('OK');
    } catch (err) {
        console.error('Error processing webhook', err);
        return res.status(500).send('Internal Server Error');
    }
});

// ---------- Start Server ----------
app.listen(PORT, () => {
    console.log(`Webhook listener running on port ${PORT}`);
});