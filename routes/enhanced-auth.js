const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const db = require('../db');
const crypto = require('crypto');

// Generate OTP
function generateOTP() {
  return Math.floor(100000 + Math.random() * 900000).toString(); // 6-digit OTP
}

// Store OTP temporarily (in production, use Redis)
const otpStore = new Map();

// STEP 1: Request OTP for Signup
router.post('/request-otp', async (req, res) => {
  const { phone, email } = req.body;
  
  // Check if user already exists
  db.query('SELECT * FROM users WHERE phone = ? OR email = ?', [phone, email], (err, results) => {
    if (err) return res.status(500).json({ error: 'Database error' });
    if (results.length > 0) return res.status(400).json({ error: 'User already exists' });
    
    // Generate OTP
    const otp = generateOTP();
    
    // Store OTP with expiration (5 minutes)
    otpStore.set(phone, {
      otp,
      email,
      expires: Date.now() + 5 * 60 * 1000
    });
    
    // TODO: Send OTP via SMS (integrate with Termii, Africa's Talking, or Twilio)
    // For now, we'll just return it in response (REMOVE IN PRODUCTION!)
    console.log(`OTP for ${phone}: ${otp}`);
    
    res.json({ 
      success: true, 
      message: 'OTP sent to your phone',
      // REMOVE THIS IN PRODUCTION - only for testing
      debug_otp: otp 
    });
  });
});

// STEP 2: Verify OTP and Complete Signup
router.post('/verify-otp-signup', async (req, res) => {
  const { phone, email, name, password, role, otp } = req.body;
  
  // Verify OTP
  const storedData = otpStore.get(phone);
  
  if (!storedData) {
    return res.status(400).json({ error: 'OTP expired or not found. Request a new one.' });
  }
  
  if (storedData.otp !== otp) {
    return res.status(400).json({ error: 'Invalid OTP' });
  }
  
  if (Date.now() > storedData.expires) {
    otpStore.delete(phone);
    return res.status(400).json({ error: 'OTP expired. Request a new one.' });
  }
  
  // OTP is valid - create user
  const hash = await bcrypt.hash(password, 10);
  
  db.query(
    `INSERT INTO users (name, email, phone, password, role, phone_verified, created_at) 
     VALUES (?, ?, ?, ?, ?, 1, NOW())`,
    [name, email, phone, hash, role],
    (err, result) => {
      if (err) {
        console.error(err);
        return res.status(500).json({ error: 'Signup failed' });
      }
      
      // Clear OTP
      otpStore.delete(phone);
      
      res.json({ 
        success: true, 
        message: 'Account created successfully!',
        user: { id: result.insertId, role }
      });
    }
  );
});

// STEP 3: Login with OTP option
router.post('/login-otp', (req, res) => {
  const { phone } = req.body;
  
  // Check if user exists
  db.query('SELECT * FROM users WHERE phone = ?', [phone], (err, results) => {
    if (err || !results.length) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    // Generate OTP
    const otp = generateOTP();
    
    // Store OTP
    otpStore.set(phone, {
      otp,
      userId: results[0].id,
      expires: Date.now() + 5 * 60 * 1000
    });
    
    // TODO: Send OTP via SMS
    console.log(`Login OTP for ${phone}: ${otp}`);
    
    res.json({ 
      success: true, 
      message: 'OTP sent to your phone',
      debug_otp: otp // REMOVE IN PRODUCTION
    });
  });
});

// STEP 4: Verify OTP and Login
router.post('/verify-otp-login', (req, res) => {
  const { phone, otp } = req.body;
  
  const storedData = otpStore.get(phone);
  
  if (!storedData || storedData.otp !== otp) {
    return res.status(400).json({ error: 'Invalid OTP' });
  }
  
  if (Date.now() > storedData.expires) {
    otpStore.delete(phone);
    return res.status(400).json({ error: 'OTP expired' });
  }
  
  // Get user details
  db.query('SELECT * FROM users WHERE id = ?', [storedData.userId], (err, results) => {
    if (err || !results.length) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    const user = results[0];
    otpStore.delete(phone);
    
    res.json({ 
      success: true, 
      user: { 
        id: user.id, 
        name: user.name,
        email: user.email,
        role: user.role, 
        verified: user.verified,
        phone_verified: user.phone_verified
      } 
    });
  });
});

// Vendor Verification - Submit NIN and Bank Details
router.post('/vendor/submit-verification', (req, res) => {
  const { vendor_id, nin, nin_name, bank_account, bank_name, account_name } = req.body;
  
  // Check if NIN or Bank Account already exists
  db.query(
    'SELECT * FROM users WHERE (nin = ? OR bank_account = ?) AND id != ?',
    [nin, bank_account, vendor_id],
    (err, duplicates) => {
      if (err) return res.status(500).json({ error: 'Database error' });
      
      if (duplicates.length > 0) {
        return res.status(400).json({ 
          error: 'NIN or Bank Account already registered with another vendor',
          fraud_alert: true
        });
      }
      
      // Update vendor with verification details
      db.query(
        `UPDATE users 
         SET nin = ?, nin_name = ?, bank_account = ?, bank_name = ?, account_name = ?,
             verification_submitted = 1, verification_submitted_at = NOW()
         WHERE id = ? AND role = 'vendor'`,
        [nin, nin_name, bank_account, bank_name, account_name, vendor_id],
        (err) => {
          if (err) return res.status(500).json({ error: 'Failed to submit verification' });
          
          res.json({ 
            success: true, 
            message: 'Verification details submitted. Admin will review shortly.' 
          });
        }
      );
    }
  );
});

// Admin: Verify Vendor
router.post('/admin/verify-vendor/:id', (req, res) => {
  const { approved } = req.body; // true or false
  
  db.query(
    `UPDATE users 
     SET verified = ?, verification_date = NOW() 
     WHERE id = ? AND role = 'vendor'`,
    [approved ? 1 : 0, req.params.id],
    (err) => {
      if (err) return res.status(500).json({ error: 'Failed to update verification' });
      
      res.json({ 
        success: true, 
        message: approved ? 'Vendor verified' : 'Vendor rejected' 
      });
    }
  );
});

// Track device/IP for fraud detection
router.post('/track-device', (req, res) => {
  const { user_id, device_id, ip_address, user_agent } = req.body;
  
  db.query(
    `INSERT INTO device_tracking (user_id, device_id, ip_address, user_agent, last_seen)
     VALUES (?, ?, ?, ?, NOW())
     ON DUPLICATE KEY UPDATE last_seen = NOW(), login_count = login_count + 1`,
    [user_id, device_id, ip_address, user_agent],
    (err) => {
      if (err) console.error('Device tracking error:', err);
      res.json({ success: true });
    }
  );
});

module.exports = router;
