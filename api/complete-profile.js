import { MongoClient } from 'mongodb';

const uri = process.env.MONGODB_URI || process.env.MONGO_URL;

export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') return res.status(200).end();

    if (req.method !== 'POST') {
        return res.status(405).json({ success: false, message: 'Method not allowed' });
    }

    let client;
    try {
        const body = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {});
        const { username, phone, password, type } = body;

        client = new MongoClient(uri);
        await client.connect();
        const db = client.db('safira');
        const collection = db.collection('safiradatas'); // أو اسم الكولكشن الخاص بالبيانات المجمعة لديك

        // جلب وثيقة البيانات الرئيسية (Singleton)
        let record = await collection.findOne({ singletonKey: 'main_db' });
        
        if (!record || !record.data) {
            return res.status(404).json({ success: false, message: 'بيانات النظام غير موجودة' });
        }

        let dbData = record.data;
        let targetFound = { found: false };

        // التحقق وتحديث التجار أو المناديب داخل الكائن المجمع
        if (type === 'courier' || phone) {
            if (dbData.delegates) {
                let courier = dbData.delegates.find(c => c.phone === phone || c.username === username);
                if (courier) {
                    courier.password = password;
                    courier.status = 'active';
                    targetFound.found = true;
                }
            }
        } 
        
        if (!targetFound.found) {
            if (dbData.merchants) {
                let merchant = dbData.merchants.find(m => m.username === username || m.phone === phone);
                if (merchant) {
                    merchant.password = password;
                    merchant.status = 'active';
                    targetFound.found = true;
                }
            }
        }

        if (!targetFound.found) {
            return res.status(404).json({ success: false, message: 'المستخدم غير موجود في النظام' });
        }

        // تحديث الحفظ في قاعدة البيانات
        await collection.updateOne(
            { singletonKey: 'main_db' },
            { $set: { data: dbData, updatedAt: new Date() } }
        );

        return res.status(200).json({ success: true, message: 'تم تفعيل الحساب بنجاح' });

    } catch (error) {
        console.error(error);
        return res.status(500).json({ success: false, message: 'حدث خطأ في السيرفر' });
    } finally {
        if (client) {
            await client.close();
        }
    }
}
