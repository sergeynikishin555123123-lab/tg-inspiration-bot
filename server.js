import express from 'express';
import TelegramBot from 'node-telegram-bot-api';
import cors from 'cors';

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(cors());

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
    timestamp: new Date().toISOString()
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
    is_registered: false
  };
  res.json({ exists: true, user });
});

app.post('/api/user/register', (req, res) => {
  const { userId, userClass, character } = req.body;
  console.log(`📝 Регистрация: ${userId} - ${userClass} - ${character}`);
  res.json({ 
    success: true, 
    message: 'Пользователь зарегистрирован',
    starsAdded: 5
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
      description: 'Строгая преподавательница академической живописи',
      bonus_type: 'forgiveness',
      bonus_value: '1'
    },
    {
      id: 3,
      class: 'Стилисты',
      character_name: 'Эстелла Моде',
      description: 'Бывший стилист, обучает восприятию образа',
      bonus_type: 'percent_bonus',
      bonus_value: '5'
    }
  ];
  res.json(characters);
});

app.get('/', (req, res) => {
  res.json({
    message: '🎨 Мастерская Вдохновения',
    status: 'API работает',
    endpoints: {
      health: '/health',
      user: '/api/user/:id',
      characters: '/api/characters',
      register: '/api/user/register (POST)'
    }
  });
});

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
          web_app: { url: process.env.APP_URL }
        }
      ]]
    }
  });
});

bot.on('message', (msg) => {
  const chatId = msg.chat.id;
  if (msg.text && !msg.text.startsWith('/')) {
    bot.sendMessage(chatId, '💬 Используйте /start для начала работы! 😊');
  }
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📱 Mini App: ${process.env.APP_URL}`);
  console.log(`🤖 Bot: Active!`);
});
