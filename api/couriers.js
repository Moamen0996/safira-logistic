import { MongoClient } from 'mongodb';

const uri = process.env.MONGODB_URI || process.env.MONGO_URL;

export default async function handler(req, res) {
    // تفعيل الـ CORS لأي مصدر (أو خصصه لنطاق لوحة التحكم الخاص بك)
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
        const collection = db.collection('couriers');

        const { method, query } = req;
        
        // التحقق مما إذا كان الطلب خاص بالمواقع (سواء عبر Query parameter ?action=locations أو الرابط الفرعي)
        const isLocationsRequest = query.action === 'locations' || (req.url && req.url.includes('/locations'));

        if (isLocationsRequest) {
            // ----------------------------------------------------
            // مسار جلب المواقع (الذي كان في ملف locations مستقل)
            // ----------------------------------------------------
            if (method === 'GET') {
                const couriers = await collection.find({}).toArray();
                return res.status(200).json(couriers);
            }
            
            res.setHeader('Allow', ['GET']);
            return res.status(405).json({ success: false, message: `Method ${method} Not Allowed for locations` });
        } else {
            // ----------------------------------------------------
            // المسار الرئيسي للـ couriers (GET و POST)
            // ----------------------------------------------------
            if (method === 'GET') {
                const couriers = await collection.find({}).toArray();
                return res.status(200).json(couriers);
            }

            if (method === 'POST') {
                const body = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {});
                const newCourier = {
                    ...body,
                    createdAt: new Date(),
                    status: body.status || 'متاح'
                };
                const result = await collection.insertOne(newCourier);
                return res.status(201).json({ success: true, id: result.insertedId, courier: newCourier });
            }

            res.setHeader('Allow', ['GET', 'POST']);
            return res.status(405).json({ success: false, message: 'Method not allowed' });
        }

    } catch (error) {
        console.error("Couriers API Error:", error);
        return res.status(500).json({ success: false, message: 'خطأ في الاتصال بقاعدة البيانات', error: error.message });
    } finally {
        if (client) {
            await client.close();
        }
    }
}
