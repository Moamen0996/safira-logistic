const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const app = express();
app.use(cors({ origin: true, credentials: true }));
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
    payouts: [],
    shipments: []
};

const safiraSchema = new mongoose.Schema({
    singletonKey: { type: String, default: 'main_db', unique: true },
    data: { type: Object, required: true }
}, { timestamps: true });
const SafiraModel = mongoose.models.SafiraData || mongoose.model('SafiraData', safiraSchema);

let isMongoConnected = false;

async function connectDB() {
    const mongoUri = process.env.MONGODB_URI || process.env.MONGO_URL;
    if (!mongoUri) return false;
    if (mongoose.connection.readyState === 1) { isMongoConnected = true; return true; }
    try {
        await mongoose.connect(mongoUri, { serverSelectionTimeoutMS: 8000 });
        isMongoConnected = true;
        const existing = await SafiraModel.findOne({ singletonKey: 'main_db' });
        if (!existing) await SafiraModel.create({ singletonKey: 'main_db', data: fallbackDatabase });
        else fallbackDatabase = existing.data;
        return true;
    } catch (err) { isMongoConnected = false; return false; }
}
connectDB();

// ===== ROUTES FIXED =====
app.get('/api/merchants', (req, res) => res.json(fallbackDatabase.merchants || []));
app.get('/api/couriers', (req, res) => res.json(fallbackDatabase.couriers || fallbackDatabase.delegates || []));
app.get('/api/delegates', (req, res) => res.json(fallbackDatabase.delegates || []));
app.get('/api/shipments', (req, res) => res.json(fallbackDatabase.shipments || fallbackDatabase.orders || []));
app.get('/api/orders', (req, res) => res.json(fallbackDatabase.orders || fallbackDatabase.shipments || []));
app.get('/api/pricing', (req, res) => res.json(fallbackDatabase.pricing || []));
app.get('/api/finance', (req, res) => res.json({ merchants: fallbackDatabase.merchants, payouts: fallbackDatabase.payouts, orders: fallbackDatabase.orders }));
app.get('/api/payouts', (req, res) => res.json(fallbackDatabase.payouts || []));

app.post('/api/login', (req, res) => res.json({ success: true }));

app.get('/api/sync', async (req, res) => {
    try {
        if (mongoose.connection.readyState !== 1) await connectDB();
        if (isMongoConnected && mongoose.connection.readyState === 1) {
            const doc = await SafiraModel.findOne({ singletonKey: 'main_db' });
            if (doc && doc.data) return res.json({ success: true, data: doc.data, storage: 'mongodb' });
        }
        res.json({ success: true, data: fallbackDatabase, storage: 'in-memory' });
    } catch (err) { res.json({ success: true, data: fallbackDatabase, storage: 'in-memory' }); }
});

app.post('/api/sync', async (req, res) => {
    try {
        fallbackDatabase = req.body;
        if (mongoose.connection.readyState === 1) await SafiraModel.findOneAndUpdate({ singletonKey: 'main_db' }, { data: fallbackDatabase }, { upsert: true });
        else await connectDB().then(async()=>{ if(mongoose.connection.readyState===1) await SafiraModel.findOneAndUpdate({ singletonKey: 'main_db' }, { data: fallbackDatabase }, { upsert: true }) });
        res.json({ success: true });
    } catch (err) { res.status(500).json({ success: false, error: err.message }); }
});

// ... باقي الـ POST routes زي ما هي عندك
app.post('/api/merchants', async (req, res) => {
    const { name, phone } = req.body;
    if (!name || !phone) return res.status(400).json({ success: false, error: 'بيانات ناقصة' });
    const newMerchant = { id: `MER-${Date.now()}`, name, phone, dues: 0 };
    fallbackDatabase.merchants.push(newMerchant);
    if (mongoose.connection.readyState === 1) await SafiraModel.findOneAndUpdate({ singletonKey: 'main_db' }, { data: fallbackDatabase }, { upsert: true });
    res.json({ success: true, merchant: newMerchant });
});

