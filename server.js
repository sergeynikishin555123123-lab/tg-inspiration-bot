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

console.log('🎨 Мастерская Вдохновения - Запуск исправленной версии...');

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
    daily_commented BOOLEAN DEFAULT FALSE,
    consecutive_days INTEGER DEFAULT 0,
    invited_by INTEGER,
    invite_count INTEGER DEFAULT 0,
    last_bonus_claim DATETIME,
    total_activities INTEGER DEFAULT 0,
    settings TEXT DEFAULT '{}'
  )`);
  
  // Таблица персонажей
  db.run(`CREATE TABLE characters (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    class TEXT NOT NULL,
    character_name TEXT NOT NULL,
    description TEXT,
    bonus_type TEXT NOT NULL,
    bonus_value TEXT NOT NULL,
    available_buttons TEXT DEFAULT '["quiz","photo_work","shop","invite","activities"]',
    is_active BOOLEAN DEFAULT TRUE,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);
  
  // Таблица квизов
  db.run(`CREATE TABLE quizzes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    description TEXT,
    questions TEXT NOT NULL,
    sparks_reward REAL DEFAULT 1,
    cooldown_hours INTEGER DEFAULT 24,
    is_active BOOLEAN DEFAULT TRUE,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  // Таблица пройденных квизов
  db.run(`CREATE TABLE quiz_completions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    quiz_id INTEGER NOT NULL,
    completed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    score INTEGER NOT NULL,
    sparks_earned REAL NOT NULL,
    FOREIGN KEY (user_id) REFERENCES users (user_id),
    FOREIGN KEY (quiz_id) REFERENCES quizzes (id),
    UNIQUE(user_id, quiz_id)
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
    role TEXT DEFAULT 'moderator',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  // Таблица товаров магазина
  db.run(`CREATE TABLE shop_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    description TEXT,
    type TEXT NOT NULL DEFAULT 'video',
    file_url TEXT,
    preview_url TEXT,
    price REAL NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  // Таблица покупок
  db.run(`CREATE TABLE purchases (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    item_id INTEGER NOT NULL,
    price_paid REAL NOT NULL,
    purchased_at DATETIME DEFAULT CURRENT_TIMESTAMP
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
  db.run("INSERT INTO users (user_id, tg_first_name, sparks, level, is_registered, class, character_id) VALUES (?, ?, ?, ?, ?, ?, ?)",
    [12345, 'Тестовый Пользователь', 25.5, 'Ученик', true, 'Художники', 1]);
  
  // Добавляем админа
  if (process.env.ADMIN_ID) {
    db.run("INSERT INTO admins (user_id, username, role) VALUES (?, ?, ?)",
      [process.env.ADMIN_ID, 'admin', 'superadmin']);
    console.log('✅ Админ добавлен:', process.env.ADMIN_ID);
  }
  
  // Добавляем тестовые квизы
  const testQuizzes = [
    {
      title: "🎨 Основы живописи",
      description: "Проверьте свои знания основ живописи",
      questions: JSON.stringify([
        {
          question: "Кто написал картину 'Мона Лиза'?",
          options: ["Винсент Ван Гог", "Леонардо да Винчи", "Пабло Пикассо", "Клод Моне"],
          correctAnswer: 1
        }
      ]),
      sparks_reward: 2
    }
  ];
  
  const quizStmt = db.prepare("INSERT INTO quizzes (title, description, questions, sparks_reward) VALUES (?, ?, ?, ?)");
  testQuizzes.forEach(quiz => quizStmt.run([quiz.title, quiz.description, quiz.questions, quiz.sparks_reward]));
  quizStmt.finalize();

  // Добавляем тестовые товары
  const shopStmt = db.prepare("INSERT INTO shop_items (title, description, type, file_url, preview_url, price) VALUES (?, ?, ?, ?, ?, ?)");
  shopStmt.run(['🎨 Урок акварели', 'Видеоурок по основам акварели', 'video', 'https://example.com/video1.mp4', 'https://example.com/preview1.jpg', 15]);
  shopStmt.finalize();
  
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
    version: '3.0.0'
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
    `SELECT u.*, c.character_name, c.class, c.available_buttons
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
        user.level = calculateLevel(user.sparks);
        user.available_buttons = JSON.parse(user.available_buttons || '[]');
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
                tg_first_name: 'Новый пользователь',
                available_buttons: []
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
  
  const isNewUser = true; // Упрощенная логика
  
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
      
      let message = 'Регистрация успешна!';
      let sparksAdded = 0;
      
      if (isNewUser) {
        sparksAdded = 5;
        db.run(`UPDATE users SET sparks = sparks + ? WHERE user_id = ?`, [sparksAdded, userId]);
        db.run(`INSERT INTO activities (user_id, activity_type, sparks_earned, description) VALUES (?, 'registration', ?, 'Регистрация')`, [userId, sparksAdded]);
        message = 'Регистрация успешна! +5✨';
      }
      
      res.json({ 
        success: true, 
        message: message,
        sparksAdded: sparksAdded
      });
    }
  );
});

// Получение классов
app.get('/api/webapp/classes', (req, res) => {
  const classes = [
    { id: 'Художники', name: '🎨 Художники', description: 'Творцы изобразительного искусства', icon: '🎨' },
    { id: 'Стилисты', name: '👗 Стилисты', description: 'Мастера создания образов', icon: '👗' },
    { id: 'Мастера', name: '🧵 Мастера', description: 'Ремесленники прикладного искусства', icon: '🧵' },
    { id: 'Историки', name: '🏛️ Историки искусства', description: 'Знатоки истории искусств', icon: '🏛️' }
  ];
  res.json(classes);
});

// Получение персонажей
app.get('/api/webapp/characters', (req, res) => {
  db.all('SELECT * FROM characters WHERE is_active = TRUE ORDER BY class, character_name', (err, characters) => {
    if (err) {
      return res.status(500).json({ error: 'Database error' });
    }
    
    const grouped = {};
    characters.forEach(char => {
      if (!grouped[char.class]) grouped[char.class] = [];
      grouped[char.class].push({
        ...char,
        available_buttons: JSON.parse(char.available_buttons || '[]')
      });
    });
    
    res.json(grouped);
  });
});

// Получение квизов
app.get('/api/webapp/quizzes', (req, res) => {
  const userId = req.query.userId;
  
  db.all("SELECT * FROM quizzes WHERE is_active = TRUE ORDER BY created_at DESC", (err, quizzes) => {
    if (err) {
      return res.status(500).json({ error: 'Database error' });
    }
    
    const parsedQuizzes = quizzes.map(quiz => ({
      ...quiz,
      questions: JSON.parse(quiz.questions)
    }));
    
    if (userId) {
      db.all(`SELECT quiz_id, completed_at FROM quiz_completions WHERE user_id = ?`, [userId], (err, completions) => {
        const quizzesWithStatus = parsedQuizzes.map(quiz => {
          const completion = completions.find(c => c.quiz_id === quiz.id);
          return {
            ...quiz,
            completed: !!completion,
            can_retake: true // Упрощенная логика
          };
        });
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
    
    const sparksEarned = correctAnswers >= Math.ceil(questions.length * 0.6) ? quiz.sparks_reward : 0;
    
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

// Магазин
app.get('/api/webapp/shop/items', (req, res) => {
  db.all("SELECT * FROM shop_items WHERE is_active = TRUE ORDER BY price ASC", (err, items) => {
    if (err) return res.status(500).json({ error: 'Database error' });
    res.json(items);
  });
});

// Активности пользователя
app.get('/api/webapp/users/:userId/activities', (req, res) => {
  const userId = req.params.userId;
  
  db.all(`SELECT * FROM activities WHERE user_id = ? ORDER BY created_at DESC LIMIT 20`, [userId], (err, activities) => {
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
    new Promise(resolve => db.get('SELECT COUNT(*) as count FROM characters WHERE is_active = TRUE', (err, row) => resolve(row.count))),
    new Promise(resolve => db.get('SELECT COUNT(*) as count FROM shop_items WHERE is_active = TRUE', (err, row) => resolve(row.count))),
    new Promise(resolve => db.get('SELECT SUM(sparks) as total FROM users', (err, row) => resolve(row.total || 0)))
  ]).then(([totalUsers, activeQuizzes, activeCharacters, shopItems, totalSparks]) => {
    res.json({
      totalUsers,
      activeToday: totalUsers, // Упрощенная логика
      totalPosts: 0,
      pendingModeration: 0,
      totalSparks,
      shopItems,
      activeQuizzes,
      activeCharacters,
      registeredToday: 0
    });
  });
});

// Управление персонажами
app.get('/api/admin/characters', requireAdmin, (req, res) => {
  db.all("SELECT * FROM characters ORDER BY class, character_name", (err, characters) => {
    if (err) return res.status(500).json({ error: 'Database error' });
    
    const parsed = characters.map(char => ({
      ...char,
      available_buttons: JSON.parse(char.available_buttons || '[]')
    }));
    
    res.json(parsed);
  });
});

app.post('/api/admin/characters', requireAdmin, (req, res) => {
  const { class: charClass, character_name, description, bonus_type, bonus_value, available_buttons } = req.body;
  
  console.log('👥 Добавление персонажа:', { charClass, character_name });
  
  if (!charClass || !character_name || !bonus_type || !bonus_value) {
    return res.status(400).json({ error: 'Все обязательные поля должны быть заполнены' });
  }
  
  const buttonsJson = JSON.stringify(available_buttons || []);
  
  db.run(`INSERT INTO characters (class, character_name, description, bonus_type, bonus_value, available_buttons) VALUES (?, ?, ?, ?, ?, ?)`,
    [charClass, character_name, description, bonus_type, bonus_value, buttonsJson],
    function(err) {
      if (err) {
        console.error('❌ Error creating character:', err);
        return res.status(500).json({ error: 'Error creating character' });
      }
      
      res.json({
        success: true,
        message: 'Персонаж успешно создан',
        characterId: this.lastID
      });
    }
  );
});

app.put('/api/admin/characters/:id', requireAdmin, (req, res) => {
  const { id } = req.params;
  const { class: charClass, character_name, description, bonus_type, bonus_value, available_buttons, is_active } = req.body;
  
  const buttonsJson = JSON.stringify(available_buttons || []);
  
  db.run(`UPDATE characters SET class=?, character_name=?, description=?, bonus_type=?, bonus_value=?, available_buttons=?, is_active=? WHERE id=?`,
    [charClass, character_name, description, bonus_type, bonus_value, buttonsJson, is_active, id],
    function(err) {
      if (err) return res.status(500).json({ error: 'Database error' });
      
      res.json({
        success: true,
        message: 'Персонаж успешно обновлен'
      });
    }
  );
});

app.delete('/api/admin/characters/:id', requireAdmin, (req, res) => {
  const { id } = req.params;
  
  db.run(`DELETE FROM characters WHERE id = ?`, [id], function(err) {
    if (err) return res.status(500).json({ error: 'Database error' });
    
    res.json({
      success: true,
      message: 'Персонаж удален'
    });
  });
});

// Управление квизами
app.get('/api/admin/quizzes', requireAdmin, (req, res) => {
  db.all("SELECT * FROM quizzes ORDER BY created_at DESC", (err, quizzes) => {
    if (err) return res.status(500).json({ error: 'Database error' });
    
    const parsed = quizzes.map(quiz => ({
      ...quiz,
      questions: JSON.parse(quiz.questions || '[]')
    }));
    
    res.json(parsed);
  });
});

app.post('/api/admin/quizzes', requireAdmin, (req, res) => {
  const { title, description, questions, sparks_reward, cooldown_hours, is_active } = req.body;
  
  console.log('🎯 Создание квиза:', title);
  
  if (!title || !questions) {
    return res.status(400).json({ error: 'Title and questions are required' });
  }
  
  const questionsJson = JSON.stringify(questions);
  
  db.run(`INSERT INTO quizzes (title, description, questions, sparks_reward, cooldown_hours, is_active) VALUES (?, ?, ?, ?, ?, ?)`,
    [title, description, questionsJson, sparks_reward || 1, cooldown_hours || 24, is_active !== false],
    function(err) {
      if (err) {
        console.error('❌ Error creating quiz:', err);
        return res.status(500).json({ error: 'Error creating quiz' });
      }
      
      res.json({
        success: true,
        message: 'Квиз успешно создан',
        quizId: this.lastID
      });
    }
  );
});

// Управление админами
app.get('/api/admin/admins', requireAdmin, (req, res) => {
  db.all("SELECT * FROM admins ORDER BY role, user_id", (err, admins) => {
    if (err) return res.status(500).json({ error: 'Database error' });
    res.json(admins);
  });
});

app.post('/api/admin/admins', requireAdmin, (req, res) => {
  const { user_id, username, role } = req.body;
  
  console.log('🔧 Добавление админа:', { user_id, username, role });
  
  if (!user_id) {
    return res.status(400).json({ error: 'User ID is required' });
  }
  
  db.run(`INSERT OR REPLACE INTO admins (user_id, username, role) VALUES (?, ?, ?)`,
    [user_id, username, role || 'moderator'],
    function(err) {
      if (err) {
        console.error('❌ Error adding admin:', err);
        return res.status(500).json({ error: 'Error adding admin' });
      }
      
      res.json({
        success: true,
        message: 'Админ успешно добавлен'
      });
    }
  );
});

app.delete('/api/admin/admins/:userId', requireAdmin, (req, res) => {
  const { userId } = req.params;
  
  if (userId == req.admin.user_id) {
    return res.status(400).json({ error: 'Нельзя удалить самого себя' });
  }
  
  db.run(`DELETE FROM admins WHERE user_id = ?`, [userId], function(err) {
    if (err) return res.status(500).json({ error: 'Database error' });
    
    res.json({
      success: true,
      message: 'Админ удален'
    });
  });
});

// ==================== TELEGRAM BOT ====================

const bot = new TelegramBot(process.env.BOT_TOKEN, { polling: true });

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

bot.onText(/\/admin/, (msg) => {
  const chatId = msg.chat.id;
  const userId = msg.from.id;
  
  db.get('SELECT * FROM admins WHERE user_id = ?', [userId], (err, admin) => {
    if (err || !admin) {
      bot.sendMessage(chatId, '❌ У вас нет прав доступа к админ панели.');
      return;
    }
    
    const adminUrl = `${process.env.APP_URL || 'http://localhost:3000'}/admin?userId=${userId}`;
    bot.sendMessage(chatId, `🔧 Панель администратора\n\nДоступ: ${admin.role}\n\n${adminUrl}`);
  });
});

// ==================== SERVER START ====================

const PORT = process.env.PORT || 3000;

app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Сервер запущен на порту ${PORT}`);
  console.log(`📱 Mini App: ${process.env.APP_URL || `http://localhost:${PORT}`}`);
  console.log(`🔧 Admin Panel: ${process.env.APP_URL || `http://localhost:${PORT}`}/admin`);
  console.log('✅ Все системы работают');
}).on('error', (err) => {
  console.error('❌ Server error:', err);
});
