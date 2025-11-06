import http from 'http';

const testEndpoints = [
  '/health',
  '/api/webapp/characters', 
  '/api/users/12345',
  '/api/webapp/quizzes'
];

async function testEndpoint(path) {
  return new Promise((resolve) => {
    const options = {
      hostname: 'localhost',
      port: 3001,
      path: path,
      method: 'GET',
      timeout: 5000
    };

    console.log(`\n🔍 Testing: ${path}`);

    const req = http.request(options, (res) => {
      console.log(`📊 Status: ${res.statusCode}`);
      console.log(`📋 Headers: ${res.headers['content-type']}`);
      
      let data = '';
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        try {
          if (res.headers['content-type']?.includes('application/json')) {
            const jsonData = JSON.parse(data);
            console.log(`✅ Success:`, Object.keys(jsonData));
            if (path === '/api/webapp/characters' && jsonData.Художники) {
              console.log(`   👥 Characters: ${jsonData.Художники.length} художников, ${jsonData.Стилисты?.length || 0} стилистов`);
            }
          } else {
            console.log(`❌ Wrong content type:`, data.substring(0, 100));
          }
        } catch (e) {
          console.log(`❌ JSON parse error:`, e.message);
          console.log(`📄 Response:`, data.substring(0, 200));
        }
        resolve();
      });
    });

    req.on('error', (error) => {
      console.log(`❌ Connection error:`, error.message);
      resolve();
    });

    req.on('timeout', () => {
      console.log(`⏰ Timeout for ${path}`);
      req.destroy();
      resolve();
    });

    req.end();
  });
}

async function runTests() {
  console.log('🚀 Starting API tests...');
  
  for (const endpoint of testEndpoints) {
    await testEndpoint(endpoint);
  }
  
  console.log('\n🎯 All tests completed');
}

runTests();
