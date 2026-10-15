import { db } from "../src/server/db";
console.log("Database ready. Schema version:", db.prepare("SELECT MAX(version) AS version FROM schema_migrations").get());
