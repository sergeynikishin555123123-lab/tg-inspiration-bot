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

// Инициализация базы данных в памяти
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
    is_registered BOOLEAN DEFAULT FALSE,
    last_active DATETIME DEFAULT CURRENT_TIMESTAMP
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

  // Таблица активностей
  db.run(`CREATE TABLE activities (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    activity_type TEXT NOT NULL,
    stars_earned REAL NOT NULL,
    description TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);
  
  // Заполняем персонажей
  const characters = [
    [1, 'Художники', 'Лука Цветной', 'Рисует с детства, любит эксперименты с цветом', 'percent_bonus', '10'],
    [2, 'Художники', 'Марина Кисть', 'Строгая преподавательница академической живописи', 'forgiveness', '1'],
    [3, 'Художники', 'Феликс Штрих', 'Экспериментатор, мастер зарисовок', 'random_gift', '1-3'],
    [4, 'Стилисты', 'Эстелла Моде', 'Бывший стилист, обучает восприятию образа', 'percent_bonus', '5'],
    [5, 'Стилисты', 'Роза Ателье', 'Мастер практического шитья', 'secret_advice', '2weeks'],
    [6, 'Стилисты', 'Гертруда Линия', 'Ценит детали и аксессуары', 'series_bonus', '1'],
    [7, 'Мастера', 'Тихон Творец', 'Ремесленник, любит простые техники', 'photo_bonus', '1'],
    [8, 'Мастера', 'Агата Узор', 'Любит неожиданные материалы', 'weekly_surprise', '6'],
    [9, 'Мастера', 'Борис Клей', 'Весёлый мастер импровизаций', 'mini_quest', '2'],
    [10, 'Историки', 'Профессор Артёмий', 'Любитель архивов и фактов', 'quiz_hint', '1'],
    [11, 'Историки', 'Соня Гравюра', 'Рассказывает истории картин', 'fact_star', '1'],
    [12, 'Историки', 'Михаил Эпоха', 'Любит хронологию и эпохи', 'streak_multiplier', '2']
  ];
  
  const stmt = db.prepare("INSERT INTO characters (id, class, character_name, description, bonus_type, bonus_value) VALUES (?, ?, ?, ?, ?, ?)");
  characters.forEach(char => stmt.run(char));
  stmt.finalize();
  
  // Добавляем тестового пользователя
  db.run("INSERT INTO users (user_id, tg_first_name, stars, level, is_registered, class, character_id) VALUES (?, ?, ?, ?, ?, ?, ?)",
    [12345, 'Тестовый Пользователь', 25.5, 'Ученик', true, 'Художники', 1]);
  
  // Добавляем тестовые квизы
  const testQuizzes = [
    {
      id: 1,
      title: "🎨 Основы живописи",
      description: "Проверьте свои знания основ живописи",
      questions: JSON.stringify([
        {
          question: "Кто написал картину 'Мона Лиза'?",
          options: ["Винсент Ван Гог", "Леонардо да Винчи", "Пабло Пикассо", "Клод Моне"],
          correctAnswer: 1
        },
        {
          question: "Какие три основных цвета?",
          options: ["Красный, синий, зеленый", "Красный, желтый, синий", "Черный, белый, серый", "Фиолетовый, оранжевый, зеленый"],
          correctAnswer: 1
        },
        {
          question: "Что такое акварель?",
          options: ["Масляная краска", "Водорастворимая краска", "Акриловая краска", "Пастель"],
          correctAnswer: 1
        }
      ]),
      stars_reward: 2
    },
    {
      id: 2,
      title: "🏛️ История искусства",
      description: "Тест по истории мирового искусства",
      questions: JSON.stringify([
        {
          question: "В какой стране зародился импрессионизм?",
          options: ["Италия", "Франция", "Испания", "Германия"],
          correctAnswer: 1
        },
        {
          question: "Кто скульптор 'Давида'?",
          options: ["Донателло", "Микеланджело", "Бернини", "Роден"],
          correctAnswer: 1
        }
      ]),
      stars_reward: 1
    }
  ];
  
  const quizStmt = db.prepare("INSERT INTO quizzes (id, title, description, questions, stars_reward) VALUES (?, ?, ?, ?, ?)");
  testQuizzes.forEach(quiz => quizStmt.run([quiz.id, quiz.title, quiz.description, quiz.questions, quiz.stars_reward]));
  quizStmt.finalize();
  
  console.log('✅ База данных готова');
});

// ==================== API ROUTES ====================

// Health check
app.get('/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    message: '✅ Сервер работает!',
    timestamp: new Date().toISOString()
  });
});

// Получить персонажей
app.get('/api/webapp/characters', (req, res) => {
  db.all('SELECT * FROM characters ORDER BY class, character_name', (err, characters) => {
    if (err) {
      console.error('❌ Database error:', err);
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

// Получить классы
app.get('/api/webapp/classes', (req, res) => {
  const classes = [
    {
      id: 'Художники',
      name: '🎨 Художники',
      description: 'Творцы и экспериментаторы в мире изобразительного искусства',
      icon: '🎨'
    },
    {
      id: 'Стилисты', 
      name: '👗 Стилисты',
      description: 'Мастера создания гармоничных образов и стиля',
      icon: '👗'
    },
    {
      id: 'Мастера',
      name: '🧵 Мастера',
      description: 'Ремесленники и творцы прикладного искусства',
      icon: '🧵'
    },
    {
      id: 'Историки',
      name: '🏛️ Историки искусства',
      description: 'Знатоки истории, эпох и художественных направлений',
      icon: '🏛️'
    }
  ];
  
  res.json(classes);
});

// Получить пользователя - ИСПРАВЛЕННАЯ ВЕРСИЯ
app.get('/api/users/:userId', (req, res) => {
  const userId = req.params.userId;
  
  db.get(
    `SELECT u.*, c.character_name, c.class, c.bonus_type, c.bonus_value 
     FROM users u 
     LEFT JOIN characters c ON u.character_id = c.id 
     WHERE u.user_id = ?`,
    [userId],
    (err, user) => {
      if (err) {
        console.error('❌ Database error:', err);
        return res.status(500).json({ error: 'Database error' });
      }
      
      if (user) {
        user.level = calculateLevel(user.stars);
        console.log(`✅ User data loaded: ${user.tg_first_name}, stars: ${user.stars}, character: ${user.character_name}`);
        res.json({ exists: true, user });
      } else {
        console.log(`✅ New user created: ${userId}`);
        res.json({ 
          exists: false, 
          user: {
            user_id: parseInt(userId),
            stars: 0,
            level: 'Ученик',
            is_registered: false,
            class: null,
            character_name: null
          }
        });
      }
    }
  );
});

// Регистрация пользователя - ПОЛНОСТЬЮ ИСПРАВЛЕННАЯ ВЕРСИЯ
app.post('/api/users/register', (req, res) => {
  const { userId, userClass, characterId, tgUsername, tgFirstName, tgLastName } = req.body;
  
  console.log('📝 Регистрация пользователя:', { userId, userClass, characterId });
  
  if (!userId || !userClass || !characterId) {
    return res.status(400).json({ error: 'User ID, class and character are required' });
  }
  
  // Всегда обновляем пользователя (создаем или изменяем)
  db.run(
    `INSERT OR REPLACE INTO users (
      user_id, tg_username, tg_first_name, tg_last_name, 
      class, character_id, is_registered, stars, last_active
    ) VALUES (?, ?, ?, ?, ?, ?, TRUE, COALESCE((SELECT stars FROM users WHERE user_id = ?), 0) + 5, CURRENT_TIMESTAMP)`,
    [userId, tgUsername, tgFirstName, tgLastName, userClass, characterId, userId],
    function(err) {
      if (err) {
        console.error('❌ Error saving user:', err);
        return res.status(500).json({ error: 'Error saving user' });
      }
      
      // Добавляем активность за регистрацию/смену персонажа
      const activityType = this.changes === 1 ? 'registration' : 'character_change';
      const activityDesc = activityType === 'registration' ? 'Регистрация в системе' : 'Смена персонажа';
      
      db.run(
        `INSERT INTO activities (user_id, activity_type, stars_earned, description) 
         VALUES (?, ?, 5, ?)`,
        [userId, activityType, activityDesc],
        (err) => {
          if (err) console.error('Error logging activity:', err);
        }
      );
      
      const message = activityType === 'registration' 
        ? 'Регистрация успешна! +5⭐' 
        : 'Персонаж успешно изменен! +5⭐';
      
      console.log(`✅ ${message} for user ${userId}`);
      res.json({ 
        success: true, 
        message: message,
        starsAdded: 5,
        userId: userId,
        changes: this.changes
      });
    }
  );
});

// Получить квизы
app.get('/api/webapp/quizzes', (req, res) => {
  db.all("SELECT * FROM quizzes WHERE is_active = TRUE ORDER BY id", (err, quizzes) => {
    if (err) {
      console.error('❌ Database error:', err);
      return res.status(500).json({ error: 'Database error' });
    }
    
    const parsedQuizzes = quizzes.map(quiz => ({
      ...quiz,
      questions: JSON.parse(quiz.questions)
    }));
    
    res.json(parsedQuizzes);
  });
});

// Отправить ответ на квиз - ИСПРАВЛЕННАЯ ВЕРСИЯ
app.post('/api/webapp/quizzes/:quizId/submit', (req, res) => {
  const { quizId } = req.params;
  const { userId, answers } = req.body;
  
  console.log(`📝 Отправка ответов на квиз ${quizId} от пользователя ${userId}`, answers);
  
  if (!userId) {
    return res.status(400).json({ error: 'User ID is required' });
  }
  
  // Получаем квиз
  db.get("SELECT * FROM quizzes WHERE id = ?", [quizId], (err, quiz) => {
    if (err) {
      console.error('❌ Database error:', err);
      return res.status(500).json({ error: 'Database error' });
    }
    
    if (!quiz) {
      return res.status(404).json({ error: 'Quiz not found' });
    }
    
    const questions = JSON.parse(quiz.questions);
    let correctAnswers = 0;
    
    // Проверяем ответы
    questions.forEach((question, index) => {
      if (answers[index] === question.correctAnswer) {
        correctAnswers++;
      }
    });
    
    // Рассчитываем награду согласно ТЗ
    let starsEarned = 0;
    if (questions.length <= 3) {
      starsEarned = correctAnswers >= 1 ? 1 : 0;
    } else {
      if (correctAnswers >= Math.ceil(questions.length * 0.6)) {
        starsEarned = 2;
      } else if (correctAnswers >= 1) {
        starsEarned = 1;
      }
    }
    
    console.log(`✅ Quiz results: ${correctAnswers}/${questions.length} correct, stars earned: ${starsEarned}`);
    
    // Всегда обновляем звезды пользователя
    db.get('SELECT stars FROM users WHERE user_id = ?', [userId], (err, user) => {
      if (err) {
        console.error('❌ Database error:', err);
        return res.status(500).json({ error: 'Database error' });
      }
      
      let newStars = starsEarned;
      if (user) {
        newStars = user.stars + starsEarned;
      }
      
      // Создаем или обновляем пользователя
      db.run(
        `INSERT OR REPLACE INTO users (user_id, stars, last_active) 
         VALUES (?, ?, CURRENT_TIMESTAMP)`,
        [userId, newStars],
        function(err) {
          if (err) {
            console.error('❌ Error updating user stars:', err);
            return res.status(500).json({ error: 'Error updating stars' });
          }
          
          // Записываем активность только если получили звезды
          if (starsEarned > 0) {
            db.run(
              `INSERT INTO activities (user_id, activity_type, stars_earned, description) 
               VALUES (?, 'quiz', ?, ?)`,
              [userId, starsEarned, `Квиз: ${quiz.title}`],
              (err) => {
                if (err) console.error('Error logging activity:', err);
              }
            );
          }
          
          const message = starsEarned > 0 
            ? `Поздравляем! Вы получили ${starsEarned}⭐` 
            : 'Попробуйте еще раз!';
          
          res.json({
            success: true,
            correctAnswers,
            totalQuestions: questions.length,
            starsEarned,
            passed: starsEarned > 0,
            newTotalStars: newStars,
            message: message
          });
        }
      );
    });
  });
});

// Отправить фото работы - ИСПРАВЛЕННАЯ ВЕРСИЯ
app.post('/api/webapp/submit-work', (req, res) => {
  const { userId, description } = req.body;
  
  console.log('📸 Отправка работы от пользователя:', userId);
  
  if (!userId) {
    return res.status(400).json({ error: 'User ID is required' });
  }
  
  const starsEarned = 3;
  
  // Получаем текущие звезды пользователя
  db.get('SELECT stars FROM users WHERE user_id = ?', [userId], (err, user) => {
    if (err) {
      console.error('❌ Database error:', err);
      return res.status(500).json({ error: 'Database error' });
    }
    
    let newStars = starsEarned;
    if (user) {
      newStars = user.stars + starsEarned;
    }
    
    // Создаем или обновляем пользователя
    db.run(
      `INSERT OR REPLACE INTO users (user_id, stars, last_active) 
       VALUES (?, ?, CURRENT_TIMESTAMP)`,
      [userId, newStars],
      function(err) {
        if (err) {
          console.error('❌ Error updating user stars:', err);
          return res.status(500).json({ error: 'Error updating stars' });
        }
        
        // Записываем активность
        db.run(
          `INSERT INTO activities (user_id, activity_type, stars_earned, description) 
           VALUES (?, 'photo_work', ?, ?)`,
          [userId, starsEarned, description || 'Фото работы'],
          (err) => {
            if (err) console.error('Error logging activity:', err);
          }
        );
        
        console.log(`✅ Work submitted: +${starsEarned} stars for user ${userId}, total: ${newStars}`);
        
        res.json({
          success: true,
          starsEarned: starsEarned,
          newTotalStars: newStars,
          message: 'Фото работы принято! +3⭐'
        });
      }
    );
  });
});

// Получить активности пользователя
app.get('/api/webapp/users/:userId/activities', (req, res) => {
  const userId = req.params.userId;
  
  db.all(
    `SELECT * FROM activities 
     WHERE user_id = ? 
     ORDER BY created_at DESC 
     LIMIT 20`,
    [userId],
    (err, activities) => {
      if (err) {
        console.error('❌ Database error:', err);
        return res.status(500).json({ error: 'Database error' });
      }
      
      res.json({ activities });
    }
  );
});

// Главная страница
app.get('/', (req, res) => {
  res.sendFile(join(__dirname, 'public', 'index.html'));
});

// ==================== TELEGRAM BOT ====================

const bot = new TelegramBot(process.env.BOT_TOKEN, { polling: false });

bot.onText(/\/start/, (msg) => {
  const chatId = msg.chat.id;
  const name = msg.from.first_name || 'Друг';
  const userId = msg.from.id;
  
  const welcomeText = `🎨 Привет, ${name}! 

Добро пожаловать в **Мастерскую Вдохновения**! 

✨ Вот что вас ждет:
• 📚 Обучающие видео и задания
• ⭐ Система уровней и звёзд
• 🏆 Достижения и бонусы

Нажмите кнопку ниже чтобы открыть личный кабинет!`;
  
  const keyboard = {
    inline_keyboard: [[
      {
        text: "📱 Открыть Личный Кабинет",
        web_app: { url: process.env.APP_URL || `http://localhost:3000` }
      }
    ]]
  };

  bot.sendMessage(chatId, welcomeText, {
    parse_mode: 'Markdown',
    reply_markup: keyboard
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
    console.log(`📝 Quizzes: http://localhost:${selectedPort}/api/webapp/quizzes`);
    console.log(`🤖 Bot: Active!`);
    console.log('=================================');
  }).on('error', (err) => {
    console.error('❌ Server error:', err);
  });
}

startServer();
