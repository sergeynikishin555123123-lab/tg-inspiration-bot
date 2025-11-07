import sqlite3 from 'sqlite3';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Создаем директорию для базы данных если её нет
const dbDir = join(process.cwd(), 'data');
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

const dbPath = join(dbDir, 'inspiration.db');
let db = null;

export const initDatabase = () => {
  return new Promise((resolve, reject) => {
    db = new sqlite3.Database(dbPath, (err) => {
      if (err) {
        console.error('❌ Error opening database:', err.message);
        reject(err);
        return;
      }
      
      console.log('✅ Connected to SQLite database:', dbPath);
      createTables().then(resolve).catch(reject);
    });
  });
};

const createTables = async () => {
  return new Promise((resolve, reject) => {
    db.serialize(() => {
      console.log('📊 Creating tables...');
      
      // Таблица пользователей
      db.run(`CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER UNIQUE NOT NULL,
        tg_username TEXT,
        tg_first_name TEXT,
        tg_last_name TEXT,
        class TEXT,
        character_id INTEGER,
        sparks REAL DEFAULT 0,
        level TEXT DEFAULT 'Ученик',
        is_registered BOOLEAN DEFAULT FALSE,
        registration_date DATETIME DEFAULT CURRENT_TIMESTAMP,
        last_active DATETIME DEFAULT CURRENT_TIMESTAMP,
        daily_commented BOOLEAN DEFAULT FALSE,
        consecutive_days INTEGER DEFAULT 0,
        invited_by INTEGER,
        invite_count INTEGER DEFAULT 0,
        last_bonus_claim DATETIME,
        total_activities INTEGER DEFAULT 0,
        settings TEXT DEFAULT '{}'
      )`, (err) => {
        if (err) reject(err);
      });

      // Таблица персонажей
      db.run(`CREATE TABLE IF NOT EXISTS characters (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        class TEXT NOT NULL,
        character_name TEXT NOT NULL,
        description TEXT,
        bonus_type TEXT NOT NULL,
        bonus_value TEXT NOT NULL,
        available_buttons TEXT DEFAULT '[]',
        is_active BOOLEAN DEFAULT TRUE,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )`, (err) => {
        if (err) reject(err);
      });

      // Таблица квизов
      db.run(`CREATE TABLE IF NOT EXISTS quizzes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT NOT NULL,
        description TEXT,
        questions TEXT NOT NULL,
        sparks_reward REAL DEFAULT 1,
        cooldown_hours INTEGER DEFAULT 24,
        is_active BOOLEAN DEFAULT TRUE,
        post_id TEXT,
        created_by INTEGER,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )`, (err) => {
        if (err) reject(err);
      });

      // Таблица пройденных квизов
      db.run(`CREATE TABLE IF NOT EXISTS quiz_completions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        quiz_id INTEGER NOT NULL,
        completed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        score INTEGER NOT NULL,
        sparks_earned REAL NOT NULL,
        FOREIGN KEY (user_id) REFERENCES users (user_id),
        FOREIGN KEY (quiz_id) REFERENCES quizzes (id),
        UNIQUE(user_id, quiz_id)
      )`, (err) => {
        if (err) reject(err);
      });

      // Таблица активностей
      db.run(`CREATE TABLE IF NOT EXISTS activities (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        activity_type TEXT NOT NULL,
        sparks_earned REAL NOT NULL,
        description TEXT,
        metadata TEXT DEFAULT '{}',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users (user_id)
      )`, (err) => {
        if (err) reject(err);
      });

      // Таблица постов канала
      db.run(`CREATE TABLE IF NOT EXISTS channel_posts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        post_id TEXT UNIQUE NOT NULL,
        title TEXT NOT NULL,
        content TEXT,
        photo_url TEXT,
        video_url TEXT,
        buttons TEXT,
        published_by INTEGER,
        published_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        is_published BOOLEAN DEFAULT FALSE,
        requires_action BOOLEAN DEFAULT FALSE,
        action_type TEXT DEFAULT 'quiz'
      )`, (err) => {
        if (err) reject(err);
      });

      // Таблица комментариев
      db.run(`CREATE TABLE IF NOT EXISTS comments (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        post_id TEXT NOT NULL,
        comment_text TEXT NOT NULL,
        is_approved BOOLEAN DEFAULT FALSE,
        sparks_awarded BOOLEAN DEFAULT FALSE,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users (user_id)
      )`, (err) => {
        if (err) reject(err);
      });

      // Таблица фото работ
      db.run(`CREATE TABLE IF NOT EXISTS photo_works (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        photo_url TEXT NOT NULL,
        description TEXT,
        theme TEXT,
        is_approved BOOLEAN DEFAULT FALSE,
        sparks_awarded BOOLEAN DEFAULT FALSE,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users (user_id)
      )`, (err) => {
        if (err) reject(err);
      });

      // Таблица приглашений
      db.run(`CREATE TABLE IF NOT EXISTS invitations (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        inviter_id INTEGER NOT NULL,
        invited_id INTEGER UNIQUE NOT NULL,
        invited_username TEXT,
        is_active BOOLEAN DEFAULT TRUE,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (inviter_id) REFERENCES users (user_id),
        FOREIGN KEY (invited_id) REFERENCES users (user_id)
      )`, (err) => {
        if (err) reject(err);
      });

      // Таблица админов
      db.run(`CREATE TABLE IF NOT EXISTS admins (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER UNIQUE NOT NULL,
        username TEXT,
        role TEXT DEFAULT 'moderator',
        permissions TEXT DEFAULT '{}',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )`, (err) => {
        if (err) reject(err);
      });

      // Таблица товаров магазина
      db.run(`CREATE TABLE IF NOT EXISTS shop_items (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT NOT NULL,
        description TEXT,
        type TEXT NOT NULL DEFAULT 'video',
        file_url TEXT,
        preview_url TEXT,
        price REAL NOT NULL,
        is_active BOOLEAN DEFAULT TRUE,
        created_by INTEGER,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )`, (err) => {
        if (err) reject(err);
      });

      // Таблица покупок
      db.run(`CREATE TABLE IF NOT EXISTS purchases (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        item_id INTEGER NOT NULL,
        price_paid REAL NOT NULL,
        purchased_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users (user_id),
        FOREIGN KEY (item_id) REFERENCES shop_items (id)
      )`, (err) => {
        if (err) reject(err);
      });

      db.run(`CREATE TABLE IF NOT EXISTS user_sessions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        session_data TEXT DEFAULT '{}',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users (user_id)
      )`, (err) => {
        if (err) reject(err);
      });

      // Заполняем начальными данными
      setTimeout(() => {
        populateInitialData().then(resolve).catch(reject);
      }, 1000);
    });
  });
};

