import { MongoClient } from 'mongodb';

let cachedClient = null;

async function getDb(){
  if(cachedClient) return cachedClient.db('safira');
  
  // إضافة خيار المهلة الزمنية لمنع خطأ 504 Gateway Timeout
  const client = new MongoClient(process.env.MONGODB_URI, {
    serverSelectionTimeoutMS: 5000
  });
  
  await client.connect();
  cachedClient = client;
  return client.db('safira');
}

export default async function handler(req, res){
  // ترويسات CORS المسموحة لجميع المصادر
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    const db = await getDb();
    const col = db.collection('staff_users');

    if(req.method === 'GET'){
      const users = await col.find({}, { projection: { pass: 0 } }).toArray();
      return res.json(users);
    }

    if(req.method === 'POST'){
      const { action, username, password, name, role } = req.body || {};

      if(!action){
        // التحقق من بيانات الأدمن الرئيسي من متغيرات البيئة
        if(username === process.env.ADMIN_USER && password === process.env.ADMIN_PASSWORD){
          return res.json({ 
            success: true, 
            user: { username, name: "مؤمن (الأونر)", role: "مدير عام (صلاحيات كاملة)" } 
          });
        }
        
        // التحقق من قاعدة البيانات للموظفين الآخرين
        const user = await col.findOne({ username, pass: password });
        if(user){ 
          const { pass, ...safeUser } = user; 
          return res.json({ success: true, user: safeUser }); 
        }
        
        return res.status(401).json({ success: false, message: "بيانات الدخول غير صحيحة" });
      }

      if(action === 'create'){
        await col.insertOne({ username, pass: password, name, role, status: "نشط" });
        return res.json({ success: true });
      }
    }

    if(req.method === 'DELETE'){
      const { username } = req.body || {};
      await col.deleteOne({ username });
      return res.json({ success: true });
    }

  } catch (error) {
    console.error("Staff API Error:", error);
    return res.status(500).json({ success: false, error: error.message });
  }
}
