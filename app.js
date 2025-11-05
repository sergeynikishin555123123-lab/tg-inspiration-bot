require('dotenv').config();
const express = require('express');
const { Pool } = require('pg');
const path = require('path');
const TelegramBot = require('node-telegram-bot-api');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json());
app.use(cors());
app.use(express.static(path.join(__dirname, 'build')));

// Подключение к БД
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

// Инициализация бота
const bot = new TelegramBot(process.env.BOT_TOKEN);

// Создание таблиц при запуске
async function initializeDatabase() {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS users (
        user_id BIGINT PRIMARY KEY,
        tg_username VARCHAR(255),
        tg_name VARCHAR(255),
        class VARCHAR(100),
        character VARCHAR(100),
        stars FLOAT DEFAULT 0,
        level VARCHAR(50) DEFAULT 'Ученик',
        last_active_date DATE,
        daily_commented BOOLEAN DEFAULT false,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('✅ Database tables initialized');
  } catch (error) {
    console.error('❌ Database initialization error:', error);
  }
}

// Проверка работы
app.get('/health', async (req, res) => {
  try {
    await pool.query('SELECT 1');
    res.json({ 
      status: 'OK', 
      database: 'connected',
      message: 'Мастерская Вдохновения работает!',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({ 
      status: 'ERROR', 
      database: 'disconnected',
      error: error.message 
    });
  }
});

// Webhook для Telegram
app.post('/webhook', (req, res) => {
  bot.processUpdate(req.body);
  res.send('OK');
});

// Serve Mini App
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'build', 'index.html'));
});

// Обработчик команды /start
bot.onText(/\/start/, async (msg) => {
  const chatId = msg.chat.id;
  const userId = msg.from.id;
  const username = msg.from.username || '';
  const name = msg.from.first_name || 'Пользователь';
  
  try {
    await pool.query(
      `INSERT INTO users (user_id, tg_username, tg_name, stars, level) 
       VALUES ($1, $2, $3, 0, 'Учениk')
       ON CONFLICT (user_id) DO NOTHING`,
      [userId, username, name]
    );
    
    const welcomeText = `🎨 Добро пожаловать в Мастерскую Вдохновения, ${name}!

Система успешно запущена! Скоро здесь появятся:
• Обучающие видео и задания
• Система уровней и звёзд
• Интерактивные квизы
• Сообщество единомышленников

Нажмите "Открыть Личный Кабинет" чтобы начать!`;
    
    bot.sendMessage(chatId, welcomeText, {
      reply_markup: {
        inline_keyboard: [[
          {
            text: "📱 Открыть Личный Кабинет",
            web_app: { url: `${process.env.APP_URL}` }
          }
        ]]
      }
    });
  } catch (error) {
    console.error('Error in /start:', error);
  }
});

// Запуск сервера
app.listen(PORT, async () => {
  await initializeDatabase();
  
  // Установка webhook
  bot.setWebHook(`${process.env.WEBHOOK_URL}`)
    .then(() => console.log('✅ Webhook set successfully'))
    .catch(err => console.error('❌ Webhook error:', err));
    
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`🌐 Health check: ${process.env.APP_URL}/health`);
  console.log(`🤖 Bot is ready!`);
});
