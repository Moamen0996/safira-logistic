const express = require('express');
const mongoose = require('mongoose');
const app = express();

// تفعيل قراءة ملفات الـ JSON المرسلة من الواجهة الأمامية
app.use(express.json());

// 1. الاتصال بقاعدة البيانات MongoDB Atlas
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log("Database connected successfully"))
  .catch(err => console.error("Database connection error:", err));

// 2. تعريف نموذج التاجر (Merchant Model)
const merchantSchema = new mongoose.Schema({
  name: { type: String, required: true },
  phone: String,
  storeName: String,
  createdAt: { type: Date, default: Date.now }
});

const Merchant = mongoose.model('Merchant', merchantSchema);

// 3. مسارات الـ API الخاصة بالتجار

// أ) مسار حفظ تاجر جديد (يستقبل البيانات من الموقع ويحفظها)
app.post('/api/merchants', async (req, res) => {
  try {
    const newMerchant = new Merchant(req.body);
    await newMerchant.save();
    res.status(201).json({ success: true, message: "تم حفظ التاجر بنجاح", data: newMerchant });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ب) مسار جلب كل التجار (لعرضهم في أي جهاز متصل)
app.get('/api/merchants', async (req, res) => {
  try {
    const merchants = await Merchant.find();
    res.json({ success: true, data: merchants });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// تشغيل السيرفر
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
