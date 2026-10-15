export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method === 'GET') return res.status(200).json({ status: 'ok' });
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {});
    const username = (body.username || '').toString().trim();
    const password = (body.password || '').toString().trim();

    // هيقرا من فيرسل لو انت حاططهم
    const ENV_USER = process.env.ADMIN_USERNAME || process.env.OWNER_USER || "believer";
    const ENV_PASS = process.env.ADMIN_PASSWORD || process.env.OWNER_PASS || "123456";

    console.log('Login try:', username, 'vs env:', ENV_USER);

    if (username.toLowerCase() === ENV_USER.toLowerCase() && password === ENV_PASS) {
      return res.status(200).json({
        success: true,
        user: { 
          username: ENV_USER, code: ENV_USER, role: 'admin', 
          name: 'مؤمن (المالك)', isAdmin: true, isOwner: true, permissions: ['all'] 
        }
      });
    }

    return res.status(401).json({ success: false, message: 'اسم المستخدم أو كلمة المرور غير صحيحة!' });
  } catch (e) {
    return res.status(500).json({ success: false, message: e.message });
  }
}
