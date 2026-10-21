import { MongoClient } from 'mongodb';

const uri = process.env.MONGODB_URI || process.env.MONGO_URL;

export default async function handler(req, res) {
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
        const collection = db.collection('orders');

        if (req.method === 'POST' || req.method === 'PUT') {
            const body = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {});
            const { orderId, status, location } = body;

            if (!orderId) {
                return res.status(400).json({ success: false, message: 'مُعرف الأوردر مطلوب' });
            }

            const updateFields = { updatedAt: new Date() };
            if (status) updateFields.status = status;
            if (location) updateFields.currentLocation = location;

            const result = await collection.updateOne(
                { $or: [{ id: orderId }, { _id: orderId }] },
                { $set: updateFields }
            );

            if (result.matchedCount === 0) {
                return res.status(404).json({ success: false, message: 'الأوردر غير موجود' });
            }

            return res.status(200).json({ success: true, message: 'تم تحديث حالة الأوردر بنجاح' });
        }

        return res.status(405).json({ error: 'Method not allowed' });
    } catch (error) {
        console.error("Order Status Error:", error);
        return res.status(500).json({ success: false, message: 'خطأ في الخادم' });
    } finally {
        if (client) await client.close();
    }
}
