import express from 'express';
import TelegramBot from 'node-telegram-bot-api';
import cors from 'cors';
import bodyParser from 'body-parser';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import dotenv from 'dotenv';
import { initDatabase, getDatabase } from './config/database.js';

// Загрузка переменных окружения
dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();

// Middleware
app.use(express.json({ limit: '50mb' }));
app.use(cors());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static(join(__dirname, 'public')));
app.use('/admin', express.static(join(__dirname, 'admin')));

console.log('🎨 Мастерская Вдохновения - Запуск...');

// Проверка токена бота
if (!process.env.BOT_TOKEN) {
  console.error('❌ BOT_TOKEN не найден!');
  process.exit(1);
}

// Инициализация базы данных
let db;
try {
  await initDatabase();
  db = getDatabase();
  console.log('✅ Database initialized successfully');
} catch (error) {
  console.error('❌ Database initialization failed:', error);
  process.exit(1);
}

// ==================== UTILITY FUNCTIONS ====================

function calculateLevel(sparks) {
  if (sparks >= 400) return 'Наставник';
  if (sparks >= 300) return 'Мастер';
  if (sparks >= 150) return 'Знаток';
  if (sparks >= 50) return 'Искатель';
  return 'Ученик';
}

function applyCharacterBonus(user, baseSparks, activityType) {
  if (!user.character_id) return baseSparks;
  
  return new Promise((resolve) => {
    db.get('SELECT * FROM characters WHERE id = ?', [user.character_id], (err, character) => {
      if (err || !character) {
        resolve(baseSparks);
        return;
      }
      
      let finalSparks = baseSparks;
      
      switch(character.bonus_type) {
        case 'percent_bonus':
          const bonusPercent = parseInt(character.bonus_value);
          finalSparks = baseSparks * (1 + bonusPercent/100);
          break;
          
        case 'photo_bonus':
          if (activityType === 'photo_work') {
            finalSparks = baseSparks + parseInt(character.bonus_value);
          }
          break;
          
        case 'random_gift':
          if (Math.random() < 0.166) {
            const randomBonus = Math.floor(Math.random() * 3) + 1;
            finalSparks = baseSparks + randomBonus;
          }
          break;
          
        case 'fact_star':
          if (activityType === 'quiz') {
            finalSparks = baseSparks + 1;
          }
          break;
      }
      
      resolve(Math.round(finalSparks * 10) / 10);
    });
  });
}

// ==================== MIDDLEWARE ====================

const requireAdmin = (req, res, next) => {
  const userId = req.headers['x-user-id'] || req.query.userId || req.body.userId;
  
  if (!userId) {
    return res.status(401).json({ error: 'User ID required' });
  }
  
  db.get('SELECT * FROM admins WHERE user_id = ?', [userId], (err, admin) => {
    if (err) {
      console.error('Admin check error:', err);
      return res.status(500).json({ error: 'Database error' });
    }
    
    if (!admin) {
      return res.status(403).json({ error: 'Admin access required' });
    }
    
    req.admin = admin;
    next();
  });
};

// ==================== BASIC API ROUTES ====================

app.get('/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    message: '✅ Сервер работает!',
    timestamp: new Date().toISOString()
  });
});

app.get('/', (req, res) => {
  res.sendFile(join(__dirname, 'public', 'index.html'));
});

app.get('/admin', (req, res) => {
  res.sendFile(join(__dirname, 'admin', 'index.html'));
});

// ==================== WEBAPP API ROUTES ====================

// Получение персонажей с группировкой по классам
app.get('/api/webapp/characters', (req, res) => {
  db.all('SELECT * FROM characters WHERE is_active = TRUE ORDER BY class, character_name', (err, characters) => {
    if (err) {
      console.error('❌ Database error:', err);
      return res.status(500).json({ error: 'Database error' });
    }
    
    const groupedCharacters = {};
    characters.forEach(character => {
      if (!groupedCharacters[character.class]) {
        groupedCharacters[character.class] = [];
      }
      groupedCharacters[character.class].push({
        ...character,
        available_buttons: JSON.parse(character.available_buttons || '[]')
      });
    });
    
    res.json(groupedCharacters);
  });
});

// Получение списка классов
app.get('/api/webapp/classes', (req, res) => {
  const classes = [
    {
      id: 'Художники',
      name: '🎨 Художники',
      description: 'Творцы и экспериментаторы в мире изобразительного искусства',
      icon: '🎨'
    },
    {
      id: 'Стилисты', 
      name: '👗 Стилисты',
      description: 'Мастера создания гармоничных образов и стиля',
      icon: '👗'
    },
    {
      id: 'Мастера',
      name: '🧵 Мастера',
      description: 'Ремесленники и творцы прикладного искусства',
      icon: '🧵'
    },
    {
      id: 'Историки',
      name: '🏛️ Историки искусства',
      description: 'Знатоки истории, эпох и художественных направлений',
      icon: '🏛️'
    }
  ];
  
  res.json(classes);
});

