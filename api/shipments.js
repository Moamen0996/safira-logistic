import { MongoClient, ObjectId } from 'mongodb';

const uri = process.env.MONGODB_URI || process.env.MONGO_URL;

export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
    res.setHeader(
        'Access-Control-Allow-Headers',
        'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization'
    );

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }
    
    let client;
    try {
        if (!uri) {
            return res.status(500).json({ success: false, message: 'MongoDB URI is missing in environment variables' });
        }

        client = new MongoClient(uri);
        await client.connect();
        const db = client.db('safira');
        const collection = db.collection('shipments');
        const safiraDataCol = db.collection('safiradatas');

      // 1. جلب الشحنات (GET)
        if (req.method === 'GET') {
            const shipments = await collection.find({}).sort({ createdAt: -1 }).toArray();
            return res.status(200).json(shipments);
        }

        // 2. إضافة أو استيراد الشحنات (POST)
        if (req.method === 'POST') {
            const body = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {});
            
            if (body.shipments && Array.isArray(body.shipments)) {
                const shipmentsWithMeta = body.shipments.map(s => ({
                    ...s,
                    id: s.id || `SAF-${Math.floor(100000 + Math.random() * 900000)}`,
                    createdAt: new Date()
                }));
                if (shipmentsWithMeta.length > 0) {
                    await collection.insertMany(shipmentsWithMeta);
                }
                return res.status(201).json({ success: true, message: 'تم استيراد وحفظ الشحنات بنجاح' });
            }

            const newShipment = {
                ...body,
                id: body.id || `SAF-${Math.floor(100000 + Math.random() * 900000)}`,
                createdAt: new Date()
            };
            await collection.insertOne(newShipment);
            return res.status(201).json({ success: true, message: 'تم إضافة الشحنة بنجاح', shipment: newShipment });
        }

        // 3. حذف الشحنة (DELETE)
        if (req.method === 'DELETE') {
            const body = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {});
            const rawId = req.query.id || body.id;

            if (!rawId) {
                return res.status(400).json({ success: false, message: 'رقم الشحنة مطلوب للحذف' });
            }

            const cleanId = String(rawId).trim();
            const withHash = cleanId.startsWith('#') ? cleanId : `#${cleanId}`;
            const withoutHash = cleanId.replace('#', '');

            const queryConditions = [
                { id: cleanId }, { id: withHash }, { id: withoutHash },
                { shipmentId: cleanId }, { shipmentId: withHash }, { shipmentId: withoutHash }
            ];

            if (ObjectId.isValid(cleanId)) {
                queryConditions.push({ _id: new ObjectId(cleanId) });
            }

            const result = await collection.deleteOne({ $or: queryConditions });

            if (result.deletedCount === 0) {
                return res.status(404).json({ success: false, message: 'الشحنة غير موجودة في القاعدة' });
            }

            return res.status(200).json({ success: true, message: 'تم حذف الشحنة بنجاح' });
        }

        // 4. تعديل الشحنة (PUT) - 🚀 التحديث القاطع وحفظ الحالة واسم المندوب
        if (req.method === 'PUT') {
            const body = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {});
            const rawId = req.query.id || body.id || body._id;

            if (!rawId) {
                return res.status(400).json({ success: false, message: 'رقم الشحنة مطلوب للتعديل' });
            }

            const cleanId = String(rawId).trim();
            const withHash = cleanId.startsWith('#') ? cleanId : `#${cleanId}`;
            const withoutHash = cleanId.replace('#', '');

            const queryConditions = [
                { id: cleanId }, { id: withHash }, { id: withoutHash },
                { shipmentId: cleanId }, { shipmentId: withHash }, { shipmentId: withoutHash }
            ];
            if (ObjectId.isValid(cleanId)) {
                queryConditions.push({ _id: new ObjectId(cleanId) });
            }

            const updateData = { ...body };
            
            // لو تم إسناد مندوب، نجعل حالتها 'مع المندوب' بقوة لكي تختفي من المخزن
            if (updateData.courierAssigned || updateData.courier || updateData.deliveryAgent) {
                updateData.status = 'مع المندوب';
            }

            delete updateData._id;
            delete updateData.id;

            const result = await collection.updateOne(
                { $or: queryConditions },
                { $set: updateData }
            );
            
            if (result.matchedCount === 0) {
                return res.status(404).json({ success: false, message: 'الشحنة غير موجودة لتعديلها' });
            }

            // 🚀 مزامنة وتحديث الـ safiradatas لتكون متوافقة تماماً
            try {
                const activeShipments = await collection.find({
                    $and: [
                        { status: { $ne: 'مع المندوب' } },
                        { status: { $ne: 'with-courier' } },
                        { courierAssigned: { $exists: false } },
                        { courier: { $exists: false } }
                    ]
                }).toArray();

                await safiraDataCol.updateOne(
                    { singletonKey: "main_db" },
                    { $set: { "data.shipments": activeShipments, updatedAt: new Date() } },
                    { upsert: true }
                );
            } catch (syncErr) {
                console.error("Safiradata sync error:", syncErr);
            }

            return res.status(200).json({ success: true, message: 'تم تعديل بيانات الشحنة بنجاح' });
        }

        return res.status(405).json({ error: 'Method not allowed' });

    } catch (error) {
        console.error("API Error:", error);
        return res.status(500).json({ success: false, message: 'خطأ في الخادم السحابي', details: error.message });
    } finally {
        if (client) {
            try { await client.close(); } catch (e) {}
        }
    }
}
