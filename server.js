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
const PORT = process.env.PORT || 3001;

// Middleware
app.use(express.json());
app.use(cors());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static(join(__dirname, 'public')));

// Проверяем наличие BOT_TOKEN
if (!process.env.BOT_TOKEN) {
  console.error('❌ BOT_TOKEN не найден в переменных окружения!');
  process.exit(1);
}

console.log('🤖 Bot starting...');

// Инициализация бота
let bot;
try {
  bot = new TelegramBot(process.env.BOT_TOKEN, {
    polling: {
      interval: 300,
      autoStart: true,
      params: {
        timeout: 10
      }
    }
  });
  console.log('✅ Bot initialized successfully');
} catch (error) {
  console.error('❌ Error initializing bot:', error);
  process.exit(1);
}

// Инициализация базы данных
try {
  const { initDatabase } = await import('./config/database.js');
  initDatabase();
  console.log('✅ Database initialized');
} catch (error) {
  console.error('❌ Error initializing database:', error);
}

// Базовые endpoint'ы
app.get('/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    message: '✅ Бот работает!',
    timestamp: new Date().toISOString(),
    version: '1.0.0',
    port: PORT
  });
});

// API маршруты - ДОБАВЛЯЕМ ИХ ПРЯМО ЗДЕСЬ ДЛЯ ТЕСТА

