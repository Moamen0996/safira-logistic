// config.js

// تحديد رابط السيرفر الأساسي تلقائياً بناءً على مكان فتح الصفحة
const API_BASE_URL = (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
    ? 'http://localhost:8080' // لو شغال محلياً على جهازك
    : 'safira-logistic-production.up.railway.app'; // استبدل هذا بدومين سيرفر Railway الحقيقي الخاص بك

// دالة مساعدة ذكية لإرسال واستقبال البيانات
async function apiRequest(endpoint, options = {}) {
    try {
        const url = `${API_BASE_URL}${endpoint}`;
        
        const defaultHeaders = {
            'Content-Type': 'application/json',
        };

        const config = {
            ...options,
            headers: {
                ...defaultHeaders,
                ...(options.headers || {})
            }
        };

        const response = await fetch(url, config);
        const data = await response.json();
        
        return data;
    } catch (error) {
        console.error('API Request Error:', error);
        throw error;
    }
}