// Получение данных пользователя
app.get('/api/users/:userId', (req, res) => {
  const userId = req.params.userId;
  
  db.get(
    `SELECT u.*, c.character_name, c.class, c.bonus_type, c.bonus_value, c.available_buttons
     FROM users u 
     LEFT JOIN characters c ON u.character_id = c.id 
     WHERE u.user_id = ?`,
    [userId],
    (err, user) => {
      if (err) {
        console.error('❌ Database error:', err);
        return res.status(500).json({ error: 'Database error' });
      }
      
      if (user) {
        user.level = calculateLevel(user.sparks);
        user.available_buttons = JSON.parse(user.available_buttons || '[]');
        res.json({ exists: true, user });
      } else {
        // Создаем нового пользователя
        const tgFirstName = 'Новый пользователь';
        db.run(
          `INSERT INTO users (user_id, tg_first_name, sparks, level) VALUES (?, ?, 0, 'Ученик')`,
          [userId, tgFirstName],
          function(err) {
            if (err) {
              console.error('❌ Error creating user:', err);
              return res.status(500).json({ error: 'Error creating user' });
            }
            
            res.json({ 
              exists: false, 
              user: {
                user_id: parseInt(userId),
                sparks: 0,
                level: 'Ученик',
                is_registered: false,
                class: null,
                character_id: null,
                character_name: null,
                tg_first_name: tgFirstName,
                available_buttons: [],
                invite_count: 0
              }
            });
          }
        );
      }
    }
  );
});

// Регистрация пользователя
app.post('/api/users/register', (req, res) => {
  const { userId, userClass, characterId, tgUsername, tgFirstName, tgLastName } = req.body;
  
  console.log('📝 Регистрация пользователя:', { userId, userClass, characterId });
  
  if (!userId || !userClass || !characterId) {
    return res.status(400).json({ error: 'User ID, class and character are required' });
  }
  
  // Получаем текущие данные пользователя
  db.get('SELECT * FROM users WHERE user_id = ?', [userId], (err, existingUser) => {
    if (err) {
      console.error('❌ Database error:', err);
      return res.status(500).json({ error: 'Database error' });
    }
    
    const isNewUser = !existingUser;
    const isFirstRegistration = !existingUser || !existingUser.is_registered;
    
    // Получаем данные персонажа для available_buttons
    db.get('SELECT available_buttons FROM characters WHERE id = ?', [characterId], (err, character) => {
      if (err) {
        console.error('❌ Error getting character:', err);
        return res.status(500).json({ error: 'Error getting character data' });
      }
      
      const availableButtons = character ? character.available_buttons : '[]';
      
      if (isNewUser) {
        // Создаем нового пользователя
        db.run(
          `INSERT INTO users (
            user_id, tg_username, tg_first_name, tg_last_name, 
            class, character_id, is_registered, sparks, level, available_buttons
          ) VALUES (?, ?, ?, ?, ?, ?, TRUE, 5, 'Ученик', ?)`,
          [userId, tgUsername, tgFirstName, tgLastName, userClass, characterId, availableButtons],
          function(err) {
            if (err) {
              console.error('❌ Error creating user:', err);
              return res.status(500).json({ error: 'Error creating user' });
            }
            
            // Записываем активность регистрации
            db.run(
              `INSERT INTO activities (user_id, activity_type, sparks_earned, description) 
               VALUES (?, 'registration', 5, 'Регистрация в системе')`,
              [userId]
            );
            
            res.json({ 
              success: true, 
              message: 'Регистрация успешна! +5✨',
              sparksAdded: 5,
              isNewRegistration: true
            });
          }
        );
      } else {
        // Обновляем существующего пользователя
        const newSparks = isFirstRegistration ? (existingUser.sparks || 0) + 5 : existingUser.sparks;
        
        db.run(
          `UPDATE users SET 
            tg_username = ?, tg_first_name = ?, tg_last_name = ?,
            class = ?, character_id = ?, is_registered = TRUE, 
            sparks = ?, available_buttons = ?, last_active = CURRENT_TIMESTAMP
           WHERE user_id = ?`,
          [tgUsername, tgFirstName, tgLastName, userClass, characterId, newSparks, availableButtons, userId],
          function(err) {
            if (err) {
              console.error('❌ Error updating user:', err);
              return res.status(500).json({ error: 'Error updating user' });
            }
            
            if (isFirstRegistration) {
              // Записываем активность регистрации
              db.run(
                `INSERT INTO activities (user_id, activity_type, sparks_earned, description) 
                 VALUES (?, 'registration', 5, 'Регистрация в системе')`,
                [userId]
              );
            }
            
            res.json({ 
              success: true, 
              message: isFirstRegistration ? 'Регистрация успешна! +5✨' : 'Персонаж успешно изменен!',
              sparksAdded: isFirstRegistration ? 5 : 0,
              isNewRegistration: isFirstRegistration
            });
          }
        );
      }
    });
  });
});

