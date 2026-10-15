import { connectDB, SafiraModel, fallbackDatabase, setCors } from './_db.js';

export default async function handler(req, res) {
    setCors(res);
    if (req.method === 'OPTIONS') return res.status(200).end();

    try {
        await connectDB();
        const doc = await SafiraModel.findOne({ singletonKey: 'main_db' });
        let dbData = doc ? doc.data : fallbackDatabase;
        if (!dbData.orders) dbData.orders = [];

        // POST أو PUT لتحديث حالة الأوردر أو التتبع لحظياً
        if (req.method === 'POST' || req.method === 'PUT') {
            const body = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {});
            const { orderId, status, location } = body;

            if (!orderId) {
                return res.status(400).json({ success: false, message: 'مُعرف الأوردر مطلوب' });
            }

            const order = dbData.orders.find(o => o.id === orderId || o._id === orderId);
            if (!order) {
                return res.status(404).json({ success: false, message: 'الأوردر غير موجود' });
            }

            // تحديث الحالة أو الموقع الجغرافي للمندوب/الشحنة
            if (status) order.status = status;
            if (location) order.currentLocation = location;
            order.updatedAt = new Date();

            await SafiraModel.findOneAndUpdate({ singletonKey: 'main_db' }, { data: dbData }, { upsert: true });

            return res.status(200).json({ success: true, message: 'تم تحديث حالة الأوردر والتتبع بنجاح', order });
        }

        return res.status(405).json({ error: 'Method not allowed' });
    } catch (err) {
        console.error("Order Status API Error:", err);
        return res.status(500).json({ success: false, message: 'خطأ في الخادم' });
    }
}
