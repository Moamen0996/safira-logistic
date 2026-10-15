import mongoose from 'mongoose';

export const fallbackDatabase = {
    orders: [],
    delegates: [],
    merchants: [
        { id: "MER-201", name: "متجر القاهرة الإلكتروني", phone: "01011223344", dues: 2400 },
    ],
    merchantRequests: [],
    pricing: [],
    payouts: [],
    shipments: []
};

const safiraSchema = new mongoose.Schema({
    singletonKey: { type: String, default: 'main_db', unique: true },
    data: { type: Object, required: true }
}, { timestamps: true });

export const SafiraModel = mongoose.models.SafiraData || mongoose.model('SafiraData', safiraSchema);

export async function connectDB() {
    const mongoUri = process.env.MONGODB_URI || process.env.MONGO_URL;
    if (!mongoUri) return false;
    if (mongoose.connection.readyState === 1) return true;
    try {
        await mongoose.connect(mongoUri, { serverSelectionTimeoutMS: 8000 });
        const existing = await SafiraModel.findOne({ singletonKey: 'main_db' });
        if (!existing) {
            await SafiraModel.create({ singletonKey: 'main_db', data: fallbackDatabase });
        }
        return true;
    } catch (err) {
        return false;
    }
}

export function setCors(res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS, PUT, DELETE');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
}