app.post('/api/couriers', async (req, res) => {
    const { name, phone } = req.body;
    if (!name || !phone) return res.status(400).json({ success: false, error: 'بيانات ناقصة' });
    if (!fallbackDatabase.delegates) fallbackDatabase.delegates = [];
    const newCourier = { id: `DEL-${Date.now()}`, name, phone, username: `courier_${Date.now()}`, password: '123', lat: 30.0444, lng: 31.2357 };
    fallbackDatabase.delegates.push(newCourier);
    if (mongoose.connection.readyState === 1) await SafiraModel.findOneAndUpdate({ singletonKey: 'main_db' }, { data: fallbackDatabase }, { upsert: true });
    res.json({ success: true, courier: newCourier });
});

app.post('/api/orders/bulk', async (req, res) => {
    try {
        const { orders } = req.body;
        if (!Array.isArray(orders)) return res.status(400).json({ success: false, error: 'مصفوفة غلط' });
        if (!fallbackDatabase.shipments) fallbackDatabase.shipments = [];
        if (!fallbackDatabase.orders) fallbackDatabase.orders = [];
        fallbackDatabase.shipments.push(...orders);
        fallbackDatabase.orders.push(...orders);
        if (mongoose.connection.readyState === 1) await SafiraModel.findOneAndUpdate({ singletonKey: 'main_db' }, { data: fallbackDatabase }, { upsert: true });
        res.status(201).json({ success: true, count: orders.length });
    } catch (err) { res.status(500).json({ success: false, error: err.message }); }
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
        if (mongoose.connection.readyState === 1) await SafiraModel.findOneAndUpdate({ singletonKey: 'main_db' }, { data: fallbackDatabase }, { upsert: true });
        return res.json({ success: true });
    }
    res.status(404).json({ success: false });
});

app.post('/api/payouts/create', async (req, res) => {
    if (!fallbackDatabase.payouts) fallbackDatabase.payouts = [];
    fallbackDatabase.payouts.push(req.body);
    if (mongoose.connection.readyState === 1) await SafiraModel.findOneAndUpdate({ singletonKey: 'main_db' }, { data: fallbackDatabase }, { upsert: true });
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
    if (mongoose.connection.readyState === 1) await SafiraModel.findOneAndUpdate({ singletonKey: 'main_db' }, { data: fallbackDatabase }, { upsert: true });
    res.json({ success: true, payout });
});

app.get('/', (req, res) => res.send('Safira Logistics Cloud Server is running successfully!'));
// ===== نظام منع التسجيل المكرر السحابي =====
if (!fallbackDatabase.merchantRequests) fallbackDatabase.merchantRequests = [];
if (!fallbackDatabase.blockedIps) fallbackDatabase.blockedIps = [];

