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
        const collection = db.collection('merchants');

        if (req.method === 'GET') {
            const merchants = await collection.find({}).toArray();
            return res.status(200).json(merchants);
        }

        if (req.method === 'POST') {
            const body = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {});
            const result = await collection.insertOne({ ...body, createdAt: new Date() });
            return res.status(201).json({ success: true, id: result.insertedId });
        }

        return res.status(405).json({ error: 'Method not allowed' });
    } catch (error) {
        console.error("API Error:", error);
        return res.status(500).json({ success: false, message: 'خطأ في الاتصال بقاعدة البيانات' });
    } finally {
        if (client) await client.close();
    }
}
