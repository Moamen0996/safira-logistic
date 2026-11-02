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

        // helper - نفس منطق الـ id بتاعك بالظبط عشان # والـ ObjectId
        const buildQuery = (rawId) => {
            const cleanId = String(rawId).trim();
            const withHash = cleanId.startsWith('#') ? cleanId : `#${cleanId}`;
            const withoutHash = cleanId.replace('#', '');
            const q = [
                { id: cleanId }, { id: withHash }, { id: withoutHash },
                { code: cleanId }, { code: withHash }, { code: withoutHash },
                { shipmentId: cleanId }, { shipmentId: withHash }, { shipmentId: withoutHash },
                { waybill: cleanId }, { waybill: withHash }, { waybill: withoutHash },
            ];
            if (ObjectId.isValid(cleanId)) q.push({ _id: new ObjectId(cleanId) });
            return q;
        };

        const syncCentral = async () => {
            try {
                const allShipments = await collection.find({}).toArray();
                await safiraDataCol.updateOne(
                    { singletonKey: "main_db" },
                    { $set: { "data.shipments": allShipments, updatedAt: new Date() } },
                    { upsert: true }
                );
            } catch (e) { console.error("Sync error:", e); }
        };

      // 1. جلب الشحنات (GET) - مع فلتر المحذوف
        if (req.method === 'GET') {
            // شحنة واحدة بالـ id - هاتها حتى لو محذوفة عشان المودال يفتحها
            if (req.query.id) {
                const one = await collection.findOne({ $or: buildQuery(req.query.id) });
                if (!one) return res.status(404).json({ success: false, message: 'الشحنة غير موجودة' });
                return res.status(200).json(one);
            }
            // الليست كلها
            const includeDeleted = req.query.includeDeleted === 'true';
            const filter = includeDeleted ? {} : { isDeleted: { $ne: true } };
            const shipments = await collection.find(filter).sort({ createdAt: -1 }).toArray();
            return res.status(200).json(shipments);
        }

        // 2. إضافة أو استيراد الشحنات (POST)
        if (req.method === 'POST') {
            const body = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {});
            
            if (body.shipments && Array.isArray(body.shipments)) {
                const shipmentsWithMeta = body.shipments.map(s => ({
                    ...s,
                    id: s.id || `SAF-${Math.floor(100000 + Math.random() * 900000)}`,
                    isDeleted: false,
                    history: s.history || [],
                    createdAt: s.createdAt || new Date()
                }));
                if (shipmentsWithMeta.length > 0) {
                    await collection.insertMany(shipmentsWithMeta);
                }
                await syncCentral();
                return res.status(201).json({ success: true, message: 'تم استيراد وحفظ الشحنات بنجاح' });
            }

            const newShipment = {
                ...body,
                id: body.id || `SAF-${Math.floor(100000 + Math.random() * 900000)}`,
                isDeleted: false,
                history: body.history || [],
                createdAt: new Date()
            };
            await collection.insertOne(newShipment);
            await syncCentral();
            return res.status(201).json({ success: true, message: 'تم إضافة الشحنة بنجاح', shipment: newShipment });
        }

        // 3. حذف ناعم + استرجاع (PATCH) - بديل DELETE
        if (req.method === 'PATCH') {
            const body = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {});
            const rawId = req.query.id || body.id || body._id || body.waybill || body.code;
            if (!rawId) return res.status(400).json({ success: false, message: 'رقم الشحنة مطلوب' });

            const old = await collection.findOne({ $or: buildQuery(rawId) });
            if (!old) return res.status(404).json({ success: false, message: 'الشحنة غير موجودة في القاعدة' });

            let update = { updatedAt: new Date() };
            let historyEntry = null;

            // حذف ناعم
            if (body.isDeleted === true) {
                if (old.isDeleted) return res.status(200).json({ success: true, message: 'محذوفة اصلا' });
                update.isDeleted = true;
                update.deletedAt = body.deletedAt ? new Date(body.deletedAt) : new Date();
                update.deletedBy = body.deletedBy || 'الإدارة';
                update.deleteReason = body.deleteReason || '';
                historyEntry = {
                    date: new Date().toISOString(),
                    action: 'حذف الشحنة',
                    from: old.status,
                    to: 'محذوفة',
                    by: update.deletedBy,
                    note: update.deleteReason
                };
            }
            // استرجاع
            else if (body.isDeleted === false || body.restore === true) {
                update.isDeleted = false;
                update.deletedAt = null;
                update.deletedBy = null;
                update.deleteReason = '';
                historyEntry = {
                    date: new Date().toISOString(),
                    action: 'استرجاع الشحنة',
                    from: 'محذوفة',
                    to: old.status,
                    by: body.deletedBy || body.restoredBy || 'الإدارة',
                    note: 'رجعت من الأرشيف'
                };
            }
            // اي تعديل تاني جاي PATCH عادي - سيبه يعدل من غير ما يمسح الـ history
            else {
                Object.assign(update, body);
                delete update._id; delete update.id; delete update.code;
            }

            const newHistory = [...(old.history || [])];
            if (historyEntry) newHistory.push(historyEntry);
            update.history = newHistory;

            await collection.updateOne({ $or: buildQuery(rawId) }, { $set: update });
            await syncCentral();
            return res.status(200).json({ success: true, message: body.isDeleted === true ? 'تم حذف الشحنة (حذف ناعم - موجودة في الـ History)' : 'تم' });
        }

        // 3-مكرر. DELETE اتلغى نهائي - عشان مفيش حد يمسح نهائي بالغلط
        if (req.method === 'DELETE') {
            return res.status(400).json({ success: false, message: 'الحذف النهائي اتلغى - استخدم PATCH isDeleted:true' });
        }

