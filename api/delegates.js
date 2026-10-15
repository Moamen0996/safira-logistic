import { connectDB, SafiraModel, fallbackDatabase, setCors } from './_db.js';

export default async function handler(req, res) {
    setCors(res);
    if (req.method === 'OPTIONS') return res.status(200).end();

    try {
        await connectDB();
        const doc = await SafiraModel.findOne({ singletonKey: 'main_db' });
        let dbData = doc ? doc.data : fallbackDatabase;
        if (!dbData.delegates) dbData.delegates = [];

        // GET: جلب قائمة المناديب
        if (req.method === 'GET') {
            return res.status(200).json(dbData.delegates);
        }

        // POST: إضافة مندوب جديد
        if (req.method === 'POST') {
            const body = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {});
            const { name, phone, vehicleType, area } = body;

            if (!name || !phone) {
                return res.status(400).json({ success: false, message: 'اسم المندوب ورقم الهاتف مطلوبان' });
            }

            const newDelegate = {
                id: `DEL-${Date.now()}`,
                name,
                phone,
                vehicleType: vehicleType || 'موتوسيكل',
                area: area || 'عام',
                status: 'متاح',
                createdAt: new Date()
            };

            dbData.delegates.push(newDelegate);
            await SafiraModel.findOneAndUpdate({ singletonKey: 'main_db' }, { data: dbData }, { upsert: true });

            return res.status(201).json({ success: true, message: 'تم إضافة المندوب بنجاح', delegate: newDelegate });
        }

        // DELETE: حذف مندوب (عبر الـ Query مثل ?id=DEL-123)
        if (req.method === 'DELETE') {
            const delegateId = req.query.id;
            if (!delegateId) {
                return res.status(400).json({ success: false, message: 'مُعرف المندوب مطلوب للحذف' });
            }

            dbData.delegates = dbData.delegates.filter(d => d.id !== delegateId);
            await SafiraModel.findOneAndUpdate({ singletonKey: 'main_db' }, { data: dbData }, { upsert: true });

            return res.status(200).json({ success: true, message: 'تم حذف المندوب بنجاح' });
        }

        return res.status(405).json({ error: 'Method not allowed' });
    } catch (err) {
        console.error("Delegates API Error:", err);
        return res.status(500).json({ success: false, message: 'خطأ في الخادم' });
    }
}
