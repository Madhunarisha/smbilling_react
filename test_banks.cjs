const http = require('http');

const req = http.request({
  hostname: '127.0.0.1',
  port: 3000,
  path: '/api/auth/login',
  method: 'POST',
  headers: { 'Content-Type': 'application/json' }
}, (res) => {
  let body = '';
  res.on('data', c => body += c);
  res.on('end', () => {
    const token = JSON.parse(body).token;
    
    const req2 = http.request({
      hostname: '127.0.0.1',
      port: 3000,
      path: '/api/banks',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      }
    }, (res2) => {
      let body2 = '';
      res2.on('data', c => body2 += c);
      res2.on('end', () => console.log('POST /banks ->', res2.statusCode, body2));
    });
    
    req2.write(JSON.stringify({bankName: 'Test Bank', accountNumber: '1234'}));
    req2.end();
  });
});
req.write(JSON.stringify({username: 'admin', password: 'password123'})); // wait, it might be password123?
req.end();
