import express from 'express';
import db from '../config/database.js';

const router = express.Router();

// Middleware для проверки админа
const checkAdmin = (req, res, next) => {
  const userId = req.headers['user-id'] || req.query.userId;
  
  if (!userId || parseInt(userId) !== parseInt(process.env.ADMIN_ID)) {
    return res.status(403).json({ error: 'Access denied. Admin only.' });
  }
  next();
};

// Получение всех постов
router.get('/posts', checkAdmin, async (req, res) => {
  try {
    db.all(
      `SELECT * FROM channel_posts 
       ORDER BY published_at DESC 
       LIMIT 50`,
      (err, posts) => {
        if (err) {
          return res.status(500).json({ error: 'Database error' });
        }
        
        // Парсим кнопки из JSON
        const parsedPosts = posts.map(post => ({
          ...post,
          buttons: post.buttons ? JSON.parse(post.buttons) : []
        }));
        
        res.json({ posts: parsedPosts });
      }
    );
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Создание нового поста
router.post('/posts', checkAdmin, async (req, res) => {
  try {
    const { title, content, video_url, buttons } = req.body;
    
    if (!title) {
      return res.status(400).json({ error: 'Title is required' });
    }
    
    const postId = `post_${Date.now()}`;
    const buttonsJson = buttons ? JSON.stringify(buttons) : '[]';
    
    db.run(
      `INSERT INTO channel_posts (post_id, title, content, video_url, buttons, published_by) 
       VALUES (?, ?, ?, ?, ?, ?)`,
      [postId, title, content, video_url, buttonsJson, process.env.ADMIN_ID],
      function(err) {
        if (err) {
          return res.status(500).json({ error: 'Error creating post' });
        }
        
        res.json({ 
          success: true, 
          message: 'Post created successfully',
          postId: postId,
          id: this.lastID
        });
      }
    );
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Публикация поста в канал
router.post('/posts/:postId/publish', checkAdmin, async (req, res) => {
  try {
    const { postId } = req.params;
    
    // Получаем пост
    db.get('SELECT * FROM channel_posts WHERE post_id = ?', [postId], (err, post) => {
      if (err) {
        return res.status(500).json({ error: 'Database error' });
      }
      
      if (!post) {
        return res.status(404).json({ error: 'Post not found' });
      }
      
      // TODO: Реализовать отправку в Telegram канал
      // Пока просто помечаем как опубликованный
      db.run(
        'UPDATE channel_posts SET is_published = TRUE, published_at = CURRENT_TIMESTAMP WHERE post_id = ?',
        [postId],
        function(err) {
          if (err) {
            return res.status(500).json({ error: 'Error publishing post' });
          }
          
          res.json({ 
            success: true, 
            message: 'Post published successfully'
          });
        }
      );
    });
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Получение статистики
router.get('/stats', checkAdmin, async (req, res) => {
  try {
    // Получаем общее количество пользователей
    db.get('SELECT COUNT(*) as total_users FROM users', (err, usersRow) => {
      if (err) {
        return res.status(500).json({ error: 'Database error' });
      }
      
      // Получаем количество зарегистрированных пользователей
      db.get('SELECT COUNT(*) as registered_users FROM users WHERE is_registered = TRUE', (err, registeredRow) => {
        if (err) {
          return res.status(500).json({ error: 'Database error' });
        }
        
        // Получаем распределение по уровням
        db.all(
          `SELECT level, COUNT(*) as count 
           FROM users 
           WHERE is_registered = TRUE 
           GROUP BY level`,
          (err, levelsRows) => {
            if (err) {
              return res.status(500).json({ error: 'Database error' });
            }
            
            // Получаем общее количество активностей
            db.get('SELECT COUNT(*) as total_activities FROM activities', (err, activitiesRow) => {
              if (err) {
                return res.status(500).json({ error: 'Database error' });
              }
              
              res.json({
                total_users: usersRow.total_users,
                registered_users: registeredRow.registered_users,
                levels: levelsRows,
                total_activities: activitiesRow.total_activities,
                timestamp: new Date().toISOString()
              });
            });
          }
        );
      });
    });
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Получение списка пользователей
router.get('/users', checkAdmin, async (req, res) => {
  try {
    const { limit = 50, offset = 0 } = req.query;
    
    db.all(
      `SELECT u.*, c.character_name 
       FROM users u 
       LEFT JOIN characters c ON u.character_id = c.id 
       ORDER BY u.stars DESC 
       LIMIT ? OFFSET ?`,
      [parseInt(limit), parseInt(offset)],
      (err, users) => {
        if (err) {
          return res.status(500).json({ error: 'Database error' });
        }
        
        res.json({ users });
      }
    );
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

export default router;
