export default async function handler(req, res) {
    // إعدادات الـ CORS
    res.setHeader('Access-Control-Allow-Credentials', true);
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
    res.setHeader(
        'Access-Control-Allow-Headers',
        'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
    );

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    if (req.method !== 'POST') {
        return res.status(405).json({ success: false, message: 'Method Not Allowed' });
    }

    try {
        let bodyData = req.body;
        if (typeof bodyData === 'string') {
            try {
                bodyData = JSON.parse(bodyData);
            } catch (e) {
                bodyData = {};
            }
        }

        const { address, city } = bodyData || {};
        const fullQuery = `${address || ''}, ${city || 'Egypt'}, Egypt`;

        const apiKey = process.env.GEOAPIFY_API_KEY; 
        
        if (!apiKey) {
            return res.status(200).json({ 
                success: true, 
                city: normalizeEgyptianGovernorate(city || 'القاهرة'), 
                district: address || '', 
                formattedAddress: `${city || ''} - ${address || ''}`,
                location: { lat: null, lng: null } 
            });
        }

        const url = `https://api.geoapify.com/v1/geocode/search?text=${encodeURIComponent(fullQuery)}&lang=ar&filter=countrycode:eg&apiKey=${apiKey}`;
        
        const response = await fetch(url);
        const data = await response.json();

        if (data.features && data.features.length > 0) {
            const result = data.features[0];
            const props = result.properties || {};
            const coords = result.geometry?.coordinates || [null, null];

            // استخراج وتوحيد اسم المحافظة فوراً
            const rawCity = props.state || props.county || city || '';
            const detectedCity = normalizeEgyptianGovernorate(rawCity);
            const detectedDistrict = props.suburb || props.district || props.city || address || '';

            return res.status(200).json({
                success: true,
                formattedAddress: props.formatted || `${city || ''} - ${address || ''}`,
                city: detectedCity,
                district: detectedDistrict,
                location: { 
                    lat: coords[1], 
                    lng: coords[0]  
                }
            });
        } else {
            return res.status(200).json({
                success: true,
                formattedAddress: `${city || ''} - ${address || ''}`,
                city: normalizeEgyptianGovernorate(city || 'القاهرة'),
                district: address || '',
                location: { lat: null, lng: null }
            });
        }
    } catch (err) {
        console.error("Geocoding Error:", err);
        return res.status(500).json({ success: false, message: err.message });
    }
}

// ----------------------------------------------------
// دالة لتوحيد أسماء المحافظات المصرية مهما كانت طريقة كتابتها
// ----------------------------------------------------
function normalizeEgyptianGovernorate(inputName) {
    if (!inputName) return 'القاهرة';
    
    const cleanName = inputName.trim().toLowerCase()
        .replace(/ال/g, '')
        .replace(/cairo/g, 'القاهرة')
        .replace(/alexandria/g, 'الاسكندرية')
        .replace(/giza/g, 'الجيزة');

    if (cleanName.includes('قاهر') || cleanName.includes('cairo')) return 'القاهرة';
    if (cleanName.includes('اسكندر') || cleanName.includes('alex')) return 'الاسكندرية';
    if (cleanName.includes('جيز') || cleanName.includes('giza')) return 'الجيزة';
    if (cleanName.includes('قليوب')) return 'القليوبية';
    if (cleanName.includes('شرقي')) return 'الشرقية';
    if (cleanName.includes('دقهلي')) return 'الدقهلية';
    if (cleanName.includes('منوفي') || cleanName.includes('منوفية')) return 'المنوفية';
    if (cleanName.includes('غربي')) return 'الغربية';
    if (cleanName.includes('بحير')) return 'البحيرة';
    if (cleanName.includes('كفر')) return 'كفر الشيخ';
    if (cleanName.includes('فيوم')) return 'الفيوم';
    if (cleanName.includes('بني سويف')) return 'بني سويف';
    if (cleanName.includes('منيا')) return 'المنيا';
    if (cleanName.includes('أسيوط') || cleanName.includes('اسيوت')) return 'أسيوط';
    if (cleanName.includes('سوهاج')) return 'سوهاج';
    if (cleanName.includes('قن')) return 'قنا';
    if (cleanName.includes('أقصر') || cleanName.includes('luxor')) return 'الأقصر';
    if (cleanName.includes('أسوان') || cleanName.includes('aswan')) return 'أسوان';
    if (cleanName.includes('بورسعيد')) return 'بورسعيد';
    if (cleanName.includes('سويس') || cleanName.includes('suez')) return 'السويس';
    if (cleanName.includes('إسماعيلية') || cleanName.includes('ismailia')) return 'الإسماعيلية';
    if (cleanName.includes('بحر أحمر') || cleanName.includes('red sea')) return 'البحر الأحمر';
    if (cleanName.includes('وادي جديد') || cleanName.includes('new valley')) return 'الوادي الجديد';
    if (cleanName.includes('مطروح') || cleanName.includes('matruh')) return 'مطروح';
    if (cleanName.includes('شمال سيناء')) return 'شمال سيناء';
    if (cleanName.includes('جنوب سيناء')) return 'جنوب سيناء';

    return inputName.trim().replace(/^ال/, '');
}
