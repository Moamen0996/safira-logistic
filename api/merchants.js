import { connectDB, SafiraModel, fallbackDatabase, setCors } from './_db.js';

export default async function handler(req, res) {
    setCors(res);
    if (req.method === 'OPTIONS') return res.status(200).end();

    try {
        await connectDB();
        const doc = await SafiraModel.findOne({ singletonKey: 'main_db' });
        let dbData = doc ? doc.data : fallbackDatabase;
        if (!dbData.merchants) dbData.merchants = [];

        // GET: جلب قائمة التجار المعتمدين
        if (req.method === 'GET') {
            return res.status(200).json(dbData.merchants);
        }

        // POST: إضافة تاجر جديد مباشرة من الإدارة
        if (req.method === 'POST') {
            const body = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {});
            const { name, phone, dues } = body;

            if (!name || !phone) {
                return res.status(400).json({ success: false, message: 'اسم المتجر ورقم الهاتف مطلوبان' });
            }

            const newMerchant = {
                id: body.id || `MER-${Date.now()}`,
                name,
                phone,
                dues: dues ? Number(dues) : 0,
                createdAt: new Date()
            };

            dbData.merchants.push(newMerchant);
            await SafiraModel.findOneAndUpdate({ singletonKey: 'main_db' }, { data: dbData }, { upsert: true });

            return res.status(201).json({ success: true, message: 'تم إضافة التجر بنجاح', merchant: newMerchant });
        }

        // DELETE: حذف تاجر
        if (req.method === 'DELETE') {
            const merchantId = req.query.id;
            dbData.merchants = dbData.merchants.filter(m => m.id !== merchantId);
            await SafiraModel.findOneAndUpdate({ singletonKey: 'main_db' }, { data: dbData }, { upsert: true });

            return res.status(200).json({ success: true, message: 'تم حذف التاجر بنجاح' });
        }

        return res.status(405).json({ error: 'Method not allowed' });
    } catch (err) {
        console.error("Merchants API Error:", err);
        return res.status(500).json({ success: false, message: 'خطأ في الخادم' });
    }
}
