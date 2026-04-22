const express = require('express');
const router = express.Router();
const db = require('../db');

// Add portfolio item
router.post('/portfolio/add', (req, res) => {
  const { vendor_id, title, description, image_base64 } = req.body;
  
  console.log('Portfolio upload request received:', {
    vendor_id,
    title,
    description_length: description?.length || 0,
    image_size: image_base64?.length || 0
  });
  
  if (!vendor_id || !title || !image_base64) {
    console.error('Missing required fields');
    return res.status(400).json({ 
      success: false, 
      error: 'Missing required fields: vendor_id, title, or image' 
    });
  }
  
  // Validate base64 format
  if (!image_base64.startsWith('data:image/')) {
    console.error('Invalid image format');
    return res.status(400).json({ 
      success: false, 
      error: 'Invalid image format. Must be base64 image data.' 
    });
  }
  
  const query = 'INSERT INTO portfolio (vendor_id, title, description, image_url, created_at) VALUES (?, ?, ?, ?, NOW())';
  
  db.query(query, [vendor_id, title, description || '', image_base64], (err, result) => {
    if (err) {
      console.error('Database error inserting portfolio:', err);
      return res.status(500).json({ 
        success: false, 
        error: 'Database error: ' + err.message 
      });
    }
    
    console.log('Portfolio item added successfully, ID:', result.insertId);
    res.json({ 
      success: true, 
      message: 'Portfolio item added!',
      id: result.insertId
    });
  });
});

// Get vendor portfolio
router.get('/portfolio/:vendor_id', (req, res) => {
  const query = 'SELECT * FROM portfolio WHERE vendor_id = ? ORDER BY created_at DESC';
  
  db.query(query, [req.params.vendor_id], (err, results) => {
    if (err) {
      console.error('Error fetching portfolio:', err);
      return res.status(500).json({ error: 'Failed to fetch portfolio' });
    }
    
    res.json(results || []);
  });
});

// Delete portfolio item
router.delete('/portfolio/:id', (req, res) => {
  const query = 'DELETE FROM portfolio WHERE id = ?';
  
  db.query(query, [req.params.id], (err, result) => {
    if (err) {
      console.error('Error deleting portfolio:', err);
      return res.status(500).json({ error: 'Failed to delete' });
    }
    
    res.json({ success: true, message: 'Portfolio item deleted' });
  });
});

module.exports = router;
