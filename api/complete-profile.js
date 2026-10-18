import { connectDB, setCors, SafiraModel, fallbackDatabase } from './_db.js';

export default async function handler(req, res) {
    setCors(res);

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    if (req.method !== 'POST') {
        return res.status(405).json({ success: false, message: 'Method not allowed' });
    }

    try {
        const connected = await connectDB();
        if (!connected) {
            return res.status(500).json({ success: false, message: 'فشل الاتصال بقاعدة البيانات' });
        }

        const { username, phone, password, type } = req.body;
        
        let record = await SafiraModel.findOne({ singletonKey: 'main_db' });
        let dbData = record ? record.data : fallbackDatabase;

        let targetFound = false;

        // التحقق وتحديث بيانات التاجر أو المندوب بناءً على اسم المستخدم أو رقم الهاتف
        if (type === 'courier' || phone) {
            if (dbData.delegates) {
                let courier = dbData.delegates.find(c => c.phone === phone || c.username === username);
                if (courier) {
                    courier.password = password; // حفظ كلمة المرور
                    courier.status = 'active';
                    targetFound = true;
                }
            }
        } else {
            if (dbData.merchants) {
                let merchant = dbData.merchants.find(m => m.username === username || m.phone === phone);
                if (merchant) {
                    merchant.password = password; // حفظ كلمة المرور
                    merchant.status = 'active';
                    targetFound = true;
                }
            }
        }

        if (!targetFound) {
            return res.status(404).json({ success: false, message: 'المستخدم غير موجود في النظام' });
        }

        // حفظ التعديلات في MongoDB
        record.data = dbData;
        await record.markModified('data');
        await record.save();

        return res.status(200).json({ success: true, message: 'تم تفعيل الحساب بنجاح' });

    } catch (error) {
        console.error(error);
        return res.status(500).json({ success: false, message: 'حدث خطأ في السيرفر' });
    }
}
