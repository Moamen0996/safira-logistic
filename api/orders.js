import { connectDB, SafiraModel, fallbackDatabase, setCors } from './_db.js';

export default async function handler(req, res) {
    setCors(res);
    if (req.method === 'OPTIONS') return res.status(200).end();

    try {
        await connectDB();
        const doc = await SafiraModel.findOne({ singletonKey: 'main_db' });
        let dbData = doc ? doc.data : fallbackDatabase;
        if (!dbData.orders) dbData.orders = [];

        // GET: جلب جميع الأوردرات
        if (req.method === 'GET') {
            return res.status(200).json(dbData.orders);
        }

        // POST: إضافة أوردر جديد
        if (req.method === 'POST') {
            const body = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {});
            const newOrder = {
                id: body.id || `ORD-${Date.now()}`,
                ...body,
                createdAt: new Date()
            };

            dbData.orders.unshift(newOrder); // يوضع في البداية
            await SafiraModel.findOneAndUpdate({ singletonKey: 'main_db' }, { data: dbData }, { upsert: true });

            return res.status(201).json({ success: true, message: 'تم إضافة الأوردر بنجاح', order: newOrder });
        }

        // PUT: تحديث حالة أو بيانات أوردر
        if (req.method === 'PUT') {
            const body = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {});
            const orderId = body.id || req.query.id;

            const index = dbData.orders.findIndex(o => o.id === orderId);
            if (index === -1) return res.status(404).json({ success: false, message: 'الأوردر غير موجود' });

            dbData.orders[index] = { ...dbData.orders[index], ...body, updatedAt: new Date() };
            await SafiraModel.findOneAndUpdate({ singletonKey: 'main_db' }, { data: dbData }, { upsert: true });

            return res.status(200).json({ success: true, message: 'تم تحديث الأوردر بنجاح' });
        }

        // DELETE: حذف أوردر
        if (req.method === 'DELETE') {
            const orderId = req.query.id;
            dbData.orders = dbData.orders.filter(o => o.id !== orderId);
            await SafiraModel.findOneAndUpdate({ singletonKey: 'main_db' }, { data: dbData }, { upsert: true });

            return res.status(200).json({ success: true, message: 'تم حذف الأوردر' });
        }

        return res.status(405).json({ error: 'Method not allowed' });
    } catch (err) {
        console.error("Orders API Error:", err);
        return res.status(500).json({ success: false, message: 'خطأ في الخادم' });
    }
}
