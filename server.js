const express = require('express');
const mongoose = require('mongoose');
const path = require('path');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 8080;
const MONGO_URI = process.env.MONGO_URI || '';

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname)));

// 1. تعريف نموذج الشحنات في قاعدة بيانات MongoDB
const shipmentSchema = new mongoose.Schema({
    trackingNumber: { type: String, required: true, unique: true },
    senderName: String,
    receiverName: String,
    destination: String,
    status: { type: String, default: 'قيد المعالجة' },
    createdAt: { type: Date, default: Date.now }
});

const Shipment = mongoose.model('Shipment', shipmentSchema);

// 2. الاتصال بقاعدة البيانات
if (MONGO_URI) {
    mongoose.connect(MONGO_URI)
        .then(() => console.log('✅ MongoDB Connected Successfully'))
        .catch(err => console.error('❌ Connection Error:', err));
} else {
    console.log('⚠️ Warning: MONGO_URI is not defined in environment variables.');
}

// 3. مسارات الـ API السحابية (API Endpoints)
// جلب جميع الشحنات من قاعدة البيانات
app.get('/api/shipments', async (req, res) => {
    try {
        const shipments = await Shipment.find().sort({ createdAt: -1 });
        res.json(shipments);
    } catch (err) {
        res.status(500).json({ error: 'Failed to fetch shipments' });
    }
});

// إضافة شحنة جديدة وحفظها في السحابة ليرها الجميع
app.post('/api/shipments', async (req, res) => {
    try {
        const newShipment = new Shipment(req.body);
        const savedShipment = await newShipment.save();
        res.status(201).json(savedShipment);
    } catch (err) {
        res.status(400).json({ error: 'Failed to save shipment (Tracking number might already exist)' });
    }
});

// 4. توجيه باقي الطلبات للـ index.html
app.get('*', (req, res) => {
    const indexPath = path.join(__dirname, 'index.html');
    res.sendFile(indexPath, (err) => {
        if (err) {
            res.status(404).send('Error: index.html not found in the root directory.');
        }
    });
});

app.listen(PORT, '0.0.0.0', () => {
    console.log('🚀 Server running on port ' + PORT);
});
