const fs = require('fs');
let content = fs.readFileSync('src/server/api.ts', 'utf8');

// Change the import line
content = content.replace(
  "import { db, readDb, writeDb, logAudit, getMongoDb } from './db.js';",
  "import { db as sqliteDb, readDb, writeDb, logAudit, getMongoDb } from './db.js';"
);

// In the POST /invoices body, replace standalone db. with sqliteDb. 
// We need to be careful only to replace within the POST /invoices handler
// Strategy: replace all db. in lines 988-1224 only
const lines = content.split('\n');

// Find start/end line indexes of POST /invoices handler
let startIdx = -1;
let endIdx = -1;
let depth = 0;
let inHandler = false;

for (let i = 0; i < lines.length; i++) {
  if (lines[i].includes("// Create Invoice Transactionally")) {
    startIdx = i;
  }
  if (startIdx !== -1 && !inHandler && lines[i].includes("apiRouter.post('/invoices',")) {
    inHandler = true;
  }
  if (inHandler) {
    for (const ch of lines[i]) {
      if (ch === '{') depth++;
      if (ch === '}') depth--;
    }
    if (depth === 0 && i > startIdx + 2) {
      endIdx = i;
      break;
    }
  }
}

if (startIdx === -1 || endIdx === -1) {
  console.error('Could not find POST /invoices bounds', startIdx, endIdx);
  process.exit(1);
}

console.log(`Replacing db. in lines ${startIdx+1} to ${endIdx+1}`);
for (let i = startIdx; i <= endIdx; i++) {
  // Replace db. but NOT readDb, writeDb, getMongoDb, logAudit etc
  lines[i] = lines[i].replace(/\bdb\./g, 'sqliteDb.');
}

content = lines.join('\n');
fs.writeFileSync('src/server/api.ts', content);
console.log('Done');
