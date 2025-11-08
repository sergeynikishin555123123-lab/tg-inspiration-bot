
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

console.log('🎨 Мастерская Вдохновения - Запуск полной версии...');

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
    total_activities INTEGER DEFAULT 0
  )`);
  
  // Таблица классов (ролей)
  db.run(`CREATE TABLE classes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,
    description TEXT,
    icon TEXT,
    available_buttons TEXT DEFAULT '["quiz","photo_work","shop","invite","activities"]',
    is_active BOOLEAN DEFAULT TRUE,
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
    available_buttons TEXT DEFAULT '["quiz","photo_work","shop","invite","activities"]',
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
    purchased_at DATETIME DEFAULT CURRENT_TIMESTAMP
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
    requires_action BOOLEAN DEFAULT FALSE,
    action_type TEXT,
    action_target INTEGER,
    published_by INTEGER,
    published_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    is_published BOOLEAN DEFAULT FALSE
  )`);

  // Таблица комментариев (отзывов)
  db.run(`CREATE TABLE comments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    post_id TEXT,
    comment_text TEXT NOT NULL,
    is_approved BOOLEAN DEFAULT FALSE,
    sparks_awarded BOOLEAN DEFAULT FALSE,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
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

  // Заполняем классы (роли)
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
    },
    {
      title: "🏛️ История искусства",
      description: "Тест по истории мирового искусства",
      questions: JSON.stringify([
        {
          question: "В какой стране зародился стиль барокко?",
          options: ["Франция", "Италия", "Испания", "Германия"],
          correctAnswer: 1
        }
      ]),
      sparks_reward: 3
    }
  ];
  
  const quizStmt = db.prepare("INSERT INTO quizzes (title, description, questions, sparks_reward) VALUES (?, ?, ?, ?)");
  testQuizzes.forEach(quiz => quizStmt.run([quiz.title, quiz.description, quiz.questions, quiz.sparks_reward]));
  quizStmt.finalize();

  // Добавляем тестовые товары
  const shopStmt = db.prepare("INSERT INTO shop_items (title, description, type, file_url, preview_url, price) VALUES (?, ?, ?, ?, ?, ?)");
  shopStmt.run(['🎨 Урок акварели', 'Видеоурок по основам акварели', 'video', 'https://example.com/video1.mp4', 'https://example.com/preview1.jpg', 15]);
  shopStmt.run(['📚 Основы композиции', 'Как правильно составлять композицию', 'ebook', 'https://example.com/ebook1.pdf', 'https://example.com/preview2.jpg', 10]);
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
    version: '4.0.0'
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
            char.available_buttons as character_buttons
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
  
  // Проверяем, новый ли пользователь
  db.get('SELECT is_registered FROM users WHERE user_id = ?', [userId], (err, existingUser) => {
    if (err) {
      return res.status(500).json({ error: 'Database error' });
    }
    
    const isNewUser = !existingUser || !existingUser.is_registered;
    
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
        
        let message = 'Данные обновлены!';
        let sparksAdded = 0;
        
        if (isNewUser) {
          sparksAdded = 5;
          db.run(`UPDATE users SET sparks = sparks + ? WHERE user_id = ?`, [sparksAdded, userId]);
          db.run(`INSERT INTO activities (user_id, activity_type, sparks_earned, description) VALUES (?, 'registration', ?, 'Регистрация в системе')`, [userId, sparksAdded]);
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
      grouped[char.class_name].push({
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
        
        const passThreshold = Math.ceil(questions.length * 0.6);
        const sparksEarned = correctAnswers >= passThreshold ? quiz.sparks_reward : 0;
        
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
        
        // Начисляем бонус пригласившему
        const bonusSparks = 5;
        db.run(`UPDATE users SET sparks = sparks + ?, invite_count = invite_count + 1 WHERE user_id = ?`, 
          [bonusSparks, inviterId]);
        
        db.run(`INSERT INTO activities (user_id, activity_type, sparks_earned, description) VALUES (?, 'invitation', ?, 'Приглашение друга')`,
          [inviterId, bonusSparks]);
        
        res.json({
          success: true,
          message: 'Друг приглашен! +5✨',
          sparksEarned: bonusSparks
        });
      }
    );
  });
});

