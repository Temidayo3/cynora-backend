const express = require('express');
const cors = require('cors');
const path = require('path');
const mysql = require('mysql2');
const app = express();

// Enable CORS for all origins
app.use(cors({
  origin: '*',
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// Body parser middleware
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Database connection using environment variables
const db = mysql.createConnection({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 3306,
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'cynora_ng',
  charset: 'utf8mb4',
  connectTimeout: 30000 // 30 seconds timeout
});

// Test database connection
db.connect((err) => {
  if (err) {
    console.error('❌ Database connection failed:', err.message);
    console.error('Using these credentials:');
    console.error('Host:', process.env.DB_HOST || 'localhost');
    console.error('Port:', process.env.DB_PORT || 3306);
    console.error('User:', process.env.DB_USER || 'root');
    console.error('Database:', process.env.DB_NAME || 'cynora_ng');
  } else {
    console.log('✅ Database connected successfully!');
  }
});

// Make db available to routes
global.db = db;

// Import route files
const authRoutes = require('./routes/auth');
const vendorsRoutes = require('./routes/vendors');
const bookingsRoutes = require('./routes/bookings');
const adminRoutes = require('./routes/admin');
const usersRoutes = require('./routes/users');
const enhancedAuthRoutes = require('./routes/enhanced-auth');
const portfolioRoutes = require('./routes/portfolio');
const pointsRoutes = require('./routes/points');

// Mount routes
app.use('/api', authRoutes);
app.use('/api', vendorsRoutes);
app.use('/api', bookingsRoutes);
app.use('/api', adminRoutes);
app.use('/api', usersRoutes);
app.use('/api/auth', enhancedAuthRoutes);
app.use('/api', portfolioRoutes);
app.use('/api', pointsRoutes);

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    message: 'Cynora NG Backend is running on Render!',
    timestamp: new Date().toISOString(),
    database: db.state === 'authenticated' ? 'Connected' : 'Disconnected'
  });
});

// Root endpoint
app.get('/', (req, res) => {
  res.json({
    message: 'Cynora NG API Server',
    version: '1.0.0',
    endpoints: {
      health: '/api/health',
      signup: '/api/signup',
      login: '/api/login'
    }
  });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Server Error:', err);
  res.status(500).json({ 
    success: false, 
    error: 'Internal server error',
    message: err.message 
  });
});

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Cynora NG Backend running on port ${PORT}`);
  console.log(`📅 Started at: ${new Date().toLocaleString()}`);
  console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
});

module.exports = app;
