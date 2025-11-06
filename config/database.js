import sqlite3 from 'sqlite3';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const dbPath = join(__dirname, '..', 'data', 'inspiration.db');

// Создаем директорию для данных если её нет
import { existsSync, mkdirSync } from 'fs';
const dataDir = join(__dirname, '..', 'data');
if (!existsSync(dataDir)) {
  mkdirSync(dataDir, { recursive: true });
}

const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('Error opening database:', err.message);
  } else {
    console.log('📊 Connected to SQLite database');
  }
});

export const initDatabase = () => {
  // Таблица пользователей
  db.run(`CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER UNIQUE NOT NULL,
    tg_username TEXT,
    tg_first_name TEXT,
    tg_last_name TEXT,
    class TEXT,
    character_id INTEGER,
    stars REAL DEFAULT 0,
    level TEXT DEFAULT 'Ученик',
    is_registered BOOLEAN DEFAULT FALSE,
    registration_date DATETIME DEFAULT CURRENT_TIMESTAMP,
    last_active DATETIME DEFAULT CURRENT_TIMESTAMP,
    daily_commented BOOLEAN DEFAULT FALSE,
    consecutive_days INTEGER DEFAULT 0,
    FOREIGN KEY (character_id) REFERENCES characters(id)
  )`);

  // Таблица персонажей
  db.run(`CREATE TABLE IF NOT EXISTS characters (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    class TEXT NOT NULL,
    character_name TEXT NOT NULL,
    description TEXT,
    bonus_type TEXT NOT NULL,
    bonus_value TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  // Таблица активностей
  db.run(`CREATE TABLE IF NOT EXISTS activities (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    activity_type TEXT NOT NULL,
    stars_earned REAL NOT NULL,
    description TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(user_id)
  )`);

  // Таблица квизов
  db.run(`CREATE TABLE IF NOT EXISTS quizzes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    description TEXT,
    questions TEXT NOT NULL, -- JSON строка с вопросами
    video_id TEXT,
    required_level TEXT DEFAULT 'Ученик',
    stars_reward REAL DEFAULT 1,
    is_active BOOLEAN DEFAULT TRUE,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  // Таблица постов канала
  db.run(`CREATE TABLE IF NOT EXISTS channel_posts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    post_id TEXT UNIQUE NOT NULL,
    title TEXT NOT NULL,
    content TEXT,
    video_url TEXT,
    buttons TEXT, -- JSON строка с кнопками
    published_by INTEGER,
    published_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    is_published BOOLEAN DEFAULT FALSE
  )`);

  // Заполняем персонажей согласно ТЗ
  db.get("SELECT COUNT(*) as count FROM characters", (err, row) => {
    if (err) return console.error('Error checking characters:', err);
    
    if (row.count === 0) {
      console.log('👥 Adding default characters...');
      
      const characters = [
        // Художники
        {
          class: 'Художники',
          character_name: 'Лука Цветной',
          description: 'Рисует с детства, любит эксперименты с цветом',
          bonus_type: 'percent_bonus',
          bonus_value: '10'
        },
        {
          class: 'Художники',
          character_name: 'Марина Кисть',
          description: 'Строгая, но добрая преподавательница академической живописи',
          bonus_type: 'forgiveness',
          bonus_value: '1'
        },
        {
          class: 'Художники',
          character_name: 'Феликс Штрих',
          description: 'Экспериментатор, мастер быстрых зарисовок',
          bonus_type: 'random_gift',
          bonus_value: '1-3'
        },
        // Стилисты
        {
          class: 'Стилисты',
          character_name: 'Эстелла Моде',
          description: 'Бывший стилист, обучает восприятию образа',
          bonus_type: 'percent_bonus',
          bonus_value: '5'
        },
        {
          class: 'Стилисты',
          character_name: 'Роза Ателье',
          description: 'Мастер практического шитья и образов',
          bonus_type: 'secret_advice',
          bonus_value: '2weeks'
        },
        {
          class: 'Стилисты',
          character_name: 'Гертруда Линия',
          description: 'Ценит детали и силу аксессуаров',
          bonus_type: 'series_bonus',
          bonus_value: '1'
        },
        // Мастера
        {
          class: 'Мастера',
          character_name: 'Тихон Творец',
          description: 'Ремесленник, любит простые техники',
          bonus_type: 'photo_bonus',
          bonus_value: '1'
        },
        {
          class: 'Мастера',
          character_name: 'Агата Узор',
          description: 'Любит неожиданные материалы и коллажи',
          bonus_type: 'weekly_surprise',
          bonus_value: '6'
        },
        {
          class: 'Мастера',
          character_name: 'Борис Клей',
          description: 'Весёлый мастер импровизаций',
          bonus_type: 'mini_quest',
          bonus_value: '2'
        },
        // Историки искусства
        {
          class: 'Историки',
          character_name: 'Профессор Артёмий',
          description: 'Экстра-любитель архивов и фактов',
          bonus_type: 'quiz_hint',
          bonus_value: '1'
        },
        {
          class: 'Историки',
          character_name: 'Соня Гравюра',
          description: 'Рассказывает истории картин как сказки',
          bonus_type: 'fact_star',
          bonus_value: '1'
        },
        {
          class: 'Историки',
          character_name: 'Михаил Эпоха',
          description: 'Любит хронологию и сравнения эпох',
          bonus_type: 'streak_multiplier',
          bonus_value: '2'
        }
      ];

      const insertStmt = db.prepare(`INSERT INTO characters (class, character_name, description, bonus_type, bonus_value) 
                                    VALUES (?, ?, ?, ?, ?)`);
      
      characters.forEach(char => {
        insertStmt.run([char.class, char.character_name, char.description, char.bonus_type, char.bonus_value]);
      });
      
      insertStmt.finalize();
      console.log('✅ Default characters added');
    }
  });
};

export default db;