const populateInitialData = async () => {
  return new Promise((resolve, reject) => {
    // Проверяем персонажей
    db.get("SELECT COUNT(*) as count FROM characters", (err, row) => {
      if (err) {
        reject(err);
        return;
      }
      
      if (row.count === 0) {
        console.log('👥 Adding default characters...');
        
        const characters = [
          ['Художники', 'Лука Цветной', 'Рисует с детства, любит эксперименты с цветом', 'percent_bonus', '10', '["quiz","photo_work","shop","invite","activities"]'],
          ['Художники', 'Марина Кисть', 'Строгая преподавательница академической живописи', 'forgiveness', '1', '["quiz","photo_work","invite","activities"]'],
          ['Художники', 'Феликс Штрих', 'Экспериментатор, мастер зарисовок', 'random_gift', '1-3', '["quiz","photo_work","shop","activities"]'],
          ['Стилисты', 'Эстелла Моде', 'Бывший стилист, обучает восприятию образа', 'percent_bonus', '5', '["quiz","shop","invite","activities"]'],
          ['Стилисты', 'Роза Ателье', 'Мастер практического шитья', 'secret_advice', '2weeks', '["photo_work","shop","activities"]'],
          ['Стилисты', 'Гертруда Линия', 'Ценит детали и аксессуары', 'series_bonus', '1', '["quiz","photo_work","invite","activities"]'],
          ['Мастера', 'Тихон Творец', 'Ремесленник, любит простые техники', 'photo_bonus', '1', '["photo_work","shop","activities"]'],
          ['Мастера', 'Агата Узор', 'Любит неожиданные материалы', 'weekly_surprise', '6', '["quiz","photo_work","shop","activities"]'],
          ['Мастера', 'Борис Клей', 'Весёлый мастер импровизаций', 'mini_quest', '2', '["quiz","shop","invite","activities"]'],
          ['Историки', 'Профессор Артёмий', 'Любитель архивов и фактов', 'quiz_hint', '1', '["quiz","activities","invite"]'],
          ['Историки', 'Соня Гравюра', 'Рассказывает истории картин', 'fact_star', '1', '["quiz","photo_work","activities"]'],
          ['Историки', 'Михаил Эпоха', 'Любит хронологию и эпохи', 'streak_multiplier', '2', '["quiz","shop","invite","activities"]']
        ];
        
        const stmt = db.prepare("INSERT INTO characters (class, character_name, description, bonus_type, bonus_value, available_buttons) VALUES (?, ?, ?, ?, ?, ?)");
        
        characters.forEach(char => {
          stmt.run(char, (err) => {
            if (err) console.error('Error inserting character:', err);
          });
        });
        
        stmt.finalize();
        console.log('✅ Default characters added');
      }

      // Добавляем админа
      if (process.env.ADMIN_ID) {
        db.run("INSERT OR IGNORE INTO admins (user_id, username, role) VALUES (?, ?, ?)",
          [process.env.ADMIN_ID, 'admin', 'superadmin'], function(err) {
          if (err) {
            console.error('Error adding admin:', err);
          } else if (this.changes > 0) {
            console.log('✅ Default admin added');
          }
        });
      }

      // Добавляем тестовые квизы
      db.get("SELECT COUNT(*) as count FROM quizzes", (err, row) => {
        if (err) {
          reject(err);
          return;
        }
        
        if (row.count === 0) {
          console.log('🎯 Adding test quizzes...');
          
          const testQuizzes = [
            {
              title: "🎨 Основы живописи",
              description: "Проверьте свои знания основ живописи",
              questions: JSON.stringify([
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
              ]),
              sparks_reward: 2,
              cooldown_hours: 24
            },
            {
              title: "🏛️ История искусства",
              description: "Тест по истории мирового искусства",
              questions: JSON.stringify([
                {
                  question: "В какой стране зародился стиль барокко?",
                  options: ["Франция", "Италия", "Испания", "Германия"],
                  correctAnswer: 1
                }
              ]),
              sparks_reward: 3,
              cooldown_hours: 48
            }
          ];
          
          const quizStmt = db.prepare("INSERT INTO quizzes (title, description, questions, sparks_reward, cooldown_hours) VALUES (?, ?, ?, ?, ?)");
          
          testQuizzes.forEach(quiz => {
            quizStmt.run([quiz.title, quiz.description, quiz.questions, quiz.sparks_reward, quiz.cooldown_hours], (err) => {
              if (err) console.error('Error inserting quiz:', err);
            });
          });
          
          quizStmt.finalize();
          console.log('✅ Test quizzes added');
        }
        
        console.log('🎉 Database initialization complete!');
        resolve();
      });
    });
  });
};

export const getDatabase = () => {
  return db;
};

export default db;
