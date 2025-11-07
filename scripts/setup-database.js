import sqlite3 from 'sqlite3';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

console.log('🎯 Настройка базы данных...');

// База данных уже инициализируется в server.js
// Этот файл оставлен для совместимости

console.log('✅ База данных будет автоматически инициализирована при запуске сервера');
console.log('🚀 Запустите сервер: npm start');
