// Per-rider 5-min timer — pehle order pe shuru, 5 min baad notification
import { io } from "../server.js";
import { pool } from "../db.js";

const timers = new Map(); // riderId → setTimeout handle

export function startRiderTimer(riderId, branchId) {
  if (timers.has(riderId)) return; // already running

  const handle = setTimeout(async () => {
    timers.delete(riderId);
    const countRes = await pool.query(
      "SELECT COUNT(*) FROM delivery_assignments WHERE rider_id = $1 AND status = 'accepted'",
      [riderId]
    );
    const count = parseInt(countRes.rows[0].count);
    if (count > 0) {
      io.to(`rider_${riderId}`).emit("timer_expired", {
        message: `5 minutes up! You have ${count} order${count > 1 ? "s" : ""}. Go deliver now!`,
        order_count: count,
      });
    }
  }, 5 * 60 * 1000); // 5 minutes

  timers.set(riderId, handle);
}

export function clearRiderTimer(riderId) {
  const handle = timers.get(riderId);
  if (handle) {
    clearTimeout(handle);
    timers.delete(riderId);
  }
}

export function isTimerRunning(riderId) {
  return timers.has(riderId);
}