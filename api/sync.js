import { connectDB, SafiraModel, fallbackDatabase, setCors } from './_db.js';
import mongoose from 'mongoose';

export default async function handler(req, res) {
    setCors(res);
    if (req.method === 'OPTIONS') return res.status(200).end();

    try {
        await connectDB();
        
        if (req.method === 'GET') {
            const doc = await SafiraModel.findOne({ singletonKey: 'main_db' });
            if (doc && doc.data) {
                if(!doc.data.merchantRequests) doc.data.merchantRequests = [];
                return res.json({ success: true, data: doc.data, storage: 'mongodb' });
            }
            return res.json({ success: true, data: fallbackDatabase, storage: 'in-memory' });
        }

        if (req.method === 'POST') {
            let updatedData = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || fallbackDatabase);
            if(!updatedData.merchantRequests) updatedData.merchantRequests = [];
            
            if (mongoose.connection.readyState === 1) {
                await SafiraModel.findOneAndUpdate(
                    { singletonKey: 'main_db' }, 
                    { data: updatedData }, 
                    { upsert: true }
                );
            }
            return res.json({ success: true });
        }

        return res.status(405).json({ error: 'Method not allowed' });
    } catch (err) {
        console.error("Sync Error:", err);
        return res.status(500).json({ success: false, message: 'Server error' });
    }
}
