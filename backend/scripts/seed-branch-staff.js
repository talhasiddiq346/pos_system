// One-off: create/assign staff accounts for Tariq Road + Hussainabad Food Street.
// tahir@pos.com already existed (branch_admin, no branch) — it gets updated in
// place rather than re-inserted, since email is unique. Everyone else is new.
//
// Run: node scripts/seed-branch-staff.js
// Run against prod: DATABASE_URL=<prod url> node scripts/seed-branch-staff.js

import "dotenv/config";
import bcrypt from "bcryptjs";
import pg from "pg";

const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

const STAFF = [
  { name: "Tahir", email: "tahir@pos.com", role: "branch_admin", branch: "Tariq Road", phone: "03302064065" },
  { name: "Zahid", email: "zahid@pos.com", role: "branch_admin", branch: "Hussainabad Food Street", phone: "03302064065" },
  { name: "Omer", email: "omer@pos.com", role: "chef", branch: "Hussainabad Food Street", phone: "03302064065" },
  { name: "Qasim", email: "qasim@pos.com", role: "chef", branch: "Tariq Road", phone: "03302064065" },
  { name: "Samam", email: "samam@pos.com", role: "cashier", branch: "Hussainabad Food Street", phone: "03302064065" },
  { name: "Ajwad", email: "ajwad@pos.com", role: "cashier", branch: "Tariq Road", phone: "03302064065" },
];
const PASSWORD = "admin123";

async function main() {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const { rows: branchRows } = await client.query(
      "SELECT id, name FROM branches WHERE name IN ('Tariq Road', 'Hussainabad Food Street')"
    );
    const branchIdByName = Object.fromEntries(branchRows.map((b) => [b.name, b.id]));
    for (const s of STAFF) {
      if (!branchIdByName[s.branch]) throw new Error(`Branch not found: ${s.branch}`);
    }

    const hash = await bcrypt.hash(PASSWORD, 10);

    for (const s of STAFF) {
      const branchId = branchIdByName[s.branch];
      const { rows: existing } = await client.query(
        "SELECT id FROM users WHERE email = $1",
        [s.email]
      );
      if (existing.length) {
        await client.query(
          `UPDATE users SET name = $1, password_hash = $2, role = $3, branch_id = $4, phone = $5
           WHERE email = $6`,
          [s.name, hash, s.role, branchId, s.phone, s.email]
        );
        console.log(`Updated  ${s.email} -> ${s.role} @ ${s.branch}`);
      } else {
        await client.query(
          `INSERT INTO users (name, email, password_hash, role, branch_id, phone)
           VALUES ($1, $2, $3, $4, $5, $6)`,
          [s.name, s.email, hash, s.role, branchId, s.phone]
        );
        console.log(`Inserted ${s.email} -> ${s.role} @ ${s.branch}`);
      }
    }

    await client.query("COMMIT");
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("Failed, rolled back:", err);
    process.exitCode = 1;
  } finally {
    client.release();
    await pool.end();
  }
}

main();
