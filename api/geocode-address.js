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
        // ضمان قراءة البيانات سواء كانت مرسلة كـ Object جاهز أو String
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

        // استخدام مفتاح Geoapify الجديد
        const apiKey = process.env.GEOAPIFY_API_KEY; 
        
        // لو المفتاح مش موجود، نرجع العنوان الأصلي كحماية بدل ما السيرفر يضرب 500
        if (!apiKey) {
            return res.status(200).json({ 
                success: true, 
                city: city || 'القاهرة', 
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
            const coords = result.geometry?.coordinates || [null, null]; // Geoapify بيرجع [lng, lat]

            const detectedCity = props.state || props.county || city || '';
            const detectedDistrict = props.suburb || props.district || props.city || address || '';

            return res.status(200).json({
                success: true,
                formattedAddress: props.formatted || `${city || ''} - ${address || ''}`,
                city: detectedCity,
                district: detectedDistrict,
                location: { 
                    lat: coords[1], // خط العرض
                    lng: coords[0]  // خط الطول
                }
            });
        } else {
            // لو Geoapify مجابش نتيجة، نرجع بيانات المدخلات الطبيعية عشان الأوردر ما يعلقش
            return res.status(200).json({
                success: true,
                formattedAddress: `${city || ''} - ${address || ''}`,
                city: city || 'القاهرة',
                district: address || '',
                location: { lat: null, lng: null }
            });
        }
    } catch (err) {
        console.error("Geocoding Error:", err);
        return res.status(500).json({ success: false, message: err.message });
    }
}
