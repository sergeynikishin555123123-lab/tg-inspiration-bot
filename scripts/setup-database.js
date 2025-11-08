import sqlite3 from 'sqlite3';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

console.log('🎯 Настройка базы данных Мастерской Вдохновения...');

// Для продакшена используйте файловую базу:
// const db = new sqlite3.Database(join(__dirname, '..', 'database.db'));
const db = new sqlite3.Database(':memory:');

db.serialize(() => {
  console.log('📊 Создание таблиц...');
  
  // Все таблицы из server.js создаются автоматически при запуске
  // Этот файл оставлен для будущих миграций
  
  console.log('✅ База данных готова к использованию');
  console.log('🚀 Запустите сервер: npm start');
});

db.close();
