console.log('✅ База данных инициализируется автоматически при запуске сервера');
console.log('🚀 Запустите сервер: npm start');

// Создаем простой скрипт для проверки зависимостей
import { readFileSync } from 'fs';

try {
  const packageJson = JSON.parse(readFileSync('./package.json', 'utf8'));
  console.log('📦 Зависимости проекта:');
  Object.entries(packageJson.dependencies).forEach(([name, version]) => {
    console.log(`   ${name}: ${version}`);
  });
} catch (error) {
  console.log('❌ Ошибка чтения package.json');
}
