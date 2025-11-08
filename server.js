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
import sharp from 'sharp';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const db = new sqlite3.Database(':memory:');

// Создаем папки для загрузок
const uploadsDir = join(__dirname, 'uploads');
const photosDir = join(uploadsDir, 'photos');
const previewsDir = join(uploadsDir, 'previews');

[uploadsDir, photosDir, previewsDir].forEach(dir => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
});

// Настройка multer для загрузки фотографий
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, photosDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname);
    cb(null, 'photo-' + uniqueSuffix + ext);
  }
});

const fileFilter = (req, file, cb) => {
  if (file.mimetype.startsWith('image/')) {
    cb(null, true);
  } else {
    cb(new Error('Только изображения разрешены'), false);
  }
};

const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  }
});

app.use(express.json({ limit: '50mb' }));
app.use(cors());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static(join(__dirname, 'public')));
app.use('/admin', express.static(join(__dirname, 'admin')));
app.use('/uploads', express.static(uploadsDir));

console.log('🎨 Мастерская Вдохновения - Запуск с системой загрузки фото...');

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
    available_buttons TEXT DEFAULT '["quiz","shop","invite","activities","marathon","photos"]',
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
    available_buttons TEXT DEFAULT '["quiz","shop","invite","activities","marathon","photos"]',
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
    perfect_reward REAL DEFAULT 5,
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
    total_questions INTEGER NOT NULL,
    sparks_earned REAL NOT NULL,
    perfect BOOLEAN DEFAULT FALSE,
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
    metadata TEXT DEFAULT '{}',
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
    type TEXT NOT NULL DEFAULT 'photo',
    file_path TEXT NOT NULL,
    preview_path TEXT,
    price REAL NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    created_by INTEGER,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  // Таблица покупок
  db.run(`CREATE TABLE purchases (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    item_id INTEGER NOT NULL,
    price_paid REAL NOT NULL,
    purchased_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users (user_id),
    FOREIGN KEY (item_id) REFERENCES shop_items (id)
  )`);

  // Таблица постов канала
  db.run(`CREATE TABLE channel_posts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    post_id TEXT UNIQUE,
    title TEXT NOT NULL,
    content TEXT,
    photo_path TEXT,
    buttons TEXT,
    requires_action BOOLEAN DEFAULT FALSE,
    action_type TEXT,
    action_target INTEGER,
    published_by INTEGER,
    published_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    is_published BOOLEAN DEFAULT FALSE,
    allow_comments BOOLEAN DEFAULT TRUE,
    allow_photos BOOLEAN DEFAULT FALSE
  )`);

  // Таблица комментариев (отзывов к постам)
  db.run(`CREATE TABLE comments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    post_id TEXT NOT NULL,
    comment_text TEXT NOT NULL,
    is_approved BOOLEAN DEFAULT FALSE,
    sparks_awarded BOOLEAN DEFAULT FALSE,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users (user_id)
  )`);

  // Таблица загруженных фото пользователей
  db.run(`CREATE TABLE user_photos (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    post_id TEXT,
    photo_path TEXT NOT NULL,
    description TEXT,
    is_approved BOOLEAN DEFAULT FALSE,
    sparks_awarded BOOLEAN DEFAULT FALSE,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users (user_id)
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

  // Таблица марафонов/челленджей
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
    joined_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    completed BOOLEAN DEFAULT FALSE,
    completed_at DATETIME,
    sparks_earned REAL DEFAULT 0,
    FOREIGN KEY (user_id) REFERENCES users (user_id),
    FOREIGN KEY (marathon_id) REFERENCES marathons (id),
    UNIQUE(user_id, marathon_id)
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
      sparks_reward: 1,
      perfect_reward: 5
    }
  ];
  
  const quizStmt = db.prepare("INSERT INTO quizzes (title, description, questions, sparks_reward, perfect_reward) VALUES (?, ?, ?, ?, ?)");
  testQuizzes.forEach(quiz => quizStmt.run([quiz.title, quiz.description, quiz.questions, quiz.sparks_reward, quiz.perfect_reward]));
  quizStmt.finalize();
  
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

function awardSparks(userId, sparks, description, activityType = 'other', metadata = {}) {
  db.run(`UPDATE users SET sparks = sparks + ?, last_active = CURRENT_TIMESTAMP WHERE user_id = ?`, [sparks, userId]);
  db.run(`INSERT INTO activities (user_id, activity_type, sparks_earned, description, metadata) VALUES (?, ?, ?, ?, ?)`,
    [userId, activityType, sparks, description, JSON.stringify(metadata)]);
}

// Функция создания превью изображения
async function createPreview(originalPath, previewPath) {
  try {
    await sharp(originalPath)
      .resize(400, 400, {
        fit: 'inside',
        withoutEnlargement: true
      })
      .jpeg({ quality: 80 })
      .toFile(previewPath);
    return true;
  } catch (error) {
    console.error('Error creating preview:', error);
    return false;
  }
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
    version: '6.0.0'
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
        
        if (isNewUser) {
          awardSparks(userId, 0, 'Регистрация в системе', 'registration');
          message = 'Регистрация успешна!';
        }
        
        res.json({ 
          success: true, 
          message: message,
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
      db.all(`SELECT quiz_id, completed_at, score, total_questions, perfect FROM quiz_completions WHERE user_id = ?`, [userId], (err, completions) => {
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
            next_available: completedAt ? new Date(completedAt.getTime() + cooldownMs) : null,
            previous_score: completion ? completion.score : null,
            previous_total: completion ? completion.total_questions : null,
            perfect: completion ? completion.perfect : false
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
        
        const perfect = correctAnswers === questions.length;
        let sparksEarned = 0;
        
        // Начисляем искры по новой системе
        if (correctAnswers > 0) {
          sparksEarned = quiz.sparks_reward; // 1 искра за любой правильный ответ
        }
        
        if (perfect) {
          sparksEarned += quiz.perfect_reward; // +5 искр за идеальное прохождение
        }
        
        // Сохраняем результат
        db.run(`INSERT OR REPLACE INTO quiz_completions (user_id, quiz_id, score, total_questions, sparks_earned, perfect) VALUES (?, ?, ?, ?, ?, ?)`,
          [userId, quizId, correctAnswers, questions.length, sparksEarned, perfect]);
        
        // Начисляем искры
        if (sparksEarned > 0) {
          awardSparks(userId, sparksEarned, `Квиз: ${quiz.title}`, 'quiz', {
            quiz_id: quizId,
            correct_answers: correctAnswers,
            total_questions: questions.length,
            perfect: perfect
          });
        }
        
        res.json({
          success: true,
          correctAnswers,
          totalQuestions: questions.length,
          sparksEarned,
          perfect: perfect,
          passed: correctAnswers > 0,
          message: perfect ? 
            `Идеально! Вы получили ${sparksEarned}✨ (${quiz.sparks_reward} + ${quiz.perfect_reward} за идеальный результат)` :
            correctAnswers > 0 ? 
              `Поздравляем! Вы получили ${sparksEarned}✨` : 
              'Попробуйте еще раз!'
        });
      });
    }
  );
});

// Загрузка фотографии пользователем
app.post('/api/webapp/photos/upload', upload.single('photo'), async (req, res) => {
  const { userId, postId, description } = req.body;
  
  console.log('📸 Загрузка фотографии пользователем:', { userId, postId });
  
  if (!userId || !req.file) {
    return res.status(400).json({ error: 'User ID and photo are required' });
  }
  
  try {
    const photoPath = req.file.path;
    const previewPath = join(previewsDir, 'preview-' + path.basename(photoPath));
    
    // Создаем превью
    await createPreview(photoPath, previewPath);
    
    // Сохраняем в базу
    db.run(`INSERT INTO user_photos (user_id, post_id, photo_path, description) VALUES (?, ?, ?, ?)`,
      [userId, postId, photoPath, description],
      function(err) {
        if (err) {
          console.error('❌ Error saving photo:', err);
          return res.status(500).json({ error: 'Error saving photo' });
        }
        
        res.json({
          success: true,
          message: 'Фотография загружена и отправлена на модерацию! После одобрения вы получите +3✨',
          photoId: this.lastID,
          sparksPotential: 3
        });
      }
    );
    
  } catch (error) {
    console.error('❌ Error processing photo:', error);
    res.status(500).json({ error: 'Error processing photo' });
  }
});

// Получение фотографий пользователя
app.get('/api/webapp/photos/:userId', (req, res) => {
  const userId = req.params.userId;
  
  db.all(`
    SELECT up.*, cp.title as post_title 
    FROM user_photos up 
    LEFT JOIN channel_posts cp ON up.post_id = cp.post_id 
    WHERE up.user_id = ? 
    ORDER BY up.created_at DESC
  `, [userId], (err, photos) => {
    if (err) return res.status(500).json({ error: 'Database error' });
    
    // Заменяем пути на URL
    const photosWithUrls = photos.map(photo => ({
      ...photo,
      photo_url: `/uploads/photos/${path.basename(photo.photo_path)}`,
      preview_url: `/uploads/previews/${path.basename(photo.photo_path).replace('photo-', 'preview-')}`
    }));
    
    res.json({ photos: photosWithUrls });
  });
});

// Получение ссылки для приглашения
app.get('/api/webapp/invite/:userId', (req, res) => {
  const userId = req.params.userId;
  const channelUsername = process.env.CHANNEL_USERNAME;
  
  if (!channelUsername) {
    return res.status(500).json({ error: 'Channel username not configured' });
  }
  
  const inviteLink = `https://t.me/${channelUsername.replace('@', '')}?start=invite_${userId}`;
  
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
        
        // Начисляем бонус пригласившему - 10 искр за приглашение
        awardSparks(inviterId, 10, 'Приглашение друга', 'invitation', {
          invited_user_id: invitedId,
          invited_username: invitedUsername
        });
        
        // Обновляем счетчик приглашений
        db.run(`UPDATE users SET invite_count = invite_count + 1 WHERE user_id = ?`, [inviterId]);
        
        res.json({
          success: true,
          message: 'Друг приглашен! +10✨',
          sparksEarned: 10
        });
      }
    );
  });
});

