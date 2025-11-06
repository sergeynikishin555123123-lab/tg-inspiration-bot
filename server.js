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

// Инициализация базы данных и маршрутов
try {
  const { initDatabase } = await import('./config/database.js');
  initDatabase();
  
  // Импортируем маршруты
  const userRoutes = (await import('./routes/users.js')).default;
  const adminRoutes = (await import('./routes/admin.js')).default;
  const webappRoutes = (await import('./routes/webapp.js')).default;
  
  // Подключаем маршруты
  app.use('/api/users', userRoutes);
  app.use('/api/admin', adminRoutes);
  app.use('/api/webapp', webappRoutes);
  
  console.log('✅ Routes initialized');
} catch (error) {
  console.error('❌ Error initializing routes:', error);
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

app.get('/', (req, res) => {
  res.json({
    message: '🎨 Мастерская Вдохновения - API',
    status: 'Работает',
    endpoints: {
      health: '/health',
      user: '/api/users/:id',
      characters: '/api/webapp/characters'
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
