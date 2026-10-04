const db = require('../config/db');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

/**
 * REGISTER
 * POST /api/auth/register
 */
const register = async (req, res) => {
  const { email, password, full_name, phone, gender } = req.body;

  if (!email || !password || !full_name || !phone || !gender) {
    return res.status(400).json({
      message: 'Email, password, name, phone, and gender are required.'
    });
  }

  // Split full name
  const nameParts = full_name.trim().split(' ');
  const first_name = nameParts[0];
  const last_name = nameParts.slice(1).join(' ') || null;

  const connection = await db.getConnection();

  try {
    await connection.beginTransaction();

    // Check existing user
    const [existing] = await connection.execute(
      'SELECT id FROM users WHERE email = ?',
      [email]
    );

    if (existing.length > 0) {
      return res.status(409).json({ message: 'User already exists.' });
    }

    // Hash password
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);

    // Insert user
    const [userResult] = await connection.execute(
      `INSERT INTO users 
       (email, password_hash, first_name, last_name, phone, gender)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        email,
        passwordHash,
        first_name,
        last_name,
        phone,
        gender.toUpperCase()
      ]
    );

    const userId = userResult.insertId;

    // Get USER role
    const [roles] = await connection.execute(
      'SELECT id FROM roles WHERE name = ?',
      ['USER']
    );

    if (roles.length === 0) {
      throw new Error('Default role USER not found.');
    }

    // Assign role
    await connection.execute(
      'INSERT INTO user_roles (user_id, role_id) VALUES (?, ?)',
      [userId, roles[0].id]
    );

    await connection.commit();

    res.status(201).json({
      message: 'User registered successfully',
      userId
    });

  } catch (error) {
    await connection.rollback();
    console.error('Registration Error:', error);
    res.status(500).json({ message: 'Server error during registration.' });
  } finally {
    connection.release();
  }
};

/**
 * LOGIN
 * POST /api/auth/login
 */
const login = async (req, res) => {
  const { email, password } = req.body;

  try {
    const [users] = await db.execute(
      `SELECT id, email, password_hash, first_name, last_name
       FROM users WHERE email = ?`,
      [email]
    );

    if (users.length === 0) {
      return res.status(401).json({ message: 'Invalid credentials.' });
    }

    const user = users[0];

    const isMatch = await bcrypt.compare(password, user.password_hash);
    if (!isMatch) {
      return res.status(401).json({ message: 'Invalid credentials.' });
    }

    const [roles] = await db.execute(
      `SELECT r.name
       FROM roles r
       JOIN user_roles ur ON r.id = ur.role_id
       WHERE ur.user_id = ?`,
      [user.id]
    );

    const roleNames = roles.map(r => r.name);

    const token = jwt.sign(
      {
        id: user.id,
        email: user.email,
        roles: roleNames
      },
      process.env.JWT_SECRET,
      { expiresIn: '24h' }
    );

    res.json({
      token,
      user: {
        id: user.id,
        email: user.email,
        first_name: user.first_name,
        last_name: user.last_name,
        roles: roleNames
      }
    });

  } catch (error) {
    console.error('Login Error:', error);
    res.status(500).json({ message: 'Server error during login.' });
  }
};

module.exports = {
  register,
  login
};
