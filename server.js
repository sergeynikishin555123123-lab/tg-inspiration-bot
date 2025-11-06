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
    metadata TEXT DEFAULT '{}',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  // Таблица постов канала
  db.run(`CREATE TABLE channel_posts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    post_id TEXT UNIQUE NOT NULL,
    title TEXT NOT NULL,
    content TEXT,
    video_url TEXT,
    buttons TEXT,
    published_by INTEGER,
    published_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    is_published BOOLEAN DEFAULT FALSE,
    requires_action BOOLEAN DEFAULT FALSE,
    action_type TEXT DEFAULT 'quiz'
  )`);

  // Таблица комментариев
  db.run(`CREATE TABLE comments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    post_id TEXT NOT NULL,
    comment_text TEXT NOT NULL,
    is_approved BOOLEAN DEFAULT FALSE,
    stars_awarded BOOLEAN DEFAULT FALSE,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  // Таблица фото работ
  db.run(`CREATE TABLE photo_works (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    photo_url TEXT NOT NULL,
    description TEXT,
    theme TEXT,
    is_approved BOOLEAN DEFAULT FALSE,
    stars_awarded BOOLEAN DEFAULT FALSE,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  // Таблица приглашений
  db.run(`CREATE TABLE invitations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    inviter_id INTEGER NOT NULL,
    invited_id INTEGER UNIQUE NOT NULL,
    invited_username TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  // Таблица админов
  db.run(`CREATE TABLE admins (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER UNIQUE NOT NULL,
    username TEXT,
    role TEXT DEFAULT 'moderator',
    permissions TEXT DEFAULT '{}',
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
  
  // Добавляем тестового админа
  if (process.env.ADMIN_ID) {
    db.run("INSERT INTO admins (user_id, username, role) VALUES (?, ?, ?)",
      [process.env.ADMIN_ID, 'admin', 'superadmin']);
    console.log('✅ Default admin added:', process.env.ADMIN_ID);
  }
  
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

// ==================== UTILITY FUNCTIONS ====================

function calculateLevel(stars) {
  if (stars >= 400) return 'Наставник';
  if (stars >= 300) return 'Мастер';
  if (stars >= 150) return 'Знаток';
  if (stars >= 50) return 'Искатель';
  return 'Ученик';
}

function applyCharacterBonus(user, baseStars, activityType) {
  if (!user.character_id) return baseStars;
  
  return new Promise((resolve) => {
    db.get('SELECT * FROM characters WHERE id = ?', [user.character_id], (err, character) => {
      if (err || !character) {
        resolve(baseStars);
        return;
      }
      
      let finalStars = baseStars;
      
      switch(character.bonus_type) {
        case 'percent_bonus':
          const bonusPercent = parseInt(character.bonus_value);
          if ((character.class === 'Художники' && activityType === 'photo_work') ||
              (character.class === 'Стилисты' && activityType === 'style_quiz')) {
            finalStars = baseStars * (1 + bonusPercent/100);
          }
          break;
          
        case 'photo_bonus':
          if (activityType === 'photo_work') {
            finalStars = baseStars + parseInt(character.bonus_value);
          }
          break;
          
        case 'random_gift':
          if (Math.random() < 0.166) {
            const randomBonus = Math.floor(Math.random() * 3) + 1;
            finalStars = baseStars + randomBonus;
          }
          break;
          
        case 'fact_star':
          if (activityType === 'quiz') {
            finalStars = baseStars + 1;
          }
          break;
      }
      
      resolve(Math.round(finalStars * 10) / 10);
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
    if (err || !admin) {
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
        res.json({ exists: true, user });
      } else {
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

app.post('/api/users/register', (req, res) => {
  const { userId, userClass, characterId, tgUsername, tgFirstName, tgLastName } = req.body;
  
  console.log('📝 Регистрация пользователя:', { userId, userClass, characterId });
  
  if (!userId || !userClass || !characterId) {
    return res.status(400).json({ error: 'User ID, class and character are required' });
  }
  
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
      
      res.json({ 
        success: true, 
        message: message,
        starsAdded: 5,
        userId: userId
      });
    }
  );
});

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

app.post('/api/webapp/quizzes/:quizId/submit', async (req, res) => {
  const { quizId } = req.params;
  const { userId, answers } = req.body;
  
  console.log(`📝 Отправка ответов на квиз ${quizId} от пользователя ${userId}`);
  
  if (!userId) {
    return res.status(400).json({ error: 'User ID is required' });
  }
  
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
    
    questions.forEach((question, index) => {
      if (answers[index] === question.correctAnswer) {
        correctAnswers++;
      }
    });
    
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
    
    db.get(
      `SELECT u.*, c.bonus_type, c.bonus_value 
       FROM users u 
       LEFT JOIN characters c ON u.character_id = c.id 
       WHERE u.user_id = ?`,
      [userId],
      async (err, user) => {
        if (err) {
          console.error('❌ Database error:', err);
          return res.status(500).json({ error: 'Database error' });
        }
        
        const finalStars = await applyCharacterBonus(user, starsEarned, 'quiz');
        
        let newStars = finalStars;
        if (user) {
          newStars = user.stars + finalStars;
        }
        
        db.run(
          `INSERT OR REPLACE INTO users (user_id, stars, last_active) 
           VALUES (?, ?, CURRENT_TIMESTAMP)`,
          [userId, newStars],
          function(err) {
            if (err) {
              console.error('❌ Error updating user stars:', err);
              return res.status(500).json({ error: 'Error updating stars' });
            }
            
            if (finalStars > 0) {
              db.run(
                `INSERT INTO activities (user_id, activity_type, stars_earned, description) 
                 VALUES (?, 'quiz', ?, ?)`,
                [userId, finalStars, `Квиз: ${quiz.title}`],
                (err) => {
                  if (err) console.error('Error logging activity:', err);
                }
              );
            }
            
            const message = finalStars > 0 
              ? `Поздравляем! Вы получили ${finalStars}⭐` 
              : 'Попробуйте еще раз!';
            
            res.json({
              success: true,
              correctAnswers,
              totalQuestions: questions.length,
              starsEarned: finalStars,
              passed: finalStars > 0,
              newTotalStars: newStars,
              message: message
            });
          }
        );
      }
    );
  });
});

app.post('/api/webapp/submit-work', async (req, res) => {
  const { userId, description, theme, photoUrl } = req.body;
  
  console.log('📸 Отправка работы от пользователя:', userId);
  
  if (!userId || !photoUrl) {
    return res.status(400).json({ error: 'User ID and photo URL are required' });
  }
  
  const baseStars = 3;
  
  db.get(
    `SELECT u.*, c.bonus_type, c.bonus_value 
     FROM users u 
     LEFT JOIN characters c ON u.character_id = c.id 
     WHERE u.user_id = ?`,
    [userId],
    async (err, user) => {
      if (err) {
        console.error('❌ Database error:', err);
        return res.status(500).json({ error: 'Database error' });
      }
      
      const finalStars = await applyCharacterBonus(user, baseStars, 'photo_work');
      
      db.run(
        `INSERT INTO photo_works (user_id, photo_url, description, theme) 
         VALUES (?, ?, ?, ?)`,
        [userId, photoUrl, description, theme],
        function(err) {
          if (err) {
            console.error('❌ Error saving photo work:', err);
            return res.status(500).json({ error: 'Error saving work' });
          }
          
          res.json({
            success: true,
            message: 'Фото работа отправлена на модерацию! После одобрения вы получите звезды.',
            starsPotential: finalStars,
            workId: this.lastID
          });
        }
      );
    }
  );
});

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

app.post('/api/webapp/comments', (req, res) => {
  const { userId, postId, commentText } = req.body;
  
  console.log('💬 Отправка комментария от пользователя:', userId);
  
  if (!userId || !postId || !commentText) {
    return res.status(400).json({ error: 'User ID, post ID and comment text are required' });
  }
  
  db.get(
    `SELECT daily_commented FROM users WHERE user_id = ?`,
    [userId],
    (err, user) => {
      if (err) {
        console.error('❌ Database error:', err);
        return res.status(500).json({ error: 'Database error' });
      }
      
      if (user && user.daily_commented) {
        return res.json({
          success: true,
          message: 'Комментарий отправлен на модерацию (бонус за сегодня уже получен)',
          starsAwarded: 0
        });
      }
      
      db.run(
        `INSERT INTO comments (user_id, post_id, comment_text) 
         VALUES (?, ?, ?)`,
        [userId, postId, commentText],
        function(err) {
          if (err) {
            console.error('❌ Error saving comment:', err);
            return res.status(500).json({ error: 'Error saving comment' });
          }
          
          res.json({
            success: true,
            message: 'Комментарий отправлен на модерацию! После одобрения вы получите +0.5⭐',
            starsPotential: 0.5,
            commentId: this.lastID
          });
        }
      );
    }
  );
});

app.post('/api/webapp/invite', (req, res) => {
  const { inviterId, invitedId, invitedUsername } = req.body;
  
  console.log('👥 Приглашение друга:', { inviterId, invitedId });
  
  if (!inviterId || !invitedId) {
    return res.status(400).json({ error: 'Inviter ID and invited ID are required' });
  }
  
  db.get(
    `SELECT * FROM invitations WHERE inviter_id = ? AND invited_id = ?`,
    [inviterId, invitedId],
    (err, existingInvite) => {
      if (err) {
        console.error('❌ Database error:', err);
        return res.status(500).json({ error: 'Database error' });
      }
      
      if (existingInvite) {
        return res.status(400).json({ error: 'Этот пользователь уже был приглашен' });
      }
      
      db.run(
        `INSERT INTO invitations (inviter_id, invited_id, invited_username) 
         VALUES (?, ?, ?)`,
        [inviterId, invitedId, invitedUsername],
        function(err) {
          if (err) {
            console.error('❌ Error creating invitation:', err);
            return res.status(500).json({ error: 'Error creating invitation' });
          }
          
          db.run(
            `UPDATE users SET stars = stars + 10, invite_count = invite_count + 1 
             WHERE user_id = ?`,
            [inviterId],
            (err) => {
              if (err) {
                console.error('❌ Error updating inviter stars:', err);
                return res.status(500).json({ error: 'Error updating stars' });
              }
              
              db.run(
                `INSERT INTO activities (user_id, activity_type, stars_earned, description) 
                 VALUES (?, 'invitation', 10, 'Приглашение друга')`,
                [inviterId],
                (err) => {
                  if (err) console.error('Error logging activity:', err);
                }
              );
              
              res.json({
                success: true,
                message: 'Друг приглашен! +10⭐',
                starsEarned: 10
              });
            }
          );
        }
      );
    }
  );
});

// ==================== ADMIN API ROUTES ====================

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
                  
                  // Всего звезд
                  db.get(`SELECT SUM(stars) as total FROM users`, (err, row) => {
                    if (err) return res.status(500).json({ error: 'Database error' });
                    stats.totalStars = row.total || 0;
                    
                    // Активных квизов
                    db.get(`SELECT COUNT(*) as count FROM quizzes WHERE is_active = TRUE`, (err, row) => {
                      if (err) return res.status(500).json({ error: 'Database error' });
                      stats.activeQuizzes = row.count;
                      
                      // Топ приглашающий
                      db.get(`SELECT tg_first_name, invite_count FROM users 
                              WHERE invite_count > 0 ORDER BY invite_count DESC LIMIT 1`, 
                        (err, row) => {
                          if (err) return res.status(500).json({ error: 'Database error' });
                          stats.topInviter = row ? `${row.tg_first_name} (${row.invite_count})` : 'Нет данных';
                          
                          res.json(stats);
                        }
                      );
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

app.post('/api/admin/posts', requireAdmin, (req, res) => {
  const { title, content, video_url, buttons, requires_action, action_type } = req.body;
  
  console.log('📝 Создание поста админом:', { title, requires_action });
  
  if (!title) {
    return res.status(400).json({ error: 'Post title is required' });
  }
  
  const postId = `post_${Date.now()}`;
  const buttonsJson = JSON.stringify(buttons || []);
  
  db.run(
    `INSERT INTO channel_posts (post_id, title, content, video_url, buttons, published_by, requires_action, action_type) 
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [postId, title, content, video_url, buttonsJson, req.admin.user_id, requires_action, action_type],
    function(err) {
      if (err) {
        console.error('❌ Error creating post:', err);
        return res.status(500).json({ error: 'Error creating post' });
      }
      
      res.json({
        success: true,
        message: 'Пост успешно создан',
        postId: postId
      });
    }
  );
});

app.get('/api/admin/posts', requireAdmin, (req, res) => {
  db.all(
    `SELECT * FROM channel_posts ORDER BY published_at DESC`,
    (err, posts) => {
      if (err) {
        console.error('❌ Database error:', err);
        return res.status(500).json({ error: 'Database error' });
      }
      
      const parsedPosts = posts.map(post => ({
        ...post,
        buttons: JSON.parse(post.buttons || '[]')
      }));
      
      res.json(parsedPosts);
    }
  );
});

app.delete('/api/admin/posts/:postId', requireAdmin, (req, res) => {
  const { postId } = req.params;
  
  db.run(
    `DELETE FROM channel_posts WHERE post_id = ?`,
    [postId],
    function(err) {
      if (err) {
        console.error('❌ Error deleting post:', err);
        return res.status(500).json({ error: 'Error deleting post' });
      }
      
      if (this.changes === 0) {
        return res.status(404).json({ error: 'Post not found' });
      }
      
      res.json({
        success: true,
        message: 'Пост удален'
      });
    }
  );
});

app.get('/api/admin/users', requireAdmin, (req, res) => {
  db.all(
    `SELECT user_id, tg_username, tg_first_name, tg_last_name, class, stars, level, last_active, invite_count
     FROM users ORDER BY stars DESC`,
    (err, users) => {
      if (err) {
        console.error('❌ Database error:', err);
        return res.status(500).json({ error: 'Database error' });
      }
      
      res.json(users);
    }
  );
});

app.get('/api/admin/users/search', requireAdmin, (req, res) => {
  const query = req.query.q;
  
  if (!query) {
    return res.json([]);
  }
  
  db.all(
    `SELECT user_id, tg_username, tg_first_name, tg_last_name, class, stars, level, last_active
     FROM users 
     WHERE user_id LIKE ? OR tg_username LIKE ? OR tg_first_name LIKE ? OR tg_last_name LIKE ?
     ORDER BY stars DESC`,
    [`%${query}%`, `%${query}%`, `%${query}%`, `%${query}%`],
    (err, users) => {
      if (err) {
        console.error('❌ Database error:', err);
        return res.status(500).json({ error: 'Database error' });
      }
      
      res.json(users);
    }
  );
});

app.get('/api/admin/users/:userId', requireAdmin, (req, res) => {
  const userId = req.params.userId;
  
  db.get(
    `SELECT u.*, c.character_name 
     FROM users u 
     LEFT JOIN characters c ON u.character_id = c.id 
     WHERE u.user_id = ?`,
    [userId],
    (err, user) => {
      if (err) {
        console.error('❌ Database error:', err);
        return res.status(500).json({ error: 'Database error' });
      }
      
      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }
      
      user.level = calculateLevel(user.stars);
      res.json(user);
    }
  );
});

app.get('/api/admin/moderation/photos', requireAdmin, (req, res) => {
  db.all(
    `SELECT pw.*, u.tg_first_name 
     FROM photo_works pw 
     JOIN users u ON pw.user_id = u.user_id 
     WHERE pw.is_approved = FALSE 
     ORDER BY pw.created_at DESC`,
    (err, photos) => {
      if (err) {
        console.error('❌ Database error:', err);
        return res.status(500).json({ error: 'Database error' });
      }
      
      res.json(photos);
    }
  );
});

app.post('/api/admin/moderation/photos/:photoId/approve', requireAdmin, (req, res) => {
  const { photoId } = req.params;
  
  db.get(
    `SELECT * FROM photo_works WHERE id = ?`,
    [photoId],
    (err, photo) => {
      if (err || !photo) {
        return res.status(404).json({ error: 'Photo work not found' });
      }
      
      if (photo.is_approved) {
        return res.status(400).json({ error: 'Photo already approved' });
      }
      
      db.get(
        `SELECT u.*, c.bonus_type, c.bonus_value 
         FROM users u 
         LEFT JOIN characters c ON u.character_id = c.id 
         WHERE u.user_id = ?`,
        [photo.user_id],
        async (err, user) => {
          if (err) {
            console.error('❌ Database error:', err);
            return res.status(500).json({ error: 'Database error' });
          }
          
          const baseStars = 3;
          const finalStars = await applyCharacterBonus(user, baseStars, 'photo_work');
          
          db.run(
            `UPDATE photo_works SET is_approved = TRUE, stars_awarded = TRUE WHERE id = ?`,
            [photoId],
            (err) => {
              if (err) {
                console.error('❌ Error approving photo:', err);
                return res.status(500).json({ error: 'Error approving photo' });
              }
              
              db.run(
                `UPDATE users SET stars = stars + ? WHERE user_id = ?`,
                [finalStars, photo.user_id],
                (err) => {
                  if (err) {
                    console.error('❌ Error updating user stars:', err);
                    return res.status(500).json({ error: 'Error updating stars' });
                  }
                  
                  db.run(
                    `INSERT INTO activities (user_id, activity_type, stars_earned, description) 
                     VALUES (?, 'photo_work', ?, ?)`,
                    [photo.user_id, finalStars, 'Фото работа одобрена'],
                    (err) => {
                      if (err) console.error('Error logging activity:', err);
                    }
                  );
                  
                  res.json({
                    success: true,
                    message: `Фото одобрено! Пользователь получил +${finalStars}⭐`,
                    starsAwarded: finalStars
                  });
                }
              );
            }
          );
        }
      );
    }
  );
});

app.post('/api/admin/moderation/photos/:photoId/reject', requireAdmin, (req, res) => {
  const { photoId } = req.params;
  
  db.run(
    `DELETE FROM photo_works WHERE id = ?`,
    [photoId],
    function(err) {
      if (err) {
        console.error('❌ Error rejecting photo:', err);
        return res.status(500).json({ error: 'Error rejecting photo' });
      }
      
      if (this.changes === 0) {
        return res.status(404).json({ error: 'Photo work not found' });
      }
      
      res.json({
        success: true,
        message: 'Фото работа отклонена'
      });
    }
  );
});

app.get('/api/admin/moderation/comments', requireAdmin, (req, res) => {
  db.all(
    `SELECT c.*, u.tg_first_name 
     FROM comments c 
     JOIN users u ON c.user_id = u.user_id 
     WHERE c.is_approved = FALSE 
     ORDER BY c.created_at DESC`,
    (err, comments) => {
      if (err) {
        console.error('❌ Database error:', err);
        return res.status(500).json({ error: 'Database error' });
      }
      
      res.json(comments);
    }
  );
});

app.post('/api/admin/moderation/comments/:commentId/approve', requireAdmin, (req, res) => {
  const { commentId } = req.params;
  
  db.get(
    `SELECT * FROM comments WHERE id = ?`,
    [commentId],
    (err, comment) => {
      if (err || !comment) {
        return res.status(404).json({ error: 'Comment not found' });
      }
      
      if (comment.is_approved) {
        return res.status(400).json({ error: 'Comment already approved' });
      }
      
      db.get(
        `SELECT daily_commented FROM users WHERE user_id = ?`,
        [comment.user_id],
        (err, user) => {
          if (err) {
            console.error('❌ Database error:', err);
            return res.status(500).json({ error: 'Database error' });
          }
          
          if (user && user.daily_commented) {
            db.run(
              `UPDATE comments SET is_approved = TRUE WHERE id = ?`,
              [commentId],
              (err) => {
                if (err) {
                  console.error('❌ Error approving comment:', err);
                  return res.status(500).json({ error: 'Error approving comment' });
                }
                
                res.json({
                  success: true,
                  message: 'Комментарий одобрен (бонус за сегодня уже получен)',
                  starsAwarded: 0
                });
              }
            );
          } else {
            db.run(
              `UPDATE comments SET is_approved = TRUE, stars_awarded = TRUE WHERE id = ?`,
              [commentId],
              (err) => {
                if (err) {
                  console.error('❌ Error approving comment:', err);
                  return res.status(500).json({ error: 'Error approving comment' });
                }
                
                db.run(
                  `UPDATE users SET stars = stars + 0.5, daily_commented = TRUE WHERE user_id = ?`,
                  [comment.user_id],
                  (err) => {
                    if (err) {
                      console.error('❌ Error updating user stars:', err);
                      return res.status(500).json({ error: 'Error updating stars' });
                    }
                    
                    db.run(
                      `INSERT INTO activities (user_id, activity_type, stars_earned, description) 
                       VALUES (?, 'comment', 0.5, 'Комментарий одобрен')`,
                      [comment.user_id],
                      (err) => {
                        if (err) console.error('Error logging activity:', err);
                      }
                    );
                    
                    res.json({
                      success: true,
                      message: 'Комментарий одобрен! Пользователь получил +0.5⭐',
                      starsAwarded: 0.5
                    });
                  }
                );
              }
            );
          }
        }
      );
    }
  );
});

app.post('/api/admin/moderation/comments/:commentId/reject', requireAdmin, (req, res) => {
  const { commentId } = req.params;
  
  db.run(
    `DELETE FROM comments WHERE id = ?`,
    [commentId],
    function(err) {
      if (err) {
        console.error('❌ Error rejecting comment:', err);
        return res.status(500).json({ error: 'Error rejecting comment' });
      }
      
      if (this.changes === 0) {
        return res.status(404).json({ error: 'Comment not found' });
      }
      
      res.json({
        success: true,
        message: 'Комментарий отклонен'
      });
    }
  );
});

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

app.post('/api/admin/admins', requireAdmin, (req, res) => {
  const { user_id, username, role } = req.body;
  
  if (!user_id) {
    return res.status(400).json({ error: 'User ID is required' });
  }
  
  db.get(
    `SELECT * FROM admins WHERE user_id = ?`,
    [user_id],
    (err, existingAdmin) => {
      if (err) {
        console.error('❌ Database error:', err);
        return res.status(500).json({ error: 'Database error' });
      }
      
      if (existingAdmin) {
        return res.status(400).json({ error: 'User is already an admin' });
      }
      
      db.run(
        `INSERT INTO admins (user_id, username, role) VALUES (?, ?, ?)`,
        [user_id, username, role || 'moderator'],
        function(err) {
          if (err) {
            console.error('❌ Error adding admin:', err);
            return res.status(500).json({ error: 'Error adding admin' });
          }
          
          res.json({
            success: true,
            message: 'Администратор добавлен'
          });
        }
      );
    }
  );
});

app.delete('/api/admin/admins/:userId', requireAdmin, (req, res) => {
  const userId = req.params.userId;
  
  if (userId == req.admin.user_id) {
    return res.status(400).json({ error: 'Cannot remove yourself' });
  }
  
  db.get(
    `SELECT role FROM admins WHERE user_id = ?`,
    [userId],
    (err, admin) => {
      if (err || !admin) {
        return res.status(404).json({ error: 'Admin not found' });
      }
      
      if (admin.role === 'superadmin') {
        return res.status(400).json({ error: 'Cannot remove superadmin' });
      }
      
      db.run(
        `DELETE FROM admins WHERE user_id = ?`,
        [userId],
        function(err) {
          if (err) {
            console.error('❌ Error removing admin:', err);
            return res.status(500).json({ error: 'Error removing admin' });
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
    }
  );
});

// ==================== TELEGRAM BOT ====================

const bot = new TelegramBot(process.env.BOT_TOKEN, { polling: false });

// Настройка вебхука для продакшена
if (process.env.NODE_ENV === 'production' && process.env.APP_URL) {
  const webhookUrl = `${process.env.APP_URL}/bot${process.env.BOT_TOKEN}`;
  console.log(`🌐 Setting webhook to: ${webhookUrl}`);
  
  bot.setWebHook(webhookUrl)
    .then(() => console.log('✅ Webhook set successfully'))
    .catch(err => console.error('❌ Webhook error:', err.message));
} else {
  console.log('🔧 Development mode: using polling');
  bot.startPolling().then(() => {
    console.log('✅ Bot polling started');
  }).catch(err => {
    console.log('⚠️ Bot polling error:', err.message);
  });
}

// Обработчики команд бота
bot.onText(/\/start/, (msg) => {
  const chatId = msg.chat.id;
  const name = msg.from.first_name || 'Друг';
  const userId = msg.from.id;
  
  const welcomeText = `🎨 Привет, ${name}! 

Добро пожаловать в **Мастерская Вдохновения**! 

✨ Вот что вас ждет:
• 📚 Обучающие видео и задания
• ⭐ Система уровней и звёзд
• 🏆 Достижения и бонусы
• 👥 Сообщество творческих людей

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

// Обработка вебхука
app.post(`/bot${process.env.BOT_TOKEN}`, (req, res) => {
  bot.processUpdate(req.body);
  res.sendStatus(200);
});

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
    console.log(`🔧 Admin Panel: ${process.env.APP_URL || `http://localhost:${selectedPort}`}/admin`);
    console.log(`📊 Health: http://localhost:${selectedPort}/health`);
    console.log(`🌐 Webhook: ${process.env.APP_URL ? `${process.env.APP_URL}/bot${process.env.BOT_TOKEN}` : 'Not set'}`);
    console.log(`🤖 Bot: ${process.env.NODE_ENV === 'production' ? 'Webhook mode' : 'Polling mode'}`);
    console.log('=================================');
  }).on('error', (err) => {
    console.error('❌ Server error:', err);
  });
}

startServer();
