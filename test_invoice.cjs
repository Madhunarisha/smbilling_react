const http = require('http');
const req = http.request({
  hostname: '127.0.0.1', port: 3000, path: '/api/auth/login', method: 'POST', headers: { 'Content-Type': 'application/json' }
}, (res) => {
  let body = ''; res.on('data', c => body += c);
  res.on('end', () => {
    const token = JSON.parse(body).token;
    const req2 = http.request({
      hostname: '127.0.0.1', port: 3000, path: '/api/invoices', method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` }
    }, (res2) => {
      let body2 = ''; res2.on('data', c => body2 += c); res2.on('end', () => console.log('POST /invoices ->', res2.statusCode, body2));
    });
    req2.write(JSON.stringify({
      customerName: "Test Customer", items: [ { productId: "some-id", productName: "Item", quantity: 1, rate: 100 } ]
    }));
    req2.end();
  });
});
req.write(JSON.stringify({username: 'admin', password: 'admin123'}));
req.end();
