require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 8080;

app.use(cors({
  origin: "*",
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"]
}));
app.use(express.json({ limit: '15mb' }));

let fallbackDatabase = {
    orders: [
        { id: "SAF-9001", waybill: "WAY-884102", merchantId: "MER-201", merchantName: "متجر القاهرة الإلكتروني", custName: "محمود حسن", custPhone: "01012345678", address: "القاهرة - مدينة نصر", amount: 850, shipping: 70, delegateId: "DEL-101", status: "قيد التوصيل", locked: false },
        { id: "SAF-9002", waybill: "WAY-884103", merchantId: "MER-202", merchantName: "أزياء الإسكندرية", custName: "سارة أحمد", custPhone: "01298765432", address: "الإسكندرية - سموحة", amount: 1200, shipping: 80, delegateId: "DEL-102", status: "في المخزن", locked: false }
    ],
    delegates: [
        { id: "DEL-101", name: "أحمد محمود", phone: "01099887766", username: "ahmed", password: "123", lat: 30.0444, lng: 31.2357 },
        { id: "DEL-102", name: "محمد إبراهيم", phone: "01122334455", username: "mohamed", password: "123", lat: 31.2001, lng: 29.9187 }
    ],
    merchants: [
        { id: "MER-201", name: "متجر القاهرة الإلكتروني", phone: "01011223344", dues: 2400 },
        { id: "MER-202", name: "أزياء الإسكندرية", phone: "01233445566", dues: 4100 }
    ],
    pricing: [
        { gov: "القاهرة الكبرى (القاهرة، الجيزة، القليوبية)", merchantRate: 70, delegateRate: 45, deliveryTime: "24 ساعة" },
        { gov: "الإسكندرية", merchantRate: 80, delegateRate: 50, deliveryTime: "48 ساعة" },
        { gov: "الدقهلية / المنصورة", merchantRate: 85, delegateRate: 55, deliveryTime: "48-72 ساعة" },
        { gov: "الشرقية / طنطا / الغربية", merchantRate: 85, delegateRate: 55, deliveryTime: "48-72 ساعة" },
        { gov: "محافظات الصعيد (أسيوط، سوهاج، قنا)", merchantRate: 110, delegateRate: 75, deliveryTime: "3-4 أيام" },
        { gov: "باقي المحافظات والحدودية", merchantRate: 120, delegateRate: 80, deliveryTime: "4-5 أيام" }
    ],
    payouts: []
};

const safiraSchema = new mongoose.Schema({
    singletonKey: { type: String, default: 'main_db', unique: true },
    data: { type: Object, required: true }
}, { timestamps: true });
const SafiraModel = mongoose.model('SafiraData', safiraSchema);
let isMongoConnected = false;
let mongoUri = process.env.MONGODB_URI || process.env.MONGO_URL || 'mongodb+srv://safira:safira2026@cluster0.yucaqm0.mongodb.net/?appName=Cluster0';

function sanitizeMongoUri(uri) {
    if (!uri) return '';
    try {
        const regex = /^(mongodb(?:\+srv)?:\/\/)([^:]+):([^@]+)@(.*)$/;
        const match = uri.match(regex);
        if (match) {
            const prefix = match[1]; const user = match[2]; const pass = match[3]; const rest = match[4];
            let decodedPass = pass; try { decodedPass = decodeURIComponent(pass); } catch(e) {}
            return `${prefix}${user}:${encodeURIComponent(decodedPass)}@${rest}`;
        }
    } catch (e) {}
    return uri;
}

async function connectDB() {
    if (!mongoUri || mongoUri.includes('YOUR_USERNAME')) return;
    const cleanUri = sanitizeMongoUri(mongoUri);
    try {
        await mongoose.connect(cleanUri, { serverSelectionTimeoutMS: 5000, family: 4 });
        isMongoConnected = true;
        console.log('Connected to MongoDB!');
        const existing = await SafiraModel.findOne({ singletonKey: 'main_db' });
        if (!existing) await SafiraModel.create({ singletonKey: 'main_db', data: fallbackDatabase });
        else fallbackDatabase = existing.data;
    } catch (err) { isMongoConnected = false; console.error('MongoDB error:', err.message); }
}
connectDB();

app.get('/api/merchants', (req, res) => res.json(fallbackDatabase.merchants || []));
app.get('/api/couriers', (req, res) => res.json(fallbackDatabase.couriers || fallbackDatabase.delegates || []));
app.get('/api/shipments', (req, res) => res.json(fallbackDatabase.shipments || fallbackDatabase.orders || []));
app.post('/api/login', (req, res) => res.json({ success: true }));

app.get('/api/sync', async (req, res) => {
    try {
        if (isMongoConnected && mongoose.connection.readyState === 1) {
            const doc = await SafiraModel.findOne({ singletonKey: 'main_db' });
            if (doc && doc.data) return res.json({ success: true, data: doc.data, storage: 'mongodb' });
        }
        res.json({ success: true, data: fallbackDatabase, storage: 'in-memory' });
    } catch (err) { res.status(500).json({ success: false, error: err.message, data: fallbackDatabase }); }
});

