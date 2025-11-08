import sqlite3 from 'sqlite3';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Создаем базу данных в файле для продакшена
const db = new sqlite3.Database(join(__dirname, '..', 'database.sqlite'));

console.log('🔄 Настройка базы данных...');

db.serialize(() => {
  // Таблицы создаются так же как в server.js
  // Этот файл можно использовать для миграций или начальной настройки
  
  console.log('✅ База данных настроена');
  db.close();
});
