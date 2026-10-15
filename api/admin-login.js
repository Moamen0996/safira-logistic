export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    // عشان لما تفتحه في المتصفح مايديش 405
    if (req.method === 'GET') {
        return res.status(200).json({ status: 'admin-login API working' });
    }

    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        const body = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {});
        const { username, password } = body;

        const ownerUser = "believer"; 
        const ownerPass = "123456";

        if (username && password) {
            if (username.trim().toLowerCase() === ownerUser && password.trim() === ownerPass) {
                return res.status(200).json({
                    success: true,
                    message: 'تم تسجيل الدخول بنجاح',
                    user: { 
                        username: ownerUser,
                        code: ownerUser, // مهم للفرونت القديم
                        role: 'admin', // غيرتها من owner لـ admin
                        name: 'مؤمن (المالك)',
                        permissions: ['all', 'manage_orders', 'manage_merchants', 'manage_couriers', 'manage_finances', 'settings'],
                        isAdmin: true,
                        isOwner: true
                    }
                });
            }
        }

        return res.status(401).json({ success: false, message: 'اسم المستخدم أو كلمة المرور غير صحيحة!' });

    } catch (error) {
        console.error("Login API Error:", error);
        return res.status(500).json({ success: false, message: 'خطأ داخلي في الخادم' });
    }
}
