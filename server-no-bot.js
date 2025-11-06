import express from 'express';
import cors from 'cors';
import sqlite3 from 'sqlite3';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { createServer } from 'http';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
let PORT = 3000;

app.use(express.json());
app.use(cors());
app.use(express.static(join(__dirname, 'public')));

console.log('🤖 Starting server (NO BOT)...');

// Используем базу в памяти
const db = new sqlite3.Database(':memory:');

// Инициализация базы данных
db.serialize(() => {
  console.log('📊 Initializing database...');
  
  // Таблица персонажей
  db.run(`CREATE TABLE characters (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    class TEXT NOT NULL,
    character_name TEXT NOT NULL,
    description TEXT,
    bonus_type TEXT NOT NULL,
    bonus_value TEXT NOT NULL
  )`);
  
  // Таблица пользователей
  db.run(`CREATE TABLE users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER UNIQUE NOT NULL,
    tg_username TEXT,
    tg_first_name TEXT,
    stars REAL DEFAULT 0,
    level TEXT DEFAULT 'Ученик',
    is_registered BOOLEAN DEFAULT FALSE,
    class TEXT,
    character_id INTEGER
  )`);
  
  // Заполняем персонажей
  console.log('👥 Adding characters...');
  const characters = [
    ['Художники', 'Лука Цветной', 'Рисует с детства, любит эксперименты с цветом', 'percent_bonus', '10'],
    ['Художники', 'Марина Кисть', 'Строгая, но добрая преподавательница академической живописи', 'forgiveness', '1'],
    ['Художники', 'Феликс Штрих', 'Экспериментатор, мастер быстрых зарисовок', 'random_gift', '1-3'],
    ['Стилисты', 'Эстелла Моде', 'Бывший стилист, обучает восприятию образа', 'percent_bonus', '5'],
    ['Стилисты', 'Роза Ателье', 'Мастер практического шитья и образов', 'secret_advice', '2weeks'],
    ['Стилисты', 'Гертруда Линия', 'Ценит детали и силу аксессуаров', 'series_bonus', '1'],
    ['Мастера', 'Тихон Творец', 'Ремесленник, любит простые техники', 'photo_bonus', '1'],
    ['Мастера', 'Агата Узор', 'Любит неожиданные материалы и коллажи', 'weekly_surprise', '6'],
    ['Мастера', 'Борис Клей', 'Весёлый мастер импровизаций', 'mini_quest', '2'],
    ['Историки', 'Профессор Артёмий', 'Экстра-любитель архивов и фактов', 'quiz_hint', '1'],
    ['Историки', 'Соня Гравюра', 'Рассказывает истории картин как сказки', 'fact_star', '1'],
    ['Историки', 'Михаил Эпоха', 'Любит хронологию и сравнения эпох', 'streak_multiplier', '2']
  ];
  
  const stmt = db.prepare("INSERT INTO characters (class, character_name, description, bonus_type, bonus_value) VALUES (?, ?, ?, ?, ?)");
  characters.forEach(char => stmt.run(char));
  stmt.finalize();
  
  // Добавляем тестового пользователя
  db.run("INSERT INTO users (user_id, tg_username, tg_first_name, stars, level, is_registered) VALUES (?, ?, ?, ?, ?, ?)",
    [12345, 'test_user', 'Тестовый Пользователь', 25.5, 'Ученик', true]);
  
  console.log('✅ Database initialized with test data');
});

// API маршруты
app.get('/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    message: '✅ Сервер работает!',
    port: PORT,
    timestamp: new Date().toISOString()
  });
});

app.get('/api/webapp/characters', (req, res) => {
  console.log('📝 GET /api/webapp/characters');
  
  db.all("SELECT * FROM characters ORDER BY class, character_name", (err, characters) => {
    if (err) {
      console.error('Database error:', err);
      return res.status(500).json({ error: 'Database error' });
    }
    
    const grouped = characters.reduce((acc, char) => {
      if (!acc[char.class]) acc[char.class] = [];
      acc[char.class].push(char);
      return acc;
    }, {});
    
    console.log(`✅ Returned ${characters.length} characters`);
    res.json(grouped);
  });
});

app.get('/api/users/:userId', (req, res) => {
  const userId = req.params.userId;
  console.log('📝 GET /api/users/', userId);
  
  db.get("SELECT * FROM users WHERE user_id = ?", [userId], (err, user) => {
    if (err) {
      console.error('Database error:', err);
      return res.status(500).json({ error: 'Database error' });
    }
    
    if (user) {
      res.json({ exists: true, user });
    } else {
      // Создаем нового пользователя
      const newUser = {
        user_id: parseInt(userId),
        tg_username: 'new_user',
        tg_first_name: 'Новый',
        stars: 0,
        level: 'Ученик',
        is_registered: false
      };
      res.json({ exists: true, user: newUser });
    }
  });
});

app.post('/api/users/register', (req, res) => {
  const { userId, userClass, characterId } = req.body;
  console.log('📝 POST /api/users/register', { userId, userClass, characterId });
  
  db.run(
    `INSERT OR REPLACE INTO users (user_id, class, character_id, is_registered, stars) 
     VALUES (?, ?, ?, TRUE, 5)`,
    [userId, userClass, characterId],
    function(err) {
      if (err) {
        console.error('Error:', err);
        return res.status(500).json({ error: 'Database error' });
      }
      
      res.json({ 
        success: true, 
        message: 'Регистрация успешна! +5⭐'
      });
    }
  );
});

// Главная страница
app.get('/', (req, res) => {
  res.sendFile(join(__dirname, 'public', 'index.html'));
});

// Функция для поиска свободного порта
function findFreePort(startPort) {
  return new Promise((resolve) => {
    const server = createServer();
    server.listen(startPort, '0.0.0.0', () => {
      const port = server.address().port;
      server.close(() => resolve(port));
    });
    server.on('error', () => {
      resolve(findFreePort(startPort + 1));
    });
  });
}

// Запуск сервера
async function startServer() {
  const freePort = await findFreePort(3000);
  PORT = freePort;
  
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Server running on port ${PORT}`);
    console.log(`📊 Health: http://localhost:${PORT}/health`);
    console.log(`👥 Characters: http://localhost:${PORT}/api/webapp/characters`);
    console.log(`👤 Users: http://localhost:${PORT}/api/users/12345`);
    console.log(`🏠 Main page: http://localhost:${PORT}`);
    console.log(`🤖 Bot: DISABLED (API only)`);
  }).on('error', (err) => {
    console.error('❌ Server error:', err);
    process.exit(1);
  });
}

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\n🛑 Shutting down gracefully...');
  process.exit(0);
});

startServer();
