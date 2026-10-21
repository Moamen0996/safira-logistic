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

        // 1. جلب الأوردرات (GET)
        if (req.method === 'GET') {
            const orders = await collection.find({}).sort({ createdAt: -1 }).toArray();
            return res.status(200).json(orders);
        }

        // 2. إضافة أوردر واحد أو مجموعة أوردرات (POST) - لدعم استيراد الإكسيل
        if (req.method === 'POST') {
            const body = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {});
            
            // لو تم إرسال مصفوفة شحنات (من الإكسيل)
            if (body.shipments && Array.isArray(body.shipments)) {
                const shipmentsWithMeta = body.shipments.map(s => ({
                    ...s,
                    id: s.id || `SAF-${Math.floor(100000 + Math.random() * 900000)}`,
                    createdAt: new Date()
                }));
                if (shipmentsWithMeta.length > 0) {
                    await collection.insertMany(shipmentsWithMeta);
                }
                return res.status(201).json({ success: true, message: 'تم مزامنة وحفظ الشحنات بنجاح' });
            }

            // لو أوردر فردي عادي
            const newOrder = {
                ...body,
                id: body.id || `SAF-${Math.floor(100000 + Math.random() * 900000)}`,
                createdAt: new Date()
            };
            await collection.insertOne(newOrder);
            return res.status(201).json({ success: true, message: 'تم إضافة الأوردر بنجاح', order: newOrder });
        }

        // 3. حذف أوردر (DELETE)
        if (req.method === 'DELETE') {
            const body = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {});
            const orderId = req.query.id || body.id;

            if (!orderId) {
                return res.status(400).json({ success: false, message: 'رقم الأوردر مطلوب للحذف' });
            }

            const result = await collection.deleteOne({ 
                $or: [
                    { id: orderId }, 
                    { _id: ObjectId.isValid(orderId) ? new ObjectId(orderId) : null }
                ] 
            });

            if (result.deletedCount === 0) {
                return res.status(404).json({ success: false, message: 'الأوردر غير موجود في القاعدة' });
            }

            return res.status(200).json({ success: true, message: 'تم حذف الأوردر بنجاح' });
        }

        return res.status(405).json({ error: 'Method not allowed' });
    } catch (error) {
        console.error("Orders Error:", error);
        return res.status(500).json({ success: false, message: 'خطأ في الخادم السحابي', details: error.message });
    } finally {
        if (client) await client.close();
    }
}
