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

        // GET: جلب مصفوفة الأسعار والمناديب والمناطق السحابية
        if (req.method === 'GET') {
            const data = await collection.findOne({ type: 'shipping_rates_config' });
            return res.status(200).json(data || { rates: [], courierRates: [] });
        }

       if (req.method === 'POST') {
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {});
    
    await collection.updateOne(
        { type: 'shipping_rates_config' },
        { 
            $set: { 
                rates: body.rates || [], 
                courierRates: body.courierRates || [],
                updatedAt: new Date()
            } 
        },
        { upsert: true }
    );

    return res.status(200).json({ success: true, message: "تم الحفظ سحابياً بنجاح" });
}

        return res.status(405).json({ error: 'Method not allowed' });
    } catch (err) {
        return res.status(500).json({ error: err.message });
    } finally {
        if (client) {
            await client.close();
        }
    }
}
