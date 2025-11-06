import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import TelegramBot from 'node-telegram-bot-api';
import cors from 'cors';
import dotenv from 'dotenv';
import fs from 'fs';

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
    
    // Имитация данных пользователя (временно без БД)
    const mockUser = {
      user_id: parseInt(userId),
      tg_username: 'test_user',
      tg_name: 'Test User',
      stars: 15.5,
      level: 'Ученик',
      is_registered: false
    };
    
    res.json({ exists: true, user: mockUser });
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
    
    // Имитация успешной регистрации
    const mockResponse = {
      success: true, 
      message: 'Пользователь зарегистрирован',
      starsAdded: 5
    };
    
    console.log(`✅ User ${userId} registered successfully`);
    res.json(mockResponse);
  } catch (error) {
    console.error('❌ Registration error:', error);
    res.status(500).json({ error: error.message });
  }
});

// API для получения классов и персонажей
app.get('/api/characters', async (req, res) => {
  try {
    const characters = [
      {
        id: 1,
        class: 'Художники',
        character_name: 'Лука Цветной',
        description: 'Рисует с детства, любит эксперименты с цветом',
        bonus_type: 'percent_bonus',
        bonus_value: '10'
      },
      {
        id: 2,
        class: 'Художники',
        character_name: 'Марина Кисть',
        description: 'Строгая, но добрая преподавательница академической живописи',
        bonus_type: 'forgiveness',
        bonus_value: '1'
      },
      {
        id: 3,
        class: 'Художники',
        character_name: 'Феликс Штрих',
        description: 'Экспериментатор, мастер быстрых зарисовок',
        bonus_type: 'random_bonus',
        bonus_value: '1-3'
      },
      {
        id: 4,
        class: 'Стилисты',
        character_name: 'Эстелла Моде',
        description: 'Бывший стилист, обучает восприятию образа',
        bonus_type: 'percent_bonus',
        bonus_value: '5'
      },
      {
        id: 5,
        class: 'Стилисты',
        character_name: 'Роза Ателье',
        description: 'Мастер практического шитья и образов',
        bonus_type: 'secret_access',
        bonus_value: 'biweekly'
      },
      {
        id: 6,
        class: 'Стилисты',
        character_name: 'Гертруда Линия',
        description: 'Ценит детали и силу аксессуаров',
        bonus_type: 'series_bonus',
        bonus_value: '1'
      },
      {
        id: 7,
        class: 'Мастера',
        character_name: 'Тихон Творец',
        description: 'Ремесленник, любит простые техники',
        bonus_type: 'photo_bonus',
        bonus_value: '1'
      },
      {
        id: 8,
        class: 'Мастера',
        character_name: 'Агата Узор',
        description: 'Любит неожиданные материалы и коллажи',
        bonus_type: 'weekly_bonus',
        bonus_value: '6'
      },
      {
        id: 9,
        class: 'Мастера',
        character_name: 'Борис Клей',
        description: 'Весёлый мастер импровизаций',
        bonus_type: 'mini_quest',
        bonus_value: '2'
      },
      {
        id: 10,
        class: 'Историки искусства',
        character_name: 'Профессор Артёмий',
        description: 'Экстра-любитель архивов и фактов',
        bonus_type: 'hint',
        bonus_value: '1'
      },
      {
        id: 11,
        class: 'Историки искусства',
        character_name: 'Соня Гравюра',
        description: 'Рассказывает истории картин как сказки',
        bonus_type: 'fact_star',
        bonus_value: '1'
      },
      {
        id: 12,
        class: 'Историки искусства',
        character_name: 'Михаил Эпоха',
        description: 'Любит хронологию и сравнения эпох',
        bonus_type: 'multiplier',
        bonus_value: '2'
      }
    ];
    
    console.log(`📊 Sent ${characters.length} characters to client`);
    res.json(characters);
  } catch (error) {
    console.error('❌ Characters API error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Serve React App for all other routes
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
    const welcomeText = `🎨 Привет, ${name}! 

Добро пожаловать в **Мастерскую Вдохновения**! 

✨ Вот что вас ждет:
• 📚 Обучающие видео и задания
• ⭐ Система уровней и звёзд
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

// Обработчик обычных сообщений
bot.on('message', async (msg) => {
  const chatId = msg.chat.id;
  
  // Игнорируем команды
  if (msg.text && msg.text.startsWith('/')) {
    return;
  }
  
  // Отвечаем на обычные сообщения
  if (msg.text) {
    try {
      await bot.sendMessage(chatId, `💬 ${msg.text}\n\nПривет! Используйте /start для начала работы с ботом! 😊`);
    } catch (error) {
      console.error('❌ Message handling error:', error);
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

// Запускаем сервер
app.listen(PORT, '0.0.0.0', () => {
  console.log(`🎉 Server running on port ${PORT}`);
  console.log(`📱 Mini App: ${process.env.APP_URL}`);
  console.log(`🤖 Bot: Active and waiting for messages!`);
  console.log(`🔧 Health check: ${process.env.APP_URL}/health`);
  
  if (fs.existsSync(staticPath)) {
    console.log(`📁 Client build: Found at ${staticPath}`);
  } else {
    console.log(`⚠️  Client build: Not found - API only mode`);
  }
});
