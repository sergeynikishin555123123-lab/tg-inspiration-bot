import express from 'express';
import TelegramBot from 'node-telegram-bot-api';
import cors from 'cors';
import bodyParser from 'body-parser';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import dotenv from 'dotenv';
import sqlite3 from 'sqlite3';
import { promisify } from 'util';

// Загрузка переменных окружения
dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();

// Middleware
app.use(express.json({ limit: '50mb' }));
app.use(cors());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static(join(__dirname, 'public')));
app.use('/admin', express.static(join(__dirname, 'admin')));

console.log('🎨 Мастерская Вдохновения - Запуск...');

// Проверка обязательных переменных
if (!process.env.BOT_TOKEN) {
  console.error('❌ BOT_TOKEN не найден в .env файле!');
  process.exit(1);
}

// Инициализация базы данных
const dbPath = join(process.cwd(), 'inspiration.db');
console.log('📊 Database path:', dbPath);

const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('❌ Error opening database:', err.message);
    console.log('🔄 Using in-memory database...');
  } else {
    console.log('✅ Connected to SQLite database');
  }
});

// Промисфикация методов базы данных
const dbRun = promisify(db.run.bind(db));
const dbGet = promisify(db.get.bind(db));
const dbAll = promisify(db.all.bind(db));

// ==================== ИНИЦИАЛИЗАЦИЯ БАЗЫ ДАННЫХ ====================

