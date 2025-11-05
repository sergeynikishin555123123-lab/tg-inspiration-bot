require('dotenv').config();
const express = require('express');
const { Pool } = require('pg');
const path = require('path');
const TelegramBot = require('node-telegram-bot-api');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json());
app.use(express.static(path.join(__dirname, '../frontend/build')));

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
      );
      
      CREATE TABLE IF NOT EXISTS activities (
        activity_id SERIAL PRIMARY KEY,
        type VARCHAR(50),
        title VARCHAR(255),
        description TEXT,
        reward_rules JSONB,
        related_video_id VARCHAR(100)
      );
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

// API для Mini App - получение данных пользователя
app.get('/api/user/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const result = await pool.query(
      'SELECT * FROM users WHERE user_id = $1',
      [userId]
    );
    
    if (result.rows.length === 0) {
      return res.json({ exists: false });
    }
    
    res.json({ exists: true, user: result.rows[0] });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// API для Mini App - регистрация пользователя
app.post('/api/user/register', async (req, res) => {
  try {
    const { userId, username, name, userClass, character } = req.body;
    
    await pool.query(
      `INSERT INTO users (user_id, tg_username, tg_name, class, character, stars, level) 
       VALUES ($1, $2, $3, $4, $5, 0, 'Ученик')
       ON CONFLICT (user_id) DO UPDATE SET 
       tg_username = $2, tg_name = $3, class = $4, character = $5`,
      [userId, username, name, userClass, character]
    );
    
    res.json({ success: true, message: 'Пользователь зарегистрирован' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Serve Mini App
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/build/index.html'));
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
       VALUES ($1, $2, $3, 0, 'Ученик')
       ON CONFLICT (user_id) DO NOTHING`,
      [userId, username, name]
    );
    
    const welcomeText = `🎨 Добро пожаловать в Мастерскую Вдохновения, ${name}!

Здесь вы сможете:
• Смотреть обучающие видео
• Выполнять задания и получать звёзды
• Открывать новые уровни и бонусы
• Общаться с единомышленниками

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
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`🌐 Health check: ${process.env.APP_URL}/health`);
  console.log(`🤖 Bot is waiting for messages...`);
});
