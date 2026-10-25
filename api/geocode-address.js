export default async function handler(req, res) {
    // السماح بالطلبات (CORS Headers)
    res.setHeader('Access-Control-Allow-Credentials', true);
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
    res.setHeader(
        'Access-Control-Allow-Headers',
        'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
    );

    if (req.method === 'OPTIONS') {
        res.status(200).end();
        return;
    }

    if (req.method !== 'POST') {
        return res.status(405).json({ success: false, message: 'Method Not Allowed' });
    }

    try {
        const { address, city } = req.body || {};
        const fullQuery = `${address || ''}, ${city || 'Egypt'}`;
        
        const apiKey = process.env.GOOGLE_MAPS_API_KEY; 
        if (!apiKey) {
            return res.status(500).json({ success: false, message: "Google Maps API Key not configured on serverless environment" });
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
                location: result.geometry.location // { lat, lng }
            });
        } else {
            return res.status(200).json({ success: false, message: "لم يتم العثور على عنوان دقيق عبر الخرائط" });
        }
    } catch (err) {
        console.error("Serverless Geocode Error:", err);
        return res.status(500).json({ success: false, message: "خطأ داخلي في وظيفة الخرائط" });
    }
}