// Получение квизов
app.get('/api/webapp/quizzes', (req, res) => {
  const userId = req.query.userId;
  
  db.all("SELECT * FROM quizzes WHERE is_active = TRUE ORDER BY created_at DESC", (err, quizzes) => {
    if (err) {
      console.error('❌ Database error:', err);
      return res.status(500).json({ error: 'Database error' });
    }
    
    const parsedQuizzes = quizzes.map(quiz => ({
      ...quiz,
      questions: JSON.parse(quiz.questions || '[]')
    }));
    
    // Если передан userId, проверяем пройденные квизы
    if (userId) {
      db.all(
        `SELECT quiz_id, completed_at, sparks_earned 
         FROM quiz_completions 
         WHERE user_id = ?`,
        [userId],
        (err, completions) => {
          if (err) {
            console.error('Error fetching completions:', err);
            return res.json(parsedQuizzes);
          }
          
          const quizzesWithStatus = parsedQuizzes.map(quiz => {
            const completion = completions.find(c => c.quiz_id === quiz.id);
            const completedAt = completion ? new Date(completion.completed_at) : null;
            const cooldownMs = quiz.cooldown_hours * 60 * 60 * 1000;
            const canRetake = completedAt ? (Date.now() - completedAt.getTime()) > cooldownMs : true;
            
            return {
              ...quiz,
              completed: !!completion,
              completed_at: completion ? completion.completed_at : null,
              can_retake: canRetake,
              next_available: completedAt ? new Date(completedAt.getTime() + cooldownMs) : null,
              sparks_earned: completion ? completion.sparks_earned : 0
            };
          });
          
          res.json(quizzesWithStatus);
        }
      );
    } else {
      res.json(parsedQuizzes);
    }
  });
});

// Запуск квиза
app.get('/api/webapp/quizzes/:quizId', (req, res) => {
  const { quizId } = req.params;
  const { userId } = req.query;
  
  db.get("SELECT * FROM quizzes WHERE id = ? AND is_active = TRUE", [quizId], (err, quiz) => {
    if (err) {
      console.error('❌ Database error:', err);
      return res.status(500).json({ error: 'Database error' });
    }
    
    if (!quiz) {
      return res.status(404).json({ error: 'Quiz not found' });
    }
    
    const quizData = {
      ...quiz,
      questions: JSON.parse(quiz.questions || '[]')
    };
    
    // Проверяем возможность прохождения
    if (userId) {
      db.get(
        `SELECT completed_at FROM quiz_completions 
         WHERE user_id = ? AND quiz_id = ?`,
        [userId, quizId],
        (err, completion) => {
          if (err) {
            console.error('Error checking completion:', err);
            return res.json(quizData);
          }
          
          if (completion) {
            const completedAt = new Date(completion.completed_at);
            const cooldownMs = quiz.cooldown_hours * 60 * 60 * 1000;
            const canRetake = (Date.now() - completedAt.getTime()) > cooldownMs;
            
            quizData.can_retake = canRetake;
            quizData.completed = true;
            quizData.next_available = new Date(completedAt.getTime() + cooldownMs);
          }
          
          res.json(quizData);
        }
      );
    } else {
      res.json(quizData);
    }
  });
});

