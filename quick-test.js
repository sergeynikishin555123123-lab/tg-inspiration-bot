import { get } from 'http';

const tests = [
  '/health',
  '/api/webapp/characters',
  '/api/users/12345'
];

tests.forEach(path => {
  console.log(`\n🔍 Testing: ${path}`);
  
  get(`http://localhost:3000${path}`, (res) => {
    let data = '';
    res.on('data', chunk => data += chunk);
    res.on('end', () => {
      try {
        const json = JSON.parse(data);
        console.log(`✅ Status: ${res.statusCode}`);
        
        if (path === '/api/webapp/characters') {
          const classes = Object.keys(json);
          const counts = classes.map(cls => `${cls}: ${json[cls].length}`).join(', ');
          console.log(`   👥 Found: ${counts}`);
        } else if (path === '/api/users/12345') {
          console.log(`   👤 User: ${json.user?.tg_first_name || 'Unknown'}, Stars: ${json.user?.stars || 0}`);
        }
      } catch (e) {
        console.log('❌ JSON error');
      }
    });
  }).on('error', (err) => {
    console.log(`❌ Connection error: ${err.message}`);
  });
});
