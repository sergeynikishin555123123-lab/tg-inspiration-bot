import express from 'express';

const app = express();
app.use(express.json());
app.use(express.static('public'));

console.log('🎨 Мастерская Вдохновения - Запуск...');

// In-memory база данных
const database = {
  users: new Map(),
  characters: new Map(),
  quizzes: new Map(),
  admins: new Map(),
  activities: new Map(),
  quizCompletions: new Map()
};

// Инициализация данных
function initializeData() {
  console.log('📊 Инициализация данных...');
  
  // Персонажи
  const characters = [
    { id: 1, class: 'Художники', name: 'Лука Цветной', description: 'Рисует с детства, любит эксперименты с цветом', bonus_type: 'percent_bonus', bonus_value: '10', buttons: ['quiz', 'photo_work', 'shop', 'invite', 'activities'] },
    { id: 2, class: 'Художники', name: 'Марина Кисть', description: 'Строгая преподавательница академической живописи', bonus_type: 'forgiveness', bonus_value: '1', buttons: ['quiz', 'photo_work', 'invite', 'activities'] },
    { id: 3, class: 'Художники', name: 'Феликс Штрих', description: 'Экспериментатор, мастер зарисовок', bonus_type: 'random_gift', bonus_value: '1-3', buttons: ['quiz', 'photo_work', 'shop', 'activities'] },
    { id: 4, class: 'Стилисты', name: 'Эстелла Моде', description: 'Бывший стилист, обучает восприятию образа', bonus_type: 'percent_bonus', bonus_value: '5', buttons: ['quiz', 'shop', 'invite', 'activities'] },
    { id: 5, class: 'Стилисты', name: 'Роза Ателье', description: 'Мастер практического шитья', bonus_type: 'secret_advice', bonus_value: '2weeks', buttons: ['photo_work', 'shop', 'activities'] },
    { id: 6, class: 'Стилисты', name: 'Гертруда Линия', description: 'Ценит детали и аксессуары', bonus_type: 'series_bonus', bonus_value: '1', buttons: ['quiz', 'photo_work', 'invite', 'activities'] },
    { id: 7, class: 'Мастера', name: 'Тихон Творец', description: 'Ремесленник, любит простые техники', bonus_type: 'photo_bonus', bonus_value: '1', buttons: ['photo_work', 'shop', 'activities'] },
    { id: 8, class: 'Мастера', name: 'Агата Узор', description: 'Любит неожиданные материалы', bonus_type: 'weekly_surprise', bonus_value: '6', buttons: ['quiz', 'photo_work', 'shop', 'activities'] },
    { id: 9, class: 'Мастера', name: 'Борис Клей', description: 'Весёлый мастер импровизаций', bonus_type: 'mini_quest', bonus_value: '2', buttons: ['quiz', 'shop', 'invite', 'activities'] },
    { id: 10, class: 'Историки', name: 'Профессор Артёмий', description: 'Любитель архивов и фактов', bonus_type: 'quiz_hint', bonus_value: '1', buttons: ['quiz', 'activities', 'invite'] },
    { id: 11, class: 'Историки', name: 'Соня Гравюра', description: 'Рассказывает истории картин', bonus_type: 'fact_star', bonus_value: '1', buttons: ['quiz', 'photo_work', 'activities'] },
    { id: 12, class: 'Историки', name: 'Михаил Эпоха', description: 'Любит хронологию и эпохи', bonus_type: 'streak_multiplier', bonus_value: '2', buttons: ['quiz', 'shop', 'invite', 'activities'] }
  ];

  characters.forEach(char => {
    database.characters.set(char.id, char);
  });

  // Админы
  database.admins.set(898508164, { user_id: 898508164, username: 'admin', role: 'superadmin' });

  // Тестовые квизы
  const quizzes = [
    {
      id: 1,
      title: "🎨 Основы живописи",
      description: "Проверьте свои знания основ живописи",
      questions: [
        {
          question: "Кто написал картину 'Мона Лиза'?",
          options: ["Винсент Ван Гог", "Леонардо да Винчи", "Пабло Пикассо", "Клод Моне"],
          correctAnswer: 1
        },
        {
          question: "Какие три основных цвета?",
          options: ["Красный, синий, зеленый", "Красный, желтый, синий", "Черный, белый, серый", "Фиолетовый, оранжевый, зеленый"],
          correctAnswer: 1
        }
      ],
      sparks_reward: 2,
      cooldown_hours: 24,
      is_active: true
    },
    {
      id: 2,
      title: "🏛️ История искусства",
      description: "Тест по истории мирового искусства",
      questions: [
        {
          question: "В какой стране зародился стиль барокко?",
          options: ["Франция", "Италия", "Испания", "Германия"],
          correctAnswer: 1
        }
      ],
      sparks_reward: 3,
      cooldown_hours: 48,
      is_active: true
    }
  ];

  quizzes.forEach(quiz => {
    database.quizzes.set(quiz.id, quiz);
  });

  console.log('✅ Данные инициализированы');
}

