import express from 'express';
import TelegramBot from 'node-telegram-bot-api';
import cors from 'cors';
import bodyParser from 'body-parser';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import dotenv from 'dotenv';
import sqlite3 from 'sqlite3';
import multer from 'multer';
import fs from 'fs';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const db = new sqlite3.Database(':memory:');

// ==================== НАСТРОЙКА ЗАГРУЗКИ ФАЙЛОВ ====================
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = join(__dirname, 'uploads');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueName = Date.now() + '-' + Math.round(Math.random() * 1E9) + '-' + file.originalname;
    cb(null, uniqueName);
  }
});

const upload = multer({ 
  storage: storage,
  limits: {
    fileSize: 50 * 1024 * 1024 // 50MB
  }
});

app.use(express.json({ limit: '50mb' }));
app.use(cors());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static(join(__dirname, 'public')));
app.use('/admin', express.static(join(__dirname, 'admin')));
app.use('/uploads', express.static(join(__dirname, 'uploads')));

console.log('🎨 Мастерская Вдохновения - Запуск улучшенной версии...');

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
    total_activities INTEGER DEFAULT 0,
    total_sparks_earned REAL DEFAULT 0
  )`);
  
  // Таблица классов (ролей)
  db.run(`CREATE TABLE classes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,
    description TEXT,
    icon TEXT,
    available_buttons TEXT DEFAULT '["quiz","shop","invite","activities"]',
    is_active BOOLEAN DEFAULT TRUE,
    characters_enabled BOOLEAN DEFAULT TRUE,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);
  
  // Таблица персонажей
  db.run(`CREATE TABLE characters (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    class_id INTEGER NOT NULL,
    character_name TEXT NOT NULL,
    description TEXT,
    bonus_type TEXT NOT NULL,
    bonus_value TEXT NOT NULL,
    available_buttons TEXT DEFAULT '["quiz","shop","invite","activities"]',
    is_active BOOLEAN DEFAULT TRUE,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (class_id) REFERENCES classes (id)
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
    purchased_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    item_data TEXT NOT NULL,
    FOREIGN KEY (user_id) REFERENCES users (user_id),
    FOREIGN KEY (item_id) REFERENCES shop_items (id)
  )`);

  // Таблица постов канала
  db.run(`CREATE TABLE channel_posts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    post_id TEXT UNIQUE,
    title TEXT NOT NULL,
    content TEXT,
    photo_url TEXT,
    video_url TEXT,
    buttons TEXT,
    requires_comment BOOLEAN DEFAULT FALSE,
    published_by INTEGER,
    published_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    is_published BOOLEAN DEFAULT FALSE
  )`);

  // Таблица комментариев (отзывов к постам)
  db.run(`CREATE TABLE comments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    post_id INTEGER NOT NULL,
    comment_text TEXT NOT NULL,
    is_approved BOOLEAN DEFAULT FALSE,
    sparks_awarded BOOLEAN DEFAULT FALSE,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users (user_id),
    FOREIGN KEY (post_id) REFERENCES channel_posts (id)
  )`);

  // Таблица приглашений
  db.run(`CREATE TABLE invitations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    inviter_id INTEGER NOT NULL,
    invited_id INTEGER NOT NULL,
    invited_username TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(inviter_id, invited_id)
  )`);

  // Таблица опросов
  db.run(`CREATE TABLE polls (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    post_id INTEGER,
    question TEXT NOT NULL,
    options TEXT NOT NULL,
    correct_option INTEGER,
    sparks_reward REAL DEFAULT 2,
    is_active BOOLEAN DEFAULT TRUE,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  // Таблица участия в опросах
  db.run(`CREATE TABLE poll_participations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    poll_id INTEGER NOT NULL,
    selected_option INTEGER NOT NULL,
    sparks_earned REAL NOT NULL,
    participated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, poll_id)
  )`);

  // Таблица марафонов
  db.run(`CREATE TABLE marathons (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    description TEXT,
    start_date DATETIME,
    end_date DATETIME,
    sparks_reward REAL DEFAULT 7,
    is_active BOOLEAN DEFAULT TRUE,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  // Таблица участия в марафонах
  db.run(`CREATE TABLE marathon_participations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    marathon_id INTEGER NOT NULL,
    completed BOOLEAN DEFAULT FALSE,
    sparks_earned REAL DEFAULT 0,
    participated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, marathon_id)
  )`);

  // Заполняем классы (ролей)
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
    [1, 'Феликс Штрих', 'Экспериментатор, мастер зарисовок', 'random_gift', '1-3'],
    [2, 'Эстелла Моде', 'Бывший стилист, обучает восприятию образа', 'percent_bonus', '5'],
    [2, 'Роза Ателье', 'Мастер практического шитья', 'secret_advice', '2weeks'],
    [2, 'Гертруда Линия', 'Ценит детали и аксессуары', 'series_bonus', '1'],
    [3, 'Тихон Творец', 'Ремесленник, любит простые техники', 'photo_bonus', '1'],
    [3, 'Агата Узор', 'Любит неожиданные материалы', 'weekly_surprise', '6'],
    [3, 'Борис Клей', 'Весёлый мастер импровизаций', 'mini_quest', '2'],
    [4, 'Профессор Артёмий', 'Любитель архивов и фактов', 'quiz_hint', '1'],
    [4, 'Соня Гравюра', 'Рассказывает истории картин', 'fact_star', '1'],
    [4, 'Михаил Эпоха', 'Любит хронологию и эпохи', 'streak_multiplier', '2']
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
  const testQuizzes = [
    {
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
    }
  ];
  
  const quizStmt = db.prepare("INSERT INTO quizzes (title, description, questions, sparks_reward) VALUES (?, ?, ?, ?)");
  testQuizzes.forEach(quiz => quizStmt.run([quiz.title, quiz.description, quiz.questions, quiz.sparks_reward]));
  quizStmt.finalize();

  // Добавляем тестовые товары
  const shopStmt = db.prepare("INSERT INTO shop_items (title, description, type, file_url, preview_url, price) VALUES (?, ?, ?, ?, ?, ?)");
  shopStmt.run(['🎨 Урок акварели', 'Видеоурок по основам акварели', 'video', '/uploads/shop/video1.mp4', '/uploads/previews/preview1.jpg', 15]);
  shopStmt.run(['📚 Основы композиции', 'Как правильно составлять композицию', 'ebook', '/uploads/shop/ebook1.pdf', '/uploads/previews/preview2.jpg', 10]);
  shopStmt.finalize();

  // Добавляем тестовый марафон
  db.run("INSERT INTO marathons (title, description, start_date, end_date, sparks_reward) VALUES (?, ?, ?, ?, ?)",
    ['🎨 Неделя творчества', '7 дней интенсивной практики', '2024-01-01', '2024-01-07', 7]);
  
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

function awardSparks(userId, amount, activityType, description) {
  db.run(`UPDATE users SET sparks = sparks + ?, total_sparks_earned = total_sparks_earned + ? WHERE user_id = ?`, 
    [amount, amount, userId]);
  db.run(`INSERT INTO activities (user_id, activity_type, sparks_earned, description) VALUES (?, ?, ?, ?)`,
    [userId, activityType, amount, description]);
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
    version: '5.0.0'
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
    `SELECT u.*, c.character_name, cls.name as class_name, cls.available_buttons as class_buttons,
            char.available_buttons as character_buttons, cls.characters_enabled
     FROM users u 
     LEFT JOIN characters c ON u.character_id = c.id 
     LEFT JOIN classes cls ON u.class = cls.name
     LEFT JOIN characters char ON u.character_id = char.id
     WHERE u.user_id = ?`,
    [userId],
    (err, user) => {
      if (err) {
        console.error('❌ Database error:', err);
        return res.status(500).json({ error: 'Database error' });
      }
      
      if (user) {
        user.level = calculateLevel(user.sparks);
        user.available_buttons = JSON.parse(user.character_buttons || user.class_buttons || '[]');
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
                available_buttons: [],
                characters_enabled: true
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
  
  if (!userId || !userClass) {
    return res.status(400).json({ error: 'User ID and class are required' });
  }
  
  // Проверяем, новый ли пользователь
  db.get('SELECT is_registered FROM users WHERE user_id = ?', [userId], (err, existingUser) => {
    if (err) {
      return res.status(500).json({ error: 'Database error' });
    }
    
    const isNewUser = !existingUser || !existingUser.is_registered;
    
    // Проверяем, включены ли персонажи для этого класса
    db.get('SELECT characters_enabled FROM classes WHERE name = ?', [userClass], (err, classInfo) => {
      if (err) {
        return res.status(500).json({ error: 'Database error' });
      }
      
      // Если персонажи отключены, устанавливаем characterId = null
      const finalCharacterId = (classInfo && classInfo.characters_enabled) ? characterId : null;
      
      db.run(
        `INSERT OR REPLACE INTO users (
          user_id, tg_username, tg_first_name, class, character_id, is_registered, sparks
        ) VALUES (?, ?, ?, ?, ?, TRUE, COALESCE((SELECT sparks FROM users WHERE user_id = ?), 0))`,
        [userId, tgUsername, tgFirstName, userClass, finalCharacterId, userId],
        function(err) {
          if (err) {
            console.error('❌ Error saving user:', err);
            return res.status(500).json({ error: 'Error saving user' });
          }
          
          let message = 'Данные обновлены!';
          let sparksAdded = 0;
          
          if (isNewUser) {
            sparksAdded = 5;
            awardSparks(userId, sparksAdded, 'registration', 'Регистрация в системе');
            message = 'Регистрация успешна! +5✨';
          }
          
          res.json({ 
            success: true, 
            message: message,
            sparksAdded: sparksAdded,
            isNewRegistration: isNewUser
          });
        }
      );
    });
  });
});

// Получение классов
app.get('/api/webapp/classes', (req, res) => {
  db.all("SELECT * FROM classes WHERE is_active = TRUE ORDER BY name", (err, classes) => {
    if (err) return res.status(500).json({ error: 'Database error' });
    
    const parsedClasses = classes.map(cls => ({
      ...cls,
      available_buttons: JSON.parse(cls.available_buttons || '[]')
    }));
    
    res.json(parsedClasses);
  });
});

// Получение персонажей
app.get('/api/webapp/characters', (req, res) => {
  db.all(`
    SELECT c.*, cls.name as class_name, cls.characters_enabled
    FROM characters c 
    JOIN classes cls ON c.class_id = cls.id 
    WHERE c.is_active = TRUE 
    ORDER BY cls.name, c.character_name
  `, (err, characters) => {
    if (err) return res.status(500).json({ error: 'Database error' });
    
    const grouped = {};
    characters.forEach(char => {
      if (!grouped[char.class_name]) grouped[char.class_name] = [];
      grouped[char.class_name].push({
        ...char,
        available_buttons: JSON.parse(char.available_buttons || '[]'),
        characters_enabled: char.characters_enabled
      });
    });
    
    res.json(grouped);
  });
});

// Получение квизов
app.get('/api/webapp/quizzes', (req, res) => {
  const userId = req.query.userId;
  
  db.all("SELECT * FROM quizzes WHERE is_active = TRUE ORDER BY created_at DESC", (err, quizzes) => {
    if (err) return res.status(500).json({ error: 'Database error' });
    
    const parsedQuizzes = quizzes.map(quiz => ({
      ...quiz,
      questions: JSON.parse(quiz.questions)
    }));
    
    if (userId) {
      db.all(`SELECT quiz_id, completed_at FROM quiz_completions WHERE user_id = ?`, [userId], (err, completions) => {
        const quizzesWithStatus = parsedQuizzes.map(quiz => {
          const completion = completions.find(c => c.quiz_id === quiz.id);
          const completedAt = completion ? new Date(completion.completed_at) : null;
          const cooldownMs = quiz.cooldown_hours * 60 * 60 * 1000;
          const canRetake = completedAt ? (Date.now() - completedAt.getTime()) > cooldownMs : true;
          
          return {
            ...quiz,
            completed: !!completion,
            completed_at: completion ? completion.completed_at : null,
            can_retake: canRetake,
            next_available: completedAt ? new Date(completedAt.getTime() + cooldownMs) : null
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
  
  // Проверяем возможность прохождения
  db.get(
    `SELECT qc.completed_at, q.cooldown_hours 
     FROM quiz_completions qc 
     JOIN quizzes q ON qc.quiz_id = q.id 
     WHERE qc.user_id = ? AND qc.quiz_id = ?`,
    [userId, quizId],
    (err, existingCompletion) => {
      if (err) return res.status(500).json({ error: 'Database error' });
      
      if (existingCompletion) {
        const completedAt = new Date(existingCompletion.completed_at);
        const cooldownMs = existingCompletion.cooldown_hours * 60 * 60 * 1000;
        const canRetake = (Date.now() - completedAt.getTime()) > cooldownMs;
        
        if (!canRetake) {
          const nextAvailable = new Date(completedAt.getTime() + cooldownMs);
          return res.status(400).json({ 
            error: `Квиз можно будет пройти повторно после ${nextAvailable.toLocaleString('ru-RU')}` 
          });
        }
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
        
        // Новая система начисления искр
        let sparksEarned = 0;
        if (correctAnswers > 0) {
          // 1 искра за каждый правильный ответ
          sparksEarned = correctAnswers;
          // Дополнительные 5 искр за прохождение без ошибок
          if (correctAnswers === questions.length) {
            sparksEarned += 5;
          }
        }
        
        // Сохраняем результат
        db.run(`INSERT OR REPLACE INTO quiz_completions (user_id, quiz_id, score, sparks_earned) VALUES (?, ?, ?, ?)`,
          [userId, quizId, correctAnswers, sparksEarned]);
        
        // Начисляем искры
        if (sparksEarned > 0) {
          awardSparks(userId, sparksEarned, 'quiz', `Квиз: ${quiz.title} (${correctAnswers}/${questions.length} правильных)`);
        }
        
        res.json({
          success: true,
          correctAnswers,
          totalQuestions: questions.length,
          sparksEarned,
          passed: sparksEarned > 0,
          perfect: correctAnswers === questions.length,
          message: sparksEarned > 0 ? 
            `Поздравляем! Вы получили ${sparksEarned}✨ (${correctAnswers} правильных ответов${correctAnswers === questions.length ? ' + бонус за идеальный результат!' : ''})` : 
            'Попробуйте еще раз!'
        });
      });
    }
  );
});

// Получение ссылки для приглашения
app.get('/api/webapp/invite/:userId', (req, res) => {
  const userId = req.params.userId;
  const channelUsername = process.env.CHANNEL_USERNAME || 'your_channel_username';
  const inviteLink = `https://t.me/${channelUsername}?start=invite_${userId}`;
  
  res.json({
    success: true,
    invite_link: inviteLink
  });
});

// Обработка приглашения
app.post('/api/webapp/invite', (req, res) => {
  const { inviterId, invitedId, invitedUsername } = req.body;
  
  console.log('👥 Обработка приглашения:', { inviterId, invitedId });
  
  if (!inviterId || !invitedId) {
    return res.status(400).json({ error: 'Inviter ID and invited ID are required' });
  }
  
  if (inviterId == invitedId) {
    return res.status(400).json({ error: 'Нельзя приглашать самого себя' });
  }
  
  db.get('SELECT * FROM invitations WHERE inviter_id = ? AND invited_id = ?', [inviterId, invitedId], (err, existingInvite) => {
    if (err) return res.status(500).json({ error: 'Database error' });
    
    if (existingInvite) {
      return res.status(400).json({ error: 'Этот пользователь уже был приглашен' });
    }
    
    // Создаем приглашение
    db.run(`INSERT INTO invitations (inviter_id, invited_id, invited_username) VALUES (?, ?, ?)`,
      [inviterId, invitedId, invitedUsername],
      function(err) {
        if (err) return res.status(500).json({ error: 'Error creating invitation' });
        
        // Начисляем бонус пригласившему - 10 искр
        const bonusSparks = 10;
        db.run(`UPDATE users SET sparks = sparks + ?, invite_count = invite_count + 1 WHERE user_id = ?`, 
          [bonusSparks, inviterId]);
        
        awardSparks(inviterId, bonusSparks, 'invitation', 'Приглашение друга');
        
        res.json({
          success: true,
          message: 'Друг приглашен! +10✨',
          sparksEarned: bonusSparks
        });
      }
    );
  });
});

// Получение постов канала с комментариями
app.get('/api/webapp/posts', (req, res) => {
  const { userId } = req.query;
  
  db.all(`
    SELECT cp.*, 
           (SELECT COUNT(*) FROM comments c WHERE c.post_id = cp.id AND c.user_id = ? AND c.is_approved = TRUE) as user_commented
    FROM channel_posts cp 
    WHERE cp.is_published = TRUE 
    ORDER BY cp.published_at DESC
    LIMIT 20
  `, [userId || 0], (err, posts) => {
    if (err) return res.status(500).json({ error: 'Database error' });
    
    const parsedPosts = posts.map(post => ({
      ...post,
      buttons: JSON.parse(post.buttons || '[]'),
      user_commented: post.user_commented > 0
    }));
    
    res.json(parsedPosts);
  });
});

// Отправка комментария к посту
app.post('/api/webapp/comments', (req, res) => {
  const { userId, postId, commentText } = req.body;
  
  console.log('💬 Отправка комментария к посту:', { userId, postId });
  
  if (!userId || !postId || !commentText) {
    return res.status(400).json({ error: 'User ID, post ID and comment text are required' });
  }
  
  // Проверяем, комментировал ли пользователь этот пост
  db.get(`SELECT * FROM comments WHERE user_id = ? AND post_id = ?`, 
    [userId, postId], (err, existingComment) => {
    if (err) return res.status(500).json({ error: 'Database error' });
    
    if (existingComment) {
      return res.status(400).json({ error: 'Вы уже оставляли комментарий к этому посту' });
    }
    
    // Сохраняем комментарий
    db.run(`INSERT INTO comments (user_id, post_id, comment_text) VALUES (?, ?, ?)`,
      [userId, postId, commentText],
      function(err) {
        if (err) return res.status(500).json({ error: 'Error saving comment' });
        
        res.json({
          success: true,
          message: 'Комментарий отправлен на модерацию! После одобрения вы получите +1✨',
          sparksPotential: 1,
          commentId: this.lastID
        });
      }
    );
  });
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
        
        // Проверяем, не покупал ли уже
        db.get('SELECT * FROM purchases WHERE user_id = ? AND item_id = ?', [userId, itemId], (err, existingPurchase) => {
          if (err) return res.status(500).json({ error: 'Database error' });
          
          if (existingPurchase) {
            return res.status(400).json({ error: 'Вы уже приобрели этот товар' });
          }
          
          // Выполняем покупку
          db.run('UPDATE users SET sparks = sparks - ? WHERE user_id = ?', [item.price, userId], function(err) {
            if (err) return res.status(500).json({ error: 'Ошибка при списании искр' });
            
            const itemData = JSON.stringify(item);
            
            db.run('INSERT INTO purchases (user_id, item_id, price_paid, item_data) VALUES (?, ?, ?, ?)', 
              [userId, itemId, item.price, itemData], function(err) {
              if (err) return res.status(500).json({ error: 'Ошибка при сохранении покупки' });
              
              awardSparks(userId, -item.price, 'purchase', `Покупка: ${item.title}`);
              
              // Отправляем сообщение пользователю с купленным товаром
              try {
                const bot = new TelegramBot(process.env.BOT_TOKEN);
                let message = `🎉 Вы успешно приобрели товар!\n\n` +
                             `📦 ${item.title}\n` +
                             `💰 Стоимость: ${item.price}✨\n\n`;
                
                if (item.file_url) {
                  const fullFileUrl = `${process.env.APP_URL}${item.file_url}`;
                  if (item.type === 'video') {
                    message += `🎥 Видео доступно по ссылке: ${fullFileUrl}\n\n`;
                  } else if (item.type === 'ebook') {
                    message += `📚 Файл доступен по ссылке: ${fullFileUrl}\n\n`;
                  } else if (item.type === 'audio') {
                    message += `🎧 Аудио доступно по ссылке: ${fullFileUrl}\n\n`;
                  }
                }
                
                message += `💫 Остаток искр: ${user.sparks - item.price}✨`;
                
                bot.sendMessage(userId, message).catch(err => {
                  console.log('Не удалось отправить сообщение о покупке:', err.message);
                });
              } catch (botError) {
                console.log('Ошибка отправки ботом:', botError.message);
              }
              
              res.json({
                success: true,
                message: 'Покупка успешно завершена! Информация о товаре отправлена вам в Telegram.',
                item: item,
                remainingSparks: user.sparks - item.price
              });
            });
          });
        });
      });
    });
  });
});

// Получение купленных товаров
app.get('/api/webapp/shop/purchases/:userId', (req, res) => {
  const userId = req.params.userId;
  
  db.all(`
    SELECT p.*, si.title, si.description, si.type, si.file_url, si.preview_url
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
  
  db.all(`SELECT * FROM activities WHERE user_id = ? ORDER BY created_at DESC LIMIT 20`, [userId], (err, activities) => {
    if (err) return res.status(500).json({ error: 'Database error' });
    res.json({ activities });
  });
});

// Получение марафонов
app.get('/api/webapp/marathons', (req, res) => {
  const userId = req.query.userId;
  
  const now = new Date().toISOString();
  
  db.all(`
    SELECT m.*, 
           (SELECT COUNT(*) FROM marathon_participations mp WHERE mp.marathon_id = m.id AND mp.user_id = ?) as user_participated
    FROM marathons m 
    WHERE m.is_active = TRUE AND m.end_date > ?
    ORDER BY m.start_date ASC
  `, [userId || 0, now], (err, marathons) => {
    if (err) return res.status(500).json({ error: 'Database error' });
    
    const marathonsWithStatus = marathons.map(marathon => ({
      ...marathon,
      user_participated: marathon.user_participated > 0,
      is_active: new Date(marathon.start_date) <= new Date() && new Date(marathon.end_date) >= new Date()
    }));
    
    res.json(marathonsWithStatus);
  });
});

// Участие в марафоне
app.post('/api/webapp/marathons/:marathonId/participate', (req, res) => {
  const { marathonId } = req.params;
  const { userId } = req.body;
  
  if (!userId) {
    return res.status(400).json({ error: 'User ID is required' });
  }
  
  db.get('SELECT * FROM marathons WHERE id = ? AND is_active = TRUE', [marathonId], (err, marathon) => {
    if (err || !marathon) {
      return res.status(404).json({ error: 'Марафон не найден' });
    }
    
    // Проверяем, не участвует ли уже
    db.get('SELECT * FROM marathon_participations WHERE user_id = ? AND marathon_id = ?', [userId, marathonId], (err, existingParticipation) => {
      if (err) return res.status(500).json({ error: 'Database error' });
      
      if (existingParticipation) {
        return res.status(400).json({ error: 'Вы уже участвуете в этом марафоне' });
      }
      
      // Записываем участие
      db.run('INSERT INTO marathon_participations (user_id, marathon_id) VALUES (?, ?)', [userId, marathonId], function(err) {
        if (err) return res.status(500).json({ error: 'Ошибка записи на марафон' });
        
        // Начисляем искры за участие
        awardSparks(userId, marathon.sparks_reward, 'marathon', `Участие в марафоне: ${marathon.title}`);
        
        res.json({
          success: true,
          message: `Вы успешно зарегистрированы на марафон! Получено ${marathon.sparks_reward}✨`,
          sparksEarned: marathon.sparks_reward
        });
      });
    });
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
    new Promise(resolve => db.get('SELECT SUM(sparks) as total FROM users', (err, row) => resolve(row.total || 0))),
    new Promise(resolve => db.get('SELECT COUNT(*) as count FROM comments WHERE is_approved = FALSE', (err, row) => resolve(row.count))),
    new Promise(resolve => db.get('SELECT COUNT(*) as count FROM channel_posts WHERE is_published = TRUE', (err, row) => resolve(row.count)))
  ]).then(([totalUsers, activeQuizzes, activeCharacters, shopItems, totalSparks, pendingComments, totalPosts]) => {
    res.json({
      totalUsers,
      activeToday: totalUsers,
      totalPosts,
      pendingModeration: pendingComments,
      totalSparks,
      shopItems,
      activeQuizzes,
      activeCharacters,
      registeredToday: 0
    });
  });
});

// Управление классами
app.get('/api/admin/classes', requireAdmin, (req, res) => {
  db.all("SELECT * FROM classes ORDER BY name", (err, classes) => {
    if (err) return res.status(500).json({ error: 'Database error' });
    
    const parsed = classes.map(cls => ({
      ...cls,
      available_buttons: JSON.parse(cls.available_buttons || '[]')
    }));
    
    res.json(parsed);
  });
});

app.post('/api/admin/classes', requireAdmin, (req, res) => {
  const { name, description, icon, available_buttons, characters_enabled } = req.body;
  
  console.log('🎯 Добавление класса:', name);
  
  if (!name) {
    return res.status(400).json({ error: 'Название класса обязательно' });
  }
  
  const buttonsJson = JSON.stringify(available_buttons || []);
  
  db.run(`INSERT INTO classes (name, description, icon, available_buttons, characters_enabled) VALUES (?, ?, ?, ?, ?)`,
    [name, description, icon, buttonsJson, characters_enabled !== false],
    function(err) {
      if (err) return res.status(500).json({ error: 'Ошибка создания класса' });
      
      res.json({
        success: true,
        message: 'Класс успешно создан',
        classId: this.lastID
      });
    }
  );
});

app.put('/api/admin/classes/:id', requireAdmin, (req, res) => {
  const { id } = req.params;
  const { name, description, icon, available_buttons, is_active, characters_enabled } = req.body;
  
  const buttonsJson = JSON.stringify(available_buttons || []);
  
  db.run(`UPDATE classes SET name=?, description=?, icon=?, available_buttons=?, is_active=?, characters_enabled=? WHERE id=?`,
    [name, description, icon, buttonsJson, is_active, characters_enabled, id],
    function(err) {
      if (err) return res.status(500).json({ error: 'Database error' });
      
      res.json({
        success: true,
        message: 'Класс успешно обновлен'
      });
    }
  );
});

// Управление персонажами
app.get('/api/admin/characters', requireAdmin, (req, res) => {
  db.all(`
    SELECT c.*, cls.name as class_name 
    FROM characters c 
    JOIN classes cls ON c.class_id = cls.id 
    ORDER BY cls.name, c.character_name
  `, (err, characters) => {
    if (err) return res.status(500).json({ error: 'Database error' });
    
    const parsed = characters.map(char => ({
      ...char,
      available_buttons: JSON.parse(char.available_buttons || '[]')
    }));
    
    res.json(parsed);
  });
});

app.post('/api/admin/characters', requireAdmin, (req, res) => {
  const { class_id, character_name, description, bonus_type, bonus_value, available_buttons } = req.body;
  
  console.log('👥 Добавление персонажа:', character_name);
  
  if (!class_id || !character_name || !bonus_type || !bonus_value) {
    return res.status(400).json({ error: 'Все обязательные поля должны быть заполнены' });
  }
  
  const buttonsJson = JSON.stringify(available_buttons || []);
  
  db.run(`INSERT INTO characters (class_id, character_name, description, bonus_type, bonus_value, available_buttons) VALUES (?, ?, ?, ?, ?, ?)`,
    [class_id, character_name, description, bonus_type, bonus_value, buttonsJson],
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
  const { class_id, character_name, description, bonus_type, bonus_value, available_buttons, is_active } = req.body;
  
  const buttonsJson = JSON.stringify(available_buttons || []);
  
  db.run(`UPDATE characters SET class_id=?, character_name=?, description=?, bonus_type=?, bonus_value=?, available_buttons=?, is_active=? WHERE id=?`,
    [class_id, character_name, description, bonus_type, bonus_value, buttonsJson, is_active, id],
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

app.delete('/api/admin/quizzes/:id', requireAdmin, (req, res) => {
  const { id } = req.params;
  
  db.run(`DELETE FROM quizzes WHERE id = ?`, [id], function(err) {
    if (err) return res.status(500).json({ error: 'Database error' });
    
    res.json({
      success: true,
      message: 'Квиз удален'
    });
  });
});

// ==================== ADMIN API - МАГАЗИН ====================

// Управление магазином - получение товаров
app.get('/api/admin/shop/items', requireAdmin, (req, res) => {
  db.all("SELECT * FROM shop_items ORDER BY created_at DESC", (err, items) => {
    if (err) return res.status(500).json({ error: 'Database error' });
    res.json(items);
  });
});

// Создание товара с загрузкой файлов
app.post('/api/admin/shop/items', upload.fields([
  { name: 'file', maxCount: 1 },
  { name: 'preview', maxCount: 1 }
]), requireAdmin, (req, res) => {
  const { title, description, type, price } = req.body;
  const files = req.files;
  
  console.log('🛒 Добавление товара:', title);
  console.log('📁 Загруженные файлы:', files);
  
  if (!title || !price) {
    return res.status(400).json({ error: 'Title and price are required' });
  }

  // Получаем пути к загруженным файлам
  const fileUrl = files['file'] ? `/uploads/${files['file'][0].filename}` : null;
  const previewUrl = files['preview'] ? `/uploads/${files['preview'][0].filename}` : null;

  db.run(`INSERT INTO shop_items (title, description, type, file_url, preview_url, price) VALUES (?, ?, ?, ?, ?, ?)`,
    [title, description, type || 'video', fileUrl, previewUrl, parseFloat(price)],
    function(err) {
      if (err) {
        console.error('❌ Error creating shop item:', err);
        return res.status(500).json({ error: 'Error creating shop item' });
      }
      
      res.json({
        success: true,
        message: 'Товар успешно добавлен',
        itemId: this.lastID,
        fileUrl: fileUrl,
        previewUrl: previewUrl
      });
    }
  );
});

// Обновление товара
app.put('/api/admin/shop/items/:id', requireAdmin, (req, res) => {
  const { id } = req.params;
  const { title, description, type, price, is_active } = req.body;
  
  db.run(`UPDATE shop_items SET title=?, description=?, type=?, price=?, is_active=? WHERE id=?`,
    [title, description, type, price, is_active, id],
    function(err) {
      if (err) return res.status(500).json({ error: 'Database error' });
      
      res.json({
        success: true,
        message: 'Товар успешно обновлен'
      });
    }
  );
});

// Удаление товара
app.delete('/api/admin/shop/items/:id', requireAdmin, (req, res) => {
  const { id } = req.params;
  
  db.run(`DELETE FROM shop_items WHERE id = ?`, [id], function(err) {
    if (err) return res.status(500).json({ error: 'Database error' });
    
    res.json({
      success: true,
      message: 'Товар удален'
    });
  });
});

// ==================== ADMIN API - ПУБЛИКАЦИИ ====================

// Получение постов
app.get('/api/admin/posts', requireAdmin, (req, res) => {
  db.all("SELECT * FROM channel_posts ORDER BY created_at DESC", (err, posts) => {
    if (err) return res.status(500).json({ error: 'Database error' });
    
    const parsed = posts.map(post => ({
      ...post,
      buttons: JSON.parse(post.buttons || '[]')
    }));
    
    res.json(parsed);
  });
});

// Создание поста с загрузкой медиа
app.post('/api/admin/posts', upload.fields([
  { name: 'photo', maxCount: 1 },
  { name: 'video', maxCount: 1 }
]), requireAdmin, (req, res) => {
  const { title, content, buttons, requires_comment } = req.body;
  const files = req.files;
  
  console.log('📝 Создание поста:', title);
  console.log('📁 Загруженные файлы:', files);

  if (!title) {
    return res.status(400).json({ error: 'Title is required' });
  }

  // Получаем пути к загруженным файлам
  const photoUrl = files['photo'] ? `/uploads/${files['photo'][0].filename}` : null;
  const videoUrl = files['video'] ? `/uploads/${files['video'][0].filename}` : null;
  
  const buttonsJson = JSON.stringify(buttons || []);

  db.run(`INSERT INTO channel_posts (title, content, photo_url, video_url, buttons, requires_comment, published_by) VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [title, content, photoUrl, videoUrl, buttonsJson, requires_comment, req.admin.user_id],
    function(err) {
      if (err) {
        console.error('❌ Error creating post:', err);
        return res.status(500).json({ error: 'Error creating post' });
      }
      
      const postId = this.lastID;
      
      // Публикуем пост в канал
      db.get('SELECT * FROM channel_posts WHERE id = ?', [postId], (err, post) => {
        if (!err && post) {
          publishToChannel(post);
        }
      });
      
      res.json({
        success: true,
        message: 'Пост успешно создан и опубликован в канал',
        postId: postId,
        photoUrl: photoUrl,
        videoUrl: videoUrl
      });
    }
  );
});

// Модерация комментариев
app.get('/api/admin/comments', requireAdmin, (req, res) => {
  db.all(`
    SELECT c.*, u.tg_first_name, u.tg_username, cp.title as post_title
    FROM comments c 
    JOIN users u ON c.user_id = u.user_id 
    JOIN channel_posts cp ON c.post_id = cp.id
    WHERE c.is_approved = FALSE 
    ORDER BY c.created_at DESC
  `, (err, comments) => {
    if (err) return res.status(500).json({ error: 'Database error' });
    res.json(comments);
  });
});

app.post('/api/admin/comments/:id/approve', requireAdmin, (req, res) => {
  const { id } = req.params;
  
  db.get('SELECT * FROM comments WHERE id = ?', [id], (err, comment) => {
    if (err || !comment) return res.status(404).json({ error: 'Comment not found' });
    
    if (comment.is_approved) {
      return res.status(400).json({ error: 'Comment already approved' });
    }
    
    // Одобряем комментарий и начисляем искры
    db.run(`UPDATE comments SET is_approved = TRUE, sparks_awarded = TRUE WHERE id = ?`, [id]);
    awardSparks(comment.user_id, 1, 'comment', 'Комментарий одобрен');
    
    res.json({
      success: true,
      message: 'Комментарий одобрен, пользователь получил +1✨'
    });
  });
});

app.post('/api/admin/comments/:id/reject', requireAdmin, (req, res) => {
  const { id } = req.params;
  
  db.run(`DELETE FROM comments WHERE id = ?`, [id], function(err) {
    if (err) return res.status(500).json({ error: 'Database error' });
    
    res.json({
      success: true,
      message: 'Комментарий отклонен и удален'
    });
  });
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

// Установка команд бота
bot.setMyCommands([
  {
    command: 'start',
    description: 'Открыть личный кабинет'
  },
  {
    command: 'admin',
    description: 'Панель администратора'
  },
  {
    command: 'help',
    description: 'Помощь'
  }
]);

// Обработка команды /start
bot.onText(/\/start/, (msg) => {
  const chatId = msg.chat.id;
  const name = msg.from.first_name || 'Друг';
  const userId = msg.from.id;
  
  const welcomeText = `🎨 Привет, ${name}!

Добро пожаловать в **Мастерская Вдохновения**!

✨ Откройте личный кабинет чтобы:
• 🎯 Проходить квизы и получать искры
• 👥 Выбрать своего персонажа  
• 🛒 Покупать обучающие материалы
• 📊 Отслеживать свой прогресс
• 💬 Оставлять отзывы и получать награды
• 👥 Приглашать друзей и получать бонусы

Нажмите кнопку ниже чтобы начать!`;

  const keyboard = {
    reply_markup: {
      inline_keyboard: [[
        {
          text: "📱 Открыть Личный Кабинет",
          web_app: { url: process.env.APP_URL || `http://localhost:3000` }
        }
      ]]
    }
  };

  bot.sendMessage(chatId, welcomeText, {
    parse_mode: 'Markdown',
    ...keyboard
  });
});

// Обработка команды /start с приглашением
bot.onText(/\/start invite_(\d+)/, (msg, match) => {
  const chatId = msg.chat.id;
  const name = msg.from.first_name || 'Друг';
  const userId = msg.from.id;
  const inviteCode = match[1];
  
  let welcomeText = `🎨 Привет, ${name}!

Добро пожаловать в **Мастерская Вдохновения**!

✨ Вы были приглашены другом! Откройте личный кабинет чтобы:
• 🎯 Проходить квизы и получать искры
• 👥 Выбрать своего персонажа  
• 🛒 Покупать обучающие материалы
• 📊 Отслеживать свой прогресс

Нажмите кнопку ниже чтобы начать!`;
  
  // Обработка приглашения
  if (inviteCode && inviteCode !== userId.toString()) {
    db.get('SELECT * FROM users WHERE user_id = ?', [inviteCode], (err, inviter) => {
      if (!err && inviter) {
        db.run(`INSERT OR IGNORE INTO invitations (inviter_id, invited_id, invited_username) VALUES (?, ?, ?)`,
          [inviteCode, userId, msg.from.username],
          function() {
            if (this.changes > 0) {
              awardSparks(inviteCode, 10, 'invitation', 'Приглашение друга');
              console.log(`✅ User ${userId} invited by ${inviteCode}`);
              
              // Уведомляем пригласившего
              bot.sendMessage(inviteCode, `🎉 Ваш друг ${name} присоединился по вашей ссылке! Вы получили +10✨`).catch(console.error);
            }
          }
        );
      }
    });
  }
  
  const keyboard = {
    reply_markup: {
      inline_keyboard: [[
        {
          text: "📱 Открыть Личный Кабинет",
          web_app: { url: process.env.APP_URL || `http://localhost:3000` }
        }
      ]]
    }
  };

  bot.sendMessage(chatId, welcomeText, {
    parse_mode: 'Markdown',
    ...keyboard
  });
});

// Команда для админов
bot.onText(/\/admin/, (msg) => {
  const chatId = msg.chat.id;
  const userId = msg.from.id;
  
  db.get('SELECT * FROM admins WHERE user_id = ?', [userId], (err, admin) => {
    if (err || !admin) {
      bot.sendMessage(chatId, '❌ У вас нет прав доступа к админ панели.');
      return;
    }
    
    const adminUrl = `${process.env.APP_URL || 'http://localhost:3000'}/admin?userId=${userId}`;
    
    const keyboard = {
      reply_markup: {
        inline_keyboard: [[
          {
            text: "🔧 Открыть Админ Панель",
            web_app: { url: adminUrl }
          }
        ]]
      }
    };
    
    bot.sendMessage(chatId, `🔧 Панель администратора\n\nДоступ: ${admin.role}\n\nНажмите кнопку ниже чтобы открыть панель управления:`, keyboard);
  });
});

// Команда помощи
bot.onText(/\/help/, (msg) => {
  const chatId = msg.chat.id;
  
  const helpText = `🤖 **Помощь по боту "Мастерская Вдохновения"**

**Основные команды:**
/start - Открыть личный кабинет
/admin - Панель администратора (только для админов)
/help - Эта справка

**Что можно делать:**
🎯 Проходить квизы и получать искры
👥 Выбирать персонажей и классы
🛒 Покупать обучающие материалы
💬 Оставлять отзывы к постам
👥 Приглашать друзей
📊 Отслеживать свой прогресс

**Награды:**
✅ Квизы: 1 искра за правильный ответ + 5 за идеальный результат
✅ Комментарии: +1 искра после модерации
✅ Приглашения: +10 искр за каждого друга
✅ Марафоны: +7 искр за участие

Для начала работы нажмите /start`;

  bot.sendMessage(chatId, helpText, { parse_mode: 'Markdown' });
});

// Публикация постов в канал с медиа
async function publishToChannel(post) {
  try {
    const channelId = process.env.CHANNEL_USERNAME;
    if (!channelId) {
      console.log('❌ CHANNEL_USERNAME not set');
      return;
    }

    let caption = `*${post.title}*`;
    if (post.content) {
      caption += `\n\n${post.content}`;
    }

    const buttons = JSON.parse(post.buttons || '[]');
    const keyboard = {
      reply_markup: {
        inline_keyboard: []
      }
    };

    // Добавляем кнопки из поста
    buttons.forEach(button => {
      keyboard.reply_markup.inline_keyboard.push([{
        text: button.text,
        url: button.url
      }]);
    });

    // Добавляем кнопку "Написать отзыв" если требуется
    if (post.requires_comment) {
      const appUrl = process.env.APP_URL || 'http://localhost:3000';
      keyboard.reply_markup.inline_keyboard.push([{
        text: "💬 Написать отзыв (+1✨)",
        web_app: { url: `${appUrl}#comments` }
      }]);
    }

    // Добавляем кнопку "Пригласить друга"
    keyboard.reply_markup.inline_keyboard.push([{
      text: "👥 Пригласить друга (+10✨)",
      web_app: { url: `${process.env.APP_URL || 'http://localhost:3000'}#invite` }
    }]);

    let message;
    const appUrl = process.env.APP_URL || 'http://localhost:3000';
    
    if (post.photo_url) {
      // Если фото загружено на наш сервер
      const fullPhotoUrl = `${appUrl}${post.photo_url}`;
      message = await bot.sendPhoto(channelId, fullPhotoUrl, {
        caption: caption,
        parse_mode: 'Markdown',
        ...keyboard
      });
    } else if (post.video_url) {
      // Если видео загружено на наш сервер
      const fullVideoUrl = `${appUrl}${post.video_url}`;
      message = await bot.sendVideo(channelId, fullVideoUrl, {
        caption: caption,
        parse_mode: 'Markdown',
        ...keyboard
      });
    } else {
      // Текстовый пост
      message = await bot.sendMessage(channelId, caption, {
        parse_mode: 'Markdown',
        ...keyboard
      });
    }

    // Сохраняем ID поста в канале
    db.run('UPDATE channel_posts SET post_id = ?, is_published = TRUE WHERE id = ?', 
      [message.message_id.toString(), post.id]);

    console.log('✅ Post published to channel:', post.title);
  } catch (error) {
    console.error('❌ Error publishing to channel:', error);
    
    // Если ошибка доступа, проверьте настройки бота
    if (error.response && error.response.statusCode === 403) {
      console.log('❌ Bot doesnt have permission to post in channel. Check bot admin rights.');
    }
  }
}

// Проверка прав бота в канале
async function checkBotRights() {
  try {
    const channel = process.env.CHANNEL_USERNAME;
    if (!channel) {
      console.log('⚠️ CHANNEL_USERNAME not set in .env');
      return;
    }

    // Пробуем отправить тестовое сообщение
    const testMessage = await bot.sendMessage(channel, 
      '🤖 Бот успешно подключен к каналу! Этот тестовое сообщение можно удалить.',
      { disable_notification: true }
    );
    
    // Удаляем тестовое сообщение
    await bot.deleteMessage(channel, testMessage.message_id);
    
    console.log('✅ Бот имеет права на публикацию в канале!');
  } catch (error) {
    console.log('❌ Ошибка доступа бота к каналу:', error.message);
    console.log('🔧 Проверьте:');
    console.log('   - Добавлен ли бот как администратор канала');
    console.log('   - Есть ли у бота права на публикацию сообщений');
    console.log('   - Правильный ли CHANNEL_USERNAME в .env файле');
  }
}

// Вызываем проверку при запуске
setTimeout(checkBotRights, 3000);

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
