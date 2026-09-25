require('dotenv').config();

const dns = require('dns');
dns.setServers(['8.8.8.8', '1.1.1.1']);

const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 8080;

app.use(cors());
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
            const prefix = match[1];
            const user = match[2];
            const pass = match[3];
            const rest = match[4];
            
            let decodedPass = pass;
            try { decodedPass = decodeURIComponent(pass); } catch(e) {}
            const encodedPass = encodeURIComponent(decodedPass);
            
            return `${prefix}${user}:${encodedPass}@${rest}`;
        }
    } catch (e) {
        console.error('Error sanitizing MongoDB URI:', e.message);
    }
    return uri;
}

async function connectDB() {
    if (!mongoUri || mongoUri.includes('YOUR_USERNAME')) {
        console.log('⚠️ لم يتم إدخال رابط MongoDB Atlas الحقيقي بعد. السيرفر يعمل حالياً بنظام الذاكرة المؤقتة.');
        return;
    }
    
    const cleanUri = sanitizeMongoUri(mongoUri);

    try {
        console.log('Attempting connection to MongoDB Atlas cluster...');
        await mongoose.connect(cleanUri, {
            serverSelectionTimeoutMS: 5000,
            family: 4
        });
        isMongoConnected = true;
        console.log('Successfully connected to MongoDB Atlas!');
        
        const existing = await SafiraModel.findOne({ singletonKey: 'main_db' });
        if (!existing) {
            await SafiraModel.create({ singletonKey: 'main_db', data: fallbackDatabase });
        } else {
            fallbackDatabase = existing.data;
        }
    } catch (err) {
        isMongoConnected = false;
        console.error('MongoDB connection error (Auth/Network):', err.message);
    }
}

connectDB();

app.use((req, res, next) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    next();
});

app.get('/api/sync', async (req, res) => {
    try {
        if (isMongoConnected && mongoose.connection.readyState === 1) {
            const doc = await SafiraModel.findOne({ singletonKey: 'main_db' });
            if (doc && doc.data) {
                return res.json({ success: true, data: doc.data, storage: 'mongodb' });
            }
        }
        res.json({ success: true, data: fallbackDatabase, storage: 'in-memory-resilient' });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message, data: fallbackDatabase });
    }
});

app.post('/api/sync', async (req, res) => {
    try {
        const newData = req.body;
        if (!newData) {
            return res.status(400).json({ success: false, error: 'Invalid data payload' });
        }
        
        fallbackDatabase = newData;

        if (isMongoConnected && mongoose.connection.readyState === 1) {
            await SafiraModel.findOneAndUpdate(
                { singletonKey: 'main_db' },
                { data: newData },
                { upsert: true, new: true }
            );
        }
        res.json({ success: true, message: 'Data synced successfully', storage: isMongoConnected ? 'mongodb' : 'in-memory-resilient' });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

app.post('/api/merchants', async (req, res) => {
    try {
        const { name, phone } = req.body;
        if (!name || !phone) {
            return res.status(400).json({ success: false, error: 'الرجاء إدخال اسم التاجر ورقم الهاتف' });
        }
        
        if (!fallbackDatabase.merchants) {
            fallbackDatabase.merchants = [];
        }
        
        const newMerchant = { id: `MER-${Date.now()}`, name, phone, dues: 0 };
        fallbackDatabase.merchants.push(newMerchant);

        if (isMongoConnected && mongoose.connection.readyState === 1) {
            await SafiraModel.findOneAndUpdate(
                { singletonKey: 'main_db' },
                { data: fallbackDatabase },
                { upsert: true, new: true }
            );
        }

        res.status(200).json({ success: true, message: 'تم حفظ التاجر بنجاح', merchant: newMerchant });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

app.post('/api/couriers', async (req, res) => {
    try {
        const { name, phone } = req.body;
        if (!name || !phone) {
            return res.status(400).json({ success: false, error: 'الرجاء إدخال اسم المندوب ورقم الهاتف' });
        }

        if (!fallbackDatabase.delegates) {
            fallbackDatabase.delegates = [];
        }

        const newCourier = { id: `DEL-${Date.now()}`, name, phone, username: `courier_${Date.now()}`, password: '123', lat: 30.0444, lng: 31.2357 };
        fallbackDatabase.delegates.push(newCourier);

        if (isMongoConnected && mongoose.connection.readyState === 1) {
            await SafiraModel.findOneAndUpdate(
                { singletonKey: 'main_db' },
                { data: fallbackDatabase },
                { upsert: true, new: true }
            );
        }

        res.status(200).json({ success: true, message: 'تم حفظ المندوب بنجاح', courier: newCourier });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

app.post('/api/orders/bulk', async (req, res) => {
    try {
        const { orders } = req.body;
        if (!orders || !Array.isArray(orders)) {
            return res.status(400).json({ success: false, error: 'البيانات المرسلة ليست مصفوفة صحيحة' });
        }
        
        if (!fallbackDatabase.orders) {
            fallbackDatabase.orders = [];
        }
        
        fallbackDatabase.orders.push(...orders);

        if (isMongoConnected && mongoose.connection.readyState === 1) {
            await SafiraModel.findOneAndUpdate(
                { singletonKey: 'main_db' },
                { data: fallbackDatabase },
                { upsert: true, new: true }
            );
        }

        res.status(201).json({ success: true, message: 'تم حفظ الشحنات الجماعية بنجاح', count: orders.length });
    } catch (err) {
        res.status(400).json({ success: false, error: 'حدث خطأ أثناء حفظ الشحنات الجماعية', details: err.message });
    }
});

app.post('/api/delegates/login', async (req, res) => {
    try {
        const { username, password } = req.body;
        const delegates = fallbackDatabase.delegates || [];
        
        const delegate = delegates.find(d => d.username === username && d.password === password);
        
        if (!delegate) {
            return res.status(401).json({ success: false, error: 'اسم المستخدم أو كلمة المرور غير صحيحة' });
        }

        res.json({ success: true, delegate });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

app.post('/api/delegates/location', async (req, res) => {
    try {
        const { delegateId, lat, lng } = req.body;
        const delegates = fallbackDatabase.delegates || [];
        
        const delegate = delegates.find(d => d.id === delegateId);
        if (delegate) {
            delegate.lat = lat;
            delegate.lng = lng;

            if (isMongoConnected && mongoose.connection.readyState === 1) {
                await SafiraModel.findOneAndUpdate(
                    { singletonKey: 'main_db' },
                    { data: fallbackDatabase },
                    { upsert: true, new: true }
                );
            }
            return res.json({ success: true, message: 'تم تحديث الموقع بنجاح' });
        }

        res.status(404).json({ success: false, error: 'المندوب غير موجود' });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

app.post('/api/fix-auth', async (req, conres) => {
    try {
        const { newUri } = req.body;
        if (newUri) {
            mongoUri = newUri;
        }
        
        if (mongoose.connection.readyState !== 0) {
            await mongoose.disconnect();
        }
        
        isMongoConnected = false;
        await connectDB();
        
        conres.json({
            success: isMongoConnected,
            connected: isMongoConnected,
            message: isMongoConnected ? 'MongoDB connected successfully!' : 'Authentication failed.'
        });
    } catch (err) {
        conres.status(500).json({ success: false, error: err.message });
    }
});

app.get('/', (req, res) => {
    res.send('Safira Logistics Cloud Server is running successfully!');
});

app.listen(PORT, '0.0.0.0', () => {
    console.log(`Safira Logistics Cloud Server is running on port ${PORT}`);
});
