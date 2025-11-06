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

console.log('🤖 Bot starting...');

// Импорт маршрутов
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
    version: '1.0.0'
  });
});

app.get('/api/status', (req, res) => {
  res.json({
    bot: 'active',
    database: 'connected',
    users: 0, // Будем получать из БД
    activities: 0
  });
});

// Обработка команды /start
bot.onText(/\/start/, async (msg) => {
  const chatId = msg.chat.id;
  const name = msg.from.first_name || 'Друг';
  const userId = msg.from.id;
  
  // Проверяем, зарегистрирован ли пользователь
  const db = (await import('./config/database.js')).default;
  
  try {
    const user = await new Promise((resolve, reject) => {
      db.get('SELECT * FROM users WHERE user_id = ?', [userId], (err, row) => {
        if (err) reject(err);
        resolve(row);
      });
    });

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
          web_app: { url: process.env.APP_URL }
        }
      ]]
    };

    // Если пользователь не зарегистрирован, добавляем кнопку регистрации
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

  } catch (error) {
    console.error('Error in /start:', error);
    bot.sendMessage(chatId, 'Привет! Добро пожаловать в Мастерскую Вдохновения! 🎨');
  }
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
            web_app: { url: process.env.APP_URL }
          }
        ]]
      }
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
            web_app: { url: process.env.APP_URL }
          }
        ]]
      }
    });
  }
});

// Запуск сервера
app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📱 Mini App: ${process.env.APP_URL}`);
  console.log(`🤖 Bot: Active!`);
  console.log(`📊 API endpoints available`);
});
