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
        const collection = db.collection('rates');

        if (req.method === 'GET') {
            const data = await collection.findOne({ type: 'shipping_rates_config' });
            return res.status(200).json(data || { rates: [], courierRates: [] });
        }

        if (req.method === 'POST') {
            let body = req.body;
            if (typeof body === 'string') {
                try { body = JSON.parse(body); } catch (e) { body = {}; }
            }
            body = body || {};

            // حماية ضد التكرار السريع (أقل من 0.6 ثانية)
            const currentConfig = await collection.findOne({ type: 'shipping_rates_config' });
            if (currentConfig && currentConfig.updatedAt) {
                const timeDiff = Date.now() - new Date(currentConfig.updatedAt).getTime();
                if (timeDiff < 600) {
                    return res.status(200).json({ success: true, message: "تم تجاهل الطلب المكرر السريع" });
                }
            }

            await collection.updateOne(
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

        return res.status(405).json({ success: false, message: 'Method not allowed' });

    } catch (error) {
        console.error("Rates API Error:", error);
        return res.status(500).json({ success: false, message: 'خطأ في الاتصال بقاعدة البيانات', error: error.message });
    } finally {
        if (client) {
            await client.close();
        }
    }
}
