import http from 'http';

const API_BASE = 'http://localhost:3002';

const endpoints = [
  '/health',
  '/api/webapp/characters',
  '/api/users/12345',
  '/api/webapp/quizzes'
];

endpoints.forEach(endpoint => {
  console.log(`\n🔍 Testing: ${endpoint}`);
  
  const req = http.request(API_BASE + endpoint, (res) => {
    let data = '';
    res.on('data', chunk => data += chunk);
    res.on('end', () => {
      try {
        const json = JSON.parse(data);
        console.log(`✅ Status: ${res.statusCode}`);
        if (endpoint === '/api/webapp/characters') {
          const counts = Object.keys(json).map(cls => `${cls}: ${json[cls].length}`).join(', ');
          console.log(`   👥 Characters: ${counts}`);
        }
      } catch (e) {
        console.log(`❌ JSON Error: ${e.message}`);
      }
    });
  });
  
  req.on('error', (err) => {
    console.log(`❌ Connection Error: ${err.message}`);
  });
  
  req.end();
});
