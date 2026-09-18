const fs = require('fs');
let content = fs.readFileSync('src/server/api.ts', 'utf8');

content = content.replace(/get\(item\.productId\);/g, 'get(item.productId) as any;');
content = content.replace(/get\(\);/g, 'get() as any;');
content = content.replace(/get\(phoneToMatch\);/g, 'get(phoneToMatch) as any;');
content = content.replace(/get\(finalCustomerId\);/g, 'get(finalCustomerId) as any;');
content = content.replace(/get\(newInvoiceId\);/g, 'get(newInvoiceId) as any;');
content = content.replace(/get\(id\);/g, 'get(id) as any;');

fs.writeFileSync('src/server/api.ts', content);
console.log('Fixed typescript typings');
