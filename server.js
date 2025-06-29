// backend/server.js
import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import authRoutes from "./routes/auth.js";
import bookingsRoutes from "./routes/bookings.js";
import roomsRoutes from "./routes/rooms.js";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

app.use("/api/users", authRoutes); // Signup/Login
app.use("/api/bookings", bookingsRoutes); // Bookings
app.use("/api/rooms", roomsRoutes); // Room info

app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
});
