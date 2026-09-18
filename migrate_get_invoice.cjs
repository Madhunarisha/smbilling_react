const fs = require('fs');
const apiPath = '/Users/hazzinotechnologies/smbilling_react/src/server/api.ts';

let code = fs.readFileSync(apiPath, 'utf8');

const startMarker = "apiRouter.get('/invoices', authenticateToken, async (req: Request, res: Response) => {";
const endMarker = "});";
// Find the function end for GET /invoices
const startIndex = code.indexOf(startMarker);

let openBrackets = 0;
let endIndex = -1;
for (let i = startIndex + startMarker.length - 1; i < code.length; i++) {
  if (code[i] === '{') openBrackets++;
  if (code[i] === '}') {
    openBrackets--;
    if (openBrackets === 0) {
      endIndex = i + 1; // including '}'
      // need to include ');'
      if (code.substring(endIndex, endIndex + 2) === ');') endIndex += 2;
      break;
    }
  }
}

const replacement = `apiRouter.get('/invoices', authenticateToken, async (req: Request, res: Response) => {
  const { q, status, fromDate, toDate } = req.query;
  let sql = 'SELECT * FROM invoices WHERE 1=1';
  const params = [];

  if (q && typeof q === 'string') {
    const query = \`%\${q.toLowerCase()}%\`;
    sql += ' AND (LOWER(invoiceNumber) LIKE ? OR LOWER(customerName) LIKE ? OR LOWER(customerPhone) LIKE ?)';
    params.push(query, query, query);
  }

  if (status && typeof status === 'string' && status.toLowerCase() !== 'all') {
    sql += ' AND paymentStatus = ?';
    params.push(status);
  }

  if (fromDate && typeof fromDate === 'string') {
    sql += ' AND date >= ?';
    params.push(fromDate);
  }

  if (toDate && typeof toDate === 'string') {
    sql += ' AND date <= ?';
    params.push(toDate + 'T23:59:59.999Z');
  }

  sql += ' ORDER BY date DESC';

  const invoices = db.prepare(sql).all(...params);
  
  // Attach items to each invoice (for the UI that expects them embedded)
  const itemsStmt = db.prepare('SELECT * FROM invoice_items WHERE invoiceId = ?');
  for (const inv of invoices) {
    inv.items = itemsStmt.all(inv.id);
  }

  res.json(invoices);
});`;

code = code.substring(0, startIndex) + replacement + code.substring(endIndex);

const getByIdStart = "apiRouter.get('/invoices/:id', authenticateToken, async (req: Request, res: Response) => {";
const byIdIndex = code.indexOf(getByIdStart);

let byIdEnd = -1;
openBrackets = 0;
for (let i = byIdIndex + getByIdStart.length - 1; i < code.length; i++) {
  if (code[i] === '{') openBrackets++;
  if (code[i] === '}') {
    openBrackets--;
    if (openBrackets === 0) {
      byIdEnd = i + 1;
      if (code.substring(byIdEnd, byIdEnd + 2) === ');') byIdEnd += 2;
      break;
    }
  }
}

const getByIdReplacement = `apiRouter.get('/invoices/:id', authenticateToken, async (req: Request, res: Response) => {
  const inv = db.prepare('SELECT * FROM invoices WHERE id = ? OR invoiceNumber = ?').get(req.params.id, req.params.id);
  if (!inv) return res.status(404).json({ error: 'Invoice not found' });
  
  inv.items = db.prepare('SELECT * FROM invoice_items WHERE invoiceId = ?').all(inv.id);
  res.json(inv);
});`;

code = code.substring(0, byIdIndex) + getByIdReplacement + code.substring(byIdEnd);

fs.writeFileSync(apiPath, code, 'utf8');
console.log("Successfully migrated GET /invoices!");
