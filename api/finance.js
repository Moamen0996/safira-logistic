import { connectDB, SafiraModel, fallbackDatabase, setCors } from './_db.js';

export default async function handler(req, res) {
    setCors(res);
    if (req.method === 'OPTIONS') return res.status(200).end();

    try {
        await connectDB();
        const doc = await SafiraModel.findOne({ singletonKey: 'main_db' });
        let dbData = doc ? doc.data : fallbackDatabase;
        if (!dbData.payouts) dbData.payouts = [];

        // GET: جلب سجل الحسابات والمدفوعات
        if (req.method === 'GET') {
            return res.status(200).json({
                payouts: dbData.payouts,
                merchants: dbData.merchants || [],
                delegates: dbData.delegates || []
            });
        }

        // POST: تسوية حساب أو تسجيل عملية مالية جديدة (صرف مستحقات)
        if (req.method === 'POST') {
            const body = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {});
            const newPayout = {
                id: `PAY-${Date.now()}`,
                ...body,
                date: new Date().toLocaleString('ar-EG'),
                createdAt: new Date()
            };

            dbData.payouts.unshift(newPayout);

            // لو العملية تخص تسوية مستحقات تاجر، يمكن تحديث مديونية التاجر تلقائياً
            if (body.merchantId && body.amount && dbData.merchants) {
                const merchant = dbData.merchants.find(m => m.id === body.merchantId || m.name === body.merchantName);
                if (merchant) {
                    merchant.dues = Math.max(0, (merchant.dues || 0) - Number(body.amount));
                }
            }

            await SafiraModel.findOneAndUpdate({ singletonKey: 'main_db' }, { data: dbData }, { upsert: true });

            return res.status(201).json({ success: true, message: 'تم تسجيل العملية المالية بنجاح', payout: newPayout });
        }

        return res.status(405).json({ error: 'Method not allowed' });
    } catch (err) {
        console.error("Finance API Error:", err);
        return res.status(500).json({ success: false, message: 'خطأ في الخادم' });
    }
}
