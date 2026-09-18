const fs = require('fs');
let content = fs.readFileSync('src/server/api.ts', 'utf8');

// Fix banks endpoints to use sqliteDb
content = content.replace(
  `apiRouter.get('/banks', authenticateToken, (req: Request, res: Response) => {
  
  const banks = db.prepare('SELECT * FROM banks').all();
  res.json(banks);
});

apiRouter.post('/banks', authenticateToken, (req: AuthenticatedRequest, res: Response) => {
  
  const { bankName, accountNumber, ifsc, branch } = req.body;
  if (!bankName || !accountNumber) return res.status(400).json({ error: 'Bank Name and Account Number are required' });

  const id = \`bank-\${Date.now()}\`;
  const createdAt = new Date().toISOString();

  db.prepare(\`INSERT INTO banks (id, bankName, accountNumber, ifsc, branch, createdAt) VALUES (?, ?, ?, ?, ?, ?)\`).run(
    id, bankName.trim(), accountNumber.trim(), ifsc ? ifsc.trim().toUpperCase() : '', branch ? branch.trim() : '', createdAt
  );

  const newBank = db.prepare('SELECT * FROM banks WHERE id = ?').get(id) as any;
  res.status(201).json(newBank);
});`,
  `apiRouter.get('/banks', authenticateToken, (req: Request, res: Response) => {
  const banks = sqliteDb.prepare('SELECT * FROM banks').all();
  res.json(banks);
});

apiRouter.post('/banks', authenticateToken, (req: AuthenticatedRequest, res: Response) => {
  const { bankName, accountNumber, ifsc, branch } = req.body;
  if (!bankName || !accountNumber) return res.status(400).json({ error: 'Bank Name and Account Number are required' });

  const id = \`bank-\${Date.now()}\`;
  const createdAt = new Date().toISOString();

  sqliteDb.prepare(\`INSERT INTO banks (id, bankName, accountNumber, ifsc, branch, createdAt) VALUES (?, ?, ?, ?, ?, ?)\`).run(
    id, bankName.trim(), accountNumber.trim(), ifsc ? ifsc.trim().toUpperCase() : '', branch ? branch.trim() : '', createdAt
  );

  const newBank = sqliteDb.prepare('SELECT * FROM banks WHERE id = ?').get(id) as any;
  res.status(201).json(newBank);
});`
);

fs.writeFileSync('src/server/api.ts', content);
console.log('Fixed banks endpoints');
