import express from 'express';
import TelegramBot from 'node-telegram-bot-api';
import cors from 'cors';
import sqlite3 from 'sqlite3';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

app.use(express.json());
app.use(cors());

// Простая in-memory база для теста
const db = new sqlite3.Database(':memory:');

// Создаем таблицы и заполняем данными
db.serialize(() => {
  // Таблица персонажей
  db.run(`CREATE TABLE characters (
    id INTEGER PRIMARY KEY,
    class TEXT,
    character_name TEXT,
    description TEXT,
    bonus_type TEXT,
    bonus_value TEXT
  )`);

  // Заполняем персонажей
  const chars = [
    ['Художники', 'Лука Цветной', 'Рисует с детства', 'percent_bonus', '10'],
    ['Художники', 'Марина Кисть', 'Строгая преподавательница', 'forgiveness', '1'],
    ['Стилисты', 'Эстелла Моде', 'Бывший стилист', 'percent_bonus', '5']
  ];
  
  const stmt = db.prepare("INSERT INTO characters (class, character_name, description, bonus_type, bonus_value) VALUES (?, ?, ?, ?, ?)");
  chars.forEach(char => stmt.run(char));
  stmt.finalize();

  // Таблица пользователей
  db.run(`CREATE TABLE users (
    user_id INTEGER PRIMARY KEY,
    stars REAL DEFAULT 0,
    level TEXT DEFAULT 'Ученик',
    is_registered BOOLEAN DEFAULT FALSE
  )`);
});

// API маршруты
app.get('/health', (req, res) => {
  res.json({ status: 'OK', message: '✅ Бот работает!' });
});

app.get('/api/webapp/characters', (req, res) => {
  db.all("SELECT * FROM characters", (err, rows) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    
    const grouped = rows.reduce((acc, char) => {
      if (!acc[char.class]) acc[char.class] = [];
      acc[char.class].push(char);
      return acc;
    }, {});
    
    res.json(grouped);
  });
});

app.get('/api/users/:userId', (req, res) => {
  const userId = req.params.userId;
  
  db.get("SELECT * FROM users WHERE user_id = ?", [userId], (err, row) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    
    if (row) {
      res.json({ exists: true, user: row });
    } else {
      res.json({ 
        exists: false, 
        user: { user_id: parseInt(userId), stars: 0, level: 'Ученик', is_registered: false }
      });
    }
  });
});

// Бот
const bot = new TelegramBot(process.env.BOT_TOKEN, { polling: true });

bot.onText(/\/start/, (msg) => {
  const chatId = msg.chat.id;
  bot.sendMessage(chatId, '🎨 Добро пожаловать!', {
    reply_markup: {
      inline_keyboard: [[
        { text: "📱 Личный кабинет", web_app: { url: process.env.APP_URL || `http://localhost:${PORT}` } }
      ]]
    }
  });
});

app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
