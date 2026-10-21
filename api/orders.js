import { MongoClient, ObjectId } from 'mongodb';

const uri = process.env.MONGODB_URI || process.env.MONGO_URL;

export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS, PUT, DELETE');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    if (req.method === 'OPTIONS') return res.status(200).end();

    let client;
    try {
        client = new MongoClient(uri);
        await client.connect();
        const db = client.db('safira');
        const collection = db.collection('orders');

        if (req.method === 'GET') {
            const orders = await collection.find({}).toArray();
            return res.status(200).json(orders);
        }

        if (req.method === 'POST') {
            const body = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {});
            const newOrder = {
                ...body,
                id: body.id || `ORD-${Date.now()}`,
                createdAt: new Date()
            };
            await collection.insertOne(newOrder);
            return res.status(201).json({ success: true, message: 'تم إضافة الأوردر بنجاح', order: newOrder });
        }

        // --- إضافة جزئية الحذف DELETE هنا ---
        if (req.method === 'DELETE') {
            const body = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {});
            const orderId = body.id || req.query.id;

            if (!orderId) {
                return res.status(400).json({ success: false, message: 'رقم الأوردر مطلوب للحذف' });
            }

            // محاولة الحذف سواء كان الـ id مخزن كـ string أو بـ _id
            const result = await collection.deleteOne({ 
                $or: [{ id: orderId }, { _id: ObjectId.isValid(orderId) ? new ObjectId(orderId) : null }] 
            });

            if (result.deletedCount === 0) {
                return res.status(404).json({ success: false, message: 'الأوردر غير موجود' });
            }

            return res.status(200).json({ success: true, message: 'تم حذف الأوردر بنجاح' });
        }

        return res.status(405).json({ error: 'Method not allowed' });
    } catch (error) {
        console.error("Orders Error:", error);
        return res.status(500).json({ success: false, message: 'خطأ في الخادم' });
    } finally {
        if (client) await client.close();
    }
}