app.post('/api/sync', async (req, res) => {
    try {
        fallbackDatabase = req.body;
        if (isMongoConnected) await SafiraModel.findOneAndUpdate({ singletonKey: 'main_db' }, { data: fallbackDatabase }, { upsert: true });
        res.json({ success: true });
    } catch (err) { res.status(500).json({ success: false, error: err.message }); }
});

app.post('/api/merchants', async (req, res) => {
    const { name, phone } = req.body;
    if (!name || !phone) return res.status(400).json({ success: false, error: 'بيانات ناقصة' });
    const newMerchant = { id: `MER-${Date.now()}`, name, phone, dues: 0 };
    fallbackDatabase.merchants.push(newMerchant);
    if (isMongoConnected) await SafiraModel.findOneAndUpdate({ singletonKey: 'main_db' }, { data: fallbackDatabase }, { upsert: true });
    res.json({ success: true, merchant: newMerchant });
});

app.post('/api/couriers', async (req, res) => {
    const { name, phone } = req.body;
    if (!name || !phone) return res.status(400).json({ success: false, error: 'بيانات ناقصة' });
    const newCourier = { id: `DEL-${Date.now()}`, name, phone, username: `courier_${Date.now()}`, password: '123', lat: 30.0444, lng: 31.2357 };
    fallbackDatabase.delegates.push(newCourier);
    if (isMongoConnected) await SafiraModel.findOneAndUpdate({ singletonKey: 'main_db' }, { data: fallbackDatabase }, { upsert: true });
    res.json({ success: true, courier: newCourier });
});

app.post('/api/orders/bulk', async (req, res) => {
    const { orders } = req.body;
    fallbackDatabase.orders.push(...orders);
    if (isMongoConnected) await SafiraModel.findOneAndUpdate({ singletonKey: 'main_db' }, { data: fallbackDatabase }, { upsert: true });
    res.status(201).json({ success: true, count: orders.length });
});

app.post('/api/delegates/login', async (req, res) => {
    const { username, password } = req.body;
    const delegate = (fallbackDatabase.delegates || []).find(d => d.username === username && d.password === password);
    if (!delegate) return res.status(401).json({ success: false, error: 'بيانات غلط' });
    res.json({ success: true, delegate });
});

app.post('/api/delegates/location', async (req, res) => {
    const { delegateId, lat, lng } = req.body;
    const delegate = (fallbackDatabase.delegates || []).find(d => d.id === delegateId);
    if (delegate) {
        delegate.lat = lat; delegate.lng = lng;
        if (isMongoConnected) await SafiraModel.findOneAndUpdate({ singletonKey: 'main_db' }, { data: fallbackDatabase }, { upsert: true });
        return res.json({ success: true });
    }
    res.status(404).json({ success: false });
});

app.post('/api/fix-auth', async (req, res) => {
    try {
        if (req.body.newUri) mongoUri = req.body.newUri;
        if (mongoose.connection.readyState !== 0) await mongoose.disconnect();
        isMongoConnected = false; await connectDB();
        res.json({ success: isMongoConnected, connected: isMongoConnected });
    } catch (err) { res.status(500).json({ success: false, error: err.message }); }
});

app.post('/api/payouts/create', async (req, res) => {
    if (!fallbackDatabase.payouts) fallbackDatabase.payouts = [];
    fallbackDatabase.payouts.push(req.body);
    if (isMongoConnected) await SafiraModel.findOneAndUpdate({ singletonKey: 'main_db' }, { data: fallbackDatabase }, { upsert: true });
    res.json({ success: true, payout: req.body });
});

app.post('/api/payouts/process', async (req, res) => {
    const { payoutId, paidAmount } = req.body;
    const payout = (fallbackDatabase.payouts || []).find(p => p.id === payoutId);
    if (!payout) return res.status(404).json({ success: false });
    const numericPaid = parseFloat(paidAmount) || 0;
    payout.paidAmount = (payout.paidAmount || 0) + numericPaid;
    payout.status = payout.paidAmount >= payout.amount ? 'completed' : 'partial';
    payout.remainingAmount = payout.amount - payout.paidAmount;
    if (payout.merchantId) {
        const merchant = (fallbackDatabase.merchants || []).find(m => m.id === payout.merchantId);
        if (merchant) merchant.dues = Math.max(0, (merchant.dues || 0) - numericPaid);
    }
    if (isMongoConnected) await SafiraModel.findOneAndUpdate({ singletonKey: 'main_db' }, { data: fallbackDatabase }, { upsert: true });
    res.json({ success: true, payout });
});

app.get('/', (req, res) => res.send('Safira Logistics Cloud Server is running successfully!'));
app.listen(PORT, '0.0.0.0', () => console.log(`Server running on ${PORT}`));
