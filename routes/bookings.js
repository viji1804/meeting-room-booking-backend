import express from "express";
import db from "../db.js";

const router = express.Router();

// POST /api/bookings — Create a booking with all rule checks
router.post("/", (req, res) => {
  const {
    room_id,
    user_id,
    title,
    start_time,
    end_time,
    attendees_count,
    equipment,
  } = req.body;

  const start = new Date(start_time);
  const end = new Date(end_time);
  const now = new Date();

  // Rule 1: No past bookings
  if (start < now || end < now) {
    return res.status(400).json({ error: "Cannot book for past time slots." });
  }

  // Rule 2: Only today allowed
  const today = now.toISOString().split("T")[0];
  const bookingDate = start.toISOString().split("T")[0];
  if (bookingDate !== today) {
    return res
      .status(400)
      .json({ error: "Bookings are allowed for today only." });
  }

  // Rule 3: Time between 9 AM and 6 PM
  const startHour = start.getHours();
  const endHour = end.getHours();
  if (
    startHour < 9 ||
    endHour > 18 ||
    (endHour === 18 && end.getMinutes() > 0)
  ) {
    return res
      .status(400)
      .json({ error: "Bookings must be between 9 AM and 6 PM." });
  }

  // Rule 4: Min 30 mins, Max 4 hours
  const durationMs = end - start;
  const durationMinutes = durationMs / (1000 * 60);
  if (durationMinutes < 30 || durationMinutes > 240) {
    return res
      .status(400)
      .json({ error: "Booking duration must be 30 minutes to 4 hours." });
  }

  // Rule 5: Check room capacity and overlapping bookings
  db.query(
    "SELECT capacity FROM rooms WHERE id = ?",
    [room_id],
    (err, roomRes) => {
      if (err || roomRes.length === 0) {
        return res.status(500).json({ error: "Room not found" });
      }

      const roomCapacity = roomRes[0].capacity;

      const conflictQuery = `
      SELECT SUM(attendees_count) AS total_attendees
      FROM bookings
      WHERE room_id = ?
        AND (
          (start_time < ? AND end_time > ?)
          OR (start_time < ? AND end_time > ?)
          OR (start_time >= ? AND end_time <= ?)
        )
    `;

      db.query(
        conflictQuery,
        [
          room_id,
          end_time,
          start_time,
          start_time,
          end_time,
          start_time,
          end_time,
        ],
        (err, results) => {
          if (err) return res.status(500).json({ error: err });

          const alreadyBooked = results[0].total_attendees || 0;
          const requested = parseInt(attendees_count);

          if (alreadyBooked + requested > roomCapacity) {
            return res.status(409).json({
              error: `Room over capacity. Already booked for ${alreadyBooked} people.`,
            });
          }

          // Insert booking
          const insertQuery = `
          INSERT INTO bookings (room_id, user_id, title, start_time, end_time, attendees_count, equipment)
          VALUES (?, ?, ?, ?, ?, ?, ?)
        `;

          db.query(
            insertQuery,
            [
              room_id,
              user_id,
              title,
              start_time,
              end_time,
              requested,
              equipment,
            ],
            (err, result) => {
              if (err) return res.status(500).json({ error: err });

              res.status(201).json({
                message: "Booking successful",
                id: result.insertId,
              });
            }
          );
        }
      );
    }
  );
});
// DELETE /api/bookings/:id
router.delete("/:id", (req, res) => {
    const bookingId = req.params.id;
    const userId = req.query.user; // send this from frontend to check ownership
  
    const checkQuery = "SELECT * FROM bookings WHERE id = ? AND user_id = ?";
    db.query(checkQuery, [bookingId, userId], (err, results) => {
      if (err) return res.status(500).json({ error: err });
      if (results.length === 0) {
        return res.status(403).json({ error: "Unauthorized to cancel this booking" });
      }
  
      const deleteQuery = "DELETE FROM bookings WHERE id = ?";
      db.query(deleteQuery, [bookingId], (err, result) => {
        if (err) return res.status(500).json({ error: err });
        res.json({ message: "Booking cancelled" });
      });
    });
  });
  router.get("/room/:id/today", (req, res) => {
    const roomId = req.params.id;
  
    const today = new Date();
    today.setHours(0, 0, 0, 0); // today at 00:00:00
    const tomorrow = new Date(today);
    tomorrow.setDate(today.getDate() + 1); // next day 00:00:00
  
    db.query(
      `SELECT title, start_time, end_time FROM bookings 
       WHERE room_id = ? AND start_time >= ? AND start_time < ?`,
      [roomId, today, tomorrow],
      (err, results) => {
        if (err) return res.status(500).json({ error: err });
        res.json(results);
      }
    );
  });
  
// PUT /api/bookings/:id (Update a booking)
router.put("/:id", (req, res) => {
    const bookingId = req.params.id;
    const {
      title,
      attendees_count,
      start_time,
      end_time,
      equipment,
      user_id,
    } = req.body;
  
    // 🛡️ Add validation if needed (e.g., time rules)
  
    const updateQuery = `
      UPDATE bookings
      SET title = ?, attendees_count = ?, start_time = ?, end_time = ?, equipment = ?
      WHERE id = ? AND user_id = ?
    `;
  
    db.query(
      updateQuery,
      [title, attendees_count, start_time, end_time, equipment, bookingId, user_id],
      (err, result) => {
        if (err) return res.status(500).json({ error: "Update failed" });
        if (result.affectedRows === 0)
          return res.status(403).json({ error: "Unauthorized or booking not found" });
  
        res.json({ message: "Booking updated successfully" });
      }
    );
  });
// GET /api/bookings/availability?start=...&end=...
router.get("/availability", (req, res) => {
    const { start, end } = req.query;
    if (!start || !end) return res.status(400).json({ error: "Missing time range" });
  
    const query = `
      SELECT r.*
      FROM rooms r
      WHERE r.id NOT IN (
        SELECT room_id FROM bookings
        WHERE (start_time < ? AND end_time > ?)
      )
    `;
  
    db.query(query, [end, start], (err, results) => {
      if (err) return res.status(500).json({ error: err });
      res.json(results);
    });
  });
    
// ✅ GET /api/bookings/user/:id — Fetch bookings for logged-in user
router.get("/user/:id", (req, res) => {
  const userId = req.params.id;

  db.query(
    "SELECT * FROM bookings WHERE user_id = ?",
    [userId],
    (err, results) => {
      if (err) return res.status(500).json({ error: err });
      res.json(results);
    }
  );
});

export default router;
