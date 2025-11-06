import pkg from 'pg';
const { Pool } = pkg;
import dotenv from 'dotenv';

dotenv.config();

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME || 'inspiration_db',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'password',
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

async function initializeDatabase() {
  try {
    console.log('🔄 Инициализация базы данных...');
    
    await pool.query(`
      CREATE TABLE IF NOT EXISTS users (
        user_id BIGINT PRIMARY KEY,
        tg_username VARCHAR(255),
        tg_name VARCHAR(255) NOT NULL,
        user_class VARCHAR(100),
        character_name VARCHAR(100),
        stars DECIMAL(10,1) DEFAULT 0.0,
        level VARCHAR(50) DEFAULT 'Ученик',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        last_active_date DATE DEFAULT CURRENT_DATE,
        is_registered BOOLEAN DEFAULT FALSE
      );
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS user_daily_activity (
        id SERIAL PRIMARY KEY,
        user_id BIGINT REFERENCES users(user_id),
        activity_date DATE DEFAULT CURRENT_DATE,
        has_commented BOOLEAN DEFAULT FALSE,
        UNIQUE(user_id, activity_date)
      );
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS stars_history (
        id SERIAL PRIMARY KEY,
        user_id BIGINT REFERENCES users(user_id),
        stars_amount DECIMAL(5,1) NOT NULL,
        activity_type VARCHAR(100) NOT NULL,
        description TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS characters (
        id SERIAL PRIMARY KEY,
        class VARCHAR(100) NOT NULL,
        character_name VARCHAR(100) NOT NULL,
        description TEXT,
        bonus_type VARCHAR(100),
        bonus_value VARCHAR(100)
      );
    `);

    const charactersCount = await pool.query('SELECT COUNT(*) FROM characters');
    if (parseInt(charactersCount.rows[0].count) === 0) {
      await pool.query(`
        INSERT INTO characters (class, character_name, description, bonus_type, bonus_value) VALUES
        ('Художники', 'Лука Цветной', 'Рисует с детства, любит эксперименты с цветом', 'percent_bonus', '10'),
        ('Художники', 'Марина Кисть', 'Строгая, но добрая преподавательница академической живописи', 'forgiveness', '1'),
        ('Художники', 'Феликс Штрих', 'Экспериментатор, мастер быстрых зарисовок', 'random_bonus', '1-3'),
        ('Стилисты', 'Эстелла Моде', 'Бывший стилист, обучает восприятию образа', 'percent_bonus', '5'),
        ('Стилисты', 'Роза Ателье', 'Мастер практического шитья и образов', 'secret_access', 'biweekly'),
        ('Стилисты', 'Гертруда Линия', 'Ценит детали и силу аксессуаров', 'series_bonus', '1'),
        ('Мастера', 'Тихон Творец', 'Ремесленник, любит простые техники', 'photo_bonus', '1'),
        ('Мастера', 'Агата Узор', 'Любит неожиданные материалы и коллажи', 'weekly_bonus', '6'),
        ('Мастера', 'Борис Клей', 'Весёлый мастер импровизаций', 'mini_quest', '2'),
        ('Историки искусства', 'Профессор Артёмий', 'Экстра-любитель архивов и фактов', 'hint', '1'),
        ('Историки искусства', 'Соня Гравюра', 'Рассказывает истории картин как сказки', 'fact_star', '1'),
        ('Историки искусства', 'Михаил Эпоха', 'Любит хронологию и сравнения эпох', 'multiplier', '2');
      `);
      console.log('✅ Персонажи добавлены в базу данных');
    }

    console.log('✅ База данных инициализирована успешно');
  } catch (error) {
    console.error('❌ Ошибка инициализации базы данных:', error);
  }
}

async function getUser(userId) {
  try {
    const result = await pool.query('SELECT * FROM users WHERE user_id = $1', [userId]);
    return result.rows[0] || null;
  } catch (error) {
    console.error('Ошибка получения пользователя:', error);
    return null;
  }
}

async function createUser(userData) {
  try {
    const { user_id, tg_username, tg_name } = userData;
    const result = await pool.query(
      `INSERT INTO users (user_id, tg_username, tg_name) 
       VALUES ($1, $2, $3) 
       ON CONFLICT (user_id) DO NOTHING 
       RETURNING *`,
      [user_id, tg_username, tg_name]
    );
    return result.rows[0] || null;
  } catch (error) {
    console.error('Ошибка создания пользователя:', error);
    return null;
  }
}

async function updateUser(userId, updates) {
  try {
    const fields = [];
    const values = [];
    let paramCount = 1;

    for (const [key, value] of Object.entries(updates)) {
      fields.push(`${key} = $${paramCount}`);
      values.push(value);
      paramCount++;
    }

    values.push(userId);
    const query = `UPDATE users SET ${fields.join(', ')} WHERE user_id = $${paramCount} RETURNING *`;
    
    const result = await pool.query(query, values);
    return result.rows[0] || null;
  } catch (error) {
    console.error('Ошибка обновления пользователя:', error);
    return null;
  }
}

async function addStars(userId, starsAmount, activityType, description = '') {
  try {
    await pool.query(
      'UPDATE users SET stars = stars + $1 WHERE user_id = $2',
      [starsAmount, userId]
    );

    await pool.query(
      'INSERT INTO stars_history (user_id, stars_amount, activity_type, description) VALUES ($1, $2, $3, $4)',
      [userId, starsAmount, activityType, description]
    );

    const user = await getUser(userId);
    if (user) {
      const newLevel = calculateLevel(user.stars + parseFloat(starsAmount));
      if (newLevel !== user.level) {
        await updateUser(userId, { level: newLevel });
      }
    }

    return true;
  } catch (error) {
    console.error('Ошибка добавления звезд:', error);
    return false;
  }
}

function calculateLevel(stars) {
  if (stars >= 400) return 'Наставник';
  if (stars >= 300) return 'Мастер';
  if (stars >= 150) return 'Знаток';
  if (stars >= 50) return 'Искатель';
  return 'Ученик';
}

export { pool, initializeDatabase, getUser, createUser, updateUser, addStars };
