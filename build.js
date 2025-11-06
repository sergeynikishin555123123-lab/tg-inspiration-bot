import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

console.log('🚀 Starting build process...');

try {
  // Проверяем существование папки client
  if (!fs.existsSync('client')) {
    console.error('❌ Client folder not found');
    process.exit(1);
  }

  console.log('📦 Installing client dependencies...');
  execSync('cd client && npm install', { stdio: 'inherit' });

  console.log('🔨 Building client...');
  execSync('cd client && npm run build', { stdio: 'inherit' });

  console.log('✅ Build completed successfully!');
} catch (error) {
  console.error('❌ Build failed:', error);
  process.exit(1);
}