// Отправка комментария (отзыва)
app.post('/api/webapp/comments', (req, res) => {
  const { userId, postId, commentText } = req.body;
  
  console.log('💬 Отправка комментария от пользователя:', userId);
  
  if (!userId || !commentText) {
    return res.status(400).json({ error: 'User ID and comment text are required' });
  }
  
  // Проверяем, комментировал ли сегодня пользователь
  db.get(`SELECT * FROM comments WHERE user_id = ? AND DATE(created_at) = DATE('now') AND is_approved = TRUE`, 
    [userId], (err, todayComment) => {
    if (err) return res.status(500).json({ error: 'Database error' });
    
    if (todayComment) {
      return res.json({
        success: true,
        message: 'Комментарий отправлен на модерацию (бонус за сегодня уже получен)',
        sparksAwarded: 0
      });
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

// Магазин
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
    new Promise(resolve => db.get('SELECT SUM(sparks) as total FROM users', (err, row) => resolve(row.total || 0))),
    new Promise(resolve => db.get('SELECT COUNT(*) as count FROM comments WHERE is_approved = FALSE', (err, row) => resolve(row.count)))
  ]).then(([totalUsers, activeQuizzes, activeCharacters, shopItems, totalSparks, pendingComments]) => {
    res.json({
      totalUsers,
      activeToday: totalUsers,
      totalPosts: 0,
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
  const { name, description, icon, available_buttons } = req.body;
  
  console.log('🎯 Добавление класса:', name);
  
  if (!name) {
    return res.status(400).json({ error: 'Название класса обязательно' });
  }
  
  const buttonsJson = JSON.stringify(available_buttons || []);
  
  db.run(`INSERT INTO classes (name, description, icon, available_buttons) VALUES (?, ?, ?, ?)`,
    [name, description, icon, buttonsJson],
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
  const { name, description, icon, available_buttons, is_active } = req.body;
  
  const buttonsJson = JSON.stringify(available_buttons || []);
  
  db.run(`UPDATE classes SET name=?, description=?, icon=?, available_buttons=?, is_active=? WHERE id=?`,
    [name, description, icon, buttonsJson, is_active, id],
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

// Управление постами
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

app.post('/api/admin/posts', requireAdmin, (req, res) => {
  const { title, content, photo_url, video_url, buttons, requires_action, action_type, action_target } = req.body;
  
  console.log('📝 Создание поста:', title);
  
  if (!title) {
    return res.status(400).json({ error: 'Title is required' });
  }
  
  const buttonsJson = JSON.stringify(buttons || []);
  
  db.run(`INSERT INTO channel_posts (title, content, photo_url, video_url, buttons, requires_action, action_type, action_target, published_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [title, content, photo_url, video_url, buttonsJson, requires_action, action_type, action_target, req.admin.user_id],
    function(err) {
      if (err) return res.status(500).json({ error: 'Error creating post' });
      
      res.json({
        success: true,
        message: 'Пост успешно создан',
        postId: this.lastID
      });
    }
  );
});

// Модерация комментариев
app.get('/api/admin/comments', requireAdmin, (req, res) => {
  db.all(`
    SELECT c.*, u.tg_first_name, u.tg_username 
    FROM comments c 
    JOIN users u ON c.user_id = u.user_id 
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
    db.run(`UPDATE users SET sparks = sparks + 1 WHERE user_id = ?`, [comment.user_id]);
    db.run(`INSERT INTO activities (user_id, activity_type, sparks_earned, description) VALUES (?, 'comment', 1, 'Комментарий одобрен')`,
      [comment.user_id]);
    
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

// Обработка команды /start с приглашением
bot.onText(/\/start(?:\s+invite_(\d+))?/, (msg, match) => {
  const chatId = msg.chat.id;
  const name = msg.from.first_name || 'Друг';
  const userId = msg.from.id;
  const inviteCode = match ? match[1] : null;
  
  let welcomeText = `🎨 Привет, ${name}!

Добро пожаловать в **Мастерская Вдохновения**!

✨ Откройте личный кабинет чтобы:
• 🎯 Проходить квизы и получать искры
• 👥 Выбрать своего персонажа  
• 🛒 Покупать обучающие материалы
• 📊 Отслеживать свой прогресс
• 💬 Оставлять отзывы и получать награды
• 👥 Приглашать друзей и получать бонусы

Нажмите кнопку ниже чтобы начать!`;
  
  // Обработка приглашения
  if (inviteCode && inviteCode !== userId.toString()) {
    db.get('SELECT * FROM users WHERE user_id = ?', [inviteCode], (err, inviter) => {
      if (!err && inviter) {
        db.run(`INSERT OR IGNORE INTO invitations (inviter_id, invited_id, invited_username) VALUES (?, ?, ?)`,
          [inviteCode, userId, msg.from.username],
          function() {
            if (this.changes > 0) {
              db.run(`UPDATE users SET sparks = sparks + 5, invite_count = invite_count + 1 WHERE user_id = ?`, [inviteCode]);
              db.run(`INSERT INTO activities (user_id, activity_type, sparks_earned, description) VALUES (?, 'invitation', 5, 'Приглашение друга')`, [inviteCode]);
              console.log(`✅ User ${userId} invited by ${inviteCode}`);
            }
          }
        );
      }
    });
  }
  
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
    bot.sendMessage(chatId, `🔧 Панель администратора\n\nДоступ: ${admin.role}\n\n${adminUrl}`);
  });
});

// Публикация постов в канал
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
      inline_keyboard: []
    };

    // Добавляем кнопки из поста
    buttons.forEach(button => {
      keyboard.inline_keyboard.push([{
        text: button.text,
        url: button.url
      }]);
    });

    // Добавляем кнопку "Пройти квиз" если требуется действие
    if (post.requires_action && post.action_type === 'quiz') {
      const appUrl = process.env.APP_URL || 'http://localhost:3000';
      keyboard.inline_keyboard.push([{
        text: "🎯 Пройти квиз",
        web_app: { url: `${appUrl}#quizzes` }
      }]);
    }

    // Добавляем кнопку "Пригласить друга"
    keyboard.inline_keyboard.push([{
      text: "👥 Пригласить друга",
      web_app: { url: `${process.env.APP_URL || 'http://localhost:3000'}#invite` }
    }]);

    let message;
    if (post.photo_url) {
      message = await bot.sendPhoto(channelId, post.photo_url, {
        caption: caption,
        parse_mode: 'Markdown',
        reply_markup: keyboard
      });
    } else if (post.video_url) {
      message = await bot.sendVideo(channelId, post.video_url, {
        caption: caption,
        parse_mode: 'Markdown',
        reply_markup: keyboard
      });
    } else {
      message = await bot.sendMessage(channelId, caption, {
        parse_mode: 'Markdown',
        reply_markup: keyboard
      });
    }

    // Сохраняем ID поста в канале
    db.run('UPDATE channel_posts SET post_id = ?, is_published = TRUE WHERE id = ?', 
      [message.message_id.toString(), post.id]);

    console.log('✅ Post published to channel:', post.title);
  } catch (error) {
    console.error('❌ Error publishing to channel:', error);
  }
}

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
