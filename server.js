const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 8080;
const MONGO_URI = process.env.MONGO_URI || 'mongodb+srv://safira:sadira2026@cluster0.yucaqm0.mongodb.net/?appName=Cluster0';

app.use(cors());
app.use(express.json());

const SystemSchema = new mongoose.Schema({
    key: { type: String, required: true, unique: true },
    data: { type: Object, required: true }
}, { timestamps: true });

const SystemDB = mongoose.model('SystemState', SystemSchema);

mongoose.connect(MONGO_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true
}).then(() => {
    console.log('Successfully connected to MongoDB Atlas Cloud');
}).catch(err => {
    console.error('MongoDB connection error:', err);
});

// Get full application database state
app.get('/api/sync', async (req, res) => {
    try {
        let record = await SystemDB.findOne({ key: 'SAFIRA_GLOBAL_STATE' });
        if (!record) {
            // Default initial state if none exists yet
            const defaultState = {
                orders: [],
                delegates: [],
                merchants: [],
                pricing: [],
                payouts: []
            };
            record = new SystemDB({ key: 'SAFIRA_GLOBAL_STATE', data: defaultState });
            await record.save();
        }
        res.json({ success: true, data: record.data });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// Update full application database state from client
app.post('/api/sync', async (req, res) => {
    try {
        const newData = req.body;
        let record = await SystemDB.findOne({ key: 'SAFIRA_GLOBAL_STATE' });
        if (!record) {
            record = new SystemDB({ key: 'SAFIRA_GLOBAL_STATE', data: newData });
        } else {
            record.data = newData;
            record.markModified('data');
        }
        await record.save();
        res.json({ success: true, message: 'Database state synchronized successfully' });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

app.listen(PORT, () => {
    console.log(`Safira Logistics Cloud Server is running on port ${PORT}`);
});
