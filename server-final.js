import express from 'express';
import TelegramBot from 'node-telegram-bot-api';
import cors from 'cors';
import sqlite3 from 'sqlite3';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { createServer } from 'http';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
// Пробуем разные порты пока не найдем свободный
let PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(cors());
app.use(express.static(join(__dirname, 'public')));

console.log('🤖 Starting server...');

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
    ['Стилисты', 'Гертруда Линия', 'Ценит детали и силу аксессуаров', 'series_bonus', '1']
  ];
  
  const stmt = db.prepare("INSERT INTO characters (class, character_name, description, bonus_type, bonus_value) VALUES (?, ?, ?, ?, ?)");
  characters.forEach(char => stmt.run(char));
  stmt.finalize();
  
  console.log('✅ Database initialized');
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
      // Создаем тестового пользователя
      const testUser = {
        user_id: parseInt(userId),
        tg_username: 'test_user',
        tg_first_name: 'Тестовый',
        stars: 15.5,
        level: 'Ученик',
        is_registered: false
      };
      res.json({ exists: true, user: testUser });
    }
  });
});

// Главная страница - отдаем HTML
app.get('/', (req, res) => {
  res.sendFile(join(__dirname, 'public', 'index.html'));
});

// Инициализация бота (без polling чтобы избежать конфликтов)
let bot = null;
if (process.env.BOT_TOKEN) {
  try {
    bot = new TelegramBot(process.env.BOT_TOKEN);
    
    // Только обработка команд, без автоматического polling
    bot.onText(/\/start/, (msg) => {
      const chatId = msg.chat.id;
      const name = msg.from.first_name || 'Друг';
      
      bot.sendMessage(chatId, `🎨 Привет, ${name}! Сервер работает на порту ${PORT}. Откройте личный кабинет:`, {
        reply_markup: {
          inline_keyboard: [[
            {
              text: "📱 Личный кабинет",
              web_app: { url: `http://localhost:${PORT}` }
            }
          ]]
        }
      }).catch(err => {
        console.log('Bot send message error:', err.message);
      });
    });
    
    console.log('✅ Bot commands ready');
  } catch (error) {
    console.error('❌ Bot error:', error.message);
  }
}

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
    console.log(`🏠 Main page: http://localhost:${PORT}`);
    console.log(`🤖 Bot: ${bot ? 'Ready' : 'Disabled'}`);
    
    // Запускаем polling только после успешного старта сервера
    if (bot) {
      bot.startPolling().then(() => {
        console.log('✅ Bot polling started');
      }).catch(err => {
        console.log('⚠️ Bot polling error:', err.message);
      });
    }
  }).on('error', (err) => {
    console.error('❌ Server error:', err);
  });
}

startServer();
