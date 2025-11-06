import express from 'express';
import TelegramBot from 'node-telegram-bot-api';
import cors from 'cors';
import bodyParser from 'body-parser';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import dotenv from 'dotenv';
import { createServer } from 'http';

// Загрузка переменных окружения
dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();

// Middleware
app.use(express.json());
app.use(cors());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static(join(__dirname, 'public')));

console.log('🎨 Мастерская Вдохновения - Запуск...');

// Проверка токена бота
if (!process.env.BOT_TOKEN) {
  console.error('❌ BOT_TOKEN не найден!');
  process.exit(1);
}

// Инициализация базы данных в памяти (чтобы избежать проблем с файлами)
import sqlite3 from 'sqlite3';
const db = new sqlite3.Database(':memory:');

// Инициализация таблиц
db.serialize(() => {
  console.log('📊 Инициализация базы данных в памяти...');
  
  // Таблица пользователей
  db.run(`CREATE TABLE users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER UNIQUE NOT NULL,
    tg_username TEXT,
    tg_first_name TEXT,
    tg_last_name TEXT,
    class TEXT,
    character_id INTEGER,
    stars REAL DEFAULT 0,
    level TEXT DEFAULT 'Ученик',
    is_registered BOOLEAN DEFAULT FALSE
  )`);
  
  // Таблица персонажей
  db.run(`CREATE TABLE characters (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    class TEXT NOT NULL,
    character_name TEXT NOT NULL,
    description TEXT,
    bonus_type TEXT NOT NULL,
    bonus_value TEXT NOT NULL
  )`);
  
  // Таблица квизов
  db.run(`CREATE TABLE quizzes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    description TEXT,
    questions TEXT NOT NULL,
    stars_reward REAL DEFAULT 1,
    is_active BOOLEAN DEFAULT TRUE
  )`);
  
  // Заполняем персонажей
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
  
  const stmt = db.prepare("INSERT INTO characters (class, character_name, description, bonus_type, bonus_value) VALUES (?, ?, ?, ?, ?)");
  characters.forEach(char => stmt.run(char));
  stmt.finalize();
  
  // Добавляем тестового пользователя
  db.run("INSERT INTO users (user_id, tg_first_name, stars, level, is_registered) VALUES (?, ?, ?, ?, ?)",
    [12345, 'Тестовый Пользователь', 25.5, 'Ученик', true]);
  
  // Добавляем тестовые квизы
  const testQuizzes = [
    {
      title: "Основы живописи",
      description: "Проверьте свои знания основ живописи",
      questions: JSON.stringify([
        {
          question: "Кто написал картину 'Мона Лиза'?",
          options: ["Ван Гог", "Леонардо да Винчи", "Пикассо", "Моне"],
          correctAnswer: 1
        }
      ]),
      stars_reward: 2
    }
  ];
  
  const quizStmt = db.prepare("INSERT INTO quizzes (title, description, questions, stars_reward) VALUES (?, ?, ?, ?)");
  testQuizzes.forEach(quiz => quizStmt.run([quiz.title, quiz.description, quiz.questions, quiz.stars_reward]));
  quizStmt.finalize();
  
  console.log('✅ База данных готова');
});

// ==================== API ROUTES ====================

app.get('/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    message: '✅ Сервер работает!',
    timestamp: new Date().toISOString()
  });
});

app.get('/api/webapp/characters', (req, res) => {
  db.all('SELECT * FROM characters ORDER BY class, character_name', (err, characters) => {
    if (err) {
      return res.status(500).json({ error: 'Database error' });
    }
    
    const grouped = characters.reduce((acc, char) => {
      if (!acc[char.class]) acc[char.class] = [];
      acc[char.class].push(char);
      return acc;
    }, {});
    
    res.json(grouped);
  });
});

