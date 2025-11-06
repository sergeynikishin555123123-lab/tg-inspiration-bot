require('dotenv').config();
const express = require('express');
const path = require('path');
const TelegramBot = require('node-telegram-bot-api');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json());
app.use(cors());
app.use(express.static('public'));

// Инициализация бота с LONG POLLING
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

// Временное хранилище пользователей
const users = new Map();

// Health check
app.get('/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    message: '✅ Бот работает через long polling!',
    mode: 'polling',
    users_count: users.size,
    timestamp: new Date().toISOString()
  });
});

// API для Mini App - получение данных пользователя
app.get('/api/user/:userId', (req, res) => {
  const { userId } = req.params;
  const user = users.get(userId);
  
  if (!user) {
    return res.json({ exists: false });
  }
  
  res.json({ exists: true, user });
});

// API для Mini App - регистрация пользователя
app.post('/api/user/register', (req, res) => {
  try {
    const { userId, username, name, userClass, character } = req.body;
    
    const user = {
      user_id: userId,
      tg_username: username,
      tg_name: name,
      class: userClass,
      character: character,
      stars: 0,
      level: 'Ученик',
      created_at: new Date().toISOString()
    };
    
    users.set(userId.toString(), user);
    res.json({ success: true, message: 'Пользователь зарегистрирован' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Serve Mini App
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Обработчик команды /start
bot.onText(/\/start/, (msg) => {
  const chatId = msg.chat.id;
  const userId = msg.from.id;
  const username = msg.from.username || '';
  const name = msg.from.first_name || 'Друг';
  
  console.log(`👋 Новый пользователь: ${name} (ID: ${userId})`);
  
  // Сохраняем пользователя
  const user = {
    user_id: userId,
    tg_username: username,
    tg_name: name,
    stars: 0,
    level: 'Ученик',
    created_at: new Date().toISOString()
  };
  
  users.set(userId.toString(), user);
  
  const welcomeText = `🎨 Привет, ${name}! 

Добро пожаловать в **Мастерскую Вдохновения**! 

✨ Вот что вас ждет:
• 📚 Обучающие видео и задания
• ⭐ Система уровней и звёзд
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

// Обработчик callback queries (если будут кнопки)
bot.on('callback_query', (callbackQuery) => {
  const msg = callbackQuery.message;
  bot.answerCallbackQuery(callbackQuery.id)
    .then(() => {
      bot.sendMessage(msg.chat.id, '🔄 Обновляю...');
    });
});

// Обработчик ошибок
bot.on('error', (error) => {
  console.error('❌ Bot error:', error);
});

bot.on('polling_error', (error) => {
  console.error('❌ Polling error:', error);
});

// Запуск сервера
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📱 Mini App: ${process.env.APP_URL}`);
  console.log(`👥 Users storage: in-memory`);
  console.log(`✅ Bot is LIVE and waiting for messages!`);
  
  // Проверяем переменные окружения
  if (!process.env.BOT_TOKEN) {
    console.error('❌ BOT_TOKEN not found in environment variables!');
  } else {
    console.log(`🤖 Bot token: ${process.env.BOT_TOKEN.substring(0, 10)}...`);
  }
});
