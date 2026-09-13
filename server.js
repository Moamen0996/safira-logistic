const express = require('express');
const mongoose = require('mongoose');
const path = require('path');
const cors = require('cors');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 8080;
const MONGODB_URI = process.env.MONGODB_URI || process.env.MONGO_URI || '';

app.use(cors());
app.use(express.json());
app.use(express.static(__dirname));

mongoose.connect(MONGODB_URI)
.then(() => console.log('MongoDB Connected'))
.catch(err => console.error('Connection Error:', err));

const Order = mongoose.model('Order', new mongoose.Schema({
    orderId: { type: String, unique: true, required: true },
    waybill: String,
    customerName: String,
    amount: Number,
    status: { type: String, default: 'قيد المراجعة' },
    createdAt: { type: Date, default: Date.now }
}));

app.get('/api/orders', async (req, res) => {
    try {
        const orders = await Order.find();
        res.json({ success: true, orders });
    } catch (err) {
        res.status(400).json({ success: false, error: err.message });
    }
});

app.post('/api/orders', async (req, res) => {
    try {
        const order = new Order(req.body);
        await order.save();
        res.json({ success: true, order });
    } catch (err) {
        res.status(400).json({ success: false, error: err.message });
    }
});

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(PORT, () => {
    console.log('Server is running on port ' + PORT);
});
