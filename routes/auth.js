import express from "express";
import bcrypt from "bcrypt";
import db from "../db.js";

const router = express.Router();

// SIGNUP
router.post("/signup", async (req, res) => {
  try {
    const { name, email, password } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ error: "All fields are required" });
    }

    const hashed = await bcrypt.hash(password, 10);

    db.query(
      "INSERT INTO users (name, email, password) VALUES (?, ?, ?)",
      [name, email, hashed],
      (err, result) => {
        if (err) {
          if (err.code === "ER_DUP_ENTRY") {
            return res.status(400).json({ error: "Email already exists" });
          }
          console.error("DB Insert Error:", err);
          return res.status(500).json({ error: "Database error" });
        }

        res.status(201).json({ id: result.insertId, name, email });
      }
    );
  } catch (error) {
    console.error("Signup Error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// LOGIN
router.post("/login", (req, res) => {
  const { email, password } = req.body;

  if (!email || !password)
    return res.status(400).json({ error: "Email and password required" });

  db.query(
    "SELECT * FROM users WHERE email = ?",
    [email],
    async (err, results) => {
      if (err || results.length === 0) {
        console.error("Login DB error:", err);
        return res.status(401).json({ error: "Invalid credentials" });
      }

      const user = results[0];
      const valid = await bcrypt.compare(password, user.password);
      if (!valid) return res.status(401).json({ error: "Invalid credentials" });

      res.json({ id: user.id, name: user.name, email: user.email });
    }
  );
});

export default router;