// Получение персонажей
app.get('/api/webapp/characters', async (req, res) => {
  try {
    console.log('📝 GET /api/webapp/characters');
    
    // Импортируем базу данных
    const db = (await import('./config/database.js')).default;
    
    db.all('SELECT * FROM characters ORDER BY class, character_name', (err, characters) => {
      if (err) {
        console.error('Database error:', err);
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
      
      console.log(`✅ Returned ${characters.length} characters`);
      res.json(groupedCharacters);
    });
  } catch (error) {
    console.error('Error in /api/webapp/characters:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Получение данных пользователя
app.get('/api/users/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    console.log('📝 GET /api/users/', userId);
    
    const db = (await import('./config/database.js')).default;
    
    db.get(
      `SELECT u.*, c.character_name, c.class, c.bonus_type, c.bonus_value 
       FROM users u 
       LEFT JOIN characters c ON u.character_id = c.id 
       WHERE u.user_id = ?`,
      [userId],
      (err, user) => {
        if (err) {
          console.error('Database error:', err);
          return res.status(500).json({ error: 'Database error' });
        }
        
        if (user) {
          // Рассчитываем уровень на основе звезд
          const level = calculateLevel(user.stars);
          user.level = level;
          
          res.json({ exists: true, user });
        } else {
          // Создаем временного пользователя
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
    console.error('Error in /api/users:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Регистрация пользователя
app.post('/api/users/register', async (req, res) => {
  try {
    const { userId, userClass, characterId, tgUsername, tgFirstName, tgLastName } = req.body;
    console.log('📝 POST /api/users/register', { userId, userClass, characterId });
    
    if (!userId || !userClass || !characterId) {
      return res.status(400).json({ error: 'User ID, class and character are required' });
    }
    
    const db = (await import('./config/database.js')).default;
    
    // Проверяем, существует ли пользователь
    db.get('SELECT * FROM users WHERE user_id = ?', [userId], (err, existingUser) => {
      if (err) {
        console.error('Database error:', err);
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
            console.error('Error creating user:', err);
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
    console.error('Error in registration:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Получение квизов
app.get('/api/webapp/quizzes', async (req, res) => {
  try {
    console.log('📝 GET /api/webapp/quizzes');
    
    const db = (await import('./config/database.js')).default;
    
    // Сначала создадим тестовый квиз если нет квизов
    db.get("SELECT COUNT(*) as count FROM quizzes", (err, row) => {
      if (err) {
        console.error('Error checking quizzes:', err);
        return res.status(500).json({ error: 'Database error' });
      }
      
      if (row.count === 0) {
        // Создаем тестовый квиз
        const testQuiz = {
          title: "Тестовый квиз по искусству",
          description: "Проверьте свои знания в искусстве",
          questions: JSON.stringify([
            {
              question: "Кто написал картину 'Мона Лиза'?",
              options: ["Винсент Ван Гог", "Леонардо да Винчи", "Пабло Пикассо", "Клод Моне"],
              correctAnswer: 1
            },
            {
              question: "В каком веке жил Рембрандт?",
              options: ["16 век", "17 век", "18 век", "19 век"],
              correctAnswer: 1
            },
            {
              question: "Какой стиль живописи характеризуется мелкими точками?",
              options: ["Импрессионизм", "Пуантилизм", "Кубизм", "Сюрреализм"],
              correctAnswer: 1
            }
          ]),
          stars_reward: 2
        };
        
        db.run(
          `INSERT INTO quizzes (title, description, questions, stars_reward) 
           VALUES (?, ?, ?, ?)`,
          [testQuiz.title, testQuiz.description, testQuiz.questions, testQuiz.stars_reward],
          function(err) {
            if (err) {
              console.error('Error creating test quiz:', err);
            } else {
              console.log('✅ Created test quiz');
            }
            
            // Теперь получаем квизы
            sendQuizzesResponse(db, res);
          }
        );
      } else {
        sendQuizzesResponse(db, res);
      }
    });
  } catch (error) {
    console.error('Error in /api/webapp/quizzes:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

function sendQuizzesResponse(db, res) {
  db.all(
    `SELECT * FROM quizzes 
     WHERE is_active = TRUE 
     ORDER BY created_at DESC`,
    (err, quizzes) => {
      if (err) {
        console.error('Database error:', err);
        return res.status(500).json({ error: 'Database error' });
      }
      
      // Парсим вопросы из JSON
      const parsedQuizzes = quizzes.map(quiz => ({
        ...quiz,
        questions: quiz.questions ? JSON.parse(quiz.questions) : []
      }));
      
      console.log(`✅ Returned ${quizzes.length} quizzes`);
      res.json(parsedQuizzes);
    }
  );
}

// Функция расчета уровня
function calculateLevel(stars) {
  if (stars >= 400) return 'Наставник';
  if (stars >= 300) return 'Мастер';
  if (stars >= 150) return 'Знаток';
  if (stars >= 50) return 'Искатель';
  return 'Ученик';
}

// Главная страница
app.get('/', (req, res) => {
  res.json({
    message: '🎨 Мастерская Вдохновения - API',
    status: 'Работает',
    endpoints: {
      health: '/health',
      user: '/api/users/:id',
      characters: '/api/webapp/characters',
      quizzes: '/api/webapp/quizzes',
      register: '/api/users/register (POST)'
    }
  });
});

// Обработка команды /start
bot.onText(/\/start/, (msg) => {
  const chatId = msg.chat.id;
  const name = msg.from.first_name || 'Друг';
  
  const welcomeText = `🎨 Привет, ${name}! 

Добро пожаловать в **Мастерскую Вдохновения**! 

✨ Вот что вас ждет:
• 📚 Обучающие видео и задания
• ⭐ Система уровней и звёзд
• 🏆 Достижения и бонусы

Нажмите кнопку ниже чтобы открыть личный кабинет!`;
  
  bot.sendMessage(chatId, welcomeText, {
    parse_mode: 'Markdown',
    reply_markup: {
      inline_keyboard: [[
        {
          text: "📱 Открыть Личный Кабинет",
          web_app: { url: process.env.APP_URL || `http://localhost:${PORT}` }
        }
      ]]
    }
  }).catch(error => {
    console.error('Error sending message:', error);
  });
});

// Запуск сервера
app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📱 Health check: http://localhost:${PORT}/health`);
  console.log(`📚 API endpoints:`);
  console.log(`   GET  /api/webapp/characters`);
  console.log(`   GET  /api/users/:userId`);
  console.log(`   POST /api/users/register`);
  console.log(`   GET  /api/webapp/quizzes`);
  console.log(`🤖 Bot: Active!`);
}).on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`❌ Port ${PORT} is already in use!`);
    console.log('💡 Try changing PORT in .env file');
  } else {
    console.error('❌ Server error:', err);
  }
  process.exit(1);
});
