const express = require('express');
const mongoose = require('mongoose');
const path = require('path');
const cors = require('cors');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 8080;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(__dirname));

// ⚠️ ضع هنا رابط الاتصال الحقيقي الذي نسخته من زر Connect في MongoDB Atlas بالكامل
// تأكد من استبدال كلمة المرور الحقيقية مكان <password>
const MONGODB_URI = 'mongodb+srv://moamenbeliever_db_user:<moamenbeliever_db_user>@cluster0.yucaqm0.mongodb.net/?appName=Cluster0.xxxxx.mongodb.net/safira_logistic?retryWrites=true&w=majority';

console.log('🔗 جاري الاتصال بقاعدة البيانات باستخدام الحساب: moamenbeliever_db_user...');

mongoose.connect(MONGODB_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true
})
.then(() => console.log('✅ MongoDB Connected Successfully'))
.catch(err => console.error('❌ MongoDB Connection Error:', err));

// Order Schema
const orderSchema = new mongoose.Schema({
    orderId: { type: String, unique: true, required: true },
    waybill: String,
    merchantId: String,
    merchantName: String,
    customerName: String,
    customerPhone: String,
    governorate: String,
    address: String,
    amount: Number,
    shippingFee: Number,
    paymentType: String,
    status: { type: String, default: 'قيد المراجعة' },
    delegateId: String,
    delegateName: String,
    notes: String,
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now }
});

// Delegate Schema
const delegateSchema = new mongoose.Schema({
    delegateId: { type: String, unique: true, required: true },
    code: { type: String, unique: true, required: true },
    name: String,
    phone: String,
    governorate: String,
    totalDeliveries: { type: Number, default: 0 },
    successfulDeliveries: { type: Number, default: 0 },
    rejectedDeliveries: { type: Number, default: 0 },
    commissionBalance: { type: Number, default: 0 },
    isTracking: { type: Boolean, default: false },
    lastLocation: {
        latitude: Number,
        longitude: Number,
        timestamp: Date
    },
    createdAt: { type: Date, default: Date.now }
});

// Merchant Schema
const merchantSchema = new mongoose.Schema({
    merchantId: { type: String, unique: true, required: true },
    code: { type: String, unique: true, required: true },
    name: String,
    phone: String,
    governorate: String,
    totalOrders: { type: Number, default: 0 },
    accountBalance: { type: Number, default: 0 },
    createdAt: { type: Date, default: Date.now }
});

// Live Tracking Schema
const trackingSchema = new mongoose.Schema({
    delegateId: String,
    delegateName: String,
    orderId: String,
    latitude: Number,
    longitude: Number,
    accuracy: Number,
    timestamp: { type: Date, default: Date.now }
});

// Payout Request Schema
const payoutSchema = new mongoose.Schema({
    requestId: { type: String, unique: true },
    userId: String,
    userType: String,
    userName: String,
    amount: Number,
    method: String,
    accountNumber: String,
    status: { type: String, default: 'معلق' },
    createdAt: { type: Date, default: Date.now },
    processedAt: Date
});

const Order = mongoose.model('Order', orderSchema);
const Delegate = mongoose.model('Delegate', delegateSchema);
const Merchant = mongoose.model('Merchant', merchantSchema);
const Tracking = mongoose.model('Tracking', trackingSchema);
const PayoutRequest = mongoose.model('PayoutRequest', payoutSchema);

// -------- ORDERS --------
app.post('/api/orders', async (req, res) => {
    try {
        const order = new Order(req.body);
        await order.save();
        res.json({ success: true, order });
    } catch (err) {
        res.status(400).json({ success: false, error: err.message });
    }
});

app.get('/api/orders', async (req, res) => {
    try {
        const orders = await Order.find();
        res.json({ success: true, orders });
    } catch (err) {
        res.status(400).json({ success: false, error: err.message });
    }
});

