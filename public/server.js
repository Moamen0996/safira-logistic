const express = require('express');
const mongoose = require('mongoose');
const app = express();

// تفعيل قراءة ملفات الـ JSON المرسلة من الواجهة الأمامية بحجم كبير لتكفي بيانات الشحنات
app.use(express.json({ limit: '10mb' }));

// 1. الاتصال بقاعدة البيانات MongoDB Atlas
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log("Database connected successfully"))
  .catch(err => console.error("Database connection error:", err));

// 2. تعريف نموذج عام لحفظ حالة النظام الكاملة (System State Model)
// هذا النموذج سيحفظ كائن الـ db الذي تستخدمه في الواجهة الأمامية (orders, merchants, settings, etc.)
const systemStateSchema = new mongoose.Schema({
  key: { type: String, unique: true, default: "main_db" },
  data: { type: Object, required: true },
  updatedAt: { type: Date, default: Date.now }
});

const SystemState = mongoose.model('SystemState', systemStateSchema);

// 3. مسارات الـ API لدعم دالة loadDB والواجهة الأمامية القديمة
// أ) مسار جلب البيانات الشاملة (يتوافق مع fetch(`${API_URL}/data`))
app.get('/api/data', async (req, res) => {
  try {
    let state = await SystemState.findOne({ key: "main_db" });
    if (!state) {
      // إذا لمגد قاعدة بيانات محفوظة مسبقاً، نُرجع هيكلاً افتراضياً فارغاً لمنع الأخطاء
      state = { data: { orders: [], merchants: [] } };
    }
    res.json(state.data);
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ب) مسار حفظ البيانات الشاملة (إذا كان التطبيق يقوم بعمل حفظ كامل للـ db)
app.post('/api/data', async (req, res) => {
  try {
    const newData = req.body;
    await SystemState.findOneAndUpdate(
      { key: "main_db" },
      { data: newData, updatedAt: Date.now },
      { upsert: true, new: true }
    );
    res.json({ success: true, message: "تم حفظ البيانات بنجاح" });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 4. مسارات إضافية خاصة بالتجار (Merchant Endpoints للتوافق المستقبلي)
const merchantSchema = new mongoose.Schema({
  name: { type: String, required: true },
  phone: String,
  storeName: String,
  createdAt: { type: Date, default: Date.now }
});
const Merchant = mongoose.model('Merchant', merchantSchema);

app.post('/api/merchants', async (req, res) => {
  try {
    const newMerchant = new Merchant(req.body);
    await newMerchant.save();
    res.status(201).json({ success: true, message: "تم حفظ التاجر بنجاح", data: newMerchant });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

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
