const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');
const app = express();

app.use(express.json({ limit: '10mb' }));
app.use(cors());

// السماح بقراءة ملفات الواجهة الأمامية الموجودة في نفس المستودع
app.use(express.static(__dirname)); 

// 1. الاتصال بقاعدة البيانات مباشرة
mongoose.connect("mongodb+srv://moamenbeliever_db_user:MOAMENBELIEVER172096@cluster0.yucaqm0.mongodb.net/?appName=Cluster0")
  .then(() => console.log("Database connected successfully"))
  .catch(err => console.error("Database connection error:", err));

const systemStateSchema = new mongoose.Schema({
  key: { type: String, unique: true, default: "main_db" },
  data: { type: Object, required: true },
  updatedAt: { type: Date, default: Date.now }
});

const SystemState = mongoose.model('SystemState', systemStateSchema);

// 2. مسار جلب البيانات (GET) - تم تعريفه مرة واحدة فقط وبشكل آمن
const handleGetData = async (req, res) => {
  try {
    let state = await SystemState.findOne({ key: "main_db" });
    if (!state) {
      return res.json({ orders: [], merchants: [], merchantRequests: [] });
    }
    res.json(state.data);
  } catch (err) {
    console.error("خطأ في جلب البيانات:", err.message);
    res.status(500).json({ success: false, error: err.message });
  }
};

app.get('/api/data', handleGetData);
app.get('/data', handleGetData);

// 3. مسار حفظ البيانات (POST)
const handlePostData = async (req, res) => {
  try {
    const newData = req.body;
    await SystemState.findOneAndUpdate(
      { key: "main_db" },
      { data: newData, updatedAt: Date.now },
      { upsert: true, new: true }
    );
    res.json({ success: true, message: "تم حفظ البيانات بنجاح" });
  } catch (err) {
    console.error("خطأ في حفظ البيانات:", err.message);
    res.status(500).json({ success: false, error: err.message });
  }
};

app.post('/api/data', handlePostData);
app.post('/data', handlePostData);

// 4. مسار تسجيل التجار الجدد
app.post('/api/merchant-requests', async (req, res) => {
  try {
    const merchantRequest = req.body;
    let state = await SystemState.findOne({ key: "main_db" });
    if (!state) {
      state = { data: { orders: [], merchants: [], merchantRequests: [] } };
    }
    if (!state.data.merchantRequests) state.data.merchantRequests = [];
    
    merchantRequest.id = Date.now();
    merchantRequest.status = 'pending';
    merchantRequest.createdAt = new Date();
    state.data.merchantRequests.push(merchantRequest);
    
    await SystemState.findOneAndUpdate(
      { key: "main_db" },
      { data: state.data, updatedAt: Date.now },
      { upsert: true, new: true }
    );
    res.json({ success: true, message: "تم إرسال طلب التسجيل بنجاح، بانتظار موافقة الإدارة" });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// الصفحة الرئيسية تعرض ملف index.html الخاص بالتطبيق تلقائياً
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
