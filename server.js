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
const PORT = process.env.PORT || 3001; // Изменили на 3001

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

console.log('🤖 Bot starting with token:', process.env.BOT_TOKEN.substring(0, 10) + '...');

// Инициализация бота с обработкой ошибок
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

// Импорт маршрутов и базы данных
import { initDatabase } from './config/database.js';
import userRoutes from './routes/users.js';
import adminRoutes from './routes/admin.js';
import webappRoutes from './routes/webapp.js';

// Инициализация базы данных
initDatabase();

// Подключение маршрутов
app.use('/api/users', userRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/webapp', webappRoutes);

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

app.get('/api/status', (req, res) => {
  res.json({
    bot: 'active',
    database: 'connected',
    port: PORT,
    environment: process.env.NODE_ENV || 'development'
  });
});

app.get('/', (req, res) => {
  res.json({
    message: '🎨 Мастерская Вдохновения - API',
    status: 'Работает',
    endpoints: {
      health: '/health',
      status: '/api/status',
      user: '/api/users/:id',
      characters: '/api/webapp/characters'
    }
  });
});

// Обработка команды /start
bot.onText(/\/start/, async (msg) => {
  const chatId = msg.chat.id;
  const name = msg.from.first_name || 'Друг';
  const userId = msg.from.id;
  
  console.log(`👤 User ${userId} started bot`);

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

  bot.sendMessage(chatId, welcomeText, {
    parse_mode: 'Markdown',
    reply_markup: keyboard
  }).catch(error => {
    console.error('Error sending welcome message:', error);
  });
});

// Обработка callback кнопок
bot.on('callback_query', async (callbackQuery) => {
  const message = callbackQuery.message;
  const data = callbackQuery.data;
  const userId = callbackQuery.from.id;

  console.log(`🔘 Callback from user ${userId}:`, data);

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
    }).catch(error => {
      console.error('Error editing message:', error);
    });
  }
});

// Обработка обычных сообщений
bot.on('message', (msg) => {
  const chatId = msg.chat.id;
  if (msg.text && !msg.text.startsWith('/')) {
    bot.sendMessage(chatId, '💬 Используйте /start для начала работы или откройте личный кабинет через кнопку ниже! 😊', {
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
  }
});

// Обработка ошибок бота
bot.on('error', (error) => {
  console.error('❌ Bot error:', error);
});

// Запуск сервера с обработкой ошибок
const server = app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📱 Health check: http://localhost:${PORT}/health`);
  console.log(`🤖 Bot: Active!`);
}).on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`❌ Port ${PORT} is already in use!`);
    console.log('💡 Try one of these solutions:');
    console.log('   1. Kill the process using port:', PORT);
    console.log('   2. Change PORT in .env file');
    console.log('   3. Wait a few minutes and try again');
  } else {
    console.error('❌ Server error:', err);
  }
  process.exit(1);
});

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('🛑 Shutting down gracefully...');
  server.close(() => {
    console.log('✅ Server closed');
    process.exit(0);
  });
});

export default app;
