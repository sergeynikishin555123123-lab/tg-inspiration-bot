import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import TelegramBot from 'node-telegram-bot-api';
import cors from 'cors';
import dotenv from 'dotenv';
import fs from 'fs';

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
const staticPath = path.join(__dirname, 'client/dist');
if (fs.existsSync(staticPath)) {
  console.log('✅ Serving static files from:', staticPath);
  app.use(express.static(staticPath));
} else {
  console.log('⚠️  Client build not found at:', staticPath);
  console.log('📁 Current directory contents:', fs.readdirSync(__dirname));
}

// Инициализация бота
console.log('🤖 Initializing Telegram Bot...');
const bot = new TelegramBot(process.env.BOT_TOKEN, {
  polling: {
    interval: 300,
    autoStart: true,
    params: {
      timeout: 10
    }
  }
});

// Health check endpoint
app.get('/health', async (req, res) => {
  try {
    const healthInfo = {
      status: 'OK',
      message: '✅ Бот работает через long polling!',
      mode: 'polling',
      timestamp: new Date().toISOString(),
      database: 'PostgreSQL',
      environment: process.env.NODE_ENV,
      client_build: fs.existsSync(staticPath) ? 'Exists' : 'Missing'
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
    console.log(`📱 API Request for user: ${userId}`);
    
    const user = await getUser(parseInt(userId));
    
    if (!user) {
      return res.json({ exists: false });
    }
    
    res.json({ exists: true, user });
  } catch (error) {
    console.error('❌ API Error:', error);
    res.status(500).json({ error: error.message });
  }
});

// API для Mini App - регистрация пользователя
app.post('/api/user/register', async (req, res) => {
  try {
    const { userId, username, name, userClass, character } = req.body;
    
    console.log(`📝 Registration request for user ${userId}: ${userClass} - ${character}`);
    
    const updateData = {
      user_class: userClass,
      character_name: character,
      is_registered: true
    };
    
    const updatedUser = await updateUser(userId, updateData);
    
    if (updatedUser) {
      // Начисляем звезды за регистрацию
      await addStars(userId, 5, 'registration', 'Регистрация в системе');
      
      console.log(`✅ User ${userId} registered successfully`);
      
      res.json({ 
        success: true, 
        message: 'Пользователь зарегистрирован',
        starsAdded: 5
      });
    } else {
      console.log(`❌ User ${userId} not found for registration`);
      res.status(400).json({ error: 'Пользователь не найден' });
    }
  } catch (error) {
    console.error('❌ Registration error:', error);
    res.status(500).json({ error: error.message });
  }
});

// API для получения классов и персонажей
app.get('/api/characters', async (req, res) => {
  try {
    const { pool } = await import('./database.js');
    const result = await pool.query('SELECT * FROM characters ORDER BY class, character_name');
    console.log(`📊 Sent ${result.rows.length} characters to client`);
    res.json(result.rows);
  } catch (error) {
    console.error('❌ Characters API error:', error);
    res.status(500).json({ error: error.message });
  }
});

// API для проверки бота
app.get('/api/bot-info', (req, res) => {
  res.json({
    bot_username: process.env.BOT_USERNAME,
    webapp_url: process.env.APP_URL,
    status: 'active'
  });
});

// Serve React App for all other routes - только если сборка существует
app.get('*', (req, res) => {
  if (fs.existsSync(staticPath)) {
    res.sendFile(path.join(staticPath, 'index.html'));
  } else {
    res.json({
      message: '🎨 Мастерская Вдохновения - Backend API',
      status: 'running',
      client: 'Client build not found. Run: cd client && npm run build',
      endpoints: {
        health: '/health',
        user: '/api/user/:id',
        characters: '/api/characters',
        register: '/api/user/register (POST)'
      }
    });
  }
});

// Обработчик команды /start
bot.onText(/\/start/, async (msg) => {
  const chatId = msg.chat.id;
  const userId = msg.from.id;
  const username = msg.from.username || '';
  const name = msg.from.first_name || 'Друг';
  
  console.log(`👋 New user: ${name} (ID: ${userId})`);
  
  try {
    // Создаем или получаем пользователя
    let user = await getUser(userId);
    if (!user) {
      user = await createUser({
        user_id: userId,
        tg_username: username,
        tg_name: name
      });
      console.log(`✅ Created new user: ${userId}`);
    } else {
      console.log(`✅ Found existing user: ${userId}`);
    }
    
    const welcomeText = `🎨 Привет, ${name}! 

Добро пожаловать в **Мастерскую Вдохновения**! 

✨ Вот что вас ждет:
• 📚 Обучающие видео и задания
• ⭐ Система уровней и звёзд (сейчас: ${user?.stars || 0}⭐)
• 🏆 Достижения и бонусы
• 👥 Сообщество единомышленников

Нажмите кнопку ниже чтобы открыть личный кабинет и начать!`;
    
    await bot.sendMessage(chatId, welcomeText, {
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
    
  } catch (error) {
    console.error('❌ Error in /start command:', error);
    await bot.sendMessage(chatId, '😔 Произошла ошибка. Попробуйте позже.');
  }
});

// Обработчик callback queries (нажатия на кнопки)
bot.on('callback_query', async (callbackQuery) => {
  const message = callbackQuery.message;
  const data = callbackQuery.data;
  
  try {
    if (data === 'open_webapp') {
      await bot.answerCallbackQuery(callbackQuery.id);
      await bot.sendMessage(message.chat.id, 'Открываю личный кабинет...', {
        reply_markup: {
          inline_keyboard: [[
            {
              text: "📱 Открыть Личный Кабинет",
              web_app: { url: process.env.APP_URL }
            }
          ]]
        }
      });
    }
  } catch (error) {
    console.error('❌ Callback query error:', error);
  }
});

// Обработчик обычных сообщений
bot.on('message', async (msg) => {
  const chatId = msg.chat.id;
  const userId = msg.from.id;
  
  // Игнорируем команды (они обрабатываются отдельно)
  if (msg.text && msg.text.startsWith('/')) {
    return;
  }
  
  // Игнорируем служебные сообщения
  if (msg.web_app_data || msg.successful_payment) {
    return;
  }
  
  // Отвечаем на обычные сообщения
  if (msg.text) {
    try {
      // Проверяем, зарегистрирован ли пользователь
      const user = await getUser(userId);
      
      if (user && user.is_registered) {
        await bot.sendMessage(chatId, `💬 ${msg.text}\n\nОтличное сообщение! 🎨\n\nИспользуйте кнопку ниже для доступа к личному кабинету.`, {
          reply_markup: {
            inline_keyboard: [[
              {
                text: "📱 Личный Кабинет",
                web_app: { url: process.env.APP_URL }
              }
            ]]
          }
        });
      } else {
        await bot.sendMessage(chatId, `💬 ${msg.text}\n\nПривет! Нажмите /start чтобы начать работу с ботом! 😊`);
      }
    } catch (error) {
      console.error('❌ Message handling error:', error);
      await bot.sendMessage(chatId, '😔 Произошла ошибка. Попробуйте команду /start');
    }
  }
});

// Обработка ошибок бота
bot.on('error', (error) => {
  console.error('❌ Telegram Bot Error:', error);
});

bot.on('polling_error', (error) => {
  console.error('❌ Telegram Polling Error:', error);
});

// Функция для проверки доступности базы данных
async function checkDatabaseConnection() {
  try {
    const { pool } = await import('./database.js');
    const client = await pool.connect();
    console.log('✅ Database connection successful');
    client.release();
    return true;
  } catch (error) {
    console.error('❌ Database connection failed:', error);
    return false;
  }
}

// Функция запуска приложения
async function startApp() {
  try {
    console.log('🚀 Starting Мастерская Вдохновения...');
    console.log('📊 Environment:', process.env.NODE_ENV);
    console.log('🌐 App URL:', process.env.APP_URL);
    
    // Проверяем подключение к базе данных
    const dbConnected = await checkDatabaseConnection();
    if (!dbConnected) {
      console.log('⚠️  Continuing without database connection...');
    }
    
    // Инициализируем базу данных
    await initializeDatabase();
    
    // Запускаем сервер
    app.listen(PORT, '0.0.0.0', () => {
      console.log(`🎉 Server running on port ${PORT}`);
      console.log(`📱 Mini App: ${process.env.APP_URL}`);
      console.log(`🗄️ Database: ${dbConnected ? 'Connected' : 'Disconnected'}`);
      console.log(`🤖 Bot: Active and waiting for messages!`);
      console.log(`🔧 Health check: ${process.env.APP_URL}/health`);
      
      // Выводим информацию о клиентской сборке
      if (fs.existsSync(staticPath)) {
        console.log(`📁 Client build: Found at ${staticPath}`);
      } else {
        console.log(`⚠️  Client build: Not found - API only mode`);
      }
    });
    
  } catch (error) {
    console.error('❌ Failed to start application:', error);
    process.exit(1);
  }
}

// Обработка graceful shutdown
process.on('SIGINT', async () => {
  console.log('🛑 Shutting down gracefully...');
  try {
    bot.stopPolling();
    console.log('✅ Bot polling stopped');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error during shutdown:', error);
    process.exit(1);
  }
});

process.on('SIGTERM', async () => {
  console.log('🛑 Received SIGTERM, shutting down...');
  try {
    bot.stopPolling();
    console.log('✅ Bot polling stopped');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error during shutdown:', error);
    process.exit(1);
  }
});

// Обработка необработанных исключений
process.on('uncaughtException', (error) => {
  console.error('❌ Uncaught Exception:', error);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ Unhandled Rejection at:', promise, 'reason:', reason);
});

// Запускаем приложение
startApp();