// Отправка ответов на квиз
app.post('/api/webapp/quizzes/:quizId/submit', async (req, res) => {
  const { quizId } = req.params;
  const { userId, answers } = req.body;
  
  console.log(`📝 Отправка ответов на квиз ${quizId} от пользователя ${userId}`);
  
  if (!userId || !answers) {
    return res.status(400).json({ error: 'User ID and answers are required' });
  }
  
  try {
    // Получаем данные квиза
    const quiz = await new Promise((resolve, reject) => {
      db.get("SELECT * FROM quizzes WHERE id = ?", [quizId], (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });
    
    if (!quiz) {
      return res.status(404).json({ error: 'Quiz not found' });
    }
    
    const questions = JSON.parse(quiz.questions || '[]');
    let correctAnswers = 0;
    
    // Проверяем ответы
    questions.forEach((question, index) => {
      if (answers[index] === question.correctAnswer) {
        correctAnswers++;
      }
    });
    
    // Начисляем искры
    const passThreshold = Math.ceil(questions.length * 0.6);
    let sparksEarned = 0;
    
    if (correctAnswers >= passThreshold) {
      sparksEarned = quiz.sparks_reward;
    }
    
    // Получаем данные пользователя для бонусов
    const user = await new Promise((resolve, reject) => {
      db.get(
        `SELECT u.*, c.bonus_type, c.bonus_value 
         FROM users u 
         LEFT JOIN characters c ON u.character_id = c.id 
         WHERE u.user_id = ?`,
        [userId],
        (err, row) => {
          if (err) reject(err);
          else resolve(row);
        }
      );
    });
    
    const finalSparks = await applyCharacterBonus(user, sparksEarned, 'quiz');
    const newSparks = (user?.sparks || 0) + finalSparks;
    
    // Сохраняем результат прохождения
    await new Promise((resolve, reject) => {
      db.run(
        `INSERT OR REPLACE INTO quiz_completions (user_id, quiz_id, completed_at, score, sparks_earned) 
         VALUES (?, ?, CURRENT_TIMESTAMP, ?, ?)`,
        [userId, quizId, correctAnswers, finalSparks],
        function(err) {
          if (err) reject(err);
          else resolve();
        }
      );
    });
    
    // Обновляем искры пользователя
    await new Promise((resolve, reject) => {
      db.run(
        `UPDATE users SET sparks = ?, last_active = CURRENT_TIMESTAMP WHERE user_id = ?`,
        [newSparks, userId],
        (err) => {
          if (err) reject(err);
          else resolve();
        }
      );
    });
    
    // Записываем активность
    if (finalSparks > 0) {
      db.run(
        `INSERT INTO activities (user_id, activity_type, sparks_earned, description) 
         VALUES (?, 'quiz', ?, ?)`,
        [userId, finalSparks, `Квиз: ${quiz.title}`]
      );
    }
    
    const message = finalSparks > 0 
      ? `Поздравляем! Вы получили ${finalSparks}✨` 
      : 'Попробуйте еще раз!';
    
    res.json({
      success: true,
      correctAnswers,
      totalQuestions: questions.length,
      sparksEarned: finalSparks,
      passed: finalSparks > 0,
      newTotalSparks: newSparks,
      completed: true,
      message: message
    });
    
  } catch (error) {
    console.error('❌ Quiz submission error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Получение активностей пользователя
app.get('/api/webapp/users/:userId/activities', (req, res) => {
  const userId = req.params.userId;
  
  db.all(
    `SELECT * FROM activities 
     WHERE user_id = ? 
     ORDER BY created_at DESC 
     LIMIT 20`,
    [userId],
    (err, activities) => {
      if (err) {
        console.error('❌ Database error:', err);
        return res.status(500).json({ error: 'Database error' });
      }
      
      res.json({ activities });
    }
  );
});

// Отправка фото работы
app.post('/api/webapp/submit-work', async (req, res) => {
  const { userId, description, theme, photoUrl } = req.body;
  
  console.log('📸 Отправка работы от пользователя:', userId);
  
  if (!userId || !photoUrl) {
    return res.status(400).json({ error: 'User ID and photo URL are required' });
  }
  
  const baseSparks = 3;
  
  db.get(
    `SELECT u.*, c.bonus_type, c.bonus_value 
     FROM users u 
     LEFT JOIN characters c ON u.character_id = c.id 
     WHERE u.user_id = ?`,
    [userId],
    async (err, user) => {
      if (err) {
        console.error('❌ Database error:', err);
        return res.status(500).json({ error: 'Database error' });
      }
      
      const finalSparks = await applyCharacterBonus(user, baseSparks, 'photo_work');
      
      db.run(
        `INSERT INTO photo_works (user_id, photo_url, description, theme) 
         VALUES (?, ?, ?, ?)`,
        [userId, photoUrl, description, theme],
        function(err) {
          if (err) {
            console.error('❌ Error saving photo work:', err);
            return res.status(500).json({ error: 'Error saving work' });
          }
          
          res.json({
            success: true,
            message: 'Фото работа отправлена на модерацию! После одобрения вы получите искры.',
            sparksPotential: finalSparks,
            workId: this.lastID
          });
        }
      );
    }
  );
});

// Приглашение друга
app.post('/api/webapp/invite', (req, res) => {
  const { inviterId, invitedId, invitedUsername } = req.body;
  
  console.log('👥 Приглашение друга:', { inviterId, invitedId });
  
  if (!inviterId || !invitedId) {
    return res.status(400).json({ error: 'Inviter ID and invited ID are required' });
  }
  
  db.get(
    `SELECT * FROM invitations WHERE inviter_id = ? AND invited_id = ?`,
    [inviterId, invitedId],
    (err, existingInvite) => {
      if (err) {
        console.error('❌ Database error:', err);
        return res.status(500).json({ error: 'Database error' });
      }
      
      if (existingInvite) {
        return res.status(400).json({ error: 'Этот пользователь уже был приглашен' });
      }
      
      db.run(
        `INSERT INTO invitations (inviter_id, invited_id, invited_username) 
         VALUES (?, ?, ?)`,
        [inviterId, invitedId, invitedUsername],
        function(err) {
          if (err) {
            console.error('❌ Error creating invitation:', err);
            return res.status(500).json({ error: 'Error creating invitation' });
          }
          
          db.run(
            `UPDATE users SET sparks = sparks + 10, invite_count = invite_count + 1 
             WHERE user_id = ?`,
            [inviterId],
            (err) => {
              if (err) {
                console.error('❌ Error updating inviter sparks:', err);
                return res.status(500).json({ error: 'Error updating sparks' });
              }
              
              db.run(
                `INSERT INTO activities (user_id, activity_type, sparks_earned, description) 
                 VALUES (?, 'invitation', 10, 'Приглашение друга')`,
                [inviterId],
                (err) => {
                  if (err) console.error('Error logging activity:', err);
                }
              );
              
              res.json({
                success: true,
                message: 'Друг приглашен! +10✨',
                sparksEarned: 10
              });
            }
          );
        }
      );
    }
  );
});

// ==================== МАГАЗИН API ====================

app.get('/api/webapp/shop/items', (req, res) => {
  db.all(
    `SELECT * FROM shop_items WHERE is_active = TRUE ORDER BY price ASC`,
    (err, items) => {
      if (err) {
        console.error('❌ Database error:', err);
        return res.status(500).json({ error: 'Database error' });
      }
      
      res.json(items);
    }
  );
});

app.post('/api/webapp/shop/purchase', (req, res) => {
  const { userId, itemId } = req.body;
  
  console.log('🛒 Покупка товара:', { userId, itemId });
  
  if (!userId || !itemId) {
    return res.status(400).json({ error: 'User ID and item ID are required' });
  }
  
  // Начинаем транзакцию
  db.serialize(() => {
    // Получаем данные о товаре
    db.get('SELECT * FROM shop_items WHERE id = ? AND is_active = TRUE', [itemId], (err, item) => {
      if (err || !item) {
        return res.status(404).json({ error: 'Товар не найден' });
      }
      
      // Проверяем баланс пользователя
      db.get('SELECT sparks FROM users WHERE user_id = ?', [userId], (err, user) => {
        if (err || !user) {
          return res.status(404).json({ error: 'Пользователь не найден' });
        }
        
        if (user.sparks < item.price) {
          return res.status(400).json({ error: 'Недостаточно искр для покупки' });
        }
        
        // Проверяем, не покупал ли уже пользователь этот товар
        db.get('SELECT * FROM purchases WHERE user_id = ? AND item_id = ?', [userId, itemId], (err, existingPurchase) => {
          if (err) {
            return res.status(500).json({ error: 'Database error' });
          }
          
          if (existingPurchase) {
            return res.status(400).json({ error: 'Вы уже приобрели этот товар' });
          }
          
          // Выполняем покупку
          db.run('UPDATE users SET sparks = sparks - ? WHERE user_id = ?', [item.price, userId], function(err) {
            if (err) {
              return res.status(500).json({ error: 'Ошибка при списании искр' });
            }
            
            db.run('INSERT INTO purchases (user_id, item_id, price_paid) VALUES (?, ?, ?)', 
              [userId, itemId, item.price], function(err) {
              if (err) {
                return res.status(500).json({ error: 'Ошибка при сохранении покупки' });
              }
              
              // Записываем активность
              db.run(
                `INSERT INTO activities (user_id, activity_type, sparks_earned, description) 
                 VALUES (?, 'purchase', ?, ?)`,
                [userId, -item.price, `Покупка: ${item.title}`],
                (err) => {
                  if (err) console.error('Error logging activity:', err);
                }
              );
              
              res.json({
                success: true,
                message: 'Покупка успешно завершена!',
                item: item,
                remainingSparks: user.sparks - item.price
              });
            });
          });
        });
      });
    });
  });
});

app.get('/api/webapp/shop/purchases/:userId', (req, res) => {
  const userId = req.params.userId;
  
  db.all(
    `SELECT p.*, si.title, si.description, si.type, si.file_url 
     FROM purchases p 
     JOIN shop_items si ON p.item_id = si.id 
     WHERE p.user_id = ? 
     ORDER BY p.purchased_at DESC`,
    [userId],
    (err, purchases) => {
      if (err) {
        console.error('❌ Database error:', err);
        return res.status(500).json({ error: 'Database error' });
      }
      
      res.json({ purchases });
    }
  );
});

// ==================== ADMIN API ROUTES ====================

// Получение списка админов
app.get('/api/admin/admins', requireAdmin, (req, res) => {
  db.all(
    `SELECT * FROM admins ORDER BY role, created_at DESC`,
    (err, admins) => {
      if (err) {
        console.error('❌ Database error:', err);
        return res.status(500).json({ error: 'Database error' });
      }
      
      res.json(admins);
    }
  );
});

// Добавление админа
app.post('/api/admin/admins', requireAdmin, (req, res) => {
  const { user_id, username, role } = req.body;
  
  console.log('➕ Добавление админа:', { user_id, username, role });
  
  if (!user_id || !role) {
    return res.status(400).json({ error: 'User ID and role are required' });
  }
  
  // Проверяем, не является ли добавляемый пользователь текущим админом
  if (user_id == req.admin.user_id) {
    return res.status(400).json({ error: 'Cannot modify your own admin status' });
  }
  
  db.run(
    `INSERT OR REPLACE INTO admins (user_id, username, role) 
     VALUES (?, ?, ?)`,
    [user_id, username, role],
    function(err) {
      if (err) {
        console.error('❌ Error adding admin:', err);
        return res.status(500).json({ error: 'Error adding admin' });
      }
      
      res.json({
        success: true,
        message: 'Администратор успешно добавлен',
        adminId: this.lastID
      });
    }
  );
});

// Удаление админа
app.delete('/api/admin/admins/:adminId', requireAdmin, (req, res) => {
  const adminId = req.params.adminId;
  
  // Не позволяем удалить самого себя
  if (adminId == req.admin.user_id) {
    return res.status(400).json({ error: 'Cannot remove yourself' });
  }
  
  db.run(
    `DELETE FROM admins WHERE user_id = ?`,
    [adminId],
    function(err) {
      if (err) {
        console.error('❌ Error deleting admin:', err);
        return res.status(500).json({ error: 'Error deleting admin' });
      }
      
      if (this.changes === 0) {
        return res.status(404).json({ error: 'Admin not found' });
      }
      
      res.json({
        success: true,
        message: 'Администратор удален'
      });
    }
  );
});

// Управление персонажами
app.get('/api/admin/characters', requireAdmin, (req, res) => {
  db.all(
    `SELECT * FROM characters ORDER BY class, character_name`,
    (err, characters) => {
      if (err) {
        console.error('❌ Database error:', err);
        return res.status(500).json({ error: 'Database error' });
      }
      
      const parsedCharacters = characters.map(char => ({
        ...char,
        available_buttons: JSON.parse(char.available_buttons || '[]')
      }));
      
      res.json(parsedCharacters);
    }
  );
});

app.post('/api/admin/characters', requireAdmin, (req, res) => {
  const { class: charClass, character_name, description, bonus_type, bonus_value, available_buttons, is_active } = req.body;
  
  console.log('👥 Добавление персонажа:', { charClass, character_name });
  
  if (!charClass || !character_name || !bonus_type || !bonus_value) {
    return res.status(400).json({ error: 'Class, name, bonus type and value are required' });
  }
  
  const buttonsJson = JSON.stringify(available_buttons || []);
  
  db.run(
    `INSERT INTO characters (class, character_name, description, bonus_type, bonus_value, available_buttons, is_active) 
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [charClass, character_name, description, bonus_type, bonus_value, buttonsJson, is_active !== false],
    function(err) {
      if (err) {
        console.error('❌ Error creating character:', err);
        return res.status(500).json({ error: 'Error creating character' });
      }
      
      res.json({
        success: true,
        message: 'Персонаж успешно создан',
        characterId: this.lastID
      });
    }
  );
});

app.put('/api/admin/characters/:characterId', requireAdmin, (req, res) => {
  const { characterId } = req.params;
  const { class: charClass, character_name, description, bonus_type, bonus_value, available_buttons, is_active } = req.body;
  
  console.log('✏️ Обновление персонажа:', characterId);
  
  const buttonsJson = JSON.stringify(available_buttons || []);
  
  db.run(
    `UPDATE characters SET 
      class = ?, character_name = ?, description = ?, 
      bonus_type = ?, bonus_value = ?, available_buttons = ?, is_active = ?
     WHERE id = ?`,
    [charClass, character_name, description, bonus_type, bonus_value, buttonsJson, is_active, characterId],
    function(err) {
      if (err) {
        console.error('❌ Error updating character:', err);
        return res.status(500).json({ error: 'Error updating character' });
      }
      
      if (this.changes === 0) {
        return res.status(404).json({ error: 'Character not found' });
      }
      
      res.json({
        success: true,
        message: 'Персонаж успешно обновлен'
      });
    }
  );
});

app.delete('/api/admin/characters/:characterId', requireAdmin, (req, res) => {
  const { characterId } = req.params;
  
  db.run(
    `DELETE FROM characters WHERE id = ?`,
    [characterId],
    function(err) {
      if (err) {
        console.error('❌ Error deleting character:', err);
        return res.status(500).json({ error: 'Error deleting character' });
      }
      
      if (this.changes === 0) {
        return res.status(404).json({ error: 'Character not found' });
      }
      
      res.json({
        success: true,
        message: 'Персонаж удален'
      });
    }
  );
});

// Управление квизами
app.get('/api/admin/quizzes', requireAdmin, (req, res) => {
  db.all(
    `SELECT q.*, u.tg_username as created_by_username 
     FROM quizzes q 
     LEFT JOIN users u ON q.created_by = u.user_id 
     ORDER BY q.created_at DESC`,
    (err, quizzes) => {
      if (err) {
        console.error('❌ Database error:', err);
        return res.status(500).json({ error: 'Database error' });
      }
      
      const parsedQuizzes = quizzes.map(quiz => ({
        ...quiz,
        questions: JSON.parse(quiz.questions || '[]')
      }));
      
      res.json(parsedQuizzes);
    }
  );
});

app.post('/api/admin/quizzes', requireAdmin, (req, res) => {
  const { title, description, questions, sparks_reward, cooldown_hours, is_active } = req.body;
  
  console.log('🎯 Создание квиза:', { title, sparks_reward });
  
  if (!title || !questions) {
    return res.status(400).json({ error: 'Title and questions are required' });
  }
  
  const questionsJson = JSON.stringify(questions);
  
  db.run(
    `INSERT INTO quizzes (title, description, questions, sparks_reward, cooldown_hours, is_active, created_by) 
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [title, description, questionsJson, sparks_reward || 1, cooldown_hours || 24, is_active !== false, req.admin.user_id],
    function(err) {
      if (err) {
        console.error('❌ Error creating quiz:', err);
        return res.status(500).json({ error: 'Error creating quiz' });
      }
      
      res.json({
        success: true,
        message: 'Квиз успешно создан',
        quizId: this.lastID
      });
    }
  );
});

app.put('/api/admin/quizzes/:quizId', requireAdmin, (req, res) => {
  const { quizId } = req.params;
  const { title, description, questions, sparks_reward, cooldown_hours, is_active } = req.body;
  
  const questionsJson = JSON.stringify(questions || []);
  
  db.run(
    `UPDATE quizzes SET title = ?, description = ?, questions = ?, sparks_reward = ?, cooldown_hours = ?, is_active = ?
     WHERE id = ?`,
    [title, description, questionsJson, sparks_reward, cooldown_hours, is_active, quizId],
    function(err) {
      if (err) {
        console.error('❌ Error updating quiz:', err);
        return res.status(500).json({ error: 'Error updating quiz' });
      }
      
      if (this.changes === 0) {
        return res.status(404).json({ error: 'Quiz not found' });
      }
      
      res.json({
        success: true,
        message: 'Квиз успешно обновлен'
      });
    }
  );
});

app.delete('/api/admin/quizzes/:quizId', requireAdmin, (req, res) => {
  const { quizId } = req.params;
  
  db.run(
    `DELETE FROM quizzes WHERE id = ?`,
    [quizId],
    function(err) {
      if (err) {
        console.error('❌ Error deleting quiz:', err);
        return res.status(500).json({ error: 'Error deleting quiz' });
      }
      
      if (this.changes === 0) {
        return res.status(404).json({ error: 'Quiz not found' });
      }
      
      res.json({
        success: true,
        message: 'Квиз удален'
      });
    }
  );
});

// Статистика для админ панели
app.get('/api/admin/stats', requireAdmin, (req, res) => {
  const stats = {};
  
  // Всего пользователей
  db.get('SELECT COUNT(*) as count FROM users', (err, row) => {
    if (err) return res.status(500).json({ error: 'Database error' });
    stats.totalUsers = row.count;
    
    // Активных сегодня
    db.get(`SELECT COUNT(*) as count FROM users 
            WHERE DATE(last_active) = DATE('now')`, (err, row) => {
      if (err) return res.status(500).json({ error: 'Database error' });
      stats.activeToday = row.count;
      
      // Всего постов
      db.get('SELECT COUNT(*) as count FROM channel_posts', (err, row) => {
        if (err) return res.status(500).json({ error: 'Database error' });
        stats.totalPosts = row.count;
        
        // На модерации
        db.get(`SELECT COUNT(*) as count FROM photo_works WHERE is_approved = FALSE`, 
          (err, photoRow) => {
            if (err) return res.status(500).json({ error: 'Database error' });
            db.get(`SELECT COUNT(*) as count FROM comments WHERE is_approved = FALSE`, 
              (err, commentRow) => {
                if (err) return res.status(500).json({ error: 'Database error' });
                stats.pendingModeration = (photoRow.count || 0) + (commentRow.count || 0);
                
                // Дополнительная статистика
                db.get(`SELECT COUNT(*) as count FROM users 
                        WHERE DATE(registration_date) = DATE('now')`, (err, row) => {
                  if (err) return res.status(500).json({ error: 'Database error' });
                  stats.registeredToday = row.count;
                  
                  // Всего искр
                  db.get(`SELECT SUM(sparks) as total FROM users`, (err, row) => {
                    if (err) return res.status(500).json({ error: 'Database error' });
                    stats.totalSparks = row.total || 0;
                    
                    // Активных квизов
                    db.get(`SELECT COUNT(*) as count FROM quizzes WHERE is_active = TRUE`, (err, row) => {
                      if (err) return res.status(500).json({ error: 'Database error' });
                      stats.activeQuizzes = row.count;
                      
                      // Товары в магазине
                      db.get(`SELECT COUNT(*) as count FROM shop_items WHERE is_active = TRUE`, (err, row) => {
                        if (err) return res.status(500).json({ error: 'Database error' });
                        stats.shopItems = row.count;
                        
                        // Персонажи
                        db.get(`SELECT COUNT(*) as count FROM characters WHERE is_active = TRUE`, (err, row) => {
                          if (err) return res.status(500).json({ error: 'Database error' });
                          stats.activeCharacters = row.count;
                          
                          res.json(stats);
                        });
                      });
                    });
                  });
                });
              }
            );
          }
        );
      });
    });
  });
});

// ==================== TELEGRAM BOT ====================

let bot;
try {
  bot = new TelegramBot(process.env.BOT_TOKEN, { 
    polling: { 
      interval: 300,
      params: {
        timeout: 10
      }
    } 
  });
  console.log('🤖 Bot initialized successfully');
} catch (error) {
  console.error('❌ Bot initialization error:', error.message);
  bot = null;
}

if (bot) {
  // Обработчики команд бота
  bot.onText(/\/start(?:\s+invite_(\d+))?/, (msg, match) => {
    const chatId = msg.chat.id;
    const name = msg.from.first_name || 'Друг';
    const userId = msg.from.id;
    const inviteCode = match ? match[1] : null;
    
    // Если есть код приглашения, обрабатываем его
    if (inviteCode && inviteCode !== userId.toString()) {
      db.get('SELECT * FROM users WHERE user_id = ?', [inviteCode], (err, inviter) => {
        if (!err && inviter) {
          db.run(
            `INSERT OR IGNORE INTO invitations (inviter_id, invited_id, invited_username) VALUES (?, ?, ?)`,
            [inviteCode, userId, msg.from.username],
            function() {
              if (this.changes > 0) {
                db.run(
                  `UPDATE users SET sparks = sparks + 10, invite_count = invite_count + 1 WHERE user_id = ?`,
                  [inviteCode]
                );
                console.log(`✅ User ${userId} invited by ${inviteCode}`);
              }
            }
          );
        }
      });
    }
    
    const welcomeText = `🎨 Привет, ${name}! 

Добро пожаловать в **Мастерская Вдохновения**! 

✨ Вот что вас ждет:
• 📚 Обучающие видео и задания
• ✨ Система уровней и искр
• 🏆 Достижения и бонусы
• 👥 Сообщество творческих людей
• 🛒 Магазин с эксклюзивными материалами

Нажмите кнопку ниже чтобы открыть личный кабинет!`;
    
    const keyboard = {
      inline_keyboard: [[
        {
          text: "📱 Открыть Личный Кабинет",
          web_app: { url: process.env.APP_URL || `http://localhost:${PORT}` }
        }
      ]]
    };

    bot.sendMessage(chatId, welcomeText, {
      parse_mode: 'Markdown',
      reply_markup: keyboard
    }).catch(err => {
      console.log('Bot message error:', err.message);
    });
  });

  // Команда для админов
  bot.onText(/\/admin/, (msg) => {
    const chatId = msg.chat.id;
    const userId = msg.from.id;
    
    db.get('SELECT * FROM admins WHERE user_id = ?', [userId], (err, admin) => {
      if (err || !admin) {
        bot.sendMessage(chatId, '❌ У вас нет прав доступа к админ панели.');
        return;
      }
      
      const adminUrl = `${process.env.APP_URL || `http://localhost:${PORT}`}/admin?userId=${userId}`;
      
      bot.sendMessage(chatId, `🔧 Панель администратора\n\nДоступ: ${admin.role}\n\n${adminUrl}`);
    });
  });

  // Обработка ошибок бота
  bot.on('polling_error', (error) => {
    console.log('🤖 Polling error:', error.message);
  });

  bot.on('error', (error) => {
    console.log('🤖 Bot error:', error.message);
  });
}

// ==================== SERVER START ====================

const PORT = process.env.PORT || 3000;

app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Сервер запущен на порту ${PORT}`);
  console.log(`📱 Mini App: ${process.env.APP_URL || `http://localhost:${PORT}`}`);
  console.log(`🔧 Admin Panel: ${process.env.APP_URL || `http://localhost:${PORT}`}/admin`);
  console.log(`📊 Health: http://localhost:${PORT}/health`);
  console.log('=================================');
}).on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`❌ Port ${PORT} is already in use. Try changing PORT in .env file`);
    process.exit(1);
  } else {
    console.error('❌ Server error:', err);
  }
});
