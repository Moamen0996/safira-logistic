import { MongoClient } from 'mongodb';

const uri = process.env.MONGODB_URI || process.env.MONGO_URL;

// تخزين مؤقت للاتصال لتسريع الاستجابة على Vercel
let cachedClient = null;

async function connectToDatabase() {
    if (cachedClient) {
        return cachedClient;
    }
    const client = new MongoClient(uri);
    await client.connect();
    cachedClient = client;
    return client;
}

export default async function handler(req, res) {
    // إعدادات الـ CORS الكاملة
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS, PUT, DELETE');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    try {
        const client = await connectToDatabase();
        const db = client.db('safira');
        const collection = db.collection('rates');

        // 1. معالجة طلبات الـ GET (جلب البيانات)
        if (req.method === 'GET') {
            const data = await collection.findOne({ type: 'shipping_rates_config' });
            return res.status(200).json(data || { rates: [], courierRates: [] });
        }

        // 2. معالجة طلبات الـ POST (الحفظ السحابي)
        if (req.method === 'POST') {
            let body = req.body;
            
            // التأكد من تحويل الـ body بشكل صحيح إذا كان نصاً
            if (typeof body === 'string') {
                try {
                    body = JSON.parse(body);
                } catch (e) {
                    body = {};
                }
            }
            body = body || {};

            // 🛑 حماية إضافية: فحص آخر وقت تحديث لمنع الطلبات المكررة الفورية (أقل من 0.6 ثانية)
            const currentConfig = await collection.findOne({ type: 'shipping_rates_config' });
            if (currentConfig && currentConfig.updatedAt) {
                const timeDiff = Date.now() - new Date(currentConfig.updatedAt).getTime();
                if (timeDiff < 600) { 
                    return res.status(200).json({ success: true, message: "تم تجاهل الطلب المكرر السريع" });
                }
            }

            // تنفيذ التحديث في قاعدة البيانات
            await collection.updateOne(
                { type: 'shipping_rates_config' },
                { 
                    $set: { 
                        rates: Array.isArray(body.rates) ? body.rates : [], 
                        courierRates: Array.isArray(body.courierRates) ? body.courierRates : [],
                        updatedAt: new Date()
                    } 
                },
                { upsert: true }
            );

            return res.status(200).json({ success: true, message: "تم الحفظ سحابياً بنجاح" });
        }

        return res.status(405).json({ error: 'Method not allowed' });

    } catch (err) {
        console.error("API Error:", err);
        return res.status(500).json({ error: err.message || "Internal Server Error" });
    }
}
