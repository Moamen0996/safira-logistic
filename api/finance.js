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

    if (!uri) {
        return res.status(500).json({ success: false, message: 'قاعدة البيانات غير مهيأة (MONGODB_URI مفقود)' });
    }

    const rawBody = typeof req.body === 'string'
        ? (() => { try { return JSON.parse(req.body); } catch { return {}; } })()
        : (req.body || {});

    const allowedTypes = ['expenses', 'revenues', 'payouts', 'merchants'];
    const requestedType = req.query?.type || rawBody?.type;

    let client;
    try {
        client = new MongoClient(uri);
        await client.connect();
        const db = client.db('safira');

        if (req.method === 'GET') {
            // إذا طلب نوعاً محدداً عبر query مثل ?type=revenues
            if (requestedType && allowedTypes.includes(requestedType)) {
                const items = await db.collection(requestedType).find({}).sort({ createdAt: -1 }).toArray();
                return res.status(200).json(items);
            }

            // الافتراضي للخزينة: جلب الإيرادات والمصروفات معاً
            const [revenues, expenses] = await Promise.all([
                db.collection('revenues').find({}).sort({ createdAt: -1 }).toArray(),
                db.collection('expenses').find({}).sort({ createdAt: -1 }).toArray()
            ]);

            return res.status(200).json({
                success: true,
                incomes: revenues,
                revenues,
                expenses
            });
        }

        if (req.method === 'POST') {
            const type = allowedTypes.includes(requestedType) ? requestedType : 'expenses';
            const collection = db.collection(type);

            let prefix = 'FIN';
            if (type === 'payouts') prefix = 'PAY';
            else if (type === 'revenues') prefix = 'REV';
            else if (type === 'expenses') prefix = 'EXP';
            else if (type === 'merchants') prefix = 'MER';

            const newItem = {
                ...rawBody,
                type,
                id: `${prefix}-${Date.now()}`,
                createdAt: new Date()
            };

            await collection.insertOne(newItem);
            return res.status(201).json({
                success: true,
                message: 'تم الحفظ بنجاح سحابياً',
                data: newItem
            });
        }

        return res.status(405).json({ success: false, error: 'Method not allowed' });

    } catch (error) {
        console.error("Finance API Error:", error);
        return res.status(500).json({ success: false, message: 'خطأ في الخادم', error: error.message });
    } finally {
        if (client) await client.close();
    }
}
