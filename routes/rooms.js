import express from "express";
import db from "../db.js";

const router = express.Router();

router.get("/", (req, res) => {
  db.query("SELECT * FROM rooms", (err, results) => {
    if (err) return res.status(500).json({ error: err });
    res.json(results);
  });
});

export default router;
