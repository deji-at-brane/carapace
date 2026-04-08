const fs = require('fs');
const path = require('path');

// Try to find the DB in the standard Tauri location for this app
const dbPath = path.join(process.env.APPDATA, 'carapace', 'carapace.db');
console.log('Searching for database at:', dbPath);

if (!fs.existsSync(dbPath)) {
  console.log('Database not found. Trying local development paths...');
}

// Since I can't easily run sqlite3 without the package, I'll check raw file contents for 'localhost'
try {
  const content = fs.readFileSync(dbPath);
  const str = content.toString('utf8');
  const count = (str.match(/localhost/g) || []).length;
  console.log('Found "localhost" occurrences in DB:', count);
  
  if (count > 0) {
    // If it's in the DB, it's likely triggering the fallback
    console.log('POSSIBLE CULPRIT: Stale agent or credential with "localhost" in DB.');
  }
} catch (e) {
  console.log('Error reading DB file:', e.message);
}
