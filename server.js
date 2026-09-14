const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
require('dotenv').config();

const app = express();
app.use(express.json());
app.use(cors());

// مسار تجريبي للتأكد أن السيرفر يعمل
app.get('/', (req, res) => {
  res.json({ status: 'success', message: 'Safira Logistics API is running perfectly!' });
});

// الاتصال بقاعدة البيانات MongoDB Atlas
const PORT = process.env.PORT || 8080;
const MONGO_URI = process.env.MONGO_URI;

mongoose.connect(MONGO_URI)
  .then(() => {
    console.log('Connected to MongoDB Atlas successfully');
    app.listen(PORT, () => {
      console.log(`Server is running on port ${PORT}`);
    });
  })
  .catch((err) => {
    console.error('Database connection error:', err);
  });