async function initializeDatabase() {
  try {
    console.log('📊 Инициализация таблиц...');
    
    // Таблица пользователей
    await dbRun(`CREATE TABLE IF NOT EXISTS users (
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
    await dbRun(`CREATE TABLE IF NOT EXISTS characters (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      class TEXT NOT NULL,
      character_name TEXT NOT NULL,
      description TEXT,
      bonus_type TEXT NOT NULL,
      bonus_value TEXT NOT NULL,
      available_buttons TEXT DEFAULT '[]',
      is_active BOOLEAN DEFAULT TRUE,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);
    
    // Таблица квизов
    await dbRun(`CREATE TABLE IF NOT EXISTS quizzes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      description TEXT,
      questions TEXT NOT NULL,
      sparks_reward REAL DEFAULT 1,
      cooldown_hours INTEGER DEFAULT 24,
      is_active BOOLEAN DEFAULT TRUE,
      post_id TEXT,
      created_by INTEGER,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

    // Таблица пройденных квизов
    await dbRun(`CREATE TABLE IF NOT EXISTS quiz_completions (
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
    await dbRun(`CREATE TABLE IF NOT EXISTS activities (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      activity_type TEXT NOT NULL,
      sparks_earned REAL NOT NULL,
      description TEXT,
      metadata TEXT DEFAULT '{}',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users (user_id)
    )`);

    // Таблица админов
    await dbRun(`CREATE TABLE IF NOT EXISTS admins (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER UNIQUE NOT NULL,
      username TEXT,
      role TEXT DEFAULT 'moderator',
      permissions TEXT DEFAULT '{}',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

    // Проверяем и заполняем персонажей
    const charCount = await dbGet("SELECT COUNT(*) as count FROM characters");
    if (charCount.count === 0) {
      console.log('👥 Добавление персонажей по умолчанию...');
      
      const characters = [
        ['Художники', 'Лука Цветной', 'Рисует с детства, любит эксперименты с цветом', 'percent_bonus', '10', '["quiz","photo_work","shop","invite","activities"]'],
        ['Художники', 'Марина Кисть', 'Строгая преподавательница академической живописи', 'forgiveness', '1', '["quiz","photo_work","invite","activities"]'],
        ['Художники', 'Феликс Штрих', 'Экспериментатор, мастер зарисовок', 'random_gift', '1-3', '["quiz","photo_work","shop","activities"]'],
        ['Стилисты', 'Эстелла Моде', 'Бывший стилист, обучает восприятию образа', 'percent_bonus', '5', '["quiz","shop","invite","activities"]'],
        ['Стилисты', 'Роза Ателье', 'Мастер практического шитья', 'secret_advice', '2weeks', '["photo_work","shop","activities"]'],
        ['Стилисты', 'Гертруда Линия', 'Ценит детали и аксессуары', 'series_bonus', '1', '["quiz","photo_work","invite","activities"]'],
        ['Мастера', 'Тихон Творец', 'Ремесленник, любит простые техники', 'photo_bonus', '1', '["photo_work","shop","activities"]'],
        ['Мастера', 'Агата Узор', 'Любит неожиданные материалы', 'weekly_surprise', '6', '["quiz","photo_work","shop","activities"]'],
        ['Мастера', 'Борис Клей', 'Весёлый мастер импровизаций', 'mini_quest', '2', '["quiz","shop","invite","activities"]'],
        ['Историки', 'Профессор Артёмий', 'Любитель архивов и фактов', 'quiz_hint', '1', '["quiz","activities","invite"]'],
        ['Историки', 'Соня Гравюра', 'Рассказывает истории картин', 'fact_star', '1', '["quiz","photo_work","activities"]'],
        ['Историки', 'Михаил Эпоха', 'Любит хронологию и эпохи', 'streak_multiplier', '2', '["quiz","shop","invite","activities"]']
      ];
      
      const stmt = db.prepare("INSERT INTO characters (class, character_name, description, bonus_type, bonus_value, available_buttons) VALUES (?, ?, ?, ?, ?, ?)");
      for (const char of characters) {
        await new Promise((resolve, reject) => {
          stmt.run(char, function(err) {
            if (err) reject(err);
            else resolve();
          });
        });
      }
      stmt.finalize();
      console.log('✅ Персонажи добавлены');
    }

    // Добавляем тестового админа
    if (process.env.ADMIN_ID) {
      await dbRun("INSERT OR IGNORE INTO admins (user_id, username, role) VALUES (?, ?, ?)", 
        [process.env.ADMIN_ID, 'admin', 'superadmin']);
      console.log('✅ Админ добавлен:', process.env.ADMIN_ID);
    }

    // Добавляем тестовые квизы
    const quizCount = await dbGet("SELECT COUNT(*) as count FROM quizzes");
    if (quizCount.count === 0) {
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
          sparks_reward: 2,
          cooldown_hours: 24
        }
      ];
      
      for (const quiz of testQuizzes) {
        await dbRun(
          "INSERT INTO quizzes (title, description, questions, sparks_reward, cooldown_hours) VALUES (?, ?, ?, ?, ?)",
          [quiz.title, quiz.description, quiz.questions, quiz.sparks_reward, quiz.cooldown_hours]
        );
      }
      console.log('✅ Тестовые квизы добавлены');
    }
    
    console.log('✅ База данных готова');
  } catch (error) {
    console.error('❌ Database initialization error:', error);
  }
}

// ==================== UTILITY FUNCTIONS ====================

function calculateLevel(sparks) {
  if (sparks >= 400) return 'Наставник';
  if (sparks >= 300) return 'Мастер';
  if (sparks >= 150) return 'Знаток';
  if (sparks >= 50) return 'Искатель';
  return 'Ученик';
}

// ==================== MIDDLEWARE ====================

const requireAdmin = async (req, res, next) => {
  try {
    const userId = req.headers['x-user-id'] || req.query.userId || req.body.userId;
    
    if (!userId) {
      return res.status(401).json({ error: 'User ID required' });
    }
    
    const admin = await dbGet('SELECT * FROM admins WHERE user_id = ?', [userId]);
    
    if (!admin) {
      return res.status(403).json({ error: 'Admin access required' });
    }
    
    req.admin = admin;
    next();
  } catch (error) {
    console.error('Admin middleware error:', error);
    res.status(500).json({ error: 'Database error' });
  }
};

// ==================== BASIC API ROUTES ====================

app.get('/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    message: '✅ Сервер работает!',
    timestamp: new Date().toISOString()
  });
});

app.get('/', (req, res) => {
  res.sendFile(join(__dirname, 'public', 'index.html'));
});

app.get('/admin', (req, res) => {
  res.sendFile(join(__dirname, 'admin', 'index.html'));
});

// ==================== WEBAPP API ROUTES ====================

// Получение персонажей с группировкой по классам
app.get('/api/webapp/characters', async (req, res) => {
  try {
    const characters = await dbAll('SELECT * FROM characters WHERE is_active = TRUE ORDER BY class, character_name');
    
    const groupedCharacters = {};
    characters.forEach(character => {
      if (!groupedCharacters[character.class]) {
        groupedCharacters[character.class] = [];
      }
      groupedCharacters[character.class].push({
        ...character,
        available_buttons: JSON.parse(character.available_buttons || '[]')
      });
    });
    
    res.json(groupedCharacters);
  } catch (error) {
    console.error('❌ Database error:', error);
    res.status(500).json({ error: 'Database error' });
  }
});

// Получение списка классов
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

// Получение данных пользователя
app.get('/api/users/:userId', async (req, res) => {
  try {
    const userId = req.params.userId;
    
    const user = await dbGet(
      `SELECT u.*, c.character_name, c.class, c.bonus_type, c.bonus_value, c.available_buttons
       FROM users u 
       LEFT JOIN characters c ON u.character_id = c.id 
       WHERE u.user_id = ?`,
      [userId]
    );
    
    if (user) {
      user.level = calculateLevel(user.sparks);
      user.available_buttons = JSON.parse(user.available_buttons || '[]');
      res.json({ exists: true, user });
    } else {
      // Создаем нового пользователя
      const tgFirstName = 'Новый пользователь';
      await dbRun(
        `INSERT INTO users (user_id, tg_first_name, sparks, level) VALUES (?, ?, 0, 'Ученик')`,
        [userId, tgFirstName]
      );
      
      res.json({ 
        exists: false, 
        user: {
          user_id: parseInt(userId),
          sparks: 0,
          level: 'Ученик',
          is_registered: false,
          class: null,
          character_id: null,
          character_name: null,
          tg_first_name: tgFirstName,
          available_buttons: [],
          invite_count: 0
        }
      });
    }
  } catch (error) {
    console.error('❌ User API error:', error);
    res.status(500).json({ error: 'Database error' });
  }
});

// Регистрация пользователя
app.post('/api/users/register', async (req, res) => {
  try {
    const { userId, userClass, characterId, tgUsername, tgFirstName, tgLastName } = req.body;
    
    console.log('📝 Регистрация пользователя:', { userId, userClass, characterId });
    
    if (!userId || !userClass || !characterId) {
      return res.status(400).json({ error: 'User ID, class and character are required' });
    }
    
    // Получаем текущие данные пользователя
    const existingUser = await dbGet('SELECT * FROM users WHERE user_id = ?', [userId]);
    
    const isNewUser = !existingUser;
    const isFirstRegistration = !existingUser || !existingUser.is_registered;
    
    // Получаем данные персонажа для available_buttons
    const character = await dbGet('SELECT available_buttons FROM characters WHERE id = ?', [characterId]);
    const availableButtons = character ? character.available_buttons : '[]';
    
    if (isNewUser) {
      // Создаем нового пользователя
      await dbRun(
        `INSERT INTO users (
          user_id, tg_username, tg_first_name, tg_last_name, 
          class, character_id, is_registered, sparks, level, available_buttons
        ) VALUES (?, ?, ?, ?, ?, ?, TRUE, 5, 'Ученик', ?)`,
        [userId, tgUsername, tgFirstName, tgLastName, userClass, characterId, availableButtons]
      );
      
      // Записываем активность регистрации
      await dbRun(
        `INSERT INTO activities (user_id, activity_type, sparks_earned, description) 
         VALUES (?, 'registration', 5, 'Регистрация в системе')`,
        [userId]
      );
      
      res.json({ 
        success: true, 
        message: 'Регистрация успешна! +5✨',
        sparksAdded: 5,
        isNewRegistration: true
      });
    } else {
      // Обновляем существующего пользователя
      const newSparks = isFirstRegistration ? (existingUser.sparks || 0) + 5 : existingUser.sparks;
      
      await dbRun(
        `UPDATE users SET 
          tg_username = ?, tg_first_name = ?, tg_last_name = ?,
          class = ?, character_id = ?, is_registered = TRUE, 
          sparks = ?, available_buttons = ?, last_active = CURRENT_TIMESTAMP
         WHERE user_id = ?`,
        [tgUsername, tgFirstName, tgLastName, userClass, characterId, newSparks, availableButtons, userId]
      );
      
      if (isFirstRegistration) {
        // Записываем активность регистрации
        await dbRun(
          `INSERT INTO activities (user_id, activity_type, sparks_earned, description) 
           VALUES (?, 'registration', 5, 'Регистрация в системе')`,
          [userId]
        );
      }
      
      res.json({ 
        success: true, 
        message: isFirstRegistration ? 'Регистрация успешна! +5✨' : 'Персонаж успешно изменен!',
        sparksAdded: isFirstRegistration ? 5 : 0,
        isNewRegistration: isFirstRegistration
      });
    }
  } catch (error) {
    console.error('❌ Registration error:', error);
    res.status(500).json({ error: 'Database error' });
  }
});

// Получение квизов
app.get('/api/webapp/quizzes', async (req, res) => {
  try {
    const userId = req.query.userId;
    const quizzes = await dbAll("SELECT * FROM quizzes WHERE is_active = TRUE ORDER BY created_at DESC");
    
    const parsedQuizzes = quizzes.map(quiz => ({
      ...quiz,
      questions: JSON.parse(quiz.questions || '[]')
    }));
    
    // Если передан userId, проверяем пройденные квизы
    if (userId) {
      const completions = await dbAll(
        `SELECT quiz_id, completed_at, sparks_earned 
         FROM quiz_completions 
         WHERE user_id = ?`,
        [userId]
      );
      
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
          sparks_earned: completion ? completion.sparks_earned : 0
        };
      });
      
      res.json(quizzesWithStatus);
    } else {
      res.json(parsedQuizzes);
    }
  } catch (error) {
    console.error('❌ Quizzes API error:', error);
    res.status(500).json({ error: 'Database error' });
  }
});

// Запуск квиза
app.get('/api/webapp/quizzes/:quizId', async (req, res) => {
  try {
    const { quizId } = req.params;
    const { userId } = req.query;
    
    const quiz = await dbGet("SELECT * FROM quizzes WHERE id = ? AND is_active = TRUE", [quizId]);
    
    if (!quiz) {
      return res.status(404).json({ error: 'Quiz not found' });
    }
    
    const quizData = {
      ...quiz,
      questions: JSON.parse(quiz.questions || '[]')
    };
    
    // Проверяем возможность прохождения
    if (userId) {
      const completion = await dbGet(
        `SELECT completed_at FROM quiz_completions 
         WHERE user_id = ? AND quiz_id = ?`,
        [userId, quizId]
      );
      
      if (completion) {
        const completedAt = new Date(completion.completed_at);
        const cooldownMs = quiz.cooldown_hours * 60 * 60 * 1000;
        const canRetake = (Date.now() - completedAt.getTime()) > cooldownMs;
        
        quizData.can_retake = canRetake;
        quizData.completed = true;
        quizData.next_available = new Date(completedAt.getTime() + cooldownMs);
      }
    }
    
    res.json(quizData);
  } catch (error) {
    console.error('❌ Quiz API error:', error);
    res.status(500).json({ error: 'Database error' });
  }
});

// Отправка ответов на квиз
app.post('/api/webapp/quizzes/:quizId/submit', async (req, res) => {
  try {
    const { quizId } = req.params;
    const { userId, answers } = req.body;
    
    console.log(`📝 Отправка ответов на квиз ${quizId} от пользователя ${userId}`);
    
    if (!userId || !answers) {
      return res.status(400).json({ error: 'User ID and answers are required' });
    }
    
    // Получаем данные квиза
    const quiz = await dbGet("SELECT * FROM quizzes WHERE id = ?", [quizId]);
    if (!quiz) {
      return res.status(404).json({ error: 'Quiz not found' });
    }
    
    const questions = JSON.parse(quiz.questions || '[]');
    let correctAnswers = 0;
    
    // Проверяем ответы
    questions.forEach((question, index) => {
      if (answers[index] === question.correctAnswer) {
        correctAnswers++;
      }
    });
    
    // Начисляем искры
    const passThreshold = Math.ceil(questions.length * 0.6);
    let sparksEarned = 0;
    
    if (correctAnswers >= passThreshold) {
      sparksEarned = quiz.sparks_reward;
    }
    
    // Получаем данные пользователя
    const user = await dbGet('SELECT sparks FROM users WHERE user_id = ?', [userId]);
    const newSparks = (user?.sparks || 0) + sparksEarned;
    
    // Сохраняем результат прохождения
    await dbRun(
      `INSERT OR REPLACE INTO quiz_completions (user_id, quiz_id, completed_at, score, sparks_earned) 
       VALUES (?, ?, CURRENT_TIMESTAMP, ?, ?)`,
      [userId, quizId, correctAnswers, sparksEarned]
    );
    
    // Обновляем искры пользователя
    await dbRun(
      `UPDATE users SET sparks = ?, last_active = CURRENT_TIMESTAMP WHERE user_id = ?`,
      [newSparks, userId]
    );
    
    // Записываем активность
    if (sparksEarned > 0) {
      await dbRun(
        `INSERT INTO activities (user_id, activity_type, sparks_earned, description) 
         VALUES (?, 'quiz', ?, ?)`,
        [userId, sparksEarned, `Квиз: ${quiz.title}`]
      );
    }
    
    const message = sparksEarned > 0 
      ? `Поздравляем! Вы получили ${sparksEarned}✨` 
      : 'Попробуйте еще раз!';
    
    res.json({
      success: true,
      correctAnswers,
      totalQuestions: questions.length,
      sparksEarned: sparksEarned,
      passed: sparksEarned > 0,
      newTotalSparks: newSparks,
      completed: true,
      message: message
    });
    
  } catch (error) {
    console.error('❌ Quiz submission error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Получение активностей пользователя
app.get('/api/webapp/users/:userId/activities', async (req, res) => {
  try {
    const userId = req.params.userId;
    const activities = await dbAll(
      `SELECT * FROM activities 
       WHERE user_id = ? 
       ORDER BY created_at DESC 
       LIMIT 20`,
      [userId]
    );
    
    res.json({ activities });
  } catch (error) {
    console.error('❌ Activities API error:', error);
    res.status(500).json({ error: 'Database error' });
  }
});

// ==================== ADMIN API ROUTES ====================

// Получение списка админов
app.get('/api/admin/admins', requireAdmin, async (req, res) => {
  try {
    const admins = await dbAll(`SELECT * FROM admins ORDER BY role, created_at DESC`);
    res.json(admins);
  } catch (error) {
    console.error('❌ Admin API error:', error);
    res.status(500).json({ error: 'Database error' });
  }
});

// Добавление админа
app.post('/api/admin/admins', requireAdmin, async (req, res) => {
  try {
    const { user_id, username, role } = req.body;
    
    console.log('➕ Добавление админа:', { user_id, username, role });
    
    if (!user_id || !role) {
      return res.status(400).json({ error: 'User ID and role are required' });
    }
    
    // Проверяем, не является ли добавляемый пользователь текущим админом
    if (user_id == req.admin.user_id) {
      return res.status(400).json({ error: 'Cannot modify your own admin status' });
    }
    
    const result = await dbRun(
      `INSERT OR REPLACE INTO admins (user_id, username, role) 
       VALUES (?, ?, ?)`,
      [user_id, username, role]
    );
    
    res.json({
      success: true,
      message: 'Администратор успешно добавлен'
    });
  } catch (error) {
    console.error('❌ Add admin error:', error);
    res.status(500).json({ error: 'Database error' });
  }
});

// Удаление админа
app.delete('/api/admin/admins/:adminId', requireAdmin, async (req, res) => {
  try {
    const adminId = req.params.adminId;
    
    // Не позволяем удалить самого себя
    if (adminId == req.admin.user_id) {
      return res.status(400).json({ error: 'Cannot remove yourself' });
    }
    
    const result = await dbRun(`DELETE FROM admins WHERE user_id = ?`, [adminId]);
    
    res.json({
      success: true,
      message: 'Администратор удален'
    });
  } catch (error) {
    console.error('❌ Delete admin error:', error);
    res.status(500).json({ error: 'Database error' });
  }
});

// Управление персонажами
app.get('/api/admin/characters', requireAdmin, async (req, res) => {
  try {
    const characters = await dbAll(`SELECT * FROM characters ORDER BY class, character_name`);
    
    const parsedCharacters = characters.map(char => ({
      ...char,
      available_buttons: JSON.parse(char.available_buttons || '[]')
    }));
    
    res.json(parsedCharacters);
  } catch (error) {
    console.error('❌ Characters API error:', error);
    res.status(500).json({ error: 'Database error' });
  }
});

app.post('/api/admin/characters', requireAdmin, async (req, res) => {
  try {
    const { class: charClass, character_name, description, bonus_type, bonus_value, available_buttons, is_active } = req.body;
    
    console.log('👥 Добавление персонажа:', { charClass, character_name });
    
    if (!charClass || !character_name || !bonus_type || !bonus_value) {
      return res.status(400).json({ error: 'Class, name, bonus type and value are required' });
    }
    
    const buttonsJson = JSON.stringify(available_buttons || []);
    
    await dbRun(
      `INSERT INTO characters (class, character_name, description, bonus_type, bonus_value, available_buttons, is_active) 
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [charClass, character_name, description, bonus_type, bonus_value, buttonsJson, is_active !== false]
    );
    
    res.json({
      success: true,
      message: 'Персонаж успешно создан'
    });
  } catch (error) {
    console.error('❌ Create character error:', error);
    res.status(500).json({ error: 'Database error' });
  }
});

app.put('/api/admin/characters/:characterId', requireAdmin, async (req, res) => {
  try {
    const { characterId } = req.params;
    const { class: charClass, character_name, description, bonus_type, bonus_value, available_buttons, is_active } = req.body;
    
    console.log('✏️ Обновление персонажа:', characterId);
    
    const buttonsJson = JSON.stringify(available_buttons || []);
    
    await dbRun(
      `UPDATE characters SET 
        class = ?, character_name = ?, description = ?, 
        bonus_type = ?, bonus_value = ?, available_buttons = ?, is_active = ?
       WHERE id = ?`,
      [charClass, character_name, description, bonus_type, bonus_value, buttonsJson, is_active, characterId]
    );
    
    res.json({
      success: true,
      message: 'Персонаж успешно обновлен'
    });
  } catch (error) {
    console.error('❌ Update character error:', error);
    res.status(500).json({ error: 'Database error' });
  }
});

app.delete('/api/admin/characters/:characterId', requireAdmin, async (req, res) => {
  try {
    const { characterId } = req.params;
    
    await dbRun(`DELETE FROM characters WHERE id = ?`, [characterId]);
    
    res.json({
      success: true,
      message: 'Персонаж удален'
    });
  } catch (error) {
    console.error('❌ Delete character error:', error);
    res.status(500).json({ error: 'Database error' });
  }
});

// Управление квизами
app.get('/api/admin/quizzes', requireAdmin, async (req, res) => {
  try {
    const quizzes = await dbAll(`SELECT * FROM quizzes ORDER BY created_at DESC`);
    
    const parsedQuizzes = quizzes.map(quiz => ({
      ...quiz,
      questions: JSON.parse(quiz.questions || '[]')
    }));
    
    res.json(parsedQuizzes);
  } catch (error) {
    console.error('❌ Quizzes admin API error:', error);
    res.status(500).json({ error: 'Database error' });
  }
});

app.post('/api/admin/quizzes', requireAdmin, async (req, res) => {
  try {
    const { title, description, questions, sparks_reward, cooldown_hours, is_active } = req.body;
    
    console.log('🎯 Создание квиза:', { title, sparks_reward });
    
    if (!title || !questions) {
      return res.status(400).json({ error: 'Title and questions are required' });
    }
    
    const questionsJson = JSON.stringify(questions);
    
    await dbRun(
      `INSERT INTO quizzes (title, description, questions, sparks_reward, cooldown_hours, is_active, created_by) 
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [title, description, questionsJson, sparks_reward || 1, cooldown_hours || 24, is_active !== false, req.admin.user_id]
    );
    
    res.json({
      success: true,
      message: 'Квиз успешно создан'
    });
  } catch (error) {
    console.error('❌ Create quiz error:', error);
    res.status(500).json({ error: 'Database error' });
  }
});

// Статистика для админ панели
app.get('/api/admin/stats', requireAdmin, async (req, res) => {
  try {
    const stats = {};
    
    // Всего пользователей
    const totalUsers = await dbGet('SELECT COUNT(*) as count FROM users');
    stats.totalUsers = totalUsers.count;
    
    // Активных сегодня
    const activeToday = await dbGet(`SELECT COUNT(*) as count FROM users WHERE DATE(last_active) = DATE('now')`);
    stats.activeToday = activeToday.count;
    
    // Всего искр
    const totalSparks = await dbGet(`SELECT SUM(sparks) as total FROM users`);
    stats.totalSparks = totalSparks.total || 0;
    
    // Активных квизов
    const activeQuizzes = await dbGet(`SELECT COUNT(*) as count FROM quizzes WHERE is_active = TRUE`);
    stats.activeQuizzes = activeQuizzes.count;
    
    // Персонажи
    const activeCharacters = await dbGet(`SELECT COUNT(*) as count FROM characters WHERE is_active = TRUE`);
    stats.activeCharacters = activeCharacters.count;
    
    res.json(stats);
  } catch (error) {
    console.error('❌ Stats API error:', error);
    res.status(500).json({ error: 'Database error' });
  }
});

// ==================== TELEGRAM BOT ====================

let bot = null;

async function initializeBot() {
  try {
    // Останавливаем предыдущие экземпляры бота
    if (bot) {
      bot.stopPolling();
    }
    
    bot = new TelegramBot(process.env.BOT_TOKEN, { 
      polling: { 
        interval: 300,
        params: {
          timeout: 10
        }
      } 
    });
    
    console.log('🤖 Bot initialized successfully');
    
    // Обработчики команд бота
    bot.onText(/\/start(?:\s+invite_(\d+))?/, async (msg, match) => {
      const chatId = msg.chat.id;
      const name = msg.from.first_name || 'Друг';
      const userId = msg.from.id;
      const inviteCode = match ? match[1] : null;
      
      // Если есть код приглашения, обрабатываем его
      if (inviteCode && inviteCode !== userId.toString()) {
        try {
          const inviter = await dbGet('SELECT * FROM users WHERE user_id = ?', [inviteCode]);
          if (inviter) {
            await dbRun(
              `INSERT OR IGNORE INTO invitations (inviter_id, invited_id, invited_username) VALUES (?, ?, ?)`,
              [inviteCode, userId, msg.from.username]
            );
            console.log(`✅ User ${userId} invited by ${inviteCode}`);
          }
        } catch (error) {
          console.error('Invite processing error:', error);
        }
      }
      
      const welcomeText = `🎨 Привет, ${name}! 

Добро пожаловать в **Мастерская Вдохновения**! 

✨ Вот что вас ждет:
• 📚 Обучающие видео и задания
• ✨ Система уровней и искр
• 🏆 Достижения и бонусы
• 👥 Сообщество творческих людей
• 🛒 Магазин с эксклюзивными материалами

Нажмите кнопку ниже чтобы открыть личный кабинет!`;
      
      const keyboard = {
        inline_keyboard: [[
          {
            text: "📱 Открыть Личный Кабинет",
            web_app: { url: process.env.APP_URL || `http://localhost:${PORT}` }
          }
        ]]
      };

      await bot.sendMessage(chatId, welcomeText, {
        parse_mode: 'Markdown',
        reply_markup: keyboard
      });
    });

    // Команда для админов
    bot.onText(/\/admin/, async (msg) => {
      const chatId = msg.chat.id;
      const userId = msg.from.id;
      
      try {
        const admin = await dbGet('SELECT * FROM admins WHERE user_id = ?', [userId]);
        if (!admin) {
          await bot.sendMessage(chatId, '❌ У вас нет прав доступа к админ панели.');
          return;
        }
        
        const adminUrl = `${process.env.APP_URL || `http://localhost:${PORT}`}/admin?userId=${userId}`;
        await bot.sendMessage(chatId, `🔧 Панель администратора\n\nДоступ: ${admin.role}\n\n${adminUrl}`);
      } catch (error) {
        console.error('Admin command error:', error);
      }
    });

    // Обработка ошибок бота
    bot.on('polling_error', (error) => {
      console.log('🤖 Polling error:', error.message);
    });

    bot.on('error', (error) => {
      console.log('🤖 Bot error:', error.message);
    });
    
  } catch (error) {
    console.error('❌ Bot initialization failed:', error.message);
    bot = null;
  }
}

