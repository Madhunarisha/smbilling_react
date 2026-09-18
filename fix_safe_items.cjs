const fs = require('fs');
let content = fs.readFileSync('src/components/InvoicePrintModal.tsx', 'utf8');

// Replace all remaining invoice.items references (not the safeItems definition line) with safeItems
content = content.replace(/\binvoice\.items\.map\(/g, 'safeItems.map(');
content = content.replace(/\binvoice\.items\[0\]/g, 'safeItems[0]');

fs.writeFileSync('src/components/InvoicePrintModal.tsx', content);
console.log('Done');
