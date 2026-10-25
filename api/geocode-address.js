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
        const fullQuery = `${address || ''}, ${city || 'Egypt'}`;

        const apiKey = process.env.GOOGLE_MAPS_API_KEY; 
        
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

        const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(fullQuery)}&key=${apiKey}&language=ar&region=EG`;
        
        const response = await fetch(url);
        const data = await response.json();

        if (data.status === 'OK' && data.results.length > 0) {
            const result = data.results[0];
            let detectedCity = '';
            let detectedDistrict = '';

            result.address_components.forEach(component => {
                if (component.types.includes('administrative_area_level_1')) {
                    detectedCity = component.long_name.replace('محافظة', '').trim();
                }
                if (component.types.includes('sublocality_level_1') || component.types.includes('locality')) {
                    detectedDistrict = component.long_name;
                }
            });

            return res.status(200).json({
                success: true,
                formattedAddress: result.formatted_address,
                city: detectedCity || city,
                district: detectedDistrict || address,
                location: result.geometry.location
            });
        } else {
            // لو جوجل مجابش نتيجة، نرجع بيانات المدخلات الطبيعية عشان الأوردر ما يعلقش
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
