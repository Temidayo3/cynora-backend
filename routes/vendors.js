const express = require('express');
const router = express.Router();
const db = require('../db');

// Browse vendors
router.get('/vendors', (req, res) => {
  const { category, location, price_min, price_max, rating_min } = req.query;
  let query = 'SELECT u.*, AVG(r.rating) as avg_rating, COUNT(b.id) as jobs FROM users u LEFT JOIN reviews r ON r.booking_id IN (SELECT id FROM bookings WHERE vendor_id = u.id) LEFT JOIN bookings b ON b.vendor_id = u.id WHERE u.role = "vendor" AND u.verified = 1';
  const params = [];
  if (category) query += ' AND EXISTS (SELECT 1 FROM services s WHERE s.vendor_id = u.id AND s.category_id = ?)', params.push(category);
  if (location) query += ' AND u.location LIKE ?', params.push(`%${location}%`);
  query += ' GROUP BY u.id';
  if (rating_min) query += ` HAVING avg_rating >= ${rating_min}`;
  db.query(query, params, (err, results) => {
    if (err) return res.status(500).json({ error: 'Error' });
    res.json(results);
  });
});

// Vendor profile
router.get('/vendors/:id', (req, res) => {
  db.query('SELECT * FROM users WHERE id = ? AND role = "vendor"', [req.params.id], (err, user) => {
    if (err || !user.length) return res.status(404).json({ error: 'Not found' });
    db.query('SELECT * FROM services WHERE vendor_id = ?', [req.params.id], (err, services) => {
      db.query('SELECT * FROM reviews WHERE booking_id IN (SELECT id FROM bookings WHERE vendor_id = ?)', [req.params.id], (err, reviews) => {
        res.json({ user: user[0], services, reviews });
      });
    });
  });
});

// Add service
router.post('/services', (req, res) => {
  const { vendor_id, category_id, title, description, price, type, portfolio } = req.body;
  db.query('INSERT INTO services (vendor_id, category_id, title, description, price, type, portfolio) VALUES (?, ?, ?, ?, ?, ?, ?)', 
    [vendor_id, category_id, title, description, price, type, JSON.stringify(portfolio || [])], (err) => {
      if (err) return res.status(500).json({ error: 'Failed' });
      res.json({ success: true });
    });
});

// Get categories
router.get('/categories', (req, res) => {
  db.query('SELECT * FROM categories', (err, results) => res.json(results));
});

module.exports = router;