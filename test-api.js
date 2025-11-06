import http from 'http';

const testEndpoint = (path, callback) => {
  const options = {
    hostname: 'localhost',
    port: 3001,
    path: path,
    method: 'GET'
  };

  const req = http.request(options, (res) => {
    let data = '';
    res.on('data', (chunk) => {
      data += chunk;
    });
    res.on('end', () => {
      console.log(`✅ ${path}:`, JSON.parse(data));
      callback();
    });
  });

  req.on('error', (error) => {
    console.log(`❌ ${path}:`, error.message);
    callback();
  });

  req.end();
};

console.log('🔍 Testing API endpoints...');

testEndpoint('/health', () => {
  testEndpoint('/api/webapp/characters', () => {
    testEndpoint('/api/users/12345', () => {
      console.log('🎯 Testing complete');
    });
  });
});
