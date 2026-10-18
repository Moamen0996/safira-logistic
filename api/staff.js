import { MongoClient } from 'mongodb';

let cachedClient = null;

async function getDb() {
  if (cachedClient) return cachedClient.db('safira');
  
  const client = new MongoClient(process.env.MONGODB_URI || process.env.MONGO_URL, {
    serverSelectionTimeoutMS: 5000
  });
  
  await client.connect();
  cachedClient = client;
  return client.db('safira');
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    const db = await getDb();
    const col = db.collection('staff_users');

    // 1. جلب قائمة الموظفين
    if (req.method === 'GET') {
      const users = await col.find({}, { projection: { pass: 0, password: 0 } }).toArray();
      return res.status(200).json(users);
    }

    // 2. إضافة موظف أو تسجيل دخول
    if (req.method === 'POST') {
      const body = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {});
      const { action, username, password, pass, name, role, phone } = body;
      const userPassword = password || pass;

      // أ) إذا كان الطلب صريحاً لعملية إنشاء حساب جديد أو يحتوي على اسم ومسمى وظيفي
      if (action === 'create' || (name && userPassword && !action)) {
        const newStaff = {
          name,
          username,
          phone: phone || '',
          pass: userPassword,
          password: userPassword, // لحفظ التوافق مع الحقلين
          role: role || 'مدير',
          status: "نشط",
          createdAt: new Date()
        };

        await col.insertOne(newStaff);
        return res.status(201).json({ success: true, message: "تم حفظ الموظف بنجاح", staff: newStaff });
      }

      // ب) إذا كان الطلب محاولة تسجيل دخول (بدون name)
      if (username === process.env.ADMIN_USER && userPassword === process.env.ADMIN_PASSWORD) {
        return res.status(200).json({ 
          success: true, 
          user: { username, name: "مؤمن (الأونر)", role: "مدير عام (صلاحيات كاملة)" } 
        });
      }

      const user = await col.findOne({ 
        username, 
        $or: [{ pass: userPassword }, { password: userPassword }] 
      });

      if (user) { 
        const { pass, password, ...safeUser } = user; 
        return res.status(200).json({ success: true, user: safeUser }); 
      }
      
      return res.status(401).json({ success: false, message: "بيانات الدخول غير صحيحة" });
    }

    // 3. حذف موظف
    if (req.method === 'DELETE') {
      const body = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {});
      const { username, id } = body;
      
      if (id) {
        const { ObjectId } = await import('mongodb');
        await col.deleteOne({ _id: new ObjectId(id) });
      } else if (username) {
        await col.deleteOne({ username });
      }

      return res.status(200).json({ success: true, message: "تم حذف الموظف" });
    }

    return res.status(405).json({ error: "Method not allowed" });

  } catch (error) {
    console.error("Staff API Error:", error);
    return res.status(500).json({ success: false, error: error.message });
  }
}
