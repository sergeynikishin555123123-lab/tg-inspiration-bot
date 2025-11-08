import sqlite3 from 'sqlite3';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const db = new sqlite3.Database(join(__dirname, '..', 'database.sqlite'));

console.log('📊 Setting up database...');

// Таблицы и начальные данные такие же как в server.js
// ... (код инициализации базы данных из server.js)

db.close(() => {
  console.log('✅ Database setup complete');
});
