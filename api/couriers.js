import { MongoClient } from 'mongodb';

const uri = process.env.MONGODB_URI || process.env.MONGO_URL;

export default async function handler(req, res) {
    // تفعيل الـ CORS
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

        const { method, query } = req;

        // ----------------------------------------------------
        // 1. مسار الأسعار والعمولات (Rates) المدمج لتجنب خطأ 404
        // ----------------------------------------------------
        const isRatesRequest = query.action === 'rates' || (req.url && req.url.includes('/rates'));
        if (isRatesRequest) {
            const ratesCollection = db.collection('rates');
            
            if (method === 'GET') {
                const data = await ratesCollection.findOne({ type: 'shipping_rates_config' });
                return res.status(200).json(data || { rates: [], courierRates: [] });
            }
            
            if (method === 'POST') {
                let body = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {});
                
                await ratesCollection.updateOne(
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

            res.setHeader('Allow', ['GET', 'POST']);
            return res.status(405).json({ success: false, message: `Method ${method} Not Allowed for rates` });
        }

        // ----------------------------------------------------
        // 2. مسار المواقع (Locations)
        // ----------------------------------------------------
        const isLocationsRequest = query.action === 'locations' || (req.url && req.url.includes('/locations'));
        const collection = db.collection('couriers');

        if (isLocationsRequest) {
            if (method === 'GET') {
                const couriers = await collection.find({}).toArray();
                return res.status(200).json(couriers);
            }
            
            res.setHeader('Allow', ['GET']);
            return res.status(405).json({ success: false, message: `Method ${method} Not Allowed for locations` });
        } else {
            // ----------------------------------------------------
            // 3. المسار الرئيسي للـ couriers (GET و POST)
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
        console.error("Couriers/Rates API Error:", error);
        return res.status(500).json({ success: false, message: 'خطأ في الاتصال بقاعدة البيانات', error: error.message });
    } finally {
        if (client) {
            await client.close();
        }
    }
}
