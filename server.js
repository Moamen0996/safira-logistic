// الصق الملف ده كامل في server.js
const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const app = express();
app.use(cors({ origin: true, credentials: true }));
app.use(express.json({ limit: '15mb' }));

let fallbackDatabase = {
    orders: [],
    delegates: [],
    merchants: [
        { id: "MER-201", name: "متجر القاهرة الإلكتروني", phone: "01011223344", dues: 2400 },
    ],
    merchantRequests: [], // ده اللي هيظهر في الإدارة
    pricing: [],
    payouts: [],
    shipments: []
};

const safiraSchema = new mongoose.Schema({
    singletonKey: { type: String, default: 'main_db', unique: true },
    data: { type: Object, required: true }
}, { timestamps: true });
const SafiraModel = mongoose.models.SafiraData || mongoose.model('SafiraData', safiraSchema);

async function connectDB() {
    const mongoUri = process.env.MONGODB_URI || process.env.MONGO_URL;
    if (!mongoUri) return false;
    if (mongoose.connection.readyState === 1) return true;
    try {
        await mongoose.connect(mongoUri, { serverSelectionTimeoutMS: 8000 });
        const existing = await SafiraModel.findOne({ singletonKey: 'main_db' });
        if (!existing) await SafiraModel.create({ singletonKey: 'main_db', data: fallbackDatabase });
        else fallbackDatabase = existing.data;
        if(!fallbackDatabase.merchantRequests) fallbackDatabase.merchantRequests = [];
        return true;
    } catch (err) { return false; }
}
connectDB();

// ===== ROUTES =====
app.get('/api/sync', async (req, res) => {
    try {
        if (mongoose.connection.readyState!== 1) await connectDB();
        const doc = await SafiraModel.findOne({ singletonKey: 'main_db' });
        if (doc && doc.data) return res.json({ success: true, data: doc.data, storage: 'mongodb' });
        res.json({ success: true, data: fallbackDatabase, storage: 'in-memory' });
    } catch (err) { res.json({ success: true, data: fallbackDatabase }); }
});
app.post('/api/sync', async (req, res) => {
    try {
        fallbackDatabase = req.body;
        if(!fallbackDatabase.merchantRequests) fallbackDatabase.merchantRequests = [];
        if (mongoose.connection.readyState === 1) await SafiraModel.findOneAndUpdate({ singletonKey: 'main_db' }, { data: fallbackDatabase }, { upsert: true });
        res.json({ success: true });
    } catch (err) { res.status(500).json({ success: false }); }
});

app.get('/api/merchant-requests', (req, res) => res.json(fallbackDatabase.merchantRequests || []));
app.get('/api/merchants', (req, res) => res.json(fallbackDatabase.merchants || []));

// التسجيل الجديد بمنع سحابي
app.post('/api/merchants/register', async (req, res) => {
    try {
        const { ownerName, phone, companyName, type, commercialId, password } = req.body;
        if (!phone ||!companyName) return res.status(400).json({ success: false, message: 'بيانات ناقصة' });
        if(!fallbackDatabase.merchantRequests) fallbackDatabase.merchantRequests = [];
        const clientIp = req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.ip || 'unknown';

        const phoneExists = fallbackDatabase.merchants?.some(m => m.phone === phone) || fallbackDatabase.merchantRequests?.some(r => r.phone === phone &&!r.isDuplicate && r.status!== 'مرفوض');
        const companyExists = fallbackDatabase.merchants?.some(m => m.name === companyName) || fallbackDatabase.merchantRequests?.some(r => r.companyName === companyName &&!r.isDuplicate && r.status!== 'مرفوض');

        if (phoneExists || companyExists) {
            fallbackDatabase.merchantRequests.push({ id: `REQ-${Date.now()}`, ownerName, phone, companyName, status: 'مرفوض - بيانات مسجلة مسبقاً', ip: clientIp, isDuplicate: true, date: new Date().toLocaleString('ar-EG') });
            if (mongoose.connection.readyState === 1) await SafiraModel.findOneAndUpdate({ singletonKey: 'main_db' }, { data: fallbackDatabase }, { upsert: true });
            return res.status(400).json({ success: false, message: 'عذراً، هذه البيانات مسجلة مسبقاً لدى النظام وتم إرسال التنبيه للإدارة!' });
        }

        const newRequest = { id: `REQ-${Date.now()}`, ownerName, phone, companyName, type, commercialId, password, status: 'قيد المراجعة', ip: clientIp, date: new Date().toLocaleString('ar-EG'), createdAt: new Date() };
        fallbackDatabase.merchantRequests.push(newRequest);
        if (mongoose.connection.readyState === 1) await SafiraModel.findOneAndUpdate({ singletonKey: 'main_db' }, { data: fallbackDatabase }, { upsert: true });
        res.status(201).json({ success: true, message: 'تم الإرسال', request: newRequest });
    } catch (err) { res.status(500).json({ success: false }); }
});

app.post('/api/merchant-requests/approve', async (req, res) => {
    const { requestId } = req.body;
    const request = (fallbackDatabase.merchantRequests || []).find(r => r.id === requestId);
    if (!request) return res.status(404).json({ success: false });
    request.status = 'مقبول';
    fallbackDatabase.merchants.push({ id: `MER-${Date.now()}`, name: request.companyName, phone: request.phone, dues: 0 });
    if (mongoose.connection.readyState === 1) await SafiraModel.findOneAndUpdate({ singletonKey: 'main_db' }, { data: fallbackDatabase }, { upsert: true });
    res.json({ success: true });
});

app.post('/api/merchant-requests/reject', async (req, res) => {
    const { requestId } = req.body;
    fallbackDatabase.merchantRequests = (fallbackDatabase.merchantRequests || []).filter(r => r.id!== requestId);
    if (mongoose.connection.readyState === 1) await SafiraModel.findOneAndUpdate({ singletonKey: 'main_db' }, { data: fallbackDatabase }, { upsert: true });
    res.json({ success: true });
});

app.get('/', (req, res) => res.send('Safira Logistics Cloud Server is running successfully!'));
module.exports = app;