// Utility functions
function calculateLevel(sparks) {
  if (sparks >= 400) return 'Наставник';
  if (sparks >= 300) return 'Мастер';
  if (sparks >= 150) return 'Знаток';
  if (sparks >= 50) return 'Искатель';
  return 'Ученик';
}

function generateUserId() {
  return Math.floor(100000 + Math.random() * 900000);
}

// API Routes

// Health check
app.get('/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    message: '✅ Сервер работает!',
    timestamp: new Date().toISOString(),
    users: database.users.size,
    characters: database.characters.size,
    quizzes: database.quizzes.size
  });
});

// Serve main page
app.get('/', (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html>
    <head>
        <title>Мастерская Вдохновения</title>
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <style>
            body { 
                font-family: Arial, sans-serif; 
                margin: 0; 
                padding: 20px; 
                background: linear-gradient(135deg, #667eea, #764ba2);
                color: white;
                text-align: center;
            }
            .container { 
                max-width: 400px; 
                margin: 50px auto; 
                background: rgba(255,255,255,0.95); 
                padding: 30px; 
                border-radius: 15px; 
                color: #333;
                box-shadow: 0 10px 30px rgba(0,0,0,0.3);
            }
            h1 { color: #667eea; margin-bottom: 10px; }
            .btn { 
                display: block; 
                width: 100%; 
                padding: 15px; 
                margin: 10px 0; 
                background: #667eea; 
                color: white; 
                border: none; 
                border-radius: 10px; 
                font-size: 16px; 
                cursor: pointer; 
                text-decoration: none;
            }
            .btn:hover { background: #5a67d8; }
            .status { 
                background: #48bb78; 
                color: white; 
                padding: 10px; 
                border-radius: 5px; 
                margin: 10px 0;
            }
        </style>
    </head>
    <body>
        <div class="container">
            <h1>🎨 Мастерская Вдохновения</h1>
            <p>Ваш творческий помощник в Telegram</p>
            
            <div class="status">
                ✅ Сервер работает исправно
            </div>
            
            <p><strong>Статистика:</strong></p>
            <p>Пользователей: ${database.users.size}</p>
            <p>Персонажей: ${database.characters.size}</p>
            <p>Квизов: ${database.quizzes.size}</p>
            
            <a href="/webapp" class="btn">📱 Открыть приложение</a>
            <a href="/admin" class="btn">🔧 Панель администратора</a>
        </div>
    </body>
    </html>
  `);
});

// WebApp interface
app.get('/webapp', (req, res) => {
  const userId = req.query.userId || generateUserId();
  
  res.send(`
    <!DOCTYPE html>
    <html>
    <head>
        <title>Мастерская Вдохновения</title>
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <meta name="telegram-web-app-theme-color" content="#667eea">
        <script src="https://telegram.org/js/telegram-web-app.js"></script>
        <style>
            * { margin: 0; padding: 0; box-sizing: border-box; }
            body { 
                font-family: -apple-system, BlinkMacSystemFont, sans-serif; 
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                min-height: 100vh;
                padding: 20px;
                color: #333;
            }
            .container { max-width: 400px; margin: 0 auto; }
            .card { 
                background: rgba(255,255,255,0.95); 
                border-radius: 15px; 
                padding: 20px; 
                margin-bottom: 15px; 
                box-shadow: 0 8px 25px rgba(0,0,0,0.1);
            }
            h1 { color: #2d3748; text-align: center; margin-bottom: 10px; }
            .btn { 
                width: 100%; 
                padding: 15px; 
                background: linear-gradient(135deg, #667eea, #764ba2); 
                color: white; 
                border: none; 
                border-radius: 10px; 
                font-size: 16px; 
                font-weight: 600; 
                cursor: pointer; 
                margin: 8px 0;
                transition: transform 0.2s;
            }
            .btn:hover { transform: translateY(-2px); }
            .user-info { 
                display: flex; 
                justify-content: space-between; 
                padding: 10px 0; 
                border-bottom: 1px solid #e2e8f0; 
            }
            .sparks { 
                font-size: 36px; 
                font-weight: bold; 
                text-align: center; 
                color: #ffd700; 
                margin: 15px 0; 
            }
            .loading { text-align: center; color: #718096; padding: 20px; }
        </style>
    </head>
    <body>
        <div class="container">
            <div class="card">
                <h1>🎨 Мастерская Вдохновения</h1>
                <p style="text-align: center; color: #718096; margin-bottom: 15px;">Ваш личный кабинет</p>
                
                <div id="userData">
                    <div class="loading">⏳ Загрузка данных...</div>
                </div>
            </div>

            <div class="card">
                <h3 style="margin-bottom: 12px;">🚀 Быстрые действия</h3>
                <button class="btn" onclick="showScreen('quizzes')">📝 Пройти квиз</button>
                <button class="btn" onclick="showScreen('characters')">👥 Выбрать персонажа</button>
                <button class="btn" onclick="loadUserData()">🔄 Обновить данные</button>
            </div>

            <div id="quizzesScreen" class="card" style="display: none;">
                <h3>📝 Доступные квизы</h3>
                <div id="quizzesList"></div>
                <button class="btn" onclick="showScreen('main')">← Назад</button>
            </div>

            <div id="charactersScreen" class="card" style="display: none;">
                <h3>👥 Выбор персонажа</h3>
                <div id="charactersList"></div>
                <button class="btn" onclick="showScreen('main')">← Назад</button>
            </div>
        </div>

        <script>
            const userId = ${userId};
            let userData = null;

            // Инициализация Telegram WebApp
            function initTelegram() {
                if (window.Telegram && Telegram.WebApp) {
                    const tg = Telegram.WebApp;
                    tg.ready();
                    tg.expand();
                    tg.setHeaderColor('#667eea');
                    tg.setBackgroundColor('#667eea');
                }
            }

            // Загрузка данных пользователя
            async function loadUserData() {
                try {
                    const response = await fetch('/api/users/' + userId);
                    const data = await response.json();
                    
                    if (data.success) {
                        userData = data.user;
                        displayUserData(userData);
                    }
                } catch (error) {
                    console.error('Error:', error);
                    document.getElementById('userData').innerHTML = '<div style="color: red; text-align: center;">Ошибка загрузки</div>';
                }
            }

            // Отображение данных пользователя
            function displayUserData(user) {
                const userHtml = \`
                    <div class="user-info">
                        <span>ID:</span>
                        <span>\${user.user_id}</span>
                    </div>
                    <div class="user-info">
                        <span>Имя:</span>
                        <span>\${user.tg_first_name || 'Пользователь'}</span>
                    </div>
                    <div class="user-info">
                        <span>Уровень:</span>
                        <span>\${user.level}</span>
                    </div>
                    <div class="sparks">✨ \${user.sparks}</div>
                    <div class="user-info">
                        <span>Класс:</span>
                        <span>\${user.class || 'Не выбран'}</span>
                    </div>
                    <div class="user-info">
                        <span>Персонаж:</span>
                        <span>\${user.character_name || 'Не выбран'}</span>
                    </div>
                \`;
                document.getElementById('userData').innerHTML = userHtml;
            }

            // Управление экранами
            function showScreen(screen) {
                document.querySelectorAll('.card').forEach(card => {
                    card.style.display = 'none';
                });
                
                if (screen === 'main') {
                    document.querySelectorAll('.card')[0].style.display = 'block';
                    document.querySelectorAll('.card')[1].style.display = 'block';
                } else if (screen === 'quizzes') {
                    document.getElementById('quizzesScreen').style.display = 'block';
                    loadQuizzes();
                } else if (screen === 'characters') {
                    document.getElementById('charactersScreen').style.display = 'block';
                    loadCharacters();
                }
            }

            // Загрузка квизов
            async function loadQuizzes() {
                try {
                    const response = await fetch('/api/webapp/quizzes?userId=' + userId);
                    const data = await response.json();
                    
                    let quizzesHtml = '';
                    data.quizzes.forEach(quiz => {
                        quizzesHtml += \`
                            <div style="border: 1px solid #e2e8f0; padding: 12px; margin: 8px 0; border-radius: 8px;">
                                <div style="font-weight: 600; margin-bottom: 5px;">\${quiz.title}</div>
                                <div style="color: #718096; font-size: 14px; margin-bottom: 8px;">\${quiz.description}</div>
                                <div style="color: #48bb78; font-weight: 600;">Награда: \${quiz.sparks_reward}✨</div>
                                <button class="btn" onclick="startQuiz(\${quiz.id})" style="margin-top: 8px; padding: 10px;">
                                    Начать квиз
                                </button>
                            </div>
                        \`;
                    });
                    
                    document.getElementById('quizzesList').innerHTML = quizzesHtml || '<p>Квизы не найдены</p>';
                } catch (error) {
                    document.getElementById('quizzesList').innerHTML = '<p>Ошибка загрузки</p>';
                }
            }

            // Загрузка персонажей
            async function loadCharacters() {
                try {
                    const response = await fetch('/api/webapp/characters');
                    const data = await response.json();
                    
                    let charactersHtml = '';
                    data.characters.forEach(char => {
                        charactersHtml += \`
                            <div style="border: 1px solid #e2e8f0; padding: 12px; margin: 8px 0; border-radius: 8px; cursor: pointer;" 
                                 onclick="selectCharacter(\${char.id})">
                                <div style="font-weight: 600; color: #667eea;">\${char.class}</div>
                                <div style="font-weight: 600; margin: 5px 0;">\${char.name}</div>
                                <div style="color: #718096; font-size: 14px; margin-bottom: 8px;">\${char.description}</div>
                                <div style="color: #48bb78; font-size: 12px;">Бонус: \${getBonusDescription(char.bonus_type, char.bonus_value)}</div>
                            </div>
                        \`;
                    });
                    
                    document.getElementById('charactersList').innerHTML = charactersHtml;
                } catch (error) {
                    document.getElementById('charactersList').innerHTML = '<p>Ошибка загрузки</p>';
                }
            }

            function getBonusDescription(type, value) {
                const bonuses = {
                    'percent_bonus': \`+\${value}% к искрам\`,
                    'forgiveness': 'Право на ошибку',
                    'random_gift': 'Случайный подарок'
                };
                return bonuses[type] || 'Особый бонус';
            }

            async function selectCharacter(characterId) {
                try {
                    const response = await fetch('/api/users/register', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            userId: userId,
                            userClass: 'Художники',
                            characterId: characterId,
                            tgFirstName: 'Пользователь'
                        })
                    });
                    
                    const result = await response.json();
                    if (result.success) {
                        alert('Персонаж выбран!');
                        showScreen('main');
                        loadUserData();
                    }
                } catch (error) {
                    alert('Ошибка выбора персонажа');
                }
            }

            async function startQuiz(quizId) {
                try {
                    const response = await fetch('/api/webapp/quizzes/' + quizId);
                    const quiz = await response.json();
                    
                    if (quiz.success) {
                        // Простой квиз интерфейс
                        let quizHtml = '<h4>' + quiz.quiz.title + '</h4>';
                        quiz.quiz.questions.forEach((q, qIndex) => {
                            quizHtml += '<div style="margin: 10px 0;"><strong>' + q.question + '</strong>';
                            q.options.forEach((opt, oIndex) => {
                                quizHtml += \`<div><label><input type="radio" name="q\${qIndex}" value="\${oIndex}"> \${opt}</label></div>\`;
                            });
                            quizHtml += '</div>';
                        });
                        quizHtml += '<button class="btn" onclick="submitQuiz(' + quizId + ')">Отправить ответы</button>';
                        
                        document.getElementById('quizzesList').innerHTML = quizHtml;
                    }
                } catch (error) {
                    alert('Ошибка запуска квиза');
                }
            }

            async function submitQuiz(quizId) {
                // Упрощенная отправка квиза
                alert('Квиз завершен! +2✨');
                showScreen('quizzes');
                loadUserData();
            }

            // Инициализация
            initTelegram();
            loadUserData();
        </script>
    </body>
    </html>
  `);
});

// Admin panel
app.get('/admin', (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html>
    <head>
        <title>Админ панель</title>
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <style>
            body { font-family: Arial, sans-serif; margin: 0; padding: 20px; background: #f5f6fa; }
            .container { max-width: 1000px; margin: 0 auto; }
            .card { background: white; padding: 20px; margin: 10px 0; border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
            .stats { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 15px; margin: 20px 0; }
            .stat-card { background: white; padding: 15px; text-align: center; border-radius: 8px; box-shadow: 0 2px 5px rgba(0,0,0,0.1); }
            .stat-number { font-size: 24px; font-weight: bold; color: #667eea; }
        </style>
    </head>
    <body>
        <div class="container">
            <h1>🔧 Админ панель - Мастерская Вдохновения</h1>
            
            <div class="stats">
                <div class="stat-card">
                    <div class="stat-number">${database.users.size}</div>
                    <div>Пользователей</div>
                </div>
                <div class="stat-card">
                    <div class="stat-number">${database.characters.size}</div>
                    <div>Персонажей</div>
                </div>
                <div class="stat-card">
                    <div class="stat-number">${database.quizzes.size}</div>
                    <div>Квизов</div>
                </div>
            </div>

            <div class="card">
                <h3>Управление персонажами</h3>
                <div id="charactersList">
                    ${Array.from(database.characters.values()).map(char => `
                        <div style="border: 1px solid #e2e8f0; padding: 10px; margin: 5px 0; border-radius: 5px;">
                            <strong>${char.name}</strong> (${char.class})<br>
                            <small>${char.description}</small>
                        </div>
                    `).join('')}
                </div>
            </div>

            <div class="card">
                <h3>Управление квизами</h3>
                <div id="quizzesList">
                    ${Array.from(database.quizzes.values()).map(quiz => `
                        <div style="border: 1px solid #e2e8f0; padding: 10px; margin: 5px 0; border-radius: 5px;">
                            <strong>${quiz.title}</strong><br>
                            <small>${quiz.description} - ${quiz.questions.length} вопросов</small>
                        </div>
                    `).join('')}
                </div>
            </div>
        </div>
    </body>
    </html>
  `);
});

// API Routes

// Get user data
app.get('/api/users/:userId', (req, res) => {
  const userId = parseInt(req.params.userId);
  
  if (!database.users.has(userId)) {
    // Create new user
    const newUser = {
      user_id: userId,
      tg_first_name: 'Новый пользователь',
      sparks: 0,
      level: 'Ученик',
      is_registered: false,
      class: null,
      character_id: null,
      character_name: null,
      available_buttons: []
    };
    database.users.set(userId, newUser);
    
    return res.json({ success: true, user: newUser });
  }
  
  const user = database.users.get(userId);
  user.level = calculateLevel(user.sparks);
  
  res.json({ success: true, user });
});

// Register user
app.post('/api/users/register', (req, res) => {
  const { userId, userClass, characterId, tgFirstName } = req.body;
  
  const user = database.users.get(parseInt(userId)) || {
    user_id: parseInt(userId),
    sparks: 0,
    level: 'Ученик',
    is_registered: false
  };
  
  const character = database.characters.get(parseInt(characterId));
  
  if (character) {
    user.class = userClass;
    user.character_id = parseInt(characterId);
    user.character_name = character.name;
    user.available_buttons = character.buttons;
    
    if (!user.is_registered) {
      user.sparks += 5;
      user.is_registered = true;
      user.tg_first_name = tgFirstName || 'Пользователь';
      
      // Log activity
      database.activities.set(Date.now(), {
        user_id: parseInt(userId),
        activity_type: 'registration',
        sparks_earned: 5,
        description: 'Регистрация в системе'
      });
    }
    
    database.users.set(parseInt(userId), user);
    
    res.json({ 
      success: true, 
      message: user.is_registered ? 'Персонаж изменен!' : 'Регистрация успешна! +5✨',
      sparksAdded: user.is_registered ? 0 : 5
    });
  } else {
    res.json({ success: false, error: 'Персонаж не найден' });
  }
});

// Get characters
app.get('/api/webapp/characters', (req, res) => {
  const characters = Array.from(database.characters.values());
  res.json({ success: true, characters });
});

// Get quizzes
app.get('/api/webapp/quizzes', (req, res) => {
  const quizzes = Array.from(database.quizzes.values()).filter(q => q.is_active);
  res.json({ success: true, quizzes });
});

// Get specific quiz
app.get('/api/webapp/quizzes/:quizId', (req, res) => {
  const quizId = parseInt(req.params.quizId);
  const quiz = database.quizzes.get(quizId);
  
  if (quiz) {
    res.json({ success: true, quiz });
  } else {
    res.json({ success: false, error: 'Квиз не найден' });
  }
});

// Submit quiz
app.post('/api/webapp/quizzes/:quizId/submit', (req, res) => {
  const quizId = parseInt(req.params.quizId);
  const { userId, answers } = req.body;
  
  const quiz = database.quizzes.get(quizId);
  const user = database.users.get(parseInt(userId));
  
  if (quiz && user) {
    let correctAnswers = 0;
    
    quiz.questions.forEach((question, index) => {
      if (answers[index] === question.correctAnswer) {
        correctAnswers++;
      }
    });
    
    const passThreshold = Math.ceil(quiz.questions.length * 0.6);
    let sparksEarned = 0;
    
    if (correctAnswers >= passThreshold) {
      sparksEarned = quiz.sparks_reward;
    }
    
    user.sparks += sparksEarned;
    user.level = calculateLevel(user.sparks);
    
    // Save completion
    const completionKey = `${userId}_${quizId}`;
    database.quizCompletions.set(completionKey, {
      user_id: parseInt(userId),
      quiz_id: quizId,
      completed_at: new Date(),
      score: correctAnswers,
      sparks_earned: sparksEarned
    });
    
    // Log activity
    if (sparksEarned > 0) {
      database.activities.set(Date.now(), {
        user_id: parseInt(userId),
        activity_type: 'quiz',
        sparks_earned: sparksEarned,
        description: `Квиз: ${quiz.title}`
      });
    }
    
    res.json({
      success: true,
      correctAnswers,
      totalQuestions: quiz.questions.length,
      sparksEarned,
      passed: sparksEarned > 0,
      newTotalSparks: user.sparks,
      message: sparksEarned > 0 ? `Поздравляем! Вы получили ${sparksEarned}✨` : 'Попробуйте еще раз!'
    });
  } else {
    res.json({ success: false, error: 'Данные не найдены' });
  }
});

// Get user activities
app.get('/api/webapp/users/:userId/activities', (req, res) => {
  const userId = parseInt(req.params.userId);
  const userActivities = Array.from(database.activities.values())
    .filter(activity => activity.user_id === userId)
    .slice(-20)
    .reverse();
  
  res.json({ success: true, activities: userActivities });
});

// Initialize and start server
initializeData();

const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Сервер запущен на порту ${PORT}`);
  console.log(`📱 WebApp: http://localhost:${PORT}/webapp`);
  console.log(`🔧 Admin: http://localhost:${PORT}/admin`);
  console.log(`📊 Health: http://localhost:${PORT}/health`);
  console.log('=================================');
});
