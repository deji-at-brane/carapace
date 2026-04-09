import sqlite3 from 'sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dbPath = path.join(process.env.APPDATA, 'carapace', 'carapace.db');

console.log('Opening database at:', dbPath);

const db = new sqlite3.Database(dbPath, sqlite3.OPEN_READONLY, (err) => {
    if (err) {
        console.error('Error opening DB:', err.message);
        process.exit(1);
    }
});

db.all("SELECT * FROM credentials", (err, rows) => {
    if (err) {
        console.error('Error querying credentials:', err.message);
    } else {
        console.log('CREDENTIALS:');
        rows.forEach(row => {
            console.log(`Host: ${row.agent_host}, Token: ${row.secret_blob}`);
        });
    }
    db.close();
});
