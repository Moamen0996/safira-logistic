import { MongoClient, ObjectId } from 'mongodb';

let cachedClient = null;

async function getDb() {
    if (cachedClient) return cachedClient.db('safira');
    const client = new MongoClient(process.env.MONGODB_URI || process.env.MONGO_URL, {
        serverSelectionTimeoutMS: 5000,
    });
    await client.connect();
    cachedClient = client;
    return client.db('safira');
}

export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS, PUT, DELETE');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    if (req.method === 'OPTIONS') return res.status(200).end();
    
    try {
        const db = await getDb();
        const collection = db.collection('shipments');

        // 1. جلب الشحنات (GET)
        if (req.method === 'GET') {
            const shipments = await collection.find({}).sort({ createdAt: -1 }).toArray();
            return res.status(200).json(shipments);
        }

        // 2. إضافة شحنة أو مجموعة شحنات من الإكسيل (POST)
        if (req.method === 'POST') {
            const body = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {});
            
            // لو تم إرسال مصفوفة شحنات (من ملف الإكسيل)
            if (body.shipments && Array.isArray(body.shipments)) {
                const shipmentsWithMeta = body.shipments.map(s => ({
                    ...s,
                    id: s.id || `SAF-${Math.floor(100000 + Math.random() * 900000)}`,
                    createdAt: new Date()
                }));
                if (shipmentsWithMeta.length > 0) {
                    await collection.insertMany(shipmentsWithMeta);
                }
                return res.status(201).json({ success: true, message: 'تم استيراد وحفظ الشحنات بنجاح' });
            }

            // لو إضافة شحنة فردية عادية
            const newShipment = {
                ...body,
                id: body.id || `SAF-${Math.floor(100000 + Math.random() * 900000)}`,
                createdAt: new Date()
            };
            await collection.insertOne(newShipment);
            return res.status(201).json({ success: true, message: 'تم إضافة الشحنة بنجاح', shipment: newShipment });
        }

        // 3. حذف شحنة (DELETE) - مع التحقق من الأونر
        if (req.method === 'DELETE') {
            const body = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {});
            const shipmentId = req.query.id || body.id;
            const { username, password } = body;

            // التحقق من بيانات الأونر (يمكنك مطابقتها مع البيئة أو البيانات المتاحة)
            const validUser = process.env.OWNER_USERNAME || "believer";
            const validPass = process.env.OWNER_PASSWORD || "admin123"; // أو الباسورد الخاص بك

            if (username && password && (username !== validUser || password !== validPass)) {
                return res.status(401).json({ success: false, message: 'بيانات الأونر غير صحيحة' });
            }

            if (!shipmentId) {
                return res.status(400).json({ success: false, message: 'رقم الشحنة مطلوب للحذف' });
            }

            const result = await collection.deleteOne({ 
                $or: [
                    { id: shipmentId }, 
                    { _id: ObjectId.isValid(shipmentId) ? new ObjectId(shipmentId) : null }
                ] 
            });

            if (result.deletedCount === 0) {
                return res.status(404).json({ success: false, message: 'الشحنة غير موجودة في القاعدة' });
            }

            return res.status(200).json({ success: true, message: 'تم حذف الشحنة بنجاح' });
        }

        return res.status(405).json({ error: 'Method not allowed' });
    } catch (error) {
        console.error('Shipments Error:', error);
        return res.status(500).json({ success: false, message: 'خطأ في الخادم السحابي', details: error.message });
    }
}