// Получение постов канала
app.get('/api/webapp/posts', (req, res) => {
  const { limit = 20, offset = 0 } = req.query;
  
  db.all(`
    SELECT * FROM channel_posts 
    WHERE is_published = TRUE 
    ORDER BY published_at DESC 
    LIMIT ? OFFSET ?
  `, [limit, offset], (err, posts) => {
    if (err) return res.status(500).json({ error: 'Database error' });
    
    const parsedPosts = posts.map(post => ({
      ...post,
      buttons: JSON.parse(post.buttons || '[]'),
      photo_url: post.photo_path ? `/uploads/photos/${path.basename(post.photo_path)}` : null
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
  
  // Проверяем, комментировал ли сегодня пользователь этот пост
  db.get(`SELECT * FROM comments WHERE user_id = ? AND post_id = ? AND DATE(created_at) = DATE('now')`, 
    [userId, postId], (err, todayComment) => {
    if (err) return res.status(500).json({ error: 'Database error' });
    
    if (todayComment) {
      return res.status(400).json({ error: 'Вы уже оставляли комментарий к этому посту сегодня' });
    }
    
    // Проверяем, комментировал ли вообще сегодня пользователь
    db.get(`SELECT * FROM comments WHERE user_id = ? AND DATE(created_at) = DATE('now') AND is_approved = TRUE`, 
      [userId], (err, dailyComment) => {
      if (err) return res.status(500).json({ error: 'Database error' });
      
      if (dailyComment) {
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
});

// Получение комментариев к посту
app.get('/api/webapp/posts/:postId/comments', (req, res) => {
  const { postId } = req.params;
  
  db.all(`
    SELECT c.*, u.tg_first_name, u.tg_username 
    FROM comments c 
    JOIN users u ON c.user_id = u.user_id 
    WHERE c.post_id = ? AND c.is_approved = TRUE 
    ORDER BY c.created_at DESC
  `, [postId], (err, comments) => {
    if (err) return res.status(500).json({ error: 'Database error' });
    res.json({ comments });
  });
});

// Магазин - получение товаров
app.get('/api/webapp/shop/items', (req, res) => {
  db.all("SELECT * FROM shop_items WHERE is_active = TRUE ORDER BY price ASC", (err, items) => {
    if (err) return res.status(500).json({ error: 'Database error' });
    
    const itemsWithUrls = items.map(item => ({
      ...item,
      file_url: `/uploads/photos/${path.basename(item.file_path)}`,
      preview_url: item.preview_path ? `/uploads/previews/${path.basename(item.preview_path)}` : null
    }));
    
    res.json(itemsWithUrls);
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
              
              awardSparks(userId, -item.price, `Покупка: ${item.title}`, 'purchase', {
                item_id: itemId,
                item_title: item.title
              });
              
              // Отправляем уведомление в Telegram о покупке
              sendPurchaseNotification(userId, item);
              
              res.json({
                success: true,
                message: 'Покупка успешно завершена! Товар доступен в вашей библиотеке.',
                item: {
                  ...item,
                  file_url: `/uploads/photos/${path.basename(item.file_path)}`
                },
                remainingSparks: user.sparks - item.price,
                purchaseId: this.lastID
              });
            });
          });
        });
      });
    });
  });
});