app.get('/api/orders/:orderId', async (req, res) => {
    try {
        const order = await Order.findOne({ orderId: req.params.orderId });
        res.json({ success: true, order });
    } catch (err) {
        res.status(400).json({ success: false, error: err.message });
    }
});

app.put('/api/orders/:orderId', async (req, res) => {
    try {
        const order = await Order.findOneAndUpdate(
            { orderId: req.params.orderId },
            req.body,
            { new: true }
        );
        res.json({ success: true, order });
    } catch (err) {
        res.status(400).json({ success: false, error: err.message });
    }
});

app.delete('/api/orders/:orderId', async (req, res) => {
    try {
        await Order.findOneAndDelete({ orderId: req.params.orderId });
        res.json({ success: true, message: 'Order deleted' });
    } catch (err) {
        res.status(400).json({ success: false, error: err.message });
    }
});

// -------- DELEGATES --------
app.post('/api/delegates', async (req, res) => {
    try {
        const delegate = new Delegate(req.body);
        await delegate.save();
        res.json({ success: true, delegate });
    } catch (err) {
        res.status(400).json({ success: false, error: err.message });
    }
});

app.get('/api/delegates', async (req, res) => {
    try {
        const delegates = await Delegate.find();
        res.json({ success: true, delegates });
    } catch (err) {
        res.status(400).json({ success: false, error: err.message });
    }
});

app.get('/api/delegates/:delegateId', async (req, res) => {
    try {
        const delegate = await Delegate.findOne({ delegateId: req.params.delegateId });
        res.json({ success: true, delegate });
    } catch (err) {
        res.status(400).json({ success: false, error: err.message });
    }
});

app.put('/api/delegates/:delegateId', async (req, res) => {
    try {
        const delegate = await Delegate.findOneAndUpdate(
            { delegateId: req.params.delegateId },
            req.body,
            { new: true }
        );
        res.json({ success: true, delegate });
    } catch (err) {
        res.status(400).json({ success: false, error: err.message });
    }
});

app.delete('/api/delegates/:delegateId', async (req, res) => {
    try {
        await Delegate.findOneAndDelete({ delegateId: req.params.delegateId });
        res.json({ success: true, message: 'Delegate deleted' });
    } catch (err) {
        res.status(400).json({ success: false, error: err.message });
    }
});

// -------- MERCHANTS --------
app.post('/api/merchants', async (req, res) => {
    try {
        const merchant = new Merchant(req.body);
        await merchant.save();
        res.json({ success: true, merchant });
    } catch (err) {
        res.status(400).json({ success: false, error: err.message });
    }
});

app.get('/api/merchants', async (req, res) => {
    try {
        const merchants = await Merchant.find();
        res.json({ success: true, merchants });
    } catch (err) {
        res.status(400).json({ success: false, error: err.message });
    }
});

app.get('/api/merchants/:merchantId', async (req, res) => {
    try {
        const merchant = await Merchant.findOne({ merchantId: req.params.merchantId });
        res.json({ success: true, merchant });
    } catch (err) {
        res.status(400).json({ success: false, error: err.message });
    }
});

app.put('/api/merchants/:merchantId', async (req, res) => {
    try {
        const merchant = await Merchant.findOneAndUpdate(
            { merchantId: req.params.merchantId },
            req.body,
            { new: true }
        );
        res.json({ success: true, merchant });
    } catch (err) {
        res.status(400).json({ success: false, error: err.message });
    }
});

app.delete('/api/merchants/:merchantId', async (req, res) => {
    try {
        await Merchant.findOneAndDelete({ merchantId: req.params.merchantId });
        res.json({ success: true, message: 'Merchant deleted' });
    } catch (err) {
        res.status(400).json({ success: false, error: err.message });
    }
});

