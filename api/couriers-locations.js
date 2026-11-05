import { MongoClient } from 'mongodb';

const uri = process.env.MONGODB_URI || process.env.MONGO_URL;

export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS, PUT, DELETE');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    if (req.method !== 'GET') {
        return res.status(405).json({ success: false, message: 'Method not allowed' });
    }

    let client;
    try {
        client = new MongoClient(uri);
        await client.connect();
        const db = client.db('safira');
        const collection = db.collection('couriers');

        const couriers = await collection.find({}).toArray();
        return res.status(200).json(couriers);
    } catch (error) {
        console.error("Error fetching couriers locations:", error);
        return res.status(500).json({ success: false, message: 'Internal Server Error', error: error.message });
    } finally {
        if (client) {
            await client.close();
        }
    }
}
