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

// Инициализация бота с long polling
const bot = new TelegramBot(process.env.BOT_TOKEN, {
  polling: {
    interval: 300,
    autoStart: true,
    params: {
      timeout: 10
    }
  }
});

// Временное хранилище
const users = new Map();

// Health check
app.get('/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    message: 'Бот работает через long polling!',
    mode: 'polling',
    timestamp: new Date().toISOString()
  });
});

// API для Mini App
app.get('/api/user/:userId', (req, res) => {
  const { userId } = req.params;
  const user = users.get(userId);
  res.json({ exists: !!user, user: user || null });
});

app.post('/api/user/register', (req, res) => {
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
});

// Serve Mini App
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Обработчик команды /start
bot.onText(/\/start/, (msg) => {
  const chatId = msg.chat.id;
  const userId = msg.from.id;
  const name = msg.from.first_name || 'Друг';
  
  console.log(`👋 User ${userId} started bot`);
  
  // Сохраняем пользователя
  const user = {
    user_id: userId,
    tg_username: msg.from.username || '',
    tg_name: name,
    stars: 0,
    level: 'Ученик',
    created_at: new Date().toISOString()
  };
  
  users.set(userId.toString(), user);
  
  const welcomeText = `🎨 Привет, ${name}! Добро пожаловать в Мастерскую Вдохновения!

✅ Бот успешно запущен и работает!

Вот что доступно прямо сейчас:
• 📱 Личный кабинет с прогрессом
• ⭐ Система уровней и достижений  
• 🎯 Персональные задания

Нажмите кнопку ниже чтобы открыть личный кабинет!`;
  
  bot.sendMessage(chatId, welcomeText, {
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

// Простой ответ на сообщения
bot.on('message', (msg) => {
  if (msg.text && !msg.text.startsWith('/')) {
    bot.sendMessage(msg.chat.id, `💬 Вы написали: "${msg.text}"\n\nИспользуйте /start для начала работы с ботом!`);
  }
});

// Запуск сервера
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`🤖 Bot started in POLLING mode`);
  console.log(`📱 App URL: ${process.env.APP_URL}`);
  console.log(`✅ Bot is ready to receive messages!`);
});
