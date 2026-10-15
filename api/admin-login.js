export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        const body = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {});
        const { username, password } = body;

        // البيانات الافتراضية لتسجيل الدخول الفوري
        const ownerUser = "believer"; 
        const ownerPass = "123456";

        if (username && password) {
            if (username.trim() === ownerUser && password.trim() === ownerPass) {
                return res.status(200).json({
                    success: true,
                    message: 'تم تسجيل الدخول بنجاح',
                    user: { username: ownerUser, role: 'owner', name: 'المدير العام' }
                });
            }
        }

        return res.status(401).json({ success: false, message: 'اسم المستخدم أو كلمة المرور غير صحيحة!' });

    } catch (error) {
        console.error("Login API Error:", error);
        return res.status(500).json({ success: false, message: 'خطأ داخلي في الخادم' });
    }
}