// 4. تعديل الشحنة (PUT) - نسخة متوافقة + حماية الـ history والمحذوف
if (req.method === 'PUT') {
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {});
    const rawId = req.query.id || body.id || body._id || body.code;

    if (!rawId) {
        return res.status(400).json({ success: false, message: 'رقم الشحنة مطلوب للتعديل' });
    }

    const queryConditions = buildQuery(rawId);

    const old = await collection.findOne({ $or: queryConditions });
    if (!old) {
        return res.status(404).json({ success: false, message: 'الشحنة غير موجودة لتعديلها' });
    }

    const pickPrice = (...vals) => {
        for (const v of vals) {
            const n = Number(v);
            if (!isNaN(n) && n > 0) return n;
        }
        return null;
    };
    const newPrice = pickPrice(body.amount, body.cod, body.price, body.total, body.cost) ?? Number(old.cod || old.amount || 0);
    const newShip = pickPrice(body.shippingFee, body.mShip, body.totalShipping) ?? Number(old.shippingFee || old.mShip || 0);
    const hasSplitShip = body.mShip !== undefined || body.cShip !== undefined;
    const finalShip = hasSplitShip ? (Number(body.mShip || 0) + Number(body.cShip || 0)) : newShip;
    const newName = body.customer || body.customerName || body.recipientName || old.customer || old.customerName || old.recipientName;

    const updateData = { ...body };

    updateData.amount = newPrice;
    updateData.cod = newPrice;
    updateData.price = newPrice;

    updateData.shippingFee = finalShip;
    updateData.mShip = hasSplitShip ? Number(body.mShip || 0) : finalShip;
    updateData.cShip = hasSplitShip ? Number(body.cShip || 0) : 0;

    updateData.customer = newName;
    updateData.customerName = newName;
    updateData.recipientName = newName;

    if (body.notes !== undefined) updateData.notes = body.notes;
    if (body.note !== undefined) updateData.notes = body.note;
    if (updateData.notes === undefined) updateData.notes = old.notes || '';

    if (updateData.courierAssigned || updateData.courier || updateData.deliveryAgent) {
        updateData.status = 'مع المندوب';
    }

    delete updateData._id;
    delete updateData.id;
    delete updateData.code;
    delete updateData.shipmentId;
    // مهم: PUT ميمسحش الـ history ولا حالة الحذف
    delete updateData.history;
    delete updateData.isDeleted;
    delete updateData.deletedAt;
    delete updateData.deletedBy;
    delete updateData.deleteReason;

    const result = await collection.updateOne(
        { $or: queryConditions },
        { $set: updateData }
    );

    if (result.matchedCount === 0) {
        return res.status(404).json({ success: false, message: 'الشحنة غير موجودة لتعديلها' });
    }

    await syncCentral();
    return res.status(200).json({ success: true, message: 'تم تعديل الحفظ السحابي بنجاح' });
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
