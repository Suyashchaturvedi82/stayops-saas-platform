const db = require('../config/db');

const getBedsByRoom = async (req, res) => {
  const { roomId } = req.params;
  try {
    const [beds] = await db.execute(
      `SELECT b.* FROM beds b JOIN rooms r ON r.id = b.room_id
       WHERE b.room_id = ? AND b.tenant_id = ? AND r.tenant_id = ? ORDER BY b.bed_number`,
      [roomId, req.user.tenant_id, req.user.tenant_id]
    );
    res.json(beds);
  } catch (error) {
    console.error('Error fetching beds:', error);
    res.status(500).json({ message: 'Server error fetching beds' });
  }
};

const createBed = async (req, res) => {
  const { room_id, bed_number, rent_per_month, description } = req.body;
  const tenantId = req.user.tenant_id;
  if (!tenantId) return res.status(400).json({ message: 'Tenant context missing.' });
  if (!room_id || !bed_number || !rent_per_month) return res.status(400).json({ message: 'Room ID, bed number, and rent are required' });

  try {
    const [roomCheck] = await db.execute('SELECT id FROM rooms WHERE id = ? AND tenant_id = ?', [room_id, tenantId]);
    if (!roomCheck.length) return res.status(404).json({ message: 'Room not found' });

    const [result] = await db.execute(
      `INSERT INTO beds (tenant_id, room_id, bed_number, rent_per_month, is_available, description)
       VALUES (?, ?, ?, ?, true, ?)`,
      [tenantId, room_id, bed_number, rent_per_month, description || null]
    );
    res.status(201).json({ message: 'Bed created successfully', bedId: result.insertId });
  } catch (error) {
    console.error('Error creating bed:', error);
    if (error.code === 'ER_DUP_ENTRY') return res.status(409).json({ message: 'Bed number already exists in this room' });
    res.status(500).json({ message: 'Server error creating bed' });
  }
};

const updateBed = async (req, res) => {
  const { id } = req.params;
  const { bed_number, is_available } = req.body;
  try {
    // Keep the Phase 2 state machine consistent with the legacy flag:
    // available => AVAILABLE, unavailable => at least occupied.
    const [result] = await db.execute(
      `UPDATE beds SET bed_number = ?, is_available = ?,
        status = IF(? = 1, 'AVAILABLE', IF(status = 'AVAILABLE', 'OCCUPIED', status))
       WHERE id = ? AND tenant_id = ?`,
      [bed_number, is_available, is_available, id, req.user.tenant_id]
    );
    if (!result.affectedRows) return res.status(404).json({ message: 'Bed not found' });
    res.json({ message: 'Bed updated successfully' });
  } catch (error) {
    console.error('Error updating bed:', error);
    res.status(500).json({ message: 'Server error updating bed' });
  }
};

module.exports = { getBedsByRoom, createBed, updateBed };
