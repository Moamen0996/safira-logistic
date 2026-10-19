import { MongoClient } from 'mongodb';

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
        const collection = db.collection('main_sync');

        if (req.method === 'GET') {
            let doc = await collection.findOne({ singletonKey: 'main_db' });
            return res.status(200).json(doc ? doc.data : {});
        }

        if (req.method === 'POST') {
            const body = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {});
            await collection.updateOne(
                { singletonKey: 'main_db' },
                { $set: { data: body, updatedAt: new Date() } },
                { upsert: true }
            );
            return res.status(200).json({ success: true, message: 'تمت المزامنة بنجاح' });
        }

        return res.status(405).json({ error: 'Method not allowed' });
    } catch (error) {
        console.error("Sync Error:", error);
        return res.status(500).json({ success: false, message: 'خطأ في الخادم' });
    } finally {
        if (client) await client.close();
    }
}
