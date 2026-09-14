const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
require('dotenv').config();

const app = express();
app.use(express.json());
app.use(cors());

// مسار تجريبي للتأكد أن السيرفر يعمل
app.get('/', (req, res) => {
  res.json({ status: 'success', message: 'Safira Logistics API is running perfectly!' });
});

// الاتصال بقاعدة البيانات MongoDB Atlas
const PORT = process.env.PORT || 8080;
const MONGO_URI = process.env.MONGO_URI;
app.get('/admin', (req, res) => {
  res.sendFile(__dirname + '/public/admin.html'); // أو المسار الصحيح لصفحة الأدمن عندك
// التأكد من وجود رابط قاعدة البيانات قبل الاتصال
if (!MONGO_URI) {
    console.error("❌ خطأ: متغير MONGO_URI مفقود في متغيرات البيئة على Railway!");
}

mongoose.connect(MONGO_URI)
  .then(() => {
    console.log('✅ Connected to MongoDB Atlas successfully');
    app.listen(PORT, () => {
      console.log(`Server is running on port ${PORT}`);
    });
  })
  .catch(err => {
    console.error('❌ Database connection error:', err);
  });
  })
  .catch((err) => {
    console.error('Database connection error:', err);
  });
app.get('/admin', (req, res) => {
  res.sendFile(__dirname + '/public/admin.html'); // أو المسار الصحيح لصفحة الأدمن عندك
});
