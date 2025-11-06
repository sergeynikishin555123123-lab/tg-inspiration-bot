import express from 'express';
import TelegramBot from 'node-telegram-bot-api';
import cors from 'cors';
import bodyParser from 'body-parser';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import dotenv from 'dotenv';

// Загрузка переменных окружения
dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

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

// Инициализация базы данных
import { initDatabase, getDatabase } from './config/database.js';
initDatabase();
const db = getDatabase();

// ==================== API ROUTES ====================

// Health check
app.get('/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    message: '✅ Сервер работает!',
    timestamp: new Date().toISOString(),
    version: '1.0.0'
  });
});

// Главная страница API
app.get('/api', (req, res) => {
  res.json({
    name: 'Мастерская Вдохновения',
    version: '1.0.0',
    endpoints: {
      health: '/health',
      characters: '/api/webapp/characters',
      user: '/api/users/:id',
      register: '/api/users/register (POST)',
      quizzes: '/api/webapp/quizzes'
    }
  });
});

// Получить персонажей
app.get('/api/webapp/characters', async (req, res) => {
  try {
    db.all('SELECT * FROM characters ORDER BY class, character_name', (err, characters) => {
      if (err) {
        console.error('❌ Database error:', err);
        return res.status(500).json({ error: 'Database error' });
      }
      
      // Группируем по классам
      const groupedCharacters = characters.reduce((acc, character) => {
        if (!acc[character.class]) {
          acc[character.class] = [];
        }
        acc[character.class].push(character);
        return acc;
      }, {});
      
      res.json(groupedCharacters);
    });
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Получить классы
app.get('/api/webapp/classes', async (req, res) => {
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

// Получить пользователя
app.get('/api/users/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    
    db.get(
      `SELECT u.*, c.character_name, c.class, c.bonus_type, c.bonus_value 
       FROM users u 
       LEFT JOIN characters c ON u.character_id = c.id 
       WHERE u.user_id = ?`,
      [userId],
      (err, user) => {
        if (err) {
          return res.status(500).json({ error: 'Database error' });
        }
        
        if (user) {
          // Рассчитываем уровень на основе звезд
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
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Регистрация пользователя
app.post('/api/users/register', async (req, res) => {
  try {
    const { userId, userClass, characterId, tgUsername, tgFirstName, tgLastName } = req.body;
    
    if (!userId || !userClass || !characterId) {
      return res.status(400).json({ error: 'User ID, class and character are required' });
    }
    
    // Проверяем, существует ли пользователь
    db.get('SELECT * FROM users WHERE user_id = ?', [userId], (err, existingUser) => {
      if (err) {
        return res.status(500).json({ error: 'Database error' });
      }
      
      if (existingUser) {
        return res.status(400).json({ error: 'User already registered' });
      }
      
      // Создаем нового пользователя
      db.run(
        `INSERT INTO users (user_id, tg_username, tg_first_name, tg_last_name, class, character_id, is_registered, stars) 
         VALUES (?, ?, ?, ?, ?, ?, TRUE, 5)`,
        [userId, tgUsername, tgFirstName, tgLastName, userClass, characterId],
        function(err) {
          if (err) {
            return res.status(500).json({ error: 'Error creating user' });
          }
          
          // Добавляем активность за регистрацию
          db.run(
            `INSERT INTO activities (user_id, activity_type, stars_earned, description) 
             VALUES (?, 'registration', 5, 'Регистрация в системе')`,
            [userId]
          );
          
          res.json({ 
            success: true, 
            message: 'Пользователь успешно зарегистрирован',
            starsAdded: 5,
            userId: userId
          });
        }
      );
    });
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Получить квизы
app.get('/api/webapp/quizzes', async (req, res) => {
  try {
    db.all(
      `SELECT * FROM quizzes 
       WHERE is_active = TRUE 
       ORDER BY created_at DESC`,
      (err, quizzes) => {
        if (err) {
          return res.status(500).json({ error: 'Database error' });
        }
        
        // Парсим вопросы из JSON
        const parsedQuizzes = quizzes.map(quiz => ({
          ...quiz,
          questions: quiz.questions ? JSON.parse(quiz.questions) : []
        }));
        
        res.json(parsedQuizzes);
      }
    );
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Отправить ответ на квиз
app.post('/api/webapp/quizzes/:quizId/submit', async (req, res) => {
  try {
    const { quizId } = req.params;
    const { userId, answers } = req.body;
    
    if (!userId) {
      return res.status(400).json({ error: 'User ID is required' });
    }
    
    // Получаем квиз
    db.get('SELECT * FROM quizzes WHERE id = ?', [quizId], (err, quiz) => {
      if (err) {
        return res.status(500).json({ error: 'Database error' });
      }
      
      if (!quiz) {
        return res.status(404).json({ error: 'Quiz not found' });
      }
      
      const questions = quiz.questions ? JSON.parse(quiz.questions) : [];
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
        // Короткий опрос (3 вопроса)
        starsEarned = correctAnswers >= 1 ? 1 : 0;
      } else {
        // Викторина (3-5 вопросов)
        if (correctAnswers >= Math.ceil(questions.length * 0.6)) {
          starsEarned = 2;
        } else if (correctAnswers >= 1) {
          starsEarned = 1;
        }
      }
      
      // Обновляем звезды пользователя
      if (starsEarned > 0) {
        db.get('SELECT stars FROM users WHERE user_id = ?', [userId], (err, user) => {
          if (err) {
            return res.json({
              success: true,
              correctAnswers,
              totalQuestions: questions.length,
              starsEarned,
              passed: starsEarned > 0
            });
          }
          
          if (user) {
            const newStars = user.stars + starsEarned;
            
            db.run(
              'UPDATE users SET stars = ?, last_active = CURRENT_TIMESTAMP WHERE user_id = ?',
              [newStars, userId],
              (err) => {
                if (err) {
                  console.error('Error updating stars:', err);
                }
                
                // Записываем активность
                db.run(
                  `INSERT INTO activities (user_id, activity_type, stars_earned, description) 
                   VALUES (?, 'quiz', ?, ?)`,
                  [userId, starsEarned, `Квиз: ${quiz.title}`]
                );
                
                res.json({
                  success: true,
                  correctAnswers,
                  totalQuestions: questions.length,
                  starsEarned,
                  passed: starsEarned > 0,
                  newTotalStars: newStars
                });
              }
            );
          } else {
            res.json({
              success: true,
              correctAnswers,
              totalQuestions: questions.length,
              starsEarned,
              passed: starsEarned > 0
            });
          }
        });
      } else {
        res.json({
          success: true,
          correctAnswers,
          totalQuestions: questions.length,
          starsEarned,
          passed: false
        });
      }
    });
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Отправить фото работы
app.post('/api/webapp/submit-work', async (req, res) => {
  try {
    const { userId, photoUrl, description } = req.body;
    
    if (!userId || !photoUrl) {
      return res.status(400).json({ error: 'User ID and photo URL are required' });
    }
    
    // Начисляем 3 звезды за работу согласно ТЗ
    db.get('SELECT stars FROM users WHERE user_id = ?', [userId], (err, user) => {
      if (err) {
        return res.status(500).json({ error: 'Database error' });
      }
      
      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }
      
      const starsEarned = 3;
      const newStars = user.stars + starsEarned;
      
      db.run(
        'UPDATE users SET stars = ?, last_active = CURRENT_TIMESTAMP WHERE user_id = ?',
        [newStars, userId],
        (err) => {
          if (err) {
            return res.status(500).json({ error: 'Error updating stars' });
          }
          
          // Записываем активность
          db.run(
            `INSERT INTO activities (user_id, activity_type, stars_earned, description) 
             VALUES (?, 'photo_work', ?, ?)`,
            [userId, starsEarned, description || 'Фото работы']
          );
          
          res.json({
            success: true,
            starsEarned: starsEarned,
            newTotalStars: newStars,
            message: 'Фото работы принято! +3⭐'
          });
        }
      );
    });
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Главная страница
app.get('/', (req, res) => {
  res.sendFile(join(__dirname, 'public', 'index.html'));
});

// ==================== TELEGRAM BOT ====================

// Инициализация бота
const bot = new TelegramBot(process.env.BOT_TOKEN, {
  polling: {
    interval: 300,
    autoStart: true,
    params: {
      timeout: 10
    }
  }
});

console.log('✅ Bot initialized');

// Обработка команды /start
bot.onText(/\/start/, async (msg) => {
  const chatId = msg.chat.id;
  const name = msg.from.first_name || 'Друг';
  const userId = msg.from.id;
  
  const welcomeText = `🎨 Привет, ${name}! 

Добро пожаловать в **Мастерскую Вдохновения**! 

✨ Вот что вас ждет:
• 📚 Обучающие видео и задания
• ⭐ Система уровней и звёзд
• 🏆 Достижения и бонусы
• 👥 Сообщество единомышленников

Нажмите кнопку ниже чтобы открыть личный кабинет!`;
  
  const keyboard = {
    inline_keyboard: [[
      {
        text: "📱 Открыть Личный Кабинет",
        web_app: { url: process.env.APP_URL || `http://localhost:${PORT}` }
      }
    ]]
  };

  // Проверяем, зарегистрирован ли пользователь
  db.get('SELECT * FROM users WHERE user_id = ?', [userId], (err, user) => {
    if (!user) {
      keyboard.inline_keyboard.push([
        {
          text: "📝 Начать регистрацию",
          callback_data: 'start_registration'
        }
      ]);
    }

    bot.sendMessage(chatId, welcomeText, {
      parse_mode: 'Markdown',
      reply_markup: keyboard
    });
  });
});

// Обработка callback кнопок
bot.on('callback_query', async (callbackQuery) => {
  const message = callbackQuery.message;
  const data = callbackQuery.data;
  const userId = callbackQuery.from.id;

  if (data === 'start_registration') {
    const registrationText = `📝 **Регистрация в Мастерской Вдохновения**

Для завершения регистрации откройте личный кабинет и выберите свой класс и персонажа!`;
    
    bot.editMessageText(registrationText, {
      chat_id: message.chat.id,
      message_id: message.message_id,
      parse_mode: 'Markdown',
      reply_markup: {
        inline_keyboard: [[
          {
            text: "📱 Открыть Личный Кабинет",
            web_app: { url: process.env.APP_URL || `http://localhost:${PORT}` }
          }
        ]]
      }
    });
  }
});

// Обработка ошибок бота
bot.on('error', (error) => {
  console.error('❌ Bot error:', error);
});

// ==================== UTILITY FUNCTIONS ====================

function calculateLevel(stars) {
  if (stars >= 400) return 'Наставник';
  if (stars >= 300) return 'Мастер';
  if (stars >= 150) return 'Знаток';
  if (stars >= 50) return 'Искатель';
  return 'Ученик';
}

// ==================== SERVER START ====================

app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Сервер запущен на порту ${PORT}`);
  console.log(`📱 Mini App: ${process.env.APP_URL || `http://localhost:${PORT}`}`);
  console.log(`📊 Health: http://localhost:${PORT}/health`);
  console.log(`👥 API: http://localhost:${PORT}/api`);
  console.log(`🤖 Bot: Active!`);
  console.log('=================================');
});
