import express from 'express';
import TelegramBot from 'node-telegram-bot-api';
import cors from 'cors';
import bodyParser from 'body-parser';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import dotenv from 'dotenv';
import sqlite3 from 'sqlite3';

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

// Проверка токена бота
if (!process.env.BOT_TOKEN) {
  console.error('❌ BOT_TOKEN не найден!');
  process.exit(1);
}

// Инициализация базы данных
const db = new sqlite3.Database('./inspiration.db', (err) => {
  if (err) {
    console.error('❌ Error opening database:', err);
  } else {
    console.log('✅ Connected to SQLite database');
  }
});

// ==================== ИНИЦИАЛИЗАЦИЯ БАЗЫ ДАННЫХ ====================

db.serialize(() => {
  console.log('📊 Инициализация базы данных...');
  
  // Таблица пользователей
  db.run(`CREATE TABLE IF NOT EXISTS users (
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
  db.run(`CREATE TABLE IF NOT EXISTS characters (
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
  db.run(`CREATE TABLE IF NOT EXISTS quizzes (
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
  db.run(`CREATE TABLE IF NOT EXISTS quiz_completions (
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
  db.run(`CREATE TABLE IF NOT EXISTS activities (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    activity_type TEXT NOT NULL,
    sparks_earned REAL NOT NULL,
    description TEXT,
    metadata TEXT DEFAULT '{}',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users (user_id)
  )`);

  // Таблица постов канала
  db.run(`CREATE TABLE IF NOT EXISTS channel_posts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    post_id TEXT UNIQUE NOT NULL,
    title TEXT NOT NULL,
    content TEXT,
    photo_url TEXT,
    video_url TEXT,
    buttons TEXT,
    published_by INTEGER,
    published_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    is_published BOOLEAN DEFAULT FALSE,
    requires_action BOOLEAN DEFAULT FALSE,
    action_type TEXT DEFAULT 'quiz'
  )`);

  // Таблица комментариев
  db.run(`CREATE TABLE IF NOT EXISTS comments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    post_id TEXT NOT NULL,
    comment_text TEXT NOT NULL,
    is_approved BOOLEAN DEFAULT FALSE,
    sparks_awarded BOOLEAN DEFAULT FALSE,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users (user_id)
  )`);

  // Таблица фото работ
  db.run(`CREATE TABLE IF NOT EXISTS photo_works (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    photo_url TEXT NOT NULL,
    description TEXT,
    theme TEXT,
    is_approved BOOLEAN DEFAULT FALSE,
    sparks_awarded BOOLEAN DEFAULT FALSE,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users (user_id)
  )`);

  // Таблица приглашений
  db.run(`CREATE TABLE IF NOT EXISTS invitations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    inviter_id INTEGER NOT NULL,
    invited_id INTEGER UNIQUE NOT NULL,
    invited_username TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (inviter_id) REFERENCES users (user_id),
    FOREIGN KEY (invited_id) REFERENCES users (user_id)
  )`);

  // Таблица админов
  db.run(`CREATE TABLE IF NOT EXISTS admins (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER UNIQUE NOT NULL,
    username TEXT,
    role TEXT DEFAULT 'moderator',
    permissions TEXT DEFAULT '{}',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  // Таблица товаров магазина
  db.run(`CREATE TABLE IF NOT EXISTS shop_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    description TEXT,
    type TEXT NOT NULL DEFAULT 'video',
    file_url TEXT,
    preview_url TEXT,
    price REAL NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    created_by INTEGER,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  // Таблица покупок
  db.run(`CREATE TABLE IF NOT EXISTS purchases (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    item_id INTEGER NOT NULL,
    price_paid REAL NOT NULL,
    purchased_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users (user_id),
    FOREIGN KEY (item_id) REFERENCES shop_items (id)
  )`);

  // Проверяем и заполняем персонажей
  db.get("SELECT COUNT(*) as count FROM characters", (err, row) => {
    if (err) {
      console.error('Error checking characters:', err);
      return;
    }
    
    if (row.count === 0) {
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
      characters.forEach(char => stmt.run(char));
      stmt.finalize();
      console.log('✅ Персонажи добавлены');
    }
  });

  // Добавляем тестового админа
  if (process.env.ADMIN_ID) {
    db.run("INSERT OR IGNORE INTO admins (user_id, username, role) VALUES (?, ?, ?)",
      [process.env.ADMIN_ID, 'admin', 'superadmin'], function(err) {
      if (err) {
        console.error('Error adding admin:', err);
      } else if (this.changes > 0) {
        console.log('✅ Админ добавлен:', process.env.ADMIN_ID);
      }
    });
  }
  
  console.log('✅ База данных готова');
});

// ==================== UTILITY FUNCTIONS ====================

function calculateLevel(sparks) {
  if (sparks >= 400) return 'Наставник';
  if (sparks >= 300) return 'Мастер';
  if (sparks >= 150) return 'Знаток';
  if (sparks >= 50) return 'Искатель';
  return 'Ученик';
}

function applyCharacterBonus(user, baseSparks, activityType) {
  if (!user.character_id) return baseSparks;
  
  return new Promise((resolve) => {
    db.get('SELECT * FROM characters WHERE id = ?', [user.character_id], (err, character) => {
      if (err || !character) {
        resolve(baseSparks);
        return;
      }
      
      let finalSparks = baseSparks;
      
      switch(character.bonus_type) {
        case 'percent_bonus':
          const bonusPercent = parseInt(character.bonus_value);
          finalSparks = baseSparks * (1 + bonusPercent/100);
          break;
          
        case 'photo_bonus':
          if (activityType === 'photo_work') {
            finalSparks = baseSparks + parseInt(character.bonus_value);
          }
          break;
          
        case 'random_gift':
          if (Math.random() < 0.166) {
            const randomBonus = Math.floor(Math.random() * 3) + 1;
            finalSparks = baseSparks + randomBonus;
          }
          break;
          
        case 'fact_star':
          if (activityType === 'quiz') {
            finalSparks = baseSparks + 1;
          }
          break;
      }
      
      resolve(Math.round(finalSparks * 10) / 10);
    });
  });
}

// ==================== MIDDLEWARE ====================

const requireAdmin = (req, res, next) => {
  const userId = req.headers['x-user-id'] || req.query.userId || req.body.userId;
  
  if (!userId) {
    return res.status(401).json({ error: 'User ID required' });
  }
  
  db.get('SELECT * FROM admins WHERE user_id = ?', [userId], (err, admin) => {
    if (err) {
      console.error('Admin check error:', err);
      return res.status(500).json({ error: 'Database error' });
    }
    
    if (!admin) {
      return res.status(403).json({ error: 'Admin access required' });
    }
    
    req.admin = admin;
    next();
  });
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
app.get('/api/webapp/characters', (req, res) => {
  db.all('SELECT * FROM characters WHERE is_active = TRUE ORDER BY class, character_name', (err, characters) => {
    if (err) {
      console.error('❌ Database error:', err);
      return res.status(500).json({ error: 'Database error' });
    }
    
    // Группируем персонажей по классам
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
  });
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
app.get('/api/users/:userId', (req, res) => {
  const userId = req.params.userId;
  
  db.get(
    `SELECT u.*, c.character_name, c.class, c.bonus_type, c.bonus_value, c.available_buttons
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
        const tgFirstName = 'Новый пользователь';
        db.run(
          `INSERT INTO users (user_id, tg_first_name, sparks, level) VALUES (?, ?, 0, 'Ученик')`,
          [userId, tgFirstName],
          function(err) {
            if (err) {
              console.error('❌ Error creating user:', err);
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
                character_id: null,
                character_name: null,
                tg_first_name: tgFirstName,
                available_buttons: [],
                invite_count: 0
              }
            });
          }
        );
      }
    }
  );
});

// Регистрация или смена персонажа - ИСПРАВЛЕННАЯ ВЕРСИЯ
app.post('/api/users/register', (req, res) => {
  const { userId, userClass, characterId, tgUsername, tgFirstName, tgLastName } = req.body;
  
  console.log('📝 Регистрация/смена персонажа пользователя:', { userId, userClass, characterId });
  
  if (!userId || !userClass || !characterId) {
    return res.status(400).json({ error: 'User ID, class and character are required' });
  }
  
  // Получаем текущие данные пользователя
  db.get('SELECT * FROM users WHERE user_id = ?', [userId], (err, existingUser) => {
    if (err) {
      console.error('❌ Database error:', err);
      return res.status(500).json({ error: 'Database error' });
    }
    
    const isNewUser = !existingUser;
    const isFirstRegistration = !existingUser || !existingUser.is_registered;
    
    // Получаем данные персонажа для available_buttons
    db.get('SELECT available_buttons FROM characters WHERE id = ?', [characterId], (err, character) => {
      if (err) {
        console.error('❌ Error getting character:', err);
        return res.status(500).json({ error: 'Error getting character data' });
      }
      
      const availableButtons = character ? character.available_buttons : '[]';
      
      if (isNewUser) {
        // Создаем нового пользователя
        db.run(
          `INSERT INTO users (
            user_id, tg_username, tg_first_name, tg_last_name, 
            class, character_id, is_registered, sparks, level, available_buttons
          ) VALUES (?, ?, ?, ?, ?, ?, TRUE, 5, 'Ученик', ?)`,
          [userId, tgUsername, tgFirstName, tgLastName, userClass, characterId, availableButtons],
          function(err) {
            if (err) {
              console.error('❌ Error creating user:', err);
              return res.status(500).json({ error: 'Error creating user' });
            }
            
            // Записываем активность регистрации
            db.run(
              `INSERT INTO activities (user_id, activity_type, sparks_earned, description) 
               VALUES (?, 'registration', 5, 'Регистрация в системе')`,
              [userId],
              (err) => {
                if (err) console.error('Error logging activity:', err);
              }
            );
            
            res.json({ 
              success: true, 
              message: 'Регистрация успешна! +5✨',
              sparksAdded: 5,
              isNewRegistration: true
            });
          }
        );
      } else {
        // Обновляем существующего пользователя
        const newSparks = isFirstRegistration ? (existingUser.sparks || 0) + 5 : existingUser.sparks;
        
        db.run(
          `UPDATE users SET 
            tg_username = ?, tg_first_name = ?, tg_last_name = ?,
            class = ?, character_id = ?, is_registered = TRUE, 
            sparks = ?, available_buttons = ?, last_active = CURRENT_TIMESTAMP
           WHERE user_id = ?`,
          [tgUsername, tgFirstName, tgLastName, userClass, characterId, newSparks, availableButtons, userId],
          function(err) {
            if (err) {
              console.error('❌ Error updating user:', err);
              return res.status(500).json({ error: 'Error updating user' });
            }
            
            if (isFirstRegistration) {
              // Записываем активность регистрации
              db.run(
                `INSERT INTO activities (user_id, activity_type, sparks_earned, description) 
                 VALUES (?, 'registration', 5, 'Регистрация в системе')`,
                [userId],
                (err) => {
                  if (err) console.error('Error logging activity:', err);
                }
              );
            }
            
            res.json({ 
              success: true, 
              message: isFirstRegistration ? 'Регистрация успешна! +5✨' : 'Персонаж успешно изменен!',
              sparksAdded: isFirstRegistration ? 5 : 0,
              isNewRegistration: isFirstRegistration
            });
          }
        );
      }
    });
  });
});

// Получение квизов с информацией о прохождении
app.get('/api/webapp/quizzes', (req, res) => {
  const userId = req.query.userId;
  
  db.all("SELECT * FROM quizzes WHERE is_active = TRUE ORDER BY created_at DESC", (err, quizzes) => {
    if (err) {
      console.error('❌ Database error:', err);
      return res.status(500).json({ error: 'Database error' });
    }
    
    const parsedQuizzes = quizzes.map(quiz => ({
      ...quiz,
      questions: JSON.parse(quiz.questions || '[]')
    }));
    
    // Если передан userId, проверяем пройденные квизы
    if (userId) {
      db.all(
        `SELECT quiz_id, completed_at, sparks_earned 
         FROM quiz_completions 
         WHERE user_id = ?`,
        [userId],
        (err, completions) => {
          if (err) {
            console.error('Error fetching completions:', err);
            return res.json(parsedQuizzes);
          }
          
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
        }
      );
    } else {
      res.json(parsedQuizzes);
    }
  });
});

// Запуск квиза
app.get('/api/webapp/quizzes/:quizId', (req, res) => {
  const { quizId } = req.params;
  const { userId } = req.query;
  
  db.get("SELECT * FROM quizzes WHERE id = ? AND is_active = TRUE", [quizId], (err, quiz) => {
    if (err) {
      console.error('❌ Database error:', err);
      return res.status(500).json({ error: 'Database error' });
    }
    
    if (!quiz) {
      return res.status(404).json({ error: 'Quiz not found' });
    }
    
    const quizData = {
      ...quiz,
      questions: JSON.parse(quiz.questions || '[]')
    };
    
    // Проверяем возможность прохождения
    if (userId) {
      db.get(
        `SELECT completed_at FROM quiz_completions 
         WHERE user_id = ? AND quiz_id = ?`,
        [userId, quizId],
        (err, completion) => {
          if (err) {
            console.error('Error checking completion:', err);
            return res.json(quizData);
          }
          
          if (completion) {
            const completedAt = new Date(completion.completed_at);
            const cooldownMs = quiz.cooldown_hours * 60 * 60 * 1000;
            const canRetake = (Date.now() - completedAt.getTime()) > cooldownMs;
            
            quizData.can_retake = canRetake;
            quizData.completed = true;
            quizData.next_available = new Date(completedAt.getTime() + cooldownMs);
          }
          
          res.json(quizData);
        }
      );
    } else {
      res.json(quizData);
    }
  });
});

// Отправка ответов на квиз
app.post('/api/webapp/quizzes/:quizId/submit', async (req, res) => {
  const { quizId } = req.params;
  const { userId, answers } = req.body;
  
  console.log(`📝 Отправка ответов на квиз ${quizId} от пользователя ${userId}`);
  
  if (!userId || !answers) {
    return res.status(400).json({ error: 'User ID and answers are required' });
  }
  
  try {
    // Получаем данные квиза
    const quiz = await new Promise((resolve, reject) => {
      db.get("SELECT * FROM quizzes WHERE id = ?", [quizId], (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });
    
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
    
    // Получаем данные пользователя для бонусов
    const user = await new Promise((resolve, reject) => {
      db.get(
        `SELECT u.*, c.bonus_type, c.bonus_value 
         FROM users u 
         LEFT JOIN characters c ON u.character_id = c.id 
         WHERE u.user_id = ?`,
        [userId],
        (err, row) => {
          if (err) reject(err);
          else resolve(row);
        }
      );
    });
    
    const finalSparks = await applyCharacterBonus(user, sparksEarned, 'quiz');
    const newSparks = (user?.sparks || 0) + finalSparks;
    
    // Сохраняем результат прохождения
    await new Promise((resolve, reject) => {
      db.run(
        `INSERT OR REPLACE INTO quiz_completions (user_id, quiz_id, completed_at, score, sparks_earned) 
         VALUES (?, ?, CURRENT_TIMESTAMP, ?, ?)`,
        [userId, quizId, correctAnswers, finalSparks],
        function(err) {
          if (err) reject(err);
          else resolve();
        }
      );
    });
    
    // Обновляем искры пользователя
    await new Promise((resolve, reject) => {
      db.run(
        `UPDATE users SET sparks = ?, last_active = CURRENT_TIMESTAMP WHERE user_id = ?`,
        [newSparks, userId],
        (err) => {
          if (err) reject(err);
          else resolve();
        }
      );
    });
    
    // Записываем активность
    if (finalSparks > 0) {
      db.run(
        `INSERT INTO activities (user_id, activity_type, sparks_earned, description) 
         VALUES (?, 'quiz', ?, ?)`,
        [userId, finalSparks, `Квиз: ${quiz.title}`]
      );
    }
    
    const message = finalSparks > 0 
      ? `Поздравляем! Вы получили ${finalSparks}✨` 
      : 'Попробуйте еще раз!';
    
    res.json({
      success: true,
      correctAnswers,
      totalQuestions: questions.length,
      sparksEarned: finalSparks,
      passed: finalSparks > 0,
      newTotalSparks: newSparks,
      completed: true,
      message: message
    });
    
  } catch (error) {
    console.error('❌ Quiz submission error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Остальные API endpoints остаются аналогичными, но с улучшенной обработкой ошибок...

// ==================== ADMIN API ROUTES ====================

// Получение списка админов
app.get('/api/admin/admins', requireAdmin, (req, res) => {
  db.all(
    `SELECT * FROM admins ORDER BY role, created_at DESC`,
    (err, admins) => {
      if (err) {
        console.error('❌ Database error:', err);
        return res.status(500).json({ error: 'Database error' });
      }
      
      res.json(admins);
    }
  );
});

// Добавление админа - ИСПРАВЛЕННАЯ ВЕРСИЯ
app.post('/api/admin/admins', requireAdmin, (req, res) => {
  const { user_id, username, role } = req.body;
  
  console.log('➕ Добавление админа:', { user_id, username, role });
  
  if (!user_id || !role) {
    return res.status(400).json({ error: 'User ID and role are required' });
  }
  
  // Проверяем, не является ли добавляемый пользователь текущим админом
  if (user_id == req.admin.user_id) {
    return res.status(400).json({ error: 'Cannot modify your own admin status' });
  }
  
  db.run(
    `INSERT OR REPLACE INTO admins (user_id, username, role) 
     VALUES (?, ?, ?)`,
    [user_id, username, role],
    function(err) {
      if (err) {
        console.error('❌ Error adding admin:', err);
        return res.status(500).json({ error: 'Error adding admin' });
      }
      
      res.json({
        success: true,
        message: 'Администратор успешно добавлен',
        adminId: this.lastID
      });
    }
  );
});

// Удаление админа
app.delete('/api/admin/admins/:adminId', requireAdmin, (req, res) => {
  const adminId = req.params.adminId;
  
  // Не позволяем удалить самого себя
  if (adminId == req.admin.user_id) {
    return res.status(400).json({ error: 'Cannot remove yourself' });
  }
  
  db.run(
    `DELETE FROM admins WHERE user_id = ?`,
    [adminId],
    function(err) {
      if (err) {
        console.error('❌ Error deleting admin:', err);
        return res.status(500).json({ error: 'Error deleting admin' });
      }
      
      if (this.changes === 0) {
        return res.status(404).json({ error: 'Admin not found' });
      }
      
      res.json({
        success: true,
        message: 'Администратор удален'
      });
    }
  );
});

// Управление персонажами
app.get('/api/admin/characters', requireAdmin, (req, res) => {
  db.all(
    `SELECT * FROM characters ORDER BY class, character_name`,
    (err, characters) => {
      if (err) {
        console.error('❌ Database error:', err);
        return res.status(500).json({ error: 'Database error' });
      }
      
      const parsedCharacters = characters.map(char => ({
        ...char,
        available_buttons: JSON.parse(char.available_buttons || '[]')
      }));
      
      res.json(parsedCharacters);
    }
  );
});

app.post('/api/admin/characters', requireAdmin, (req, res) => {
  const { class: charClass, character_name, description, bonus_type, bonus_value, available_buttons, is_active } = req.body;
  
  console.log('👥 Добавление персонажа:', { charClass, character_name });
  
  if (!charClass || !character_name || !bonus_type || !bonus_value) {
    return res.status(400).json({ error: 'Class, name, bonus type and value are required' });
  }
  
  const buttonsJson = JSON.stringify(available_buttons || []);
  
  db.run(
    `INSERT INTO characters (class, character_name, description, bonus_type, bonus_value, available_buttons, is_active) 
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [charClass, character_name, description, bonus_type, bonus_value, buttonsJson, is_active !== false],
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

app.put('/api/admin/characters/:characterId', requireAdmin, (req, res) => {
  const { characterId } = req.params;
  const { class: charClass, character_name, description, bonus_type, bonus_value, available_buttons, is_active } = req.body;
  
  console.log('✏️ Обновление персонажа:', characterId);
  
  const buttonsJson = JSON.stringify(available_buttons || []);
  
  db.run(
    `UPDATE characters SET 
      class = ?, character_name = ?, description = ?, 
      bonus_type = ?, bonus_value = ?, available_buttons = ?, is_active = ?
     WHERE id = ?`,
    [charClass, character_name, description, bonus_type, bonus_value, buttonsJson, is_active, characterId],
    function(err) {
      if (err) {
        console.error('❌ Error updating character:', err);
        return res.status(500).json({ error: 'Error updating character' });
      }
      
      if (this.changes === 0) {
        return res.status(404).json({ error: 'Character not found' });
      }
      
      res.json({
        success: true,
        message: 'Персонаж успешно обновлен'
      });
    }
  );
});

app.delete('/api/admin/characters/:characterId', requireAdmin, (req, res) => {
  const { characterId } = req.params;
  
  db.run(
    `DELETE FROM characters WHERE id = ?`,
    [characterId],
    function(err) {
      if (err) {
        console.error('❌ Error deleting character:', err);
        return res.status(500).json({ error: 'Error deleting character' });
      }
      
      if (this.changes === 0) {
        return res.status(404).json({ error: 'Character not found' });
      }
      
      res.json({
        success: true,
        message: 'Персонаж удален'
      });
    }
  );
});

// Статистика для админ панели
app.get('/api/admin/stats', requireAdmin, (req, res) => {
  const stats = {};
  
  // Всего пользователей
  db.get('SELECT COUNT(*) as count FROM users', (err, row) => {
    if (err) return res.status(500).json({ error: 'Database error' });
    stats.totalUsers = row.count;
    
    // Активных сегодня
    db.get(`SELECT COUNT(*) as count FROM users 
            WHERE DATE(last_active) = DATE('now')`, (err, row) => {
      if (err) return res.status(500).json({ error: 'Database error' });
      stats.activeToday = row.count;
      
      // Всего постов
      db.get('SELECT COUNT(*) as count FROM channel_posts', (err, row) => {
        if (err) return res.status(500).json({ error: 'Database error' });
        stats.totalPosts = row.count;
        
        // На модерации
        db.get(`SELECT COUNT(*) as count FROM photo_works WHERE is_approved = FALSE`, 
          (err, photoRow) => {
            if (err) return res.status(500).json({ error: 'Database error' });
            db.get(`SELECT COUNT(*) as count FROM comments WHERE is_approved = FALSE`, 
              (err, commentRow) => {
                if (err) return res.status(500).json({ error: 'Database error' });
                stats.pendingModeration = (photoRow.count || 0) + (commentRow.count || 0);
                
                // Дополнительная статистика
                db.get(`SELECT COUNT(*) as count FROM users 
                        WHERE DATE(registration_date) = DATE('now')`, (err, row) => {
                  if (err) return res.status(500).json({ error: 'Database error' });
                  stats.registeredToday = row.count;
                  
                  // Всего искр
                  db.get(`SELECT SUM(sparks) as total FROM users`, (err, row) => {
                    if (err) return res.status(500).json({ error: 'Database error' });
                    stats.totalSparks = row.total || 0;
                    
                    // Активных квизов
                    db.get(`SELECT COUNT(*) as count FROM quizzes WHERE is_active = TRUE`, (err, row) => {
                      if (err) return res.status(500).json({ error: 'Database error' });
                      stats.activeQuizzes = row.count;
                      
                      // Товары в магазине
                      db.get(`SELECT COUNT(*) as count FROM shop_items WHERE is_active = TRUE`, (err, row) => {
                        if (err) return res.status(500).json({ error: 'Database error' });
                        stats.shopItems = row.count;
                        
                        // Персонажи
                        db.get(`SELECT COUNT(*) as count FROM characters WHERE is_active = TRUE`, (err, row) => {
                          if (err) return res.status(500).json({ error: 'Database error' });
                          stats.activeCharacters = row.count;
                          
                          res.json(stats);
                        });
                      });
                    });
                  });
                });
              }
            );
          }
        );
      });
    });
  });
});

// ==================== TELEGRAM BOT ====================

const bot = new TelegramBot(process.env.BOT_TOKEN, { polling: true });

// Обработчики команд бота
bot.onText(/\/start(?:\s+invite_(\d+))?/, (msg, match) => {
  const chatId = msg.chat.id;
  const name = msg.from.first_name || 'Друг';
  const userId = msg.from.id;
  const inviteCode = match ? match[1] : null;
  
  // Если есть код приглашения, обрабатываем его
  if (inviteCode && inviteCode !== userId.toString()) {
    // Обработка приглашения
    db.get('SELECT * FROM users WHERE user_id = ?', [inviteCode], (err, inviter) => {
      if (!err && inviter) {
        db.run(
          `INSERT OR IGNORE INTO invitations (inviter_id, invited_id, invited_username) VALUES (?, ?, ?)`,
          [inviteCode, userId, msg.from.username],
          function() {
            if (this.changes > 0) {
              db.run(
                `UPDATE users SET sparks = sparks + 10, invite_count = invite_count + 1 WHERE user_id = ?`,
                [inviteCode]
              );
              console.log(`✅ User ${userId} invited by ${inviteCode}`);
            }
          }
        );
      }
    });
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
  console.log(`📊 Health: http://localhost:${PORT}/health`);
  console.log('🤖 Bot: Polling mode');
  console.log('=================================');
}).on('error', (err) => {
  console.error('❌ Server error:', err);
});
