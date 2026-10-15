import { connectDB, SafiraModel, fallbackDatabase, setCors } from './_db.js';
import mongoose from 'mongoose';

export default async function handler(req, res) {
    setCors(res);
    if (req.method === 'OPTIONS') return res.status(200).end();

    try {
        await connectDB();
        const doc = await SafiraModel.findOne({ singletonKey: 'main_db' });
        let dbData = doc ? doc.data : fallbackDatabase;
        if(!dbData.merchantRequests) dbData.merchantRequests = [];
        if(!dbData.merchants) dbData.merchants = [];

        // GET: جلب الطلبات أو التجار حسب الحاجة
        if (req.method === 'GET') {
            const type = req.query.type;
            if (type === 'merchants') {
                return res.json(dbData.merchants);
            }
            return res.json(dbData.merchantRequests);
        }

        // POST: تسجيل أو اتخاذ إجراء (قبول/رفض)
        if (req.method === 'POST') {
            const body = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {});
            const action = req.query.action || body.action;

            // عملية قبول طلب تاجر
            if (action === 'approve' || body.requestId && body.approve) {
                const requestId = body.requestId;
                const request = dbData.merchantRequests.find(r => r.id === requestId);
                if (!request) return res.status(404).json({ success: false, message: 'الطلب غير موجود' });
                
                request.status = 'مقبول';
                dbData.merchants.push({ id: `MER-${Date.now()}`, name: request.companyName, phone: request.phone, dues: 0 });
                
                await SafiraModel.findOneAndUpdate({ singletonKey: 'main_db' }, { data: dbData }, { upsert: true });
                return res.json({ success: true });
            }

            // عملية رفض طلب تاجر
            if (action === 'reject' || body.requestId && body.reject) {
                const requestId = body.requestId;
                dbData.merchantRequests = dbData.merchantRequests.filter(r => r.id !== requestId);
                
                await SafiraModel.findOneAndUpdate({ singletonKey: 'main_db' }, { data: dbData }, { upsert: true });
                return res.json({ success: true });
            }

            // عملية تسجيل حساب تاجر جديد (Register)
            const { ownerName, phone, companyName, type, commercialId, password } = body;
            if (!phone || !companyName) return res.status(400).json({ success: false, message: 'بيانات ناقصة' });
            
            const clientIp = req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.ip || 'unknown';

            const phoneExists = dbData.merchants?.some(m => m.phone === phone) || dbData.merchantRequests?.some(r => r.phone === phone && !r.isDuplicate && r.status !== 'مرفوض');
            const companyExists = dbData.merchants?.some(m => m.name === companyName) || dbData.merchantRequests?.some(r => r.companyName === companyName && !r.isDuplicate && r.status !== 'مرفوض');

            if (phoneExists || companyExists) {
                dbData.merchantRequests.push({ 
                    id: `REQ-${Date.now()}`, ownerName, phone, companyName, 
                    status: 'مرفوض - بيانات مسجلة مسبقاً', ip: clientIp, isDuplicate: true, 
                    date: new Date().toLocaleString('ar-EG') 
                });
                await SafiraModel.findOneAndUpdate({ singletonKey: 'main_db' }, { data: dbData }, { upsert: true });
                return res.status(400).json({ success: false, message: 'عذراً، هذه البيانات مسجلة مسبقاً لدى النظام!' });
            }

            const newRequest = { 
                id: `REQ-${Date.now()}`, ownerName, phone, companyName, type, commercialId, password, 
                status: 'قيد المراجعة', ip: clientIp, date: new Date().toLocaleString('ar-EG'), createdAt: new Date() 
            };
            dbData.merchantRequests.push(newRequest);
            
            await SafiraModel.findOneAndUpdate({ singletonKey: 'main_db' }, { data: dbData }, { upsert: true });
            return res.status(201).json({ success: true, message: 'تم الإرسال', request: newRequest });
        }

        return res.status(405).json({ error: 'Method not allowed' });
    } catch (err) {
        console.error("Merchant Request API Error:", err);
        return res.status(500).json({ success: false, message: 'خطأ في الخادم' });
    }
}