// -------- LIVE TRACKING --------
app.post('/api/track', async (req, res) => {
    try {
        const { orderId, driverName, delegateId, latitude, longitude, accuracy } = req.body;
        
        const tracking = new Tracking({
            delegateId,
            delegateName: driverName,
            orderId,
            latitude,
            longitude,
            accuracy
        });
        await tracking.save();

        await Delegate.findOneAndUpdate(
            { delegateId },
            {
                lastLocation: { latitude, longitude, timestamp: new Date() },
                isTracking: true
            }
        );

        res.json({ success: true, message: 'Location tracked successfully' });
    } catch (err) {
        res.status(400).json({ success: false, error: err.message });
    }
});

app.get('/api/track/:delegateId', async (req, res) => {
    try {
        const locations = await Tracking.find({ delegateId: req.params.delegateId })
            .sort({ timestamp: -1 })
            .limit(50);
        res.json({ success: true, locations });
    } catch (err) {
        res.status(400).json({ success: false, error: err.message });
    }
});

// -------- PAYOUT REQUESTS --------
app.post('/api/payout-requests', async (req, res) => {
    try {
        const requestId = 'PAY-' + Date.now();
        const payout = new PayoutRequest({ ...req.body, requestId });
        await payout.save();
        res.json({ success: true, payout });
    } catch (err) {
        res.status(400).json({ success: false, error: err.message });
    }
});

app.get('/api/payout-requests', async (req, res) => {
    try {
        const payouts = await PayoutRequest.find();
        res.json({ success: true, payouts });
    } catch (err) {
        res.status(400).json({ success: false, error: err.message });
    }
});

app.put('/api/payout-requests/:requestId', async (req, res) => {
    try {
        const payout = await PayoutRequest.findOneAndUpdate(
            { requestId: req.params.requestId },
            req.body,
            { new: true }
        );
        res.json({ success: true, payout });
    } catch (err) {
        res.status(400).json({ success: false, error: err.message });
    }
});

app.delete('/api/payout-requests/:requestId', async (req, res) => {
    try {
        await PayoutRequest.findOneAndDelete({ requestId: req.params.requestId });
        res.json({ success: true, message: 'Payout request deleted' });
    } catch (err) {
        res.status(400).json({ success: false, error: err.message });
    }
});

// -------- STATISTICS --------
app.get('/api/stats/orders', async (req, res) => {
    try {
        const total = await Order.countDocuments();
        const delivered = await Order.countDocuments({ status: 'تم التسليم' });
        const pending = await Order.countDocuments({ status: { $in: ['قيد المراجعة', 'في المخزن', 'قيد التوصيل'] } });
        const returned = await Order.countDocuments({ status: { $in: ['مرتجع', 'تم الرفض'] } });

        res.json({ success: true, total, delivered, pending, returned });
    } catch (err) {
        res.status(400).json({ success: false, error: err.message });
    }
});

app.get('/api/stats/delegates', async (req, res) => {
    try {
        const delegates = await Delegate.find();
        res.json({ success: true, delegates });
    } catch (err) {
        res.status(400).json({ success: false, error: err.message });
    }
});

app.get('/api/stats/merchants', async (req, res) => {
    try {
        const merchants = await Merchant.find();
        res.json({ success: true, merchants });
    } catch (err) {
        res.status(400).json({ success: false, error: err.message });
    }
});

// -------- SERVE HTML FILES --------
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

app.get('/tracker', (req, res) => {
    res.sendFile(path.join(__dirname, 'delivery_tracker.html'));
});

// Health Check
app.get('/api/health', (req, res) => {
    res.json({ status: 'Server is running ✅', timestamp: new Date().toISOString() });
});

// 404 Handler
app.use((req, res) => {
    res.status(404).json({ success: false, error: 'Not Found' });
});

// Error Handling Middleware
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({ success: false, error: 'Internal Server Error' });
});

// Start Server
const server = app.listen(PORT, () => {
    console.log(`\n🚀 Safira Logistics Server running on http://localhost:${PORT}`);
    console.log(`📊 Dashboard: http://localhost:${PORT}`);
    console.log(`🗺️  Tracker: http://localhost:${PORT}/tracker`);
    console.log(`💚 Health Check: http://localhost:${PORT}/api/health\n`);
});

module.exports = app;