// Получение покупок пользователя
app.get('/api/webapp/shop/purchases/:userId', (req, res) => {
  const userId = req.params.userId;
  
  db.all(`
    SELECT p.*, si.title, si.description, si.type, si.file_path, si.preview_path
    FROM purchases p 
    JOIN shop_items si ON p.item_id = si.id 
    WHERE p.user_id = ? 
    ORDER BY p.purchased_at DESC
  `, [userId], (err, purchases) => {
    if (err) return res.status(500).json({ error: 'Database error' });
    
    const purchasesWithUrls = purchases.map(purchase => ({
      ...purchase,
      file_url: `/uploads/photos/${path.basename(purchase.file_path)}`,
      preview_url: purchase.preview_path ? `/uploads/previews/${path.basename(purchase.preview_path)}` : null
    }));
    
    res.json({ purchases: purchasesWithUrls });
  });
});

// Марафоны и челленджи
app.get('/api/webapp/marathons', (req, res) => {
  const userId = req.query.userId;
  
  db.all("SELECT * FROM marathons WHERE is_active = TRUE AND end_date > CURRENT_TIMESTAMP ORDER BY start_date DESC", (err, marathons) => {
    if (err) return res.status(500).json({ error: 'Database error' });
    
    if (userId) {
      db.all(`SELECT marathon_id, joined_at, completed FROM marathon_participations WHERE user_id = ?`, [userId], (err, participations) => {
        const marathonsWithStatus = marathons.map(marathon => {
          const participation = participations.find(p => p.marathon_id === marathon.id);
          return {
            ...marathon,
            participating: !!participation,
            joined_at: participation ? participation.joined_at : null,
            completed: participation ? participation.completed : false
          };
        });
        res.json(marathonsWithStatus);
      });
    } else {
      res.json(marathons);
    }
  });
});

