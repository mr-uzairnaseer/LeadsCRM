const mongoose = require('mongoose');

let isConnecting = false;

const connectDB = async () => {
  // Already connected
  if (mongoose.connections[0].readyState === 1) return;
  
  // Connection is in progress — wait for it to complete
  if (isConnecting) {
    while (isConnecting) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    if (mongoose.connections[0].readyState === 1) return;
  }
  
  isConnecting = true;
  try {
    await mongoose.connect(process.env.MONGODB_URI, {
      serverSelectionTimeoutMS: 15000, // 15 seconds timeout for cold starts
    });
    console.log('MongoDB Connected');
  } catch (err) {
    console.error('MongoDB Connection Error:', err.message);
    throw err;
  } finally {
    isConnecting = false;
  }
};

module.exports = connectDB;

