const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path'); // أضفنا مكتبة المسارات
const app = express();

app.use(express.json({ limit: '10mb' }));
app.use(cors());

// السماح لقراءة ملفات الواجهة الأمامية الموجودة في نفس المستودع (إذا كانت في مجلد الجذر أو مجلد public)
app.use(express.static(__dirname)); 

// 1. الاتصال بقاعدة البيانات مباشرة
mongoose.connect("mongodb+srv://moamenbeliever_db_user:moamenbeliever172096@cluster0.yucaqm0.mongodb.net/?appName=Cluster0")
  .then(() => console.log("Database connected successfully"))
  .catch(err => console.error("Database connection error:", err));

const systemStateSchema = new mongoose.Schema({
  key: { type: String, unique: true, default: "main_db" },
  data: { type: Object, required: true },
  updatedAt: { type: Date, default: Date.now }
});

const SystemState = mongoose.model('SystemState', systemStateSchema);

// 2. مسارات البيانات (GET)
const handleGetData = async (req, res) => {
  try {
    let state = await SystemState.findOne({ key: "main_db" });
    if (!state) {
      state = { data: { orders: [], merchants: [] } };
    }
    res.json(state.data);
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

app.get('/api/data', handleGetData);
app.get('/data', handleGetData);

// 2. مسارات البيانات (GET) مع حماية ضد الخطأ 500
const handleGetData = async (req, res) => {
  try {
    let state = await SystemState.findOne({ key: "main_db" });
    if (!state) {
      // إرجاع هيكل بيانات افتراضي فارغ بدلاً من إعطاء خطأ
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

app.post('/api/data', handlePostData);
app.post('/data', handlePostData);

// مسار تسجيل التجار الجدد الذي طلبناه مسبقاً
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
