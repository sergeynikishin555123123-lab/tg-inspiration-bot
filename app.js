import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import TelegramBot from 'node-telegram-bot-api';
import cors from 'cors';
import dotenv from 'dotenv';

// Импортируем функции базы данных
import { 
  initializeDatabase, 
  getUser, 
  createUser, 
  updateUser,
  addStars 
} from './database.js';

// Конфигурация ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json());
app.use(cors());

// Serve static files from React build
app.use(express.static(path.join(__dirname, 'client/dist')));

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

console.log('🤖 Bot starting in POLLING mode...');

// Health check endpoint
app.get('/health', async (req, res) => {
  try {
    const healthInfo = {
      status: 'OK',
      message: '✅ Бот работает через long polling!',
      mode: 'polling',
      timestamp: new Date().toISOString(),
      database: 'PostgreSQL',
      environment: process.env.NODE_ENV
    };
    res.json(healthInfo);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// API для Mini App - получение данных пользователя
app.get('/api/user/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const user = await getUser(parseInt(userId));
    
    if (!user) {
      return res.json({ exists: false });
    }
    
    res.json({ exists: true, user });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// API для Mini App - регистрация пользователя
app.post('/api/user/register', async (req, res) => {
  try {
    const { userId, username, name, userClass, character } = req.body;
    
    const updateData = {
      user_class: userClass,
      character_name: character,
      is_registered: true
    };
    
    const updatedUser = await updateUser(userId, updateData);
    
    if (updatedUser) {
      // Начисляем звезды за регистрацию
      await addStars(userId, 5, 'registration', 'Регистрация в системе');
      
      res.json({ 
        success: true, 
        message: 'Пользователь зарегистрирован',
        starsAdded: 5
      });
    } else {
      res.status(400).json({ error: 'Пользователь не найден' });
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// API для получения классов и персонажей
app.get('/api/characters', async (req, res) => {
  try {
    const { pool } = await import('./database.js');
    const result = await pool.query('SELECT * FROM characters ORDER BY class, character_name');
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Serve React App for all other routes
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'client/dist', 'index.html'));
});

// Обработчик команды /start
bot.onText(/\/start/, async (msg) => {
  const chatId = msg.chat.id;
  const userId = msg.from.id;
  const username = msg.from.username || '';
  const name = msg.from.first_name || 'Друг';
  
  console.log(`👋 Новый пользователь: ${name} (ID: ${userId})`);
  
  // Создаем или получаем пользователя
  let user = await getUser(userId);
  if (!user) {
    user = await createUser({
      user_id: userId,
      tg_username: username,
      tg_name: name
    });
  }
  
  const welcomeText = `🎨 Привет, ${name}! 

Добро пожаловать в **Мастерскую Вдохновения**! 

✨ Вот что вас ждет:
• 📚 Обучающие видео и задания
• ⭐ Система уровней и звёзд (сейчас: ${user?.stars || 0}⭐)
• 🏆 Достижения и бонусы
• 👥 Сообщество единомышленников

Нажмите кнопку ниже чтобы открыть личный кабинет и начать!`;
  
  bot.sendMessage(chatId, welcomeText, {
    parse_mode: 'Markdown',
    reply_markup: {
      inline_keyboard: [[
        {
          text: "📱 Открыть Личный Кабинет",
          web_app: { url: process.env.APP_URL }
        }
      ]]
    }
  });
});

// Обработчик обычных сообщений
bot.on('message', (msg) => {
  const chatId = msg.chat.id;
  
  // Игнорируем команды (они обрабатываются отдельно)
  if (msg.text && msg.text.startsWith('/')) {
    return;
  }
  
  // Отвечаем на обычные сообщения
  if (msg.text) {
    bot.sendMessage(chatId, `💬 ${msg.text}\n\nПопробуйте команду /start для начала работы! 😊`);
  }
});

// Функция запуска приложения
async function startApp() {
  try {
    // Инициализируем базу данных
    await initializeDatabase();
    
    // Запускаем сервер
    app.listen(PORT, () => {
      console.log(`🚀 Server running on port ${PORT}`);
      console.log(`📱 Mini App: ${process.env.APP_URL}`);
      console.log(`🗄️ Database: PostgreSQL`);
      console.log(`✅ Bot is LIVE and waiting for messages!`);
    });
  } catch (error) {
    console.error('❌ Failed to start application:', error);
    process.exit(1);
  }
}

// Запускаем приложение
startApp();
