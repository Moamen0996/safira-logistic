const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const app = express();

app.use(express.json({ limit: '10mb' }));
app.use(cors()); // تفعيل الـ CORS لمنع أي حظر من المتصفح

// 1. الاتصال بقاعدة البيانات
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log("Database connected successfully"))
  .catch(err => console.error("Database connection error:", err));

const systemStateSchema = new mongoose.Schema({
  key: { type: String, unique: true, default: "main_db" },
  data: { type: Object, required: true },
  updatedAt: { type: Date, default: Date.now }
});

const SystemState = mongoose.model('SystemState', systemStateSchema);

// 2. مسارات شاملة لجلب البيانات (GET)
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
app.get('/api/api/data', handleGetData);

// 3. مسارات شاملة لحفظ البيانات (POST)
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
    res.status(500).json({ success: false, error: err.message });
  }
};

app.post('/api/data', handlePostData);
app.post('/data', handlePostData);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
app.get('/test', (req, res) => res.send('Railway is working!'));