// Участие в марафоне
app.post('/api/webapp/marathons/:marathonId/join', (req, res) => {
  const { marathonId } = req.params;
  const { userId } = req.body;
  
  console.log(`🏃 Участие в марафоне ${marathonId} пользователем ${userId}`);
  
  if (!userId) {
    return res.status(400).json({ error: 'User ID is required' });
  }
  
  db.get('SELECT * FROM marathon_participations WHERE user_id = ? AND marathon_id = ?', [userId, marathonId], (err, existingParticipation) => {
    if (err) return res.status(500).json({ error: 'Database error' });
    
    if (existingParticipation) {
      return res.status(400).json({ error: 'Вы уже участвуете в этом марафоне' });
    }
    
    db.run(`INSERT INTO marathon_participations (user_id, marathon_id) VALUES (?, ?)`,
      [userId, marathonId],
      function(err) {
        if (err) return res.status(500).json({ error: 'Error joining marathon' });
        
        res.json({
          success: true,
          message: 'Вы успешно присоединились к марафону!'
        });
      }
    );
  });
});

// Завершение марафона
app.post('/api/webapp/marathons/:marathonId/complete', (req, res) => {
  const { marathonId } = req.params;
  const { userId } = req.body;
  
  console.log(`🎯 Завершение марафона ${marathonId} пользователем ${userId}`);
  
  if (!userId) {
    return res.status(400).json({ error: 'User ID is required' });
  }
  
  db.get('SELECT * FROM marathon_participations WHERE user_id = ? AND marathon_id = ?', [userId, marathonId], (err, participation) => {
    if (err || !participation) {
      return res.status(404).json({ error: 'Участие в марафоне не найдено' });
    }
    
    if (participation.completed) {
      return res.status(400).json({ error: 'Марафон уже завершен' });
    }
    
    db.get('SELECT sparks_reward FROM marathons WHERE id = ?', [marathonId], (err, marathon) => {
      if (err || !marathon) {
        return res.status(404).json({ error: 'Марафон не найден' });
      }
      
      // Начисляем 7 искр за участие в марафоне
      db.run(`UPDATE marathon_participations SET completed = TRUE, completed_at = CURRENT_TIMESTAMP, sparks_earned = ? WHERE user_id = ? AND marathon_id = ?`,
        [marathon.sparks_reward, userId, marathonId]);
      
      awardSparks(userId, marathon.sparks_reward, `Участие в марафоне: ${marathon.title}`, 'marathon', {
        marathon_id: marathonId
      });
      
      res.json({
        success: true,
        message: `Марафон завершен! Вы получили ${marathon.sparks_reward}✨`,
        sparksEarned: marathon.sparks_reward
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
    new Promise(resolve => db.get('SELECT COUNT(*) as count FROM comments WHERE is_approved = FALSE', (err, row) => resolve(row.count))),
    new Promise(resolve => db.get('SELECT COUNT(*) as count FROM user_photos WHERE is_approved = FALSE', (err, row) => resolve(row.count))),
    new Promise(resolve => db.get('SELECT COUNT(*) as count FROM channel_posts WHERE is_published = TRUE', (err, row) => resolve(row.count)))
  ]).then(([totalUsers, activeQuizzes, activeCharacters, shopItems, totalSparks, pendingComments, pendingPhotos, totalPosts]) => {
    res.json({
      totalUsers,
      activeToday: totalUsers,
      totalPosts,
      pendingModeration: pendingComments + pendingPhotos,
      pendingComments,
      pendingPhotos,
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
  const { title, description, questions, sparks_reward, perfect_reward, cooldown_hours, is_active } = req.body;
  
  console.log('🎯 Создание квиза:', title);
  
  if (!title || !questions) {
    return res.status(400).json({ error: 'Title and questions are required' });
  }
  
  const questionsJson = JSON.stringify(questions);
  
  db.run(`INSERT INTO quizzes (title, description, questions, sparks_reward, perfect_reward, cooldown_hours, is_active) VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [title, description, questionsJson, sparks_reward || 1, perfect_reward || 5, cooldown_hours || 24, is_active !== false],
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

// Управление магазином - загрузка фото для товаров
app.post('/api/admin/shop/items', upload.single('photo'), requireAdmin, async (req, res) => {
  const { title, description, type, price } = req.body;
  
  console.log('🛒 Добавление товара:', title);
  
  if (!title || !req.file || !price) {
    return res.status(400).json({ error: 'Title, photo and price are required' });
  }
  
  try {
    const filePath = req.file.path;
    const previewPath = join(previewsDir, 'preview-' + path.basename(filePath));
    
    // Создаем превью
    await createPreview(filePath, previewPath);
    
    db.run(`INSERT INTO shop_items (title, description, type, file_path, preview_path, price, created_by) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [title, description, type || 'photo', filePath, previewPath, price, req.admin.user_id],
      function(err) {
        if (err) return res.status(500).json({ error: 'Error creating item' });
        
        res.json({
          success: true,
          message: 'Товар успешно добавлен',
          itemId: this.lastID
        });
      }
    );
    
  } catch (error) {
    console.error('❌ Error processing item photo:', error);
    res.status(500).json({ error: 'Error processing photo' });
  }
});

app.get('/api/admin/shop/items', requireAdmin, (req, res) => {
  db.all("SELECT * FROM shop_items ORDER BY created_at DESC", (err, items) => {
    if (err) return res.status(500).json({ error: 'Database error' });
    
    const itemsWithUrls = items.map(item => ({
      ...item,
      file_url: `/uploads/photos/${path.basename(item.file_path)}`,
      preview_url: item.preview_path ? `/uploads/previews/${path.basename(item.preview_path)}` : null
    }));
    
    res.json(itemsWithUrls);
  });
});

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

app.delete('/api/admin/shop/items/:id', requireAdmin, (req, res) => {
  const { id } = req.params;
  
  // Сначала получаем информацию о файле для удаления
  db.get('SELECT file_path, preview_path FROM shop_items WHERE id = ?', [id], (err, item) => {
    if (err) return res.status(500).json({ error: 'Database error' });
    
    // Удаляем файлы
    if (item && item.file_path && fs.existsSync(item.file_path)) {
      fs.unlinkSync(item.file_path);
    }
    if (item && item.preview_path && fs.existsSync(item.preview_path)) {
      fs.unlinkSync(item.preview_path);
    }
    
    // Удаляем запись из базы
    db.run(`DELETE FROM shop_items WHERE id = ?`, [id], function(err) {
      if (err) return res.status(500).json({ error: 'Database error' });
      
      res.json({
        success: true,
        message: 'Товар удален'
      });
    });
  });
});

// Управление постами - загрузка фото для постов
app.post('/api/admin/posts', upload.single('photo'), requireAdmin, async (req, res) => {
  const { title, content, buttons, requires_action, action_type, action_target, allow_comments, allow_photos } = req.body;
  
  console.log('📝 Создание поста:', title);
  
  if (!title) {
    return res.status(400).json({ error: 'Title is required' });
  }
  
  try {
    let photoPath = null;
    if (req.file) {
      photoPath = req.file.path;
    }
    
    const buttonsJson = JSON.stringify(buttons || []);
    
    db.run(`INSERT INTO channel_posts (title, content, photo_path, buttons, requires_action, action_type, action_target, published_by, allow_comments, allow_photos) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [title, content, photoPath, buttonsJson, requires_action, action_type, action_target, req.admin.user_id, allow_comments !== false, allow_photos || false],
      function(err) {
        if (err) return res.status(500).json({ error: 'Error creating post' });
        
        const postId = this.lastID;
        
        // Публикуем пост в канал
        db.get('SELECT * FROM channel_posts WHERE id = ?', [postId], (err, post) => {
          if (!err && post) {
            publishToChannel(post).then(() => {
              res.json({
                success: true,
                message: 'Пост успешно создан и опубликован в канал!',
                postId: postId
              });
            }).catch(error => {
              res.json({
                success: true,
                message: 'Пост создан, но возникла ошибка при публикации в канал',
                postId: postId,
                warning: error.message
              });
            });
          } else {
            res.json({
              success: true,
              message: 'Пост успешно создан',
              postId: postId
            });
          }
        });
      }
    );
    
  } catch (error) {
    console.error('❌ Error processing post photo:', error);
    res.status(500).json({ error: 'Error processing photo' });
  }
});

app.get('/api/admin/posts', requireAdmin, (req, res) => {
  db.all("SELECT * FROM channel_posts ORDER BY created_at DESC", (err, posts) => {
    if (err) return res.status(500).json({ error: 'Database error' });
    
    const parsed = posts.map(post => ({
      ...post,
      buttons: JSON.parse(post.buttons || '[]'),
      photo_url: post.photo_path ? `/uploads/photos/${path.basename(post.photo_path)}` : null
    }));
    
    res.json(parsed);
  });
});

// Модерация комментариев
app.get('/api/admin/comments', requireAdmin, (req, res) => {
  db.all(`
    SELECT c.*, u.tg_first_name, u.tg_username, cp.title as post_title
    FROM comments c 
    JOIN users u ON c.user_id = u.user_id 
    LEFT JOIN channel_posts cp ON c.post_id = cp.post_id
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
    
    // Одобряем комментарий и начисляем 1 искру
    db.run(`UPDATE comments SET is_approved = TRUE, sparks_awarded = TRUE WHERE id = ?`, [id]);
    awardSparks(comment.user_id, 1, 'Комментарий к посту одобрен', 'comment', {
      post_id: comment.post_id,
      comment_id: id
    });
    
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

// Модерация фотографий пользователей
app.get('/api/admin/photos', requireAdmin, (req, res) => {
  db.all(`
    SELECT up.*, u.tg_first_name, u.tg_username, cp.title as post_title
    FROM user_photos up 
    JOIN users u ON up.user_id = u.user_id 
    LEFT JOIN channel_posts cp ON up.post_id = cp.post_id
    WHERE up.is_approved = FALSE 
    ORDER BY up.created_at DESC
  `, (err, photos) => {
    if (err) return res.status(500).json({ error: 'Database error' });
    
    const photosWithUrls = photos.map(photo => ({
      ...photo,
      photo_url: `/uploads/photos/${path.basename(photo.photo_path)}`,
      preview_url: `/uploads/previews/${path.basename(photo.photo_path).replace('photo-', 'preview-')}`
    }));
    
    res.json(photosWithUrls);
  });
});

app.post('/api/admin/photos/:id/approve', requireAdmin, (req, res) => {
  const { id } = req.params;
  
  db.get('SELECT * FROM user_photos WHERE id = ?', [id], (err, photo) => {
    if (err || !photo) return res.status(404).json({ error: 'Photo not found' });
    
    if (photo.is_approved) {
      return res.status(400).json({ error: 'Photo already approved' });
    }
    
    // Одобряем фото и начисляем 3 искры
    db.run(`UPDATE user_photos SET is_approved = TRUE, sparks_awarded = TRUE WHERE id = ?`, [id]);
    awardSparks(photo.user_id, 3, 'Фотография одобрена', 'photo', {
      photo_id: id,
      post_id: photo.post_id
    });
    
    res.json({
      success: true,
      message: 'Фотография одобрена, пользователь получил +3✨'
    });
  });
});

app.post('/api/admin/photos/:id/reject', requireAdmin, (req, res) => {
  const { id } = req.params;
  
  db.get('SELECT photo_path FROM user_photos WHERE id = ?', [id], (err, photo) => {
    if (err) return res.status(500).json({ error: 'Database error' });
    
    // Удаляем файлы
    if (photo && photo.photo_path && fs.existsSync(photo.photo_path)) {
      fs.unlinkSync(photo.photo_path);
      
      // Удаляем превью если существует
      const previewPath = join(previewsDir, 'preview-' + path.basename(photo.photo_path));
      if (fs.existsSync(previewPath)) {
        fs.unlinkSync(previewPath);
      }
    }
    
    // Удаляем запись из базы
    db.run(`DELETE FROM user_photos WHERE id = ?`, [id], function(err) {
      if (err) return res.status(500).json({ error: 'Database error' });
      
      res.json({
        success: true,
        message: 'Фотография отклонена и удалена'
      });
    });
  });
});

// Управление марафонами
app.get('/api/admin/marathons', requireAdmin, (req, res) => {
  db.all("SELECT * FROM marathons ORDER BY created_at DESC", (err, marathons) => {
    if (err) return res.status(500).json({ error: 'Database error' });
    res.json(marathons);
  });
});

app.post('/api/admin/marathons', requireAdmin, (req, res) => {
  const { title, description, start_date, end_date, sparks_reward } = req.body;
  
  console.log('🏃 Создание марафона:', title);
  
  if (!title) {
    return res.status(400).json({ error: 'Title is required' });
  }
  
  db.run(`INSERT INTO marathons (title, description, start_date, end_date, sparks_reward) VALUES (?, ?, ?, ?, ?)`,
    [title, description, start_date, end_date, sparks_reward || 7],
    function(err) {
      if (err) return res.status(500).json({ error: 'Error creating marathon' });
      
      res.json({
        success: true,
        message: 'Марафон успешно создан',
        marathonId: this.lastID
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

// ==================== TELEGRAM BOT ФУНКЦИИ ====================

const bot = new TelegramBot(process.env.BOT_TOKEN, { polling: true });

// Функция отправки уведомления о покупке
function sendPurchaseNotification(userId, item) {
  db.get('SELECT * FROM users WHERE user_id = ?', [userId], (err, user) => {
    if (err || !user) return;
    
    const message = `🎉 Поздравляем с покупкой!

Вы приобрели: *${item.title}*

📁 Тип: ${getItemTypeName(item.type)}
💰 Стоимость: ${item.price}✨

Ваш товар доступен в разделе "Мои покупки" в личном кабинете.

Приятного использования! 🎨`;
    
    try {
      bot.sendMessage(userId, message, { parse_mode: 'Markdown' });
    } catch (error) {
      console.log('Cannot send purchase notification:', error.message);
    }
  });
}

function getItemTypeName(type) {
  const types = {
    'photo': 'Фотография',
    'ebook': 'Электронная книга',
    'course': 'Курс',
    'material': 'Материалы'
  };
  return types[type] || type;
}

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

    // Добавляем кнопку "Написать отзыв" если разрешены комментарии
    if (post.allow_comments) {
      keyboard.inline_keyboard.push([{
        text: "💬 Написать отзыв",
        web_app: { url: `${process.env.APP_URL || 'http://localhost:3000'}#comment?postId=${post.post_id || post.id}` }
      }]);
    }

    // Добавляем кнопку "Прикрепить фото" если разрешены фото
    if (post.allow_photos) {
      keyboard.inline_keyboard.push([{
        text: "📸 Прикрепить фото",
        web_app: { url: `${process.env.APP_URL || 'http://localhost:3000'}#photos?postId=${post.post_id || post.id}` }
      }]);
    }

    let message;
    if (post.photo_path) {
      const photoPath = join(__dirname, post.photo_path);
      message = await bot.sendPhoto(channelId, photoPath, {
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
    throw error;
  }
}

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
• 🏃 Участвовать в марафонах
• 📸 Прикреплять фото и получать искры

Нажмите кнопку ниже чтобы начать!`;
  
  // Обработка приглашения
  if (inviteCode && inviteCode !== userId.toString()) {
    db.get('SELECT * FROM users WHERE user_id = ?', [inviteCode], (err, inviter) => {
      if (!err && inviter) {
        db.run(`INSERT OR IGNORE INTO invitations (inviter_id, invited_id, invited_username) VALUES (?, ?, ?)`,
          [inviteCode, userId, msg.from.username],
          function() {
            if (this.changes > 0) {
              awardSparks(inviteCode, 10, 'Приглашение друга', 'invitation', {
                invited_user_id: userId,
                invited_username: msg.from.username
              });
              db.run(`UPDATE users SET invite_count = invite_count + 1 WHERE user_id = ?`, [inviteCode]);
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

// ==================== SERVER START ====================

const PORT = process.env.PORT || 3000;

app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Сервер запущен на порту ${PORT}`);
  console.log(`📱 Mini App: ${process.env.APP_URL || `http://localhost:${PORT}`}`);
  console.log(`🔧 Admin Panel: ${process.env.APP_URL || `http://localhost:${PORT}`}/admin`);
  console.log('✅ Все системы работают');
  console.log('📊 Система начисления искр:');
  console.log('   🎯 Квиз (1 правильный ответ): 1 искра');
  console.log('   ⭐ Идеальный квиз: +5 искр');
  console.log('   💬 Комментарий к посту: 1 искра (1 раз в день)');
  console.log('   📸 Фотография: 3 искры (после модерации)');
  console.log('   👥 Приглашение друга: 10 искр');
  console.log('   🏃 Участие в марафоне: 7 искр');
}).on('error', (err) => {
  console.error('❌ Server error:', err);
});
