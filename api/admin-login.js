export default function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

    // قراءة وتحليل الـ body داخل الدالة بشكل آمن
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {});
    const { username, password } = body;

    const ADMIN_USER = process.env.ADMIN_USER || 'believer';
    const ADMIN_PASS = process.env.ADMIN_PASSWORD;

    console.log("Received username:", username, "Expected:", ADMIN_USER);
    console.log("Received password length:", password ? password.length : 0, "Expected length:", ADMIN_PASS ? ADMIN_PASS.length : 0);

    if (!ADMIN_PASS) {
        return res.status(500).json({ success: false, message: 'ADMIN_PASSWORD مش مسجل في Vercel Env' });
    }

    if (username === ADMIN_USER && password === ADMIN_PASS) {
        return res.status(200).json({ success: true, token: 'admin_' + Date.now() });
    } else {
        return res.status(401).json({ success: false, message: 'بيانات الدخول غير صحيحة' });
    }
}
