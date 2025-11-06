import express from 'express';
import TelegramBot from 'node-telegram-bot-api';
import cors from 'cors';
import sqlite3 from 'sqlite3';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3002; // Меняем порт на 3002

app.use(express.json());
app.use(cors());
app.use(express.static(join(__dirname, 'public')));

console.log('🤖 Starting server...');

// Используем базу в памяти для надежности
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
  
  // Таблица квизов
  db.run(`CREATE TABLE quizzes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    description TEXT,
    questions TEXT,
    stars_reward REAL DEFAULT 1,
    is_active BOOLEAN DEFAULT TRUE
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
  
  // Добавляем тестовый квиз
  const testQuiz = {
    title: "Тест: Основы искусства",
    description: "Проверьте свои знания в искусстве",
    questions: JSON.stringify([
      {
        question: "Кто написал картину 'Мона Лиза'?",
        options: ["Ван Гог", "Леонардо да Винчи", "Пикассо", "Моне"],
        correctAnswer: 1
      },
      {
        question: "Какой цвет получается при смешении красного и синего?",
        options: ["Зеленый", "Фиолетовый", "Оранжевый", "Коричневый"],
        correctAnswer: 1
      }
    ]),
    stars_reward: 2
  };
  
  db.run("INSERT INTO quizzes (title, description, questions, stars_reward) VALUES (?, ?, ?, ?)", 
    [testQuiz.title, testQuiz.description, testQuiz.questions, testQuiz.stars_reward]);
  
  console.log('✅ Database initialized');
});

// API маршруты
app.get('/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    message: '✅ Сервер работает!',
    timestamp: new Date().toISOString()
  });
});

app.get('/api/webapp/characters', (req, res) => {
  console.log('📝 GET /api/webapp/characters');
  
  db.all("SELECT * FROM characters ORDER BY class, character_name", (err, characters) => {
    if (err) {
      console.error('Database error:', err);
      return res.status(500).json({ error: 'Database error: ' + err.message });
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
  
  db.get(
    `SELECT u.*, c.character_name, c.class 
     FROM users u 
     LEFT JOIN characters c ON u.character_id = c.id 
     WHERE u.user_id = ?`,
    [userId],
    (err, user) => {
      if (err) {
        console.error('Database error:', err);
        return res.status(500).json({ error: 'Database error: ' + err.message });
      }
      
      if (user) {
        // Рассчитываем уровень
        const level = calculateLevel(user.stars);
        user.level = level;
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
    }
  );
});

app.post('/api/users/register', (req, res) => {
  const { userId, userClass, characterId, tgUsername, tgFirstName } = req.body;
  console.log('📝 POST /api/users/register', { userId, userClass, characterId });
  
  if (!userId || !userClass || !characterId) {
    return res.status(400).json({ error: 'Missing required fields' });
  }
  
  db.get("SELECT * FROM users WHERE user_id = ?", [userId], (err, existing) => {
    if (err) {
      console.error('Database error:', err);
      return res.status(500).json({ error: 'Database error' });
    }
    
    if (existing) {
      return res.status(400).json({ error: 'User already exists' });
    }
    
    db.run(
      `INSERT INTO users (user_id, tg_username, tg_first_name, class, character_id, is_registered, stars) 
       VALUES (?, ?, ?, ?, ?, TRUE, 5)`,
      [userId, tgUsername, tgFirstName, userClass, characterId],
      function(err) {
        if (err) {
          console.error('Error creating user:', err);
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
});

app.get('/api/webapp/quizzes', (req, res) => {
  console.log('📝 GET /api/webapp/quizzes');
  
  db.all("SELECT * FROM quizzes WHERE is_active = TRUE", (err, quizzes) => {
    if (err) {
      console.error('Database error:', err);
      return res.status(500).json({ error: 'Database error' });
    }
    
    const parsedQuizzes = quizzes.map(quiz => ({
      ...quiz,
      questions: quiz.questions ? JSON.parse(quiz.questions) : []
    }));
    
    console.log(`✅ Returned ${quizzes.length} quizzes`);
    res.json(parsedQuizzes);
  });
});

function calculateLevel(stars) {
  if (stars >= 400) return 'Наставник';
  if (stars >= 300) return 'Мастер';
  if (stars >= 150) return 'Знаток';
  if (stars >= 50) return 'Искатель';
  return 'Ученик';
}

// Инициализация бота
let bot;
if (process.env.BOT_TOKEN) {
  try {
    bot = new TelegramBot(process.env.BOT_TOKEN, { polling: true });
    
    bot.onText(/\/start/, (msg) => {
      const chatId = msg.chat.id;
      const name = msg.from.first_name || 'Друг';
      
      bot.sendMessage(chatId, `🎨 Привет, ${name}! Откройте личный кабинет:`, {
        reply_markup: {
          inline_keyboard: [[
            {
              text: "📱 Личный кабинет",
              web_app: { url: process.env.APP_URL || `http://localhost:${PORT}` }
            }
          ]]
        }
      });
    });
    
    console.log('✅ Bot initialized');
  } catch (error) {
    console.error('❌ Bot error:', error.message);
  }
} else {
  console.log('⚠️  BOT_TOKEN not set, running without bot');
}

// Запуск сервера
app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📊 Health: http://localhost:${PORT}/health`);
  console.log(`👥 Characters: http://localhost:${PORT}/api/webapp/characters`);
  console.log(`🤖 Bot: ${bot ? 'Active' : 'Disabled'}`);
}).on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`❌ Port ${PORT} is busy! Trying ${parseInt(PORT) + 1}...`);
  } else {
    console.error('❌ Server error:', err);
  }
});
