const express = require('express');
const mongoose = require('mongoose');
const path = require('path');

const app = express();
app.use(express.json());

// الاتصال بقاعدة بيانات MongoDB باستخدام المتغير البيئي الموجود في Railway (MONGO_URL أو MANGO_URL)
const mongoUrl = process.env.MONGO_URL || process.env.MANGO_URL;

if (!mongoUrl) {
    console.error("خطأ: رابط قاعدة البيانات غير موجود في المتغيرات (MONGO_URL)");
} else {
    mongoose.connect(mongoUrl)
        .then(() => console.log('تم الاتصال بقاعدة بيانات MongoDB بنجاح!'))
        .catch(err => console.error('خطأ في الاتصال بقاعدة البيانات:', err));
}

// تصميم جدول (Schema) لتخزين إحداثيات المناديب والطلبات
const trackingSchema = new mongoose.Schema({
    orderId: { type: String, required: true, unique: true },
    driverName: { type: String, required: true },
    latitude: { type: Number, required: true },
    longitude: { type: Number, required: true },
    updatedAt: { type: Date, default: Date.now }
});

const Tracking = mongoose.model('Tracking', trackingSchema);

// نقطة اتصال API لتحديث أو حفظ موقع المندوب في قاعدة البيانات
app.post('/api/track', async (req, res) => {
    try {
        const { orderId, driverName, latitude, longitude } = req.body;
        
        const updatedLocation = await Tracking.findOneAndUpdate(
            { orderId },
            { driverName, latitude, longitude, updatedAt: Date.now },
            { upsert: true, new: true }
        );

        res.status(200).json({ success: true, message: 'تم تحديث الموقع في قاعدة البيانات بنجاح', data: updatedLocation });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// نقطة اتصال API لجلب موقع مندوب بناءً على رقم الطلب
app.get('/api/track/:orderId', async (req, res) => {
    try {
        const tracking = await Tracking.findOne({ orderId: req.params.orderId });
        if (!tracking) {
            return res.status(404).json({ success: false, message: 'لا يوجد تتبع لهذا الطلب حالياً' });
        }
        res.status(200).json({ success: true, data: tracking });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// صفحة تتبع المناديب
app.get('/tracker', (req, res) => {
    res.sendFile(path.join(__dirname, 'delivery_tracker.html'));
});

// صفحة رئيسية تجريبية
app.get('/', (req, res) => {
    res.send('مرحباً بك في نظام Safira Logistic! نظام التتبع وقاعدة البيانات يعملان بنجاح. اذهب إلى /tracker لعرض خريطة التتبع.');
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`السيرفر يعمل الآن على المنفذ ${PORT}`);
});
