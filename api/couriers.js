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
        const collection = db.collection('couriers');

        if (req.method === 'GET') {
            const couriers = await collection.find({}).toArray();
            return res.status(200).json(couriers);
        }

        if (req.method === 'POST') {
            const body = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {});
            const newCourier = {
                ...body,
                createdAt: new Date(),
                status: 'متاح'
            };
            const result = await collection.insertOne(newCourier);
            return res.status(201).json({ success: true, id: result.insertedId, courier: newCourier });
        }

        return res.status(405).json({ error: 'Method not allowed' });
    } catch (error) {
        console.error("Couriers Error:", error);
        return res.status(500).json({ success: false, message: 'خطأ في الاتصال بقاعدة البيانات' });
    } finally {
        if (client) await client.close();
    }
}
