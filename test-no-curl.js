import { get } from 'http';

const testEndpoint = (port, path) => {
  return new Promise((resolve) => {
    console.log(`\n🔍 Testing: http://localhost:${port}${path}`);
    
    get(`http://localhost:${port}${path}`, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          console.log(`✅ Status: ${res.statusCode}`);
          console.log(`📦 Response:`, Object.keys(json));
          resolve(true);
        } catch (e) {
          console.log(`❌ Not JSON: ${data.substring(0, 100)}`);
          resolve(false);
        }
      });
    }).on('error', (err) => {
      console.log(`❌ Connection error: ${err.message}`);
      resolve(false);
    });
  });
};

async function runTests() {
  // Пробуем разные порты
  const ports = [3000, 3001, 3002, 3003, 3004, 3005];
  
  for (const port of ports) {
    console.log(`\n🎯 Testing port ${port}...`);
    const success = await testEndpoint(port, '/health');
    if (success) {
      console.log(`\n🎊 Server found on port ${port}!`);
      
      // Тестируем другие endpoints
      await testEndpoint(port, '/api/webapp/characters');
      await testEndpoint(port, '/api/users/12345');
      break;
    }
  }
}

runTests();
