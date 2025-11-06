import express from 'express';
import cors from 'cors';
import sqlite3 from 'sqlite3';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const PORT = 3000;

// Middleware
app.use(express.json());
app.use(cors());
app.use(express.static(join(__dirname, 'public')));

console.log('🎨 Мастерская Вдохновения - Запуск...');

// База данных в памяти
const db = new sqlite3.Database(':memory:');

// Инициализация базы
console.log('📊 Инициализация базы данных...');

db.serialize(() => {
  // Персонажи
  db.run(`CREATE TABLE characters (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    class TEXT NOT NULL,
    character_name TEXT NOT NULL,
    description TEXT,
    bonus_type TEXT,
    bonus_value TEXT
  )`);
  
  // Пользователи
  db.run(`CREATE TABLE users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER UNIQUE,
    tg_first_name TEXT,
    stars REAL DEFAULT 0,
    level TEXT DEFAULT 'Ученик',
    is_registered BOOLEAN DEFAULT FALSE
  )`);
  
  // Заполняем персонажей
  const stmt = db.prepare("INSERT INTO characters (class, character_name, description, bonus_type, bonus_value) VALUES (?, ?, ?, ?, ?)");
  
  const characters = [
    ['Художники', 'Лука Цветной', 'Рисует с детства, любит эксперименты с цветом', 'percent_bonus', '10'],
    ['Художники', 'Марина Кисть', 'Строгая преподавательница академической живописи', 'forgiveness', '1'],
    ['Художники', 'Феликс Штрих', 'Экспериментатор, мастер зарисовок', 'random_gift', '1-3'],
    ['Стилисты', 'Эстелла Моде', 'Бывший стилист, обучает восприятию образа', 'percent_bonus', '5'],
    ['Стилисты', 'Роза Ателье', 'Мастер практического шитья', 'secret_advice', '2weeks'],
    ['Стилисты', 'Гертруда Линия', 'Ценит детали и аксессуары', 'series_bonus', '1'],
    ['Мастера', 'Тихон Творец', 'Ремесленник, любит простые техники', 'photo_bonus', '1'],
    ['Мастера', 'Агата Узор', 'Любит неожиданные материалы', 'weekly_surprise', '6'],
    ['Мастера', 'Борис Клей', 'Весёлый мастер импровизаций', 'mini_quest', '2'],
    ['Историки', 'Профессор Артёмий', 'Любитель архивов и фактов', 'quiz_hint', '1'],
    ['Историки', 'Соня Гравюра', 'Рассказывает истории картин', 'fact_star', '1'],
    ['Историки', 'Михаил Эпоха', 'Любит хронологию и эпохи', 'streak_multiplier', '2']
  ];
  
  characters.forEach(char => stmt.run(char));
  stmt.finalize();
  
  // Тестовый пользователь
  db.run("INSERT INTO users (user_id, tg_first_name, stars, level, is_registered) VALUES (?, ?, ?, ?, ?)",
    [12345, 'Тестовый Пользователь', 15.5, 'Ученик', true]);
  
  console.log('✅ База данных готова');
});

// ==================== API ENDPOINTS ====================

// Health check
app.get('/health', (req, res) => {
  console.log('✅ Health check');
  res.json({ 
    status: 'OK', 
    message: 'Сервер работает!', 
    port: PORT,
    time: new Date().toISOString()
  });
});

// Получить персонажей
app.get('/api/webapp/characters', (req, res) => {
  console.log('📝 Запрос персонажей');
  
  db.all("SELECT * FROM characters ORDER BY class, character_name", (err, characters) => {
    if (err) {
      console.error('❌ Ошибка базы:', err);
      return res.status(500).json({ error: 'Ошибка базы данных' });
    }
    
    const grouped = {};
    characters.forEach(char => {
      if (!grouped[char.class]) grouped[char.class] = [];
      grouped[char.class].push(char);
    });
    
    console.log(`✅ Отправлено ${characters.length} персонажей`);
    res.json(grouped);
  });
});

// Получить пользователя
app.get('/api/users/:id', (req, res) => {
  const userId = req.params.id;
  console.log('📝 Запрос пользователя:', userId);
  
  db.get("SELECT * FROM users WHERE user_id = ?", [userId], (err, user) => {
    if (err) {
      console.error('❌ Ошибка базы:', err);
      return res.status(500).json({ error: 'Ошибка базы данных' });
    }
    
    if (user) {
      console.log('✅ Пользователь найден:', user.tg_first_name);
      res.json({ exists: true, user });
    } else {
      console.log('✅ Новый пользователь');
      res.json({ 
        exists: false, 
        user: {
          user_id: parseInt(userId),
          stars: 0,
          level: 'Ученик',
          is_registered: false
        }
      });
    }
  });
});

// Регистрация
app.post('/api/users/register', (req, res) => {
  const { userId, userClass, characterId } = req.body;
  console.log('📝 Регистрация:', { userId, userClass, characterId });
  
  db.run(
    "INSERT OR REPLACE INTO users (user_id, stars, level, is_registered) VALUES (?, 5, 'Ученик', true)",
    [userId],
    function(err) {
      if (err) {
        console.error('❌ Ошибка регистрации:', err);
        return res.status(500).json({ error: 'Ошибка регистрации' });
      }
      
      console.log('✅ Пользователь зарегистрирован');
      res.json({ 
        success: true, 
        message: 'Регистрация успешна! +5⭐',
        starsAdded: 5
      });
    }
  );
});

// Главная страница
app.get('/', (req, res) => {
  console.log('🏠 Главная страница');
  res.sendFile(join(__dirname, 'public', 'index.html'));
});

// ==================== ЗАПУСК СЕРВЕРА ====================

const server = app.listen(PORT, '0.0.0.0', () => {
  console.log('🚀 =================================');
  console.log('🚀 СЕРВЕР ЗАПУЩЕН НА ПОРТУ 3000!');
  console.log('🚀 =================================');
  console.log('📊 Health:    http://localhost:3000/health');
  console.log('👥 Characters: http://localhost:3000/api/webapp/characters');
  console.log('👤 Users:      http://localhost:3000/api/users/12345');
  console.log('🏠 Main:       http://localhost:3000');
  console.log('⏰ Time:       ' + new Date().toISOString());
  console.log('=================================');
});

// Обработка ошибок
server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.log('❌ Порт 3000 занят! Останавливаем...');
    process.exit(1);
  }
});

// Обработка завершения
process.on('SIGINT', () => {
  console.log('\n🛑 Остановка сервера...');
  server.close(() => {
    console.log('✅ Сервер остановлен');
    process.exit(0);
  });
});
