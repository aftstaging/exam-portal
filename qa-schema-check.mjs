import mysql from "mysql2/promise";
const c = await mysql.createConnection("mysql://root:root@localhost:3306/aft_portal");
const [cols] = await c.query("SHOW COLUMNS FROM users WHERE Field = 'role'");
const [pay] = await c.query("SHOW TABLES LIKE 'payments'");
const [ent] = await c.query("SHOW COLUMNS FROM entitlements WHERE Field = 'grantedBy'");
console.log("role enum:", cols[0].Type);
console.log("payments table:", Boolean(pay.length));
console.log("entitlements.grantedBy:", Boolean(ent.length));
await c.end();