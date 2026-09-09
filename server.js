const express = require('express');
const mongoose = require('mongoose');

const app = express();
const PORT = process.env.PORT || 3000;

// قراءة رابط قاعدة البيانات من المتغيرات البيئية في Railway
// (ملاحظة: يدعم الاسم الصحيح MONGO_URL أو الاسم الذي أضفته MANGO_URL)
const MONGO_URI = process.env.MONGO_URL || process.env.MANGO_URL;

app.use(express.json());

// الاتصال بقاعدة بيانات MongoDB Atlas السحابية
if (MONGO_URI) {
    mongoose.connect(MONGO_URI)
        .then(() => console.log('تم الاتصال بقاعدة بيانات MongoDB بنجاح!'))
        .catch(err => console.error('خطأ في الاتصال بقاعدة البيانات:', err));
} else {
    console.log('تحذير: لم يتم العثور على رابط الاتصال بقاعدة البيانات.');
}

// مسار رئيسي للاختبار
app.get('/', (req, res) => {
    res.send('مرحباً بك في نظام Safira Logistic - السيرفر يعمل ومتصل بقاعدة البيانات!');
});

app.listen(PORT, () => {
    console.log(`السيرفر يعمل الآن على المنفذ ${PORT}`);
});
