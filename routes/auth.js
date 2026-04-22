const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const db = require('../db');

// Signup
router.post('/signup', async (req, res) => {
  const { name, email, phone, password, role, nin, bank_account } = req.body;
  const hash = await bcrypt.hash(password, 10);
  db.query('INSERT INTO users (name, email, phone, password, role, nin, bank_account) VALUES (?, ?, ?, ?, ?, ?, ?)', 
    [name, email, phone, hash, role, nin || null, bank_account || null], (err, result) => {
      if (err) return res.status(500).json({ error: 'Signup failed' });
      res.json({ success: true, id: result.insertId });
  });
});

// Login
router.post('/login', (req, res) => {
  const { email, password } = req.body;
  db.query('SELECT * FROM users WHERE email = ?', [email], async (err, results) => {
    if (err || !results.length) return res.status(401).json({ error: 'Invalid' });
    const user = results[0];
    if (!await bcrypt.compare(password, user.password)) return res.status(401).json({ error: 'Invalid' });
    res.json({ success: true, user: { id: user.id, role: user.role, verified: user.verified } });
  });
});

module.exports = router;