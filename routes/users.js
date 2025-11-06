import express from 'express';
import db from '../config/database.js';

const router = express.Router();

// Получение данных пользователя
router.get('/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    
    db.get(
      `SELECT u.*, c.character_name, c.class, c.bonus_type, c.bonus_value 
       FROM users u 
       LEFT JOIN characters c ON u.character_id = c.id 
       WHERE u.user_id = ?`,
      [userId],
      (err, user) => {
        if (err) {
          console.error('Database error:', err);
          return res.status(500).json({ error: 'Database error' });
        }
        
        if (user) {
          // Рассчитываем уровень на основе звезд
          const level = calculateLevel(user.stars);
          user.level = level;
          
          res.json({ exists: true, user });
        } else {
          // Создаем временного пользователя
          res.json({ 
            exists: false, 
            user: {
              user_id: parseInt(userId),
              stars: 0,
              level: 'Ученик',
              is_registered: false
            }
          });
        }
      }
    );
  } catch (error) {
    console.error('Error in user route:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Регистрация пользователя
router.post('/register', async (req, res) => {
  try {
    const { userId, userClass, characterId, tgUsername, tgFirstName, tgLastName } = req.body;
    
    if (!userId || !userClass || !characterId) {
      return res.status(400).json({ error: 'User ID, class and character are required' });
    }
    
    // Проверяем, существует ли пользователь
    db.get('SELECT * FROM users WHERE user_id = ?', [userId], (err, existingUser) => {
      if (err) {
        console.error('Database error:', err);
        return res.status(500).json({ error: 'Database error' });
      }
      
      if (existingUser) {
        return res.status(400).json({ error: 'User already registered' });
      }
      
      // Создаем нового пользователя
      db.run(
        `INSERT INTO users (user_id, tg_username, tg_first_name, tg_last_name, class, character_id, is_registered, stars) 
         VALUES (?, ?, ?, ?, ?, ?, TRUE, 5)`,
        [userId, tgUsername, tgFirstName, tgLastName, userClass, characterId],
        function(err) {
          if (err) {
            console.error('Error creating user:', err);
            return res.status(500).json({ error: 'Error creating user' });
          }
          
          // Добавляем активность за регистрацию
          db.run(
            `INSERT INTO activities (user_id, activity_type, stars_earned, description) 
             VALUES (?, 'registration', 5, 'Регистрация в системе')`,
            [userId],
            (err) => {
              if (err) {
                console.error('Error logging activity:', err);
              }
            }
          );
          
          res.json({ 
            success: true, 
            message: 'Пользователь успешно зарегистрирован',
            starsAdded: 5,
            userId: userId
          });
        }
      );
    });
  } catch (error) {
    console.error('Error in registration:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Обновление звезд пользователя
router.post('/:userId/stars', async (req, res) => {
  try {
    const { userId } = req.params;
    const { stars, activityType, description } = req.body;
    
    if (!stars) {
      return res.status(400).json({ error: 'Stars amount is required' });
    }
    
    db.get('SELECT stars FROM users WHERE user_id = ?', [userId], (err, user) => {
      if (err) {
        console.error('Database error:', err);
        return res.status(500).json({ error: 'Database error' });
      }
      
      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }
      
      const newStars = user.stars + parseFloat(stars);
      
      db.run(
        'UPDATE users SET stars = ?, last_active = CURRENT_TIMESTAMP WHERE user_id = ?',
        [newStars, userId],
        function(err) {
          if (err) {
            console.error('Error updating stars:', err);
            return res.status(500).json({ error: 'Error updating stars' });
          }
          
          // Записываем активность
          if (activityType) {
            db.run(
              `INSERT INTO activities (user_id, activity_type, stars_earned, description) 
               VALUES (?, ?, ?, ?)`,
              [userId, activityType, stars, description || 'Activity'],
              (err) => {
                if (err) {
                  console.error('Error logging activity:', err);
                }
              }
            );
          }
          
          const newLevel = calculateLevel(newStars);
          
          res.json({ 
            success: true, 
            newStars: newStars,
            newLevel: newLevel,
            starsAdded: stars
          });
        }
      );
    });
  } catch (error) {
    console.error('Error updating stars:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Получение активностей пользователя
router.get('/:userId/activities', async (req, res) => {
  try {
    const { userId } = req.params;
    
    db.all(
      `SELECT * FROM activities 
       WHERE user_id = ? 
       ORDER BY created_at DESC 
       LIMIT 20`,
      [userId],
      (err, activities) => {
        if (err) {
          console.error('Database error:', err);
          return res.status(500).json({ error: 'Database error' });
        }
        
        res.json({ activities });
      }
    );
  } catch (error) {
    console.error('Error getting activities:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Обновление информации о пользователе
router.put('/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const { characterId, tgUsername } = req.body;
    
    db.run(
      'UPDATE users SET character_id = ?, tg_username = ?, last_active = CURRENT_TIMESTAMP WHERE user_id = ?',
      [characterId, tgUsername, userId],
      function(err) {
        if (err) {
          console.error('Error updating user:', err);
          return res.status(500).json({ error: 'Error updating user' });
        }
        
        if (this.changes === 0) {
          return res.status(404).json({ error: 'User not found' });
        }
        
        res.json({ 
          success: true, 
          message: 'User updated successfully'
        });
      }
    );
  } catch (error) {
    console.error('Error updating user:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Функция расчета уровня
function calculateLevel(stars) {
  if (stars >= 400) return 'Наставник';
  if (stars >= 300) return 'Мастер';
  if (stars >= 150) return 'Знаток';
  if (stars >= 50) return 'Искатель';
  return 'Ученик';
}

export default router;
