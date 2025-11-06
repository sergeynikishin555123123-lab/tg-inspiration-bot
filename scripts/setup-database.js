import { initDatabase } from '../config/database.js';

console.log('🔄 Setting up database...');
initDatabase();
setTimeout(() => {
    console.log('✅ Database setup complete!');
    process.exit(0);
}, 3000);
