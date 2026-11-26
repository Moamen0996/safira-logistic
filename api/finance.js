import { MongoClient } from 'mongodb';

const uri = process.env.MONGODB_URI || process.env.MONGO_URL;

export default async function handler(req, res) {
    // ترويسات الـ CORS الموحدة
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS, PUT, DELETE');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }
 
    let client;
    try {
        client = new MongoClient(uri);
        await client.connect();
        const db = client.db('safira');

        // تحديد الـ Collection بناءً على نوع الطلب (expenses, revenues, payouts, merchants)
        const type = req.query.type || req.body.type || 'expenses';
        const collection = db.collection(type);

        if (req.method === 'GET') {
            const data = await collection.find({}).toArray();
            return res.status(200).json(data || []);
        }

        if (req.method === 'POST') {
            const body = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {});
            
            // تحديد بادئة الـ ID حسب نوع العملية المالية
            let prefix = 'FIN';
            if (type === 'payouts') prefix = 'PAY';          // مستحقات المناديب
            else if (type === 'revenues') prefix = 'REV';     // الإيرادات
            else if (type === 'expenses') prefix = 'EXP';     // المصروفات
            else if (type === 'merchants') prefix = 'MER';    // مستحقات التجار

            const newItem = {
                ...body,
                id: `${prefix}-${Date.now()}`,
                createdAt: new Date()
            };

            await collection.insertOne(newItem);
            return res.status(201).json({ success: true, message: 'تم الحفظ بنجاح سحابياً', data: newItem });
        }

        return res.status(405).json({ success: false, error: 'Method not allowed' });

    } catch (error) {
        console.error("Finance API Error:", error);
        return res.status(500).json({ success: false, message: 'خطأ في الخادم', error: error.message });
    } finally {
        if (client) await client.close();
    }
}
