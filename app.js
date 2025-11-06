import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import TelegramBot from 'node-telegram-bot-api';
import cors from 'cors';
import dotenv from 'dotenv';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(cors());

const staticPath = path.join(__dirname, 'client/dist');
if (fs.existsSync(staticPath)) {
  console.log('✅ Serving static files from:', staticPath);
  app.use(express.static(staticPath));
} else {
  console.log('⚠️  Client build not found');
}

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

app.get('/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    message: '✅ Бот работает!',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV
  });
});

app.get('/api/user/:userId', (req, res) => {
  const { userId } = req.params;
  const user = {
    user_id: parseInt(userId),
    tg_username: 'user_' + userId,
    tg_name: 'User ' + userId,
    stars: 15.5,
    level: 'Ученик',
    is_registered: false,
    created_at: new Date().toISOString()
  };
  res.json({ exists: true, user });
});

app.post('/api/user/register', (req, res) => {
  const { userId, username, name, userClass, character } = req.body;
  console.log(`📝 Регистрация: ${userId} - ${userClass} - ${character}`);
  
  const updatedUser = {
    user_id: parseInt(userId),
    tg_username: username,
    tg_name: name,
    user_class: userClass,
    character_name: character,
    stars: 20.5,
    level: 'Искатель',
    is_registered: true
  };
  
  res.json({ 
    success: true, 
    message: 'Пользователь зарегистрирован',
    starsAdded: 5,
    user: updatedUser
  });
});

app.get('/api/characters', (req, res) => {
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
  res.json(characters);
});

app.get('*', (req, res) => {
  if (fs.existsSync(staticPath)) {
    res.sendFile(path.join(staticPath, 'index.html'));
  } else {
    res.json({
      message: '🎨 Мастерская Вдохновения - Backend API',
      status: 'running',
      endpoints: {
        health: '/health',
        user: '/api/user/:id',
        characters: '/api/characters',
        register: '/api/user/register (POST)'
      }
    });
  }
});

bot.onText(/\/start/, (msg) => {
  const chatId = msg.chat.id;
  const userId = msg.from.id;
  const username = msg.from.username || '';
  const name = msg.from.first_name || 'Друг';
  
  console.log(`👋 Новый пользователь: ${name} (ID: ${userId})`);
  
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

bot.on('message', (msg) => {
  const chatId = msg.chat.id;
  if (msg.text && !msg.text.startsWith('/')) {
    bot.sendMessage(chatId, '💬 Используйте /start для начала работы с ботом! 😊');
  }
});

bot.on('error', (error) => {
  console.error('❌ Telegram Bot Error:', error);
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📱 Mini App: ${process.env.APP_URL}`);
  console.log(`🤖 Bot: Active and waiting for messages!`);
  console.log(`🔧 Health check: ${process.env.APP_URL}/health`);
});
