const fs = require('fs');
const apiPath = 'src/server/api.ts';
let code = fs.readFileSync(apiPath, 'utf8');

// Replace GET /invoices shim
// Actually, modifying readDb in db.ts is safer for GET routes.
