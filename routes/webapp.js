import express from 'express';
import db from '../config/database.js';

const router = express.Router();

// Получение всех персонажей
router.get('/characters', async (req, res) => {
  try {
    db.all('SELECT * FROM characters ORDER BY class, character_name', (err, characters) => {
      if (err) {
        return res.status(500).json({ error: 'Database error' });
      }
      
      // Группируем по классам
      const groupedCharacters = characters.reduce((acc, character) => {
        if (!acc[character.class]) {
          acc[character.class] = [];
        }
        acc[character.class].push(character);
        return acc;
      }, {});
      
      res.json(groupedCharacters);
    });
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Получение классов
router.get('/classes', async (req, res) => {
  try {
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
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Получение доступных квизов
router.get('/quizzes', async (req, res) => {
  try {
    db.all(
      `SELECT * FROM quizzes 
       WHERE is_active = TRUE 
       ORDER BY created_at DESC`,
      (err, quizzes) => {
        if (err) {
          return res.status(500).json({ error: 'Database error' });
        }
        
        // Парсим вопросы из JSON
        const parsedQuizzes = quizzes.map(quiz => ({
          ...quiz,
          questions: quiz.questions ? JSON.parse(quiz.questions) : []
        }));
        
        res.json(parsedQuizzes);
      }
    );
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Получение конкретного квиза
router.get('/quizzes/:quizId', async (req, res) => {
  try {
    const { quizId } = req.params;
    
    db.get('SELECT * FROM quizzes WHERE id = ? AND is_active = TRUE', [quizId], (err, quiz) => {
      if (err) {
        return res.status(500).json({ error: 'Database error' });
      }
      
      if (!quiz) {
        return res.status(404).json({ error: 'Quiz not found' });
      }
      
      // Парсим вопросы из JSON
      const parsedQuiz = {
        ...quiz,
        questions: quiz.questions ? JSON.parse(quiz.questions) : []
      };
      
      res.json(parsedQuiz);
    });
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Отправка ответа на квиз
router.post('/quizzes/:quizId/submit', async (req, res) => {
  try {
    const { quizId } = req.params;
    const { userId, answers } = req.body;
    
    if (!userId) {
      return res.status(400).json({ error: 'User ID is required' });
    }
    
    // Получаем квиз
    db.get('SELECT * FROM quizzes WHERE id = ?', [quizId], (err, quiz) => {
      if (err) {
        return res.status(500).json({ error: 'Database error' });
      }
      
      if (!quiz) {
        return res.status(404).json({ error: 'Quiz not found' });
      }
      
      const questions = quiz.questions ? JSON.parse(quiz.questions) : [];
      let correctAnswers = 0;
      
      // Проверяем ответы
      questions.forEach((question, index) => {
        if (answers[index] === question.correctAnswer) {
          correctAnswers++;
        }
      });
      
      // Рассчитываем награду согласно ТЗ
      let starsEarned = 0;
      if (questions.length <= 3) {
        // Короткий опрос (3 вопроса)
        starsEarned = correctAnswers >= 1 ? 1 : 0;
      } else {
        // Викторина (3-5 вопросов)
        if (correctAnswers >= Math.ceil(questions.length * 0.6)) {
          starsEarned = 2;
        } else if (correctAnswers >= 1) {
          starsEarned = 1;
        }
      }
      
      // Если пользователь получил звезды, обновляем его баланс
      if (starsEarned > 0) {
        db.get('SELECT stars FROM users WHERE user_id = ?', [userId], (err, user) => {
          if (err) {
            console.error('Error getting user:', err);
            return res.json({
              success: true,
              correctAnswers,
              totalQuestions: questions.length,
              starsEarned,
              passed: starsEarned > 0
            });
          }
          
          if (user) {
            const newStars = user.stars + starsEarned;
            
            db.run(
              'UPDATE users SET stars = ?, last_active = CURRENT_TIMESTAMP WHERE user_id = ?',
              [newStars, userId],
              (err) => {
                if (err) {
                  console.error('Error updating stars:', err);
                }
                
                // Записываем активность
                db.run(
                  `INSERT INTO activities (user_id, activity_type, stars_earned, description) 
                   VALUES (?, 'quiz', ?, ?)`,
                  [userId, starsEarned, `Квиз: ${quiz.title}`]
                );
                
                res.json({
                  success: true,
                  correctAnswers,
                  totalQuestions: questions.length,
                  starsEarned,
                  passed: starsEarned > 0,
                  newTotalStars: newStars
                });
              }
            );
          } else {
            res.json({
              success: true,
              correctAnswers,
              totalQuestions: questions.length,
              starsEarned,
              passed: starsEarned > 0
            });
          }
        });
      } else {
        res.json({
          success: true,
          correctAnswers,
          totalQuestions: questions.length,
          starsEarned,
          passed: false
        });
      }
    });
  } catch (error) {
    console.error('Error in quiz submission:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Отправка фото работы
router.post('/submit-work', async (req, res) => {
  try {
    const { userId, photoUrl, description } = req.body;
    
    if (!userId || !photoUrl) {
      return res.status(400).json({ error: 'User ID and photo URL are required' });
    }
    
    // Начисляем 3 звезды за работу согласно ТЗ
    db.get('SELECT stars FROM users WHERE user_id = ?', [userId], (err, user) => {
      if (err) {
        return res.status(500).json({ error: 'Database error' });
      }
      
      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }
      
      const starsEarned = 3;
      const newStars = user.stars + starsEarned;
      
      db.run(
        'UPDATE users SET stars = ?, last_active = CURRENT_TIMESTAMP WHERE user_id = ?',
        [newStars, userId],
        (err) => {
          if (err) {
            return res.status(500).json({ error: 'Error updating stars' });
          }
          
          // Записываем активность
          db.run(
            `INSERT INTO activities (user_id, activity_type, stars_earned, description) 
             VALUES (?, 'photo_work', ?, ?)`,
            [userId, starsEarned, description || 'Фото работы']
          );
          
          res.json({
            success: true,
            starsEarned: starsEarned,
            newTotalStars: newStars,
            message: 'Фото работы принято! +3⭐'
          });
        }
      );
    });
  } catch (error) {
    console.error('Error submitting work:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Получение активностей пользователя
router.get('/users/:userId/activities', async (req, res) => {
  try {
    const { userId } = req.params;
    const { limit = 20 } = req.query;
    
    db.all(
      `SELECT * FROM activities 
       WHERE user_id = ? 
       ORDER BY created_at DESC 
       LIMIT ?`,
      [userId, parseInt(limit)],
      (err, activities) => {
        if (err) {
          return res.status(500).json({ error: 'Database error' });
        }
        
        res.json({ activities });
      }
    );
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

export default router;