// تسجيل تاجر جديد - بمنع سحابي (IP + phone + company)
app.post('/api/merchants/register', async (req, res) => {
    try {
        const { ownerName, phone, companyName, type, commercialId, password } = req.body;

        if (!phone ||!companyName ||!ownerName ||!password) {
            return res.status(400).json({ success: false, message: 'بيانات ناقصة' });
        }

        // هات IP الحقيقي
        const clientIp = req.headers['x-forwarded-for']?.split(',')[0]?.trim() ||
                         req.headers['x-real-ip'] ||
                         req.ip ||
                         'unknown';

        // 1. شيك هل التليفون موجود قبل كده في التجار المقبولين أو الطلبات المعلقة
        const phoneExists = fallbackDatabase.merchants?.some(m => m.phone === phone) ||
                           fallbackDatabase.merchantRequests?.some(r => r.phone === phone && r.status!== 'مرفوض');

        const companyExists = fallbackDatabase.merchants?.some(m => m.name === companyName) ||
                             fallbackDatabase.merchantRequests?.some(r => r.companyName === companyName && r.status!== 'مرفوض');

        if (phoneExists || companyExists) {
            // سجل محاولة تكرار للإدارة
            const duplicateAttempt = {
                id: `DUP-${Date.now()}`,
                ownerName, phone, companyName, type,
                ip: clientIp,
                reason: phoneExists? 'تكرار تليفون' : 'تكرار اسم شركة',
                date: new Date().toISOString()
            };
            fallbackDatabase.merchantRequests.push({
                id: `REQ-${Date.now()}`,
                ownerName, phone, companyName, type, commercialId,
                status: 'مرفوض - بيانات مسجلة مسبقاً',
                ip: clientIp,
                isDuplicate: true,
                date: new Date().toLocaleString('ar-EG')
            });

            if (mongoose.connection.readyState === 1) {
                await SafiraModel.findOneAndUpdate({ singletonKey: 'main_db' }, { data: fallbackDatabase }, { upsert: true });
            }

            return res.status(400).json({
                success: false,
                message: 'عذراً، هذه البيانات مسجلة مسبقاً لدى النظام وتم إرسال التنبيه للإدارة!',
                duplicate: true
            });
        }

        // 2. شيك هل نفس IP سجل قبل كده (خلال آخر 30 يوم مثلاً)
        const ipExists = fallbackDatabase.merchantRequests?.some(r => r.ip === clientIp &&!r.isDuplicate) ||
                        fallbackDatabase.merchants?.some(m => m.registeredIp === clientIp);

        if (ipExists) {
            fallbackDatabase.merchantRequests.push({
                id: `REQ-${Date.now()}`,
                ownerName, phone, companyName, type, commercialId,
                status: 'مرفوض - تكرار IP',
                ip: clientIp,
                isDuplicate: true,
                date: new Date().toLocaleString('ar-EG')
            });

            if (mongoose.connection.readyState === 1) {
                await SafiraModel.findOneAndUpdate({ singletonKey: 'main_db' }, { data: fallbackDatabase }, { upsert: true });
            }

            return res.status(400).json({
                success: false,
                message: 'عذراً، هذا الجهاز مسجل لديه طلب مسبقاً لدى النظام وتم إرسال التنبيه للإدارة!',
                duplicate: true
            });
        }

        // 3. لو كله تمام - انشئ طلب جديد قيد المراجعة
        const newRequest = {
            id: `REQ-${Date.now()}`,
            ownerName,
            phone,
            companyName,
            type,
            commercialId: type === 'company'? commercialId : 'غير مسجل',
            password, // في الانتاج اعمل هاش
            status: 'قيد المراجعة',
            ip: clientIp,
            registeredIp: clientIp,
            date: new Date().toLocaleString('ar-EG'),
            createdAt: new Date()
        };

        fallbackDatabase.merchantRequests.push(newRequest);

        if (mongoose.connection.readyState === 1) {
            await SafiraModel.findOneAndUpdate({ singletonKey: 'main_db' }, { data: fallbackDatabase }, { upsert: true });
        }

        res.status(201).json({
            success: true,
            message: 'تم إرسال طلب تسجيل متجرك بنجاح! الطلب حالياً قيد المراجعة',
            request: newRequest
        });

    } catch (err) {
        console.error('Register error:', err);
        res.status(500).json({ success: false, message: 'خطأ في السيرفر' });
    }
});

// عرض طلبات التسجيل للإدارة
app.get('/api/merchant-requests', (req, res) => {
    res.json(fallbackDatabase.merchantRequests || []);
});

// قبول تاجر (للإدارة)
app.post('/api/merchant-requests/approve', async (req, res) => {
    const { requestId } = req.body;
    const request = (fallbackDatabase.merchantRequests || []).find(r => r.id === requestId);
    if (!request) return res.status(404).json({ success: false });

    request.status = 'مقبول';
    const newMerchant = {
        id: `MER-${Date.now()}`,
        name: request.companyName,
        ownerName: request.ownerName,
        phone: request.phone,
        type: request.type,
        commercialId: request.commercialId,
        registeredIp: request.ip,
        dues: 0,
        createdAt: new Date()
    };
    fallbackDatabase.merchants.push(newMerchant);

    if (mongoose.connection.readyState === 1) {
        await SafiraModel.findOneAndUpdate({ singletonKey: 'main_db' }, { data: fallbackDatabase }, { upsert: true });
    }
    res.json({ success: true, merchant: newMerchant });
});
module.exports = app;
