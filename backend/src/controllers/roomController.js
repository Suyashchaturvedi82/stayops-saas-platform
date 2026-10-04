const db = require('../config/db');

const tenantIdOf = (req) => req.user?.tenant_id;

const getAllRooms = async (req, res) => {
  try {
    const tenantId = tenantIdOf(req);
    if (!tenantId) return res.status(400).json({ message: 'Tenant context missing.' });
    const [rooms] = await db.execute('SELECT * FROM rooms WHERE tenant_id = ? ORDER BY floor_number, room_number', [tenantId]);
    res.json(rooms);
  } catch (error) {
    console.error('Error fetching rooms:', error);
    res.status(500).json({ message: 'Server error fetching rooms' });
  }
};

const createRoom = async (req, res) => {
  const { room_number, floor_number, room_type, max_occupancy, rent_per_month, amenities, description } = req.body;
  const tenantId = tenantIdOf(req);
  if (!tenantId) return res.status(400).json({ message: 'Tenant context missing.' });
  if (!room_number || !max_occupancy || !rent_per_month) return res.status(400).json({ message: 'Room number, capacity, and price are required' });

  try {
    const [result] = await db.execute(
      `INSERT INTO rooms (tenant_id, room_number, floor_number, room_type, max_occupancy, rent_per_month, amenities, description)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [tenantId, room_number, floor_number || 1, room_type || 'NON_AC', max_occupancy, rent_per_month, JSON.stringify(amenities || []), description || null]
    );
    res.status(201).json({ message: 'Room created successfully', roomId: result.insertId });
  } catch (error) {
    console.error('Error creating room:', error);
    if (error.code === 'ER_DUP_ENTRY') return res.status(409).json({ message: 'Room number already exists' });
    res.status(500).json({ message: 'Server error creating room' });
  }
};

const updateRoom = async (req, res) => {
  const { id } = req.params;
  const { room_number, floor_number, room_type, max_occupancy, rent_per_month, amenities, description } = req.body;
  const tenantId = tenantIdOf(req);
  if (!tenantId) return res.status(400).json({ message: 'Tenant context missing.' });

  try {
    const [result] = await db.execute(
      `UPDATE rooms SET room_number = ?, floor_number = ?, room_type = ?, max_occupancy = ?, rent_per_month = ?, amenities = ?, description = ?
       WHERE id = ? AND tenant_id = ?`,
      [room_number, floor_number, room_type, max_occupancy, rent_per_month, JSON.stringify(amenities || []), description, id, tenantId]
    );
    if (!result.affectedRows) return res.status(404).json({ message: 'Room not found' });
    res.json({ message: 'Room updated successfully' });
  } catch (error) {
    console.error('Error updating room:', error);
    res.status(500).json({ message: 'Server error updating room' });
  }
};

module.exports = { getAllRooms, createRoom, updateRoom };