app.get('/api/users/:userId', (req, res) => {
  const userId = req.params.userId;
  
  db.get("SELECT * FROM users WHERE user_id = ?", [userId], (err, user) => {
    if (err) {
      return res.status(500).json({ error: 'Database error' });
    }
    
    if (user) {
      user.level = calculateLevel(user.stars);
      res.json({ exists: true, user });
    } else {
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

app.post('/api/users/register', (req, res) => {
  const { userId, userClass, characterId, tgUsername, tgFirstName } = req.body;
  
  db.run(
    "INSERT INTO users (user_id, tg_username, tg_first_name, class, character_id, is_registered, stars) VALUES (?, ?, ?, ?, ?, TRUE, 5)",
    [userId, tgUsername, tgFirstName, userClass, characterId],
    function(err) {
      if (err) {
        return res.status(500).json({ error: 'Error creating user' });
      }
      
      res.json({ 
        success: true, 
        message: 'Регистрация успешна!',
        starsAdded: 5
      });
    }
  );
});

app.get('/api/webapp/quizzes', (req, res) => {
  db.all("SELECT * FROM quizzes WHERE is_active = TRUE", (err, quizzes) => {
    if (err) {
      return res.status(500).json({ error: 'Database error' });
    }
    
    const parsedQuizzes = quizzes.map(quiz => ({
      ...quiz,
      questions: JSON.parse(quiz.questions)
    }));
    
    res.json(parsedQuizzes);
  });
});

app.get('/', (req, res) => {
  res.sendFile(join(__dirname, 'public', 'index.html'));
});

// ==================== TELEGRAM BOT ====================

const bot = new TelegramBot(process.env.BOT_TOKEN, { polling: false }); // Отключаем auto polling

bot.onText(/\/start/, (msg) => {
  const chatId = msg.chat.id;
  const name = msg.from.first_name || 'Друг';
  
  bot.sendMessage(chatId, `🎨 Привет, ${name}! Откройте личный кабинет:`, {
    reply_markup: {
      inline_keyboard: [[
        {
          text: "📱 Личный кабинет",
          web_app: { url: process.env.APP_URL || `http://localhost:3000` }
        }
      ]]
    }
  }).catch(err => {
    console.log('Bot message error:', err.message);
  });
});

// Запускаем polling вручную после старта сервера
setTimeout(() => {
  bot.startPolling().then(() => {
    console.log('✅ Bot polling started');
  }).catch(err => {
    console.log('⚠️ Bot polling error:', err.message);
  });
}, 1000);

// ==================== UTILITY FUNCTIONS ====================

function calculateLevel(stars) {
  if (stars >= 400) return 'Наставник';
  if (stars >= 300) return 'Мастер';
  if (stars >= 150) return 'Знаток';
  if (stars >= 50) return 'Искатель';
  return 'Ученик';
}

// ==================== SERVER START ====================

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

async function startServer() {
  const portsToTry = [3000, 3001, 3002, 3003, 3004, 3005];
  let selectedPort = null;
  
  for (const port of portsToTry) {
    try {
      const server = createServer();
      await new Promise((resolve, reject) => {
        server.listen(port, '0.0.0.0', () => {
          server.close(() => resolve(port));
        });
        server.on('error', reject);
      });
      selectedPort = port;
      break;
    } catch (err) {
      console.log(`⚠️  Port ${port} is busy, trying next...`);
    }
  }
  
  if (!selectedPort) {
    console.error('❌ No free ports found!');
    process.exit(1);
  }
  
  app.listen(selectedPort, '0.0.0.0', () => {
    console.log(`🚀 Сервер запущен на порту ${selectedPort}`);
    console.log(`📱 Mini App: ${process.env.APP_URL || `http://localhost:${selectedPort}`}`);
    console.log(`📊 Health: http://localhost:${selectedPort}/health`);
    console.log(`👥 Characters: http://localhost:${selectedPort}/api/webapp/characters`);
    console.log(`🤖 Bot: Active!`);
    console.log('=================================');
  }).on('error', (err) => {
    console.error('❌ Server error:', err);
  });
}

startServer();
