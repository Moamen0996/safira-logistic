import { MongoClient } from 'mongodb';

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

        if (req.method === 'GET') {
            const shipments = await collection.find({}).toArray();
            return res.status(200).json(shipments);
        }

        if (req.method === 'POST') {
            const body = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {});
            const newShipment = {
                ...body,
                id: body.id || `#SAF-${Math.floor(1000 + Math.random() * 9000)}`,
                createdAt: new Date()
            };
            await collection.insertOne(newShipment);
            return res.status(201).json({ success: true, message: 'تم إضافة الشحنة بنجاح', shipment: newShipment });
        }

        return res.status(405).json({ error: 'Method not allowed' });
    } catch (error) {
        console.error('Shipments Error:', error);
        return res.status(500).json({ success: false, message: 'خطأ في الخادم' });
    }
}