// ==================== SERVER START ====================

const PORT = process.env.PORT || 3000;

async function startServer() {
  try {
    // Инициализация базы данных
    await initializeDatabase();
    
    // Инициализация бота
    await initializeBot();
    
    // Запуск сервера
    app.listen(PORT, '0.0.0.0', () => {
      console.log(`🚀 Сервер запущен на порту ${PORT}`);
      console.log(`📱 Mini App: ${process.env.APP_URL || `http://localhost:${PORT}`}`);
      console.log(`🔧 Admin Panel: ${process.env.APP_URL || `http://localhost:${PORT}`}/admin`);
      console.log(`📊 Health: http://localhost:${PORT}/health`);
      console.log('=================================');
    }).on('error', (err) => {
      if (err.code === 'EADDRINUSE') {
        console.error(`❌ Port ${PORT} is already in use. Try changing PORT in .env file`);
        process.exit(1);
      } else {
        console.error('❌ Server error:', err);
      }
    });
    
  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
}

// Обработка graceful shutdown
process.on('SIGINT', async () => {
  console.log('\n🛑 Shutting down gracefully...');
  if (bot) {
    bot.stopPolling();
  }
  db.close();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('\n🛑 Shutting down gracefully...');
  if (bot) {
    bot.stopPolling();
  }
  db.close();
  process.exit(0);
});

startServer();
