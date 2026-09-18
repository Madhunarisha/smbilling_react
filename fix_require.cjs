const fs = require('fs');
let content = fs.readFileSync('src/server/api.ts', 'utf8');

// Replace "const { db: sqliteDb } = require('./db.js');" with nothing, and rename sqliteDb to db
content = content.replace(/const { db: sqliteDb } = require\('\.\/db\.js'\);/g, '');
content = content.replace(/sqliteDb\./g, 'db.');

// Replace the require in /banks routes
content = content.replace(/const { db: sqliteDb } = require\('\.\/db\.js'\);/g, '');

fs.writeFileSync('src/server/api.ts', content);
console.log('Fixed require errors');
