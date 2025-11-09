import express from 'express';
import TelegramBot from 'node-telegram-bot-api';
import cors from 'cors';
import bodyParser from 'body-parser';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import dotenv from 'dotenv';
import sqlite3 from 'sqlite3';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const db = new sqlite3.Database(':memory:');

app.use(express.json({ limit: '50mb' }));
app.use(cors());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static(join(__dirname, 'public')));
app.use('/admin', express.static(join(__dirname, 'admin')));

console.log('🎨 Мастерская Вдохновения - Запуск...');

// ==================== ИНИЦИАЛИЗАЦИЯ БАЗЫ ДАННЫХ ====================

db.serialize(() => {
  console.log('📊 Инициализация базы данных...');
  
  // Таблица пользователей
  db.run(`CREATE TABLE users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER UNIQUE NOT NULL,
    tg_username TEXT,
    tg_first_name TEXT,
    tg_last_name TEXT,
    class TEXT,
    character_id INTEGER,
    sparks REAL DEFAULT 0,
    level TEXT DEFAULT 'Ученик',
    is_registered BOOLEAN DEFAULT FALSE,
    registration_date DATETIME DEFAULT CURRENT_TIMESTAMP,
    last_active DATETIME DEFAULT CURRENT_TIMESTAMP,
    invited_by INTEGER,
    invite_count INTEGER DEFAULT 0
  )`);
  
  // Таблица классов
  db.run(`CREATE TABLE classes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,
    description TEXT,
    icon TEXT,
    is_active BOOLEAN DEFAULT TRUE
  )`);
  
  // Таблица персонажей
  db.run(`CREATE TABLE characters (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    class_id INTEGER NOT NULL,
    character_name TEXT NOT NULL,
    description TEXT,
    bonus_type TEXT NOT NULL,
    bonus_value TEXT NOT NULL,
    is_active BOOLEAN DEFAULT TRUE
  )`);
  
  // Таблица квизов
  db.run(`CREATE TABLE quizzes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    description TEXT,
    questions TEXT NOT NULL,
    sparks_reward REAL DEFAULT 1,
    is_active BOOLEAN DEFAULT TRUE
  )`);

  // Таблица пройденных квизов
  db.run(`CREATE TABLE quiz_completions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    quiz_id INTEGER NOT NULL,
    completed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    score INTEGER NOT NULL,
    sparks_earned REAL NOT NULL
  )`);

  // Таблица активностей
  db.run(`CREATE TABLE activities (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    activity_type TEXT NOT NULL,
    sparks_earned REAL NOT NULL,
    description TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  // Таблица админов
  db.run(`CREATE TABLE admins (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER UNIQUE NOT NULL,
    username TEXT,
    role TEXT DEFAULT 'moderator'
  )`);

  // Таблица товаров магазина
  db.run(`CREATE TABLE shop_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    description TEXT,
    type TEXT NOT NULL DEFAULT 'video',
    file_url TEXT,
    price REAL NOT NULL,
    is_active BOOLEAN DEFAULT TRUE
  )`);

  // Таблица покупок
  db.run(`CREATE TABLE purchases (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    item_id INTEGER NOT NULL,
    price_paid REAL NOT NULL,
    purchased_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  // Таблица комментариев
  db.run(`CREATE TABLE comments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    comment_text TEXT NOT NULL,
    is_approved BOOLEAN DEFAULT FALSE,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  // Заполняем классы
  const classes = [
    ['🎨 Художники', 'Творцы изобразительного искусства', '🎨'],
    ['👗 Стилисты', 'Мастера создания гармоничных образов', '👗'],
    ['🧵 Мастера', 'Ремесленники и творцы прикладного искусства', '🧵'],
    ['🏛️ Историки искусства', 'Знатоки истории и художественных направлений', '🏛️']
  ];
  
  const classStmt = db.prepare("INSERT INTO classes (name, description, icon) VALUES (?, ?, ?)");
  classes.forEach(cls => classStmt.run(cls));
  classStmt.finalize();

  // Заполняем персонажей
  const characters = [
    [1, 'Лука Цветной', 'Рисует с детства, любит эксперименты с цветом', 'percent_bonus', '10'],
    [1, 'Марина Кисть', 'Строгая преподавательница академической живописи', 'forgiveness', '1'],
    [2, 'Эстелла Моде', 'Бывший стилист, обучает восприятию образа', 'percent_bonus', '5'],
    [3, 'Тихон Творец', 'Ремесленник, любит простые техники', 'photo_bonus', '1'],
    [4, 'Профессор Артёмий', 'Любитель архивов и фактов', 'quiz_hint', '1']
  ];
  
  const charStmt = db.prepare("INSERT INTO characters (class_id, character_name, description, bonus_type, bonus_value) VALUES (?, ?, ?, ?, ?)");
  characters.forEach(char => charStmt.run(char));
  charStmt.finalize();
  
  // Добавляем тестового пользователя
  db.run("INSERT INTO users (user_id, tg_first_name, sparks, level, is_registered, class, character_id) VALUES (?, ?, ?, ?, ?, ?, ?)",
    [12345, 'Тестовый Пользователь', 25.5, 'Ученик', true, '🎨 Художники', 1]);
  
  // Добавляем админа
  if (process.env.ADMIN_ID) {
    db.run("INSERT INTO admins (user_id, username, role) VALUES (?, ?, ?)",
      [process.env.ADMIN_ID, 'admin', 'superadmin']);
    console.log('✅ Админ добавлен:', process.env.ADMIN_ID);
  }
  
  // Добавляем тестовые квизы
  const testQuiz = {
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
      }
    ]),
    sparks_reward: 2
  };
  
  db.run("INSERT INTO quizzes (title, description, questions, sparks_reward) VALUES (?, ?, ?, ?)",
    [testQuiz.title, testQuiz.description, testQuiz.questions, testQuiz.sparks_reward]);

  // Добавляем тестовые товары
  db.run("INSERT INTO shop_items (title, description, type, file_url, price) VALUES (?, ?, ?, ?, ?)",
    ['🎨 Урок акварели', 'Видеоурок по основам акварели', 'video', 'https://example.com/video1.mp4', 15]);
  
  console.log('✅ База данных готова');
});

// ==================== ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ ====================

function calculateLevel(sparks) {
  if (sparks >= 400) return 'Наставник';
  if (sparks >= 300) return 'Мастер';
  if (sparks >= 150) return 'Знаток';
  if (sparks >= 50) return 'Искатель';
  return 'Ученик';
}

// ==================== MIDDLEWARE ====================

const requireAdmin = (req, res, next) => {
  const userId = req.query.userId || req.body.userId;
  
  if (!userId) {
    return res.status(401).json({ error: 'User ID required' });
  }
  
  db.get('SELECT * FROM admins WHERE user_id = ?', [userId], (err, admin) => {
    if (err || !admin) {
      return res.status(403).json({ error: 'Admin access required' });
    }
    req.admin = admin;
    next();
  });
};

// ==================== BASIC ROUTES ====================

app.get('/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(),
    version: '1.0.0'
  });
});

app.get('/', (req, res) => {
  res.sendFile(join(__dirname, 'public', 'index.html'));
});

app.get('/admin', (req, res) => {
  res.sendFile(join(__dirname, 'admin', 'index.html'));
});

// ==================== WEBAPP API ====================

// Получение данных пользователя
app.get('/api/users/:userId', (req, res) => {
  const userId = req.params.userId;
  
  db.get(
    `SELECT u.*, c.character_name, cls.name as class_name
     FROM users u 
     LEFT JOIN characters c ON u.character_id = c.id 
     LEFT JOIN classes cls ON u.class = cls.name
     WHERE u.user_id = ?`,
    [userId],
    (err, user) => {
      if (err) {
        console.error('❌ Database error:', err);
        return res.status(500).json({ error: 'Database error' });
      }
      
      if (user) {
        user.level = calculateLevel(user.sparks);
        res.json({ exists: true, user });
      } else {
        // Создаем нового пользователя
        db.run(
          `INSERT INTO users (user_id, tg_first_name, sparks, level) VALUES (?, 'Новый пользователь', 0, 'Ученик')`,
          [userId],
          function(err) {
            if (err) {
              return res.status(500).json({ error: 'Error creating user' });
            }
            
            res.json({ 
              exists: false, 
              user: {
                user_id: parseInt(userId),
                sparks: 0,
                level: 'Ученик',
                is_registered: false,
                class: null,
                character_name: null,
                tg_first_name: 'Новый пользователь'
              }
            });
          }
        );
      }
    }
  );
});

// Регистрация пользователя
app.post('/api/users/register', (req, res) => {
  const { userId, userClass, characterId, tgUsername, tgFirstName } = req.body;
  
  console.log('📝 Регистрация пользователя:', { userId, userClass, characterId });
  
  if (!userId || !userClass || !characterId) {
    return res.status(400).json({ error: 'User ID, class and character are required' });
  }
  
  db.run(
    `INSERT OR REPLACE INTO users (
      user_id, tg_username, tg_first_name, class, character_id, is_registered, sparks
    ) VALUES (?, ?, ?, ?, ?, TRUE, COALESCE((SELECT sparks FROM users WHERE user_id = ?), 0))`,
    [userId, tgUsername, tgFirstName, userClass, characterId, userId],
    function(err) {
      if (err) {
        console.error('❌ Error saving user:', err);
        return res.status(500).json({ error: 'Error saving user' });
      }
      
      // Начисляем искры за регистрацию
      db.run(`UPDATE users SET sparks = sparks + 5 WHERE user_id = ?`, [userId]);
      db.run(`INSERT INTO activities (user_id, activity_type, sparks_earned, description) VALUES (?, 'registration', 5, 'Регистрация в системе')`, [userId]);
      
      res.json({ 
        success: true, 
        message: 'Регистрация успешна! +5✨',
        sparksAdded: 5
      });
    }
  );
});

// Получение классов
app.get('/api/webapp/classes', (req, res) => {
  db.all("SELECT * FROM classes WHERE is_active = TRUE ORDER BY name", (err, classes) => {
    if (err) return res.status(500).json({ error: 'Database error' });
    res.json(classes);
  });
});

// Получение персонажей
app.get('/api/webapp/characters', (req, res) => {
  db.all(`
    SELECT c.*, cls.name as class_name 
    FROM characters c 
    JOIN classes cls ON c.class_id = cls.id 
    WHERE c.is_active = TRUE 
    ORDER BY cls.name, c.character_name
  `, (err, characters) => {
    if (err) return res.status(500).json({ error: 'Database error' });
    
    const grouped = {};
    characters.forEach(char => {
      if (!grouped[char.class_name]) grouped[char.class_name] = [];
      grouped[char.class_name].push(char);
    });
    
    res.json(grouped);
  });
});

// Получение квизов
app.get('/api/webapp/quizzes', (req, res) => {
  const userId = req.query.userId;
  
  db.all("SELECT * FROM quizzes WHERE is_active = TRUE", (err, quizzes) => {
    if (err) return res.status(500).json({ error: 'Database error' });
    
    const parsedQuizzes = quizzes.map(quiz => ({
      ...quiz,
      questions: JSON.parse(quiz.questions)
    }));
    
    if (userId) {
      db.all(`SELECT quiz_id FROM quiz_completions WHERE user_id = ?`, [userId], (err, completions) => {
        const quizzesWithStatus = parsedQuizzes.map(quiz => ({
          ...quiz,
          completed: completions.some(c => c.quiz_id === quiz.id)
        }));
        res.json(quizzesWithStatus);
      });
    } else {
      res.json(parsedQuizzes);
    }
  });
});

// Прохождение квиза
app.post('/api/webapp/quizzes/:quizId/submit', (req, res) => {
  const { quizId } = req.params;
  const { userId, answers } = req.body;
  
  console.log(`📝 Прохождение квиза ${quizId} пользователем ${userId}`);
  
  if (!userId) {
    return res.status(400).json({ error: 'User ID is required' });
  }
  
  // Получаем данные квиза
  db.get("SELECT * FROM quizzes WHERE id = ?", [quizId], (err, quiz) => {
    if (err || !quiz) {
      return res.status(404).json({ error: 'Quiz not found' });
    }
    
    const questions = JSON.parse(quiz.questions);
    let correctAnswers = 0;
    
    questions.forEach((question, index) => {
      if (answers[index] === question.correctAnswer) {
        correctAnswers++;
      }
    });
    
    const passThreshold = Math.ceil(questions.length * 0.6);
    let sparksEarned = 0;
    
    if (correctAnswers >= passThreshold) {
      sparksEarned = quiz.sparks_reward + correctAnswers;
    }
    
    // Сохраняем результат
    db.run(`INSERT OR REPLACE INTO quiz_completions (user_id, quiz_id, score, sparks_earned) VALUES (?, ?, ?, ?)`,
      [userId, quizId, correctAnswers, sparksEarned]);
    
    // Обновляем искры пользователя
    if (sparksEarned > 0) {
      db.run(`UPDATE users SET sparks = sparks + ? WHERE user_id = ?`, [sparksEarned, userId]);
      db.run(`INSERT INTO activities (user_id, activity_type, sparks_earned, description) VALUES (?, 'quiz', ?, ?)`,
        [userId, sparksEarned, `Квиз: ${quiz.title}`]);
    }
    
    res.json({
      success: true,
      correctAnswers,
      totalQuestions: questions.length,
      sparksEarned,
      passed: sparksEarned > 0,
      message: sparksEarned > 0 ? `Поздравляем! Вы получили ${sparksEarned}✨` : 'Попробуйте еще раз!'
    });
  });
});

// Получение ссылки для приглашения
app.get('/api/webapp/invite/:userId', (req, res) => {
  const userId = req.params.userId;
  const channelUsername = process.env.CHANNEL_USERNAME || 'inspiration_workshop';
  const inviteLink = `https://t.me/${channelUsername}?start=invite_${userId}`;
  
  res.json({
    success: true,
    invite_link: inviteLink
  });
});

// Отправка комментария
app.post('/api/webapp/comments', (req, res) => {
  const { userId, commentText } = req.body;
  
  console.log('💬 Отправка комментария от пользователя:', userId);
  
  if (!userId || !commentText) {
    return res.status(400).json({ error: 'User ID and comment text are required' });
  }
  
  // Сохраняем комментарий
  db.run(`INSERT INTO comments (user_id, comment_text) VALUES (?, ?)`,
    [userId, commentText],
    function(err) {
      if (err) return res.status(500).json({ error: 'Error saving comment' });
      
      // Начисляем 1 искру за комментарий
      const sparksAwarded = 1;
      db.run(`UPDATE users SET sparks = sparks + ? WHERE user_id = ?`, [sparksAwarded, userId]);
      db.run(`INSERT INTO activities (user_id, activity_type, sparks_earned, description) VALUES (?, 'comment', ?, 'Комментарий')`,
        [userId, sparksAwarded]);
      
      res.json({
        success: true,
        message: 'Комментарий отправлен! +1✨',
        sparksAwarded: sparksAwarded
      });
    }
  );
});

// Магазин - получение товаров
app.get('/api/webapp/shop/items', (req, res) => {
  db.all("SELECT * FROM shop_items WHERE is_active = TRUE ORDER BY price ASC", (err, items) => {
    if (err) return res.status(500).json({ error: 'Database error' });
    res.json(items);
  });
});

// Покупка товара
app.post('/api/webapp/shop/purchase', (req, res) => {
  const { userId, itemId } = req.body;
  
  console.log('🛒 Покупка товара:', { userId, itemId });
  
  if (!userId || !itemId) {
    return res.status(400).json({ error: 'User ID and item ID are required' });
  }
  
  db.serialize(() => {
    // Получаем данные о товаре
    db.get('SELECT * FROM shop_items WHERE id = ? AND is_active = TRUE', [itemId], (err, item) => {
      if (err || !item) {
        return res.status(404).json({ error: 'Товар не найден' });
      }
      
      // Проверяем баланс пользователя
      db.get('SELECT sparks FROM users WHERE user_id = ?', [userId], (err, user) => {
        if (err || !user) {
          return res.status(404).json({ error: 'Пользователь не найден' });
        }
        
        if (user.sparks < item.price) {
          return res.status(400).json({ error: 'Недостаточно искр для покупки' });
        }
        
        // Выполняем покупку
        db.run('UPDATE users SET sparks = sparks - ? WHERE user_id = ?', [item.price, userId], function(err) {
          if (err) return res.status(500).json({ error: 'Ошибка при списании искр' });
          
          db.run('INSERT INTO purchases (user_id, item_id, price_paid) VALUES (?, ?, ?)', 
            [userId, itemId, item.price], function(err) {
            if (err) return res.status(500).json({ error: 'Ошибка при сохранении покупки' });
            
            db.run(`INSERT INTO activities (user_id, activity_type, sparks_earned, description) VALUES (?, 'purchase', ?, ?)`,
              [userId, -item.price, `Покупка: ${item.title}`]);
            
            res.json({
              success: true,
              message: 'Покупка успешно завершена!',
              item: item,
              remainingSparks: user.sparks - item.price
            });
          });
        });
      });
    });
  });
});

// Получение покупок пользователя
app.get('/api/webapp/users/:userId/purchases', (req, res) => {
  const userId = req.params.userId;
  
  db.all(`
    SELECT p.*, si.title, si.description, si.type, si.file_url
    FROM purchases p
    JOIN shop_items si ON p.item_id = si.id
    WHERE p.user_id = ?
    ORDER BY p.purchased_at DESC
  `, [userId], (err, purchases) => {
    if (err) return res.status(500).json({ error: 'Database error' });
    res.json({ purchases });
  });
});

// Активности пользователя
app.get('/api/webapp/users/:userId/activities', (req, res) => {
  const userId = req.params.userId;
  
  db.all(`SELECT * FROM activities WHERE user_id = ? ORDER BY created_at DESC LIMIT 10`, [userId], (err, activities) => {
    if (err) return res.status(500).json({ error: 'Database error' });
    res.json({ activities });
  });
});

// ==================== ADMIN API ====================

// Статистика
app.get('/api/admin/stats', requireAdmin, (req, res) => {
  Promise.all([
    new Promise(resolve => db.get('SELECT COUNT(*) as count FROM users', (err, row) => resolve(row.count))),
    new Promise(resolve => db.get('SELECT COUNT(*) as count FROM quizzes WHERE is_active = TRUE', (err, row) => resolve(row.count))),
    new Promise(resolve => db.get('SELECT COUNT(*) as count FROM shop_items WHERE is_active = TRUE', (err, row) => resolve(row.count))),
    new Promise(resolve => db.get('SELECT SUM(sparks) as total FROM users', (err, row) => resolve(row.total || 0)))
  ]).then(([totalUsers, activeQuizzes, shopItems, totalSparks]) => {
    res.json({
      totalUsers,
      activeQuizzes,
      shopItems,
      totalSparks
    });
  });
});

// Управление товарами магазина
app.get('/api/admin/shop/items', requireAdmin, (req, res) => {
  db.all("SELECT * FROM shop_items ORDER BY created_at DESC", (err, items) => {
    if (err) return res.status(500).json({ error: 'Database error' });
    res.json(items);
  });
});

app.post('/api/admin/shop/items', requireAdmin, (req, res) => {
  const { title, description, type, file_url, price } = req.body;
  
  console.log('🛒 Добавление товара:', title);
  
  if (!title || !price) {
    return res.status(400).json({ error: 'Title and price are required' });
  }
  
  db.run(`INSERT INTO shop_items (title, description, type, file_url, price) VALUES (?, ?, ?, ?, ?)`,
    [title, description, type || 'video', file_url, price],
    function(err) {
      if (err) {
        console.error('❌ Error creating shop item:', err);
        return res.status(500).json({ error: 'Error creating shop item' });
      }
      
      res.json({
        success: true,
        message: 'Товар успешно добавлен',
        itemId: this.lastID
      });
    }
  );
});

// ==================== TELEGRAM BOT ====================

// Инициализируем бота только если есть токен
let bot = null;
if (process.env.BOT_TOKEN) {
  try {
    // Используем polling только если явно указано
    bot = new TelegramBot(process.env.BOT_TOKEN, { 
      polling: process.env.ENABLE_POLLING === 'true' 
    });
    
    // Обработка команды /start
    bot.onText(/\/start/, (msg) => {
      const chatId = msg.chat.id;
      const name = msg.from.first_name || 'Друг';
      
      const welcomeText = `🎨 Привет, ${name}!

Добро пожаловать в **Мастерская Вдохновения**!

✨ Откройте личный кабинет чтобы:
• 🎯 Проходить квизы и получать искры
• 👥 Выбрать своего персонажа  
• 🛒 Покупать обучающие материалы
• 📊 Отслеживать свой прогресс

Нажмите кнопку ниже чтобы начать!`;
      
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
      });
    });

    console.log('✅ Telegram Bot инициализирован');
  } catch (error) {
    console.log('⚠️ Telegram Bot не инициализирован:', error.message);
  }
} else {
  console.log('⚠️ BOT_TOKEN не установлен, бот отключен');
}

// ==================== SERVER START ====================

const PORT = process.env.PORT || 3000;

app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Сервер запущен на порту ${PORT}`);
  console.log(`📱 Mini App: ${process.env.APP_URL || `http://localhost:${PORT}`}`);
  console.log(`🔧 Admin Panel: ${process.env.APP_URL || `http://localhost:${PORT}`}/admin`);
  if (!process.env.BOT_TOKEN) {
    console.log('⚠️ BOT_TOKEN не установлен, установите его в .env для работы бота');
  }
  if (!process.env.CHANNEL_USERNAME) {
    console.log('⚠️ CHANNEL_USERNAME не установлен, установите его в .env для работы приглашений');
  }
  console.log('✅ Все системы работают');
}).on('error', (err) => {
  console.error('❌ Server error:', err);
});
