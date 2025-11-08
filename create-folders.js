import fs from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const folders = [
  'uploads/photos',
  'uploads/previews',
  'scripts'
];

console.log('📁 Creating project folders...');

folders.forEach(folder => {
  const fullPath = join(__dirname, folder);
  if (!fs.existsSync(fullPath)) {
    fs.mkdirSync(fullPath, { recursive: true });
    console.log(`✅ Created: ${folder}`);
  } else {
    console.log(`📁 Already exists: ${folder}`);
  }
});

console.log('✅ All folders created!');
