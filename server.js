import express from 'express';
import TelegramBot from 'node-telegram-bot-api';
import cors from 'cors';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import sqlite3 from 'sqlite3';
import multer from 'multer';
import fs from 'fs';
import dotenv from 'dotenv';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const db = new sqlite3.Database(':memory:');

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(express.static(join(__dirname, 'public')));
app.use('/admin', express.static(join(__dirname, 'admin')));

// Настройка загрузки файлов
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const uploadDir = join(__dirname, 'uploads');
        if (!fs.existsSync(uploadDir)) {
            fs.mkdirSync(uploadDir, { recursive: true });
        }
        cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
        cb(null, Date.now() + '-' + file.originalname);
    }
});

const upload = multer({ 
    storage: storage,
    limits: { fileSize: 50 * 1024 * 1024 }
});

// Создаем папку uploads
const uploadsDir = join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
}

console.log('🚀 Запуск Мастерской Вдохновения...');

// ==================== ИНИЦИАЛИЗАЦИЯ БАЗЫ ДАННЫХ ====================

db.serialize(() => {
    console.log('📊 Инициализация базы данных...');

    // Таблица пользователей
    db.run(`CREATE TABLE users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER UNIQUE NOT NULL,
        tg_username TEXT,
        tg_first_name TEXT,
        class TEXT,
        character_id INTEGER,
        sparks REAL DEFAULT 0,
        level TEXT DEFAULT 'Ученик',
        is_registered BOOLEAN DEFAULT FALSE,
        registration_date DATETIME DEFAULT CURRENT_TIMESTAMP,
        last_active DATETIME DEFAULT CURRENT_TIMESTAMP,
        invite_count INTEGER DEFAULT 0,
        total_activities INTEGER DEFAULT 0
    )`);

    // Таблица классов
    db.run(`CREATE TABLE classes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL UNIQUE,
        description TEXT,
        icon TEXT,
        available_buttons TEXT DEFAULT '["quiz","shop","invite","activities","marathon"]',
        is_active BOOLEAN DEFAULT TRUE,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

    // Таблица персонажей
    db.run(`CREATE TABLE characters (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        class_id INTEGER NOT NULL,
        character_name TEXT NOT NULL,
        description TEXT,
        bonus_type TEXT NOT NULL,
        bonus_value TEXT NOT NULL,
        available_buttons TEXT DEFAULT '["quiz","shop","invite","activities","marathon"]',
        is_active BOOLEAN DEFAULT TRUE,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

    // Таблица квизов
    db.run(`CREATE TABLE quizzes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT NOT NULL,
        description TEXT,
        questions TEXT NOT NULL,
        sparks_reward REAL DEFAULT 1,
        perfect_reward REAL DEFAULT 5,
        cooldown_hours INTEGER DEFAULT 24,
        is_active BOOLEAN DEFAULT TRUE,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

    // Таблица пройденных квизов
    db.run(`CREATE TABLE quiz_completions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        quiz_id INTEGER NOT NULL,
        completed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        score INTEGER NOT NULL,
        total_questions INTEGER NOT NULL,
        sparks_earned REAL NOT NULL,
        perfect BOOLEAN DEFAULT FALSE,
        UNIQUE(user_id, quiz_id)
    )`);

    // Таблица активностей
    db.run(`CREATE TABLE activities (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        activity_type TEXT NOT NULL,
        sparks_earned REAL NOT NULL,
        description TEXT,
        metadata TEXT DEFAULT '{}',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

    // Таблица админов
    db.run(`CREATE TABLE admins (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER UNIQUE NOT NULL,
        username TEXT,
        role TEXT DEFAULT 'moderator',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

    // Таблица товаров магазина
    db.run(`CREATE TABLE shop_items (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT NOT NULL,
        description TEXT,
        type TEXT NOT NULL DEFAULT 'video',
        file_url TEXT NOT NULL,
        preview_url TEXT,
        price REAL NOT NULL,
        is_active BOOLEAN DEFAULT TRUE,
        created_by INTEGER,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

    // Таблица покупок
    db.run(`CREATE TABLE purchases (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        item_id INTEGER NOT NULL,
        price_paid REAL NOT NULL,
        purchased_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

    // Таблица постов канала
    db.run(`CREATE TABLE channel_posts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        post_id TEXT UNIQUE,
        title TEXT NOT NULL,
        content TEXT,
        photo_file_id TEXT,
        video_file_id TEXT,
        buttons TEXT,
        requires_action BOOLEAN DEFAULT FALSE,
        action_type TEXT,
        action_target INTEGER,
        published_by INTEGER,
        published_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        is_published BOOLEAN DEFAULT FALSE,
        allow_comments BOOLEAN DEFAULT TRUE
    )`);

    // Таблица комментариев
    db.run(`CREATE TABLE comments (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        post_id TEXT NOT NULL,
        comment_text TEXT NOT NULL,
        is_approved BOOLEAN DEFAULT FALSE,
        sparks_awarded BOOLEAN DEFAULT FALSE,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

    // Таблица приглашений
    db.run(`CREATE TABLE invitations (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        inviter_id INTEGER NOT NULL,
        invited_id INTEGER NOT NULL,
        invited_username TEXT,
        is_active BOOLEAN DEFAULT TRUE,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(inviter_id, invited_id)
    )`);

    // Таблица марафонов
    db.run(`CREATE TABLE marathons (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT NOT NULL,
        description TEXT,
        start_date DATETIME,
        end_date DATETIME,
        sparks_reward REAL DEFAULT 7,
        is_active BOOLEAN DEFAULT TRUE,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

    // Таблица участия в марафонах
    db.run(`CREATE TABLE marathon_participations (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        marathon_id INTEGER NOT NULL,
        joined_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        completed BOOLEAN DEFAULT FALSE,
        completed_at DATETIME,
        sparks_earned REAL DEFAULT 0,
        UNIQUE(user_id, marathon_id)
    )`);

    // Таблица фото работ
    db.run(`CREATE TABLE photo_works (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        photo_file_id TEXT NOT NULL,
        description TEXT,
        theme TEXT,
        is_approved BOOLEAN DEFAULT FALSE,
        sparks_awarded BOOLEAN DEFAULT FALSE,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

    // Заполняем классы
    const classes = [
        ['🎨 Художники', 'Творцы изобразительного искусства', '🎨'],
        ['👗 Стилисты', 'Мастера создания гармоничных образов', '👗'],
        ['🧵 Мастера', 'Ремесленники и творцы прикладного искусства', '🧵'],
        ['🏛️ Историки искусства', 'Знатоки истории и художественных направлений', '🏛️']
    ];

    const classStmt = db.prepare("INSERT INTO classes (name, description, icon) VALUES (?, ?, ?)");
    classes.forEach(cls => classStmt.run(cls));
    classStmt.finalize();

    // Заполняем персонажей
    const characters = [
        [1, 'Лука Цветной', 'Рисует с детства, любит эксперименты с цветом', 'percent_bonus', '10'],
        [1, 'Марина Кисть', 'Строгая преподавательница академической живописи', 'forgiveness', '1'],
        [1, 'Феликс Штрих', 'Экспериментатор, мастер зарисовок', 'random_gift', '1-3'],
        [2, 'Эстелла Моде', 'Бывший стилист, обучает восприятию образа', 'percent_bonus', '5'],
        [2, 'Роза Ателье', 'Мастер практического шитья', 'secret_advice', '2weeks'],
        [2, 'Гертруда Линия', 'Ценит детали и аксессуары', 'series_bonus', '1'],
        [3, 'Тихон Творец', 'Ремесленник, любит простые техники', 'photo_bonus', '1'],
        [3, 'Агата Узор', 'Любит неожиданные материалы', 'weekly_surprise', '6'],
        [3, 'Борис Клей', 'Весёлый мастер импровизаций', 'mini_quest', '2'],
        [4, 'Профессор Артёмий', 'Любитель архивов и фактов', 'quiz_hint', '1'],
        [4, 'Соня Гравюра', 'Рассказывает истории картин', 'fact_star', '1'],
        [4, 'Михаил Эпоха', 'Любит хронологию и эпохи', 'streak_multiplier', '2']
    ];

    const charStmt = db.prepare("INSERT INTO characters (class_id, character_name, description, bonus_type, bonus_value) VALUES (?, ?, ?, ?, ?)");
    characters.forEach(char => charStmt.run(char));
    charStmt.finalize();

    // Добавляем тестового пользователя
    db.run("INSERT INTO users (user_id, tg_first_name, sparks, level, is_registered, class, character_id) VALUES (?, ?, ?, ?, ?, ?, ?)",
        [12345, 'Тестовый Пользователь', 25.5, 'Ученик', true, '🎨 Художники', 1]);

    // Добавляем админа
    if (process.env.ADMIN_ID) {
        db.run("INSERT INTO admins (user_id, username, role) VALUES (?, ?, ?)",
            [process.env.ADMIN_ID, 'admin', 'superadmin']);
        console.log('✅ Админ добавлен:', process.env.ADMIN_ID);
    }

    // Добавляем тестовые квизы
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
            sparks_reward: 1,
            perfect_reward: 5
        }
    ];

    const quizStmt = db.prepare("INSERT INTO quizzes (title, description, questions, sparks_reward, perfect_reward) VALUES (?, ?, ?, ?, ?)");
    testQuizzes.forEach(quiz => quizStmt.run([quiz.title, quiz.description, quiz.questions, quiz.sparks_reward, quiz.perfect_reward]));
    quizStmt.finalize();

    // Добавляем тестовые товары
    const shopStmt = db.prepare("INSERT INTO shop_items (title, description, type, file_url, preview_url, price, created_by) VALUES (?, ?, ?, ?, ?, ?, ?)");
    shopStmt.run([
        '🎨 Урок акварели для начинающих',
        'Полный видеоурок по основам акварельной живописи',
        'video',
        'https://example.com/videos/watercolor.mp4',
        'https://example.com/previews/watercolor.jpg',
        25,
        process.env.ADMIN_ID
    ]);
    shopStmt.finalize();

    // Добавляем тестовый марафон
    db.run(`INSERT INTO marathons (title, description, start_date, end_date, sparks_reward) VALUES (?, ?, ?, ?, ?)`,
        ['7-дневный челлендж скетчинга', 'Рисуйте по одному скетчу в день в течение недели!', '2024-01-01', '2024-12-31', 7]);

    console.log('✅ База данных готова');
});

// ==================== ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ ====================

function calculateLevel(sparks) {
    if (sparks >= 400) return 'Наставник';
    if (sparks >= 300) return 'Мастер';
    if (sparks >= 150) return 'Знаток';
    if (sparks >= 50) return 'Искатель';
    return 'Ученик';
}

function awardSparks(userId, sparks, description, activityType = 'other', metadata = {}) {
    db.run(`UPDATE users SET sparks = sparks + ?, last_active = CURRENT_TIMESTAMP WHERE user_id = ?`, [sparks, userId]);
    db.run(`INSERT INTO activities (user_id, activity_type, sparks_earned, description, metadata) VALUES (?, ?, ?, ?, ?)`,
        [userId, activityType, sparks, description, JSON.stringify(metadata)]);
}

// ==================== MIDDLEWARE ====================

const requireAdmin = (req, res, next) => {
    const userId = req.query.userId || req.body.userId;
    if (!userId) {
        return res.status(401).json({ error: 'User ID required' });
    }

    db.get('SELECT * FROM admins WHERE user_id = ?', [userId], (err, admin) => {
        if (err || !admin) {
            return res.status(403).json({ error: 'Admin access required' });
        }
        req.admin = admin;
        next();
    });
};

// ==================== TELEGRAM BOT ====================

let bot;
try {
    bot = new TelegramBot(process.env.BOT_TOKEN, { polling: true });
    console.log('✅ Telegram Bot инициализирован');
} catch (error) {
    console.log('⚠️ Бот не инициализирован, используем заглушку');
    bot = {
        sendPhoto: () => Promise.resolve({ message_id: 1, photo: [{ file_id: 'test' }] }),
        sendVideo: () => Promise.resolve({ message_id: 1, video: { file_id: 'test' } }),
        sendMessage: () => Promise.resolve({ message_id: 1 }),
        onText: () => {}
    };
}

// ==================== BASIC ROUTES ====================

app.get('/health', (req, res) => {
    res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

app.get('/', (req, res) => {
    res.sendFile(join(__dirname, 'public', 'index.html'));
});

app.get('/admin', (req, res) => {
    res.sendFile(join(__dirname, 'admin', 'index.html'));
});

// ==================== WEBAPP API ====================

// Получение данных пользователя
app.get('/api/users/:userId', (req, res) => {
    const userId = req.params.userId;
    
    db.get(
        `SELECT u.*, c.character_name 
         FROM users u 
         LEFT JOIN characters c ON u.character_id = c.id 
         WHERE u.user_id = ?`,
        [userId],
        (err, user) => {
            if (err) {
                return res.status(500).json({ error: 'Database error' });
            }

            if (user) {
                user.level = calculateLevel(user.sparks);
                user.available_buttons = ['quiz', 'shop', 'invite', 'activities', 'marathon'];
                res.json({ exists: true, user });
            } else {
                // Создаем нового пользователя
                db.run(
                    `INSERT INTO users (user_id, tg_first_name, sparks, level) VALUES (?, 'Новый пользователь', 0, 'Ученик')`,
                    [userId],
                    function(err) {
                        if (err) {
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
                                character_name: null,
                                tg_first_name: 'Новый пользователь',
                                available_buttons: []
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
    const { userId, userClass, characterId, tgUsername, tgFirstName } = req.body;

    if (!userId || !userClass || !characterId) {
        return res.status(400).json({ error: 'User ID, class and character are required' });
    }

    db.run(
        `UPDATE users SET class = ?, character_id = ?, tg_username = ?, tg_first_name = ?, is_registered = TRUE WHERE user_id = ?`,
        [userClass, characterId, tgUsername, tgFirstName, userId],
        function(err) {
            if (err) {
                return res.status(500).json({ error: 'Error saving user' });
            }

            res.json({
                success: true,
                message: 'Регистрация успешна!'
            });
        }
    );
});

// Получение классов
app.get('/api/webapp/classes', (req, res) => {
    db.all("SELECT * FROM classes WHERE is_active = TRUE ORDER BY name", (err, classes) => {
        if (err) return res.status(500).json({ error: 'Database error' });
        res.json(classes);
    });
});

// Получение персонажей
app.get('/api/webapp/characters', (req, res) => {
    db.all(`
        SELECT c.*, cls.name as class_name
        FROM characters c
        JOIN classes cls ON c.class_id = cls.id
        WHERE c.is_active = TRUE
        ORDER BY cls.name, c.character_name
    `, (err, characters) => {
        if (err) return res.status(500).json({ error: 'Database error' });
        
        const grouped = {};
        characters.forEach(char => {
            if (!grouped[char.class_name]) grouped[char.class_name] = [];
            grouped[char.class_name].push(char);
        });
        
        res.json(grouped);
    });
});

// Получение квизов
app.get('/api/webapp/quizzes', (req, res) => {
    const userId = req.query.userId;
    
    db.all("SELECT * FROM quizzes WHERE is_active = TRUE ORDER BY created_at DESC", (err, quizzes) => {
        if (err) return res.status(500).json({ error: 'Database error' });
        
        const parsedQuizzes = quizzes.map(quiz => ({
            ...quiz,
            questions: JSON.parse(quiz.questions)
        }));

        if (userId) {
            db.all(`SELECT quiz_id, completed_at, score, total_questions, perfect FROM quiz_completions WHERE user_id = ?`, [userId], (err, completions) => {
                const quizzesWithStatus = parsedQuizzes.map(quiz => {
                    const completion = completions.find(c => c.quiz_id === quiz.id);
                    const completedAt = completion ? new Date(completion.completed_at) : null;
                    const cooldownMs = quiz.cooldown_hours * 60 * 60 * 1000;
                    const canRetake = completedAt ? (Date.now() - completedAt.getTime()) > cooldownMs : true;

                    return {
                        ...quiz,
                        completed: !!completion,
                        can_retake: canRetake,
                        perfect: completion ? completion.perfect : false
                    };
                });
                res.json(quizzesWithStatus);
            });
        } else {
            res.json(parsedQuizzes);
        }
    });
});

// Прохождение квиза
app.post('/api/webapp/quizzes/:quizId/submit', (req, res) => {
    const { quizId } = req.params;
    const { userId, answers } = req.body;

    if (!userId) {
        return res.status(400).json({ error: 'User ID is required' });
    }

    db.get("SELECT * FROM quizzes WHERE id = ?", [quizId], (err, quiz) => {
        if (err || !quiz) {
            return res.status(404).json({ error: 'Quiz not found' });
        }

        const questions = JSON.parse(quiz.questions);
        let correctAnswers = 0;
        questions.forEach((question, index) => {
            if (answers[index] === question.correctAnswer) {
                correctAnswers++;
            }
        });

        const perfect = correctAnswers === questions.length;
        let sparksEarned = quiz.sparks_reward;
        if (perfect) {
            sparksEarned += quiz.perfect_reward;
        }

        // Сохраняем результат
        db.run(`INSERT OR REPLACE INTO quiz_completions (user_id, quiz_id, score, total_questions, sparks_earned, perfect) VALUES (?, ?, ?, ?, ?, ?)`,
            [userId, quizId, correctAnswers, questions.length, sparksEarned, perfect]);

        // Начисляем искры
        if (sparksEarned > 0) {
            awardSparks(userId, sparksEarned, `Квиз: ${quiz.title}`, 'quiz', {
                quiz_id: quizId,
                correct_answers: correctAnswers,
                total_questions: questions.length,
                perfect: perfect
            });
        }

        res.json({
            success: true,
            correctAnswers,
            totalQuestions: questions.length,
            sparksEarned,
            perfect: perfect,
            message: perfect ?
                `Идеально! Вы получили ${sparksEarned}✨` :
                `Поздравляем! Вы получили ${sparksEarned}✨`
        });
    });
});

// Загрузка фото работы
app.post('/api/webapp/upload-photo-work', upload.single('photo'), async (req, res) => {
    try {
        const { userId, description, theme } = req.body;
        
        if (!userId || !req.file) {
            return res.status(400).json({ error: 'User ID and photo are required' });
        }

        // Сохраняем информацию о фото
        db.run(
            `INSERT INTO photo_works (user_id, photo_file_id, description, theme) VALUES (?, ?, ?, ?)`,
            [userId, `photo_${Date.now()}`, description, theme],
            function(err) {
                if (err) {
                    return res.status(500).json({ error: 'Error saving photo work' });
                }

                res.json({
                    success: true,
                    message: 'Фото успешно загружено и отправлено на модерацию! После одобрения вы получите +3✨',
                    photoWorkId: this.lastID
                });
            }
        );
    } catch (error) {
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Получение фото работ пользователя
app.get('/api/webapp/user-photo-works/:userId', (req, res) => {
    const userId = req.params.userId;
    
    db.all(`SELECT * FROM photo_works WHERE user_id = ? ORDER BY created_at DESC`, [userId], (err, photoWorks) => {
        if (err) return res.status(500).json({ error: 'Database error' });
        res.json({ photoWorks });
    });
});

// Магазин - получение товаров
app.get('/api/webapp/shop/items', (req, res) => {
    db.all("SELECT * FROM shop_items WHERE is_active = TRUE ORDER BY price ASC", (err, items) => {
        if (err) return res.status(500).json({ error: 'Database error' });
        res.json(items);
    });
});

// Покупка товара
app.post('/api/webapp/shop/purchase', (req, res) => {
    const { userId, itemId } = req.body;

    if (!userId || !itemId) {
        return res.status(400).json({ error: 'User ID and item ID are required' });
    }

    db.get('SELECT * FROM shop_items WHERE id = ? AND is_active = TRUE', [itemId], (err, item) => {
        if (err || !item) {
            return res.status(404).json({ error: 'Товар не найден' });
        }

        db.get('SELECT sparks FROM users WHERE user_id = ?', [userId], (err, user) => {
            if (err || !user) {
                return res.status(404).json({ error: 'Пользователь не найден' });
            }

            if (user.sparks < item.price) {
                return res.status(400).json({ error: 'Недостаточно искр для покупки' });
            }

            // Выполняем покупку
            db.run('UPDATE users SET sparks = sparks - ? WHERE user_id = ?', [item.price, userId], function(err) {
                if (err) return res.status(500).json({ error: 'Ошибка при списании искр' });

                db.run('INSERT INTO purchases (user_id, item_id, price_paid) VALUES (?, ?, ?)',
                    [userId, itemId, item.price], function(err) {
                        if (err) return res.status(500).json({ error: 'Ошибка при сохранении покупки' });

                        res.json({
                            success: true,
                            message: 'Покупка успешно завершена!',
                            item: item
                        });
                    });
            });
        });
    });
});

// Получение покупок пользователя
app.get('/api/webapp/shop/purchases/:userId', (req, res) => {
    const userId = req.params.userId;
    
    db.all(`
        SELECT p.*, si.title, si.description, si.type, si.file_url
        FROM purchases p
        JOIN shop_items si ON p.item_id = si.id
        WHERE p.user_id = ?
        ORDER BY p.purchased_at DESC
    `, [userId], (err, purchases) => {
        if (err) return res.status(500).json({ error: 'Database error' });
        res.json({ purchases });
    });
});

// Марафоны
app.get('/api/webapp/marathons', (req, res) => {
    const userId = req.query.userId;
    
    db.all("SELECT * FROM marathons WHERE is_active = TRUE AND end_date > CURRENT_TIMESTAMP ORDER BY start_date DESC", (err, marathons) => {
        if (err) return res.status(500).json({ error: 'Database error' });

        if (userId) {
            db.all(`SELECT marathon_id, joined_at, completed FROM marathon_participations WHERE user_id = ?`, [userId], (err, participations) => {
                const marathonsWithStatus = marathons.map(marathon => {
                    const participation = participations.find(p => p.marathon_id === marathon.id);
                    return {
                        ...marathon,
                        participating: !!participation,
                        completed: participation ? participation.completed : false
                    };
                });
                res.json(marathonsWithStatus);
            });
        } else {
            res.json(marathons);
        }
    });
});

// Участие в марафоне
app.post('/api/webapp/marathons/:marathonId/join', (req, res) => {
    const { marathonId } = req.params;
    const { userId } = req.body;

    if (!userId) {
        return res.status(400).json({ error: 'User ID is required' });
    }

    db.run(`INSERT OR IGNORE INTO marathon_participations (user_id, marathon_id) VALUES (?, ?)`,
        [userId, marathonId],
        function(err) {
            if (err) return res.status(500).json({ error: 'Error joining marathon' });

            res.json({
                success: true,
                message: 'Вы успешно присоединились к марафону!'
            });
        }
    );
});

// Активности пользователя
app.get('/api/webapp/users/:userId/activities', (req, res) => {
    const userId = req.params.userId;
    
    db.all(`SELECT * FROM activities WHERE user_id = ? ORDER BY created_at DESC LIMIT 20`, [userId], (err, activities) => {
        if (err) return res.status(500).json({ error: 'Database error' });
        res.json({ activities });
    });
});

// ==================== TELEGRAM BOT ====================

bot.onText(/\/start/, (msg) => {
    const chatId = msg.chat.id;
    const name = msg.from.first_name || 'Друг';

    const welcomeText = `🎨 Привет, ${name}!

Добро пожаловать в **Мастерская Вдохновения**!

✨ Откройте личный кабинет чтобы начать!`;

    const keyboard = {
        inline_keyboard: [[
            {
                text: "📱 Открыть Личный Кабинет",
                web_app: { url: `http://localhost:${PORT}` }
            }
        ]]
    };

    bot.sendMessage(chatId, welcomeText, {
        parse_mode: 'Markdown',
        reply_markup: keyboard
    });
});

// ==================== ЗАПУСК СЕРВЕРА ====================

const PORT = process.env.PORT || 3000;

// Функция для попытки запуска на разных портах
function startServer(port) {
    const server = app.listen(port, '0.0.0.0')
        .on('listening', () => {
            console.log(`🚀 Сервер запущен на порту ${port}`);
            console.log(`📱 Mini App: http://localhost:${port}`);
            console.log(`🔧 Admin Panel: http://localhost:${port}/admin`);
            console.log('✅ Все системы работают!');
        })
        .on('error', (err) => {
            if (err.code === 'EADDRINUSE') {
                console.log(`❌ Порт ${port} занят, пробуем следующий...`);
                if (port < 3006) {
                    startServer(port + 1);
                } else {
                    console.log('❌ Все порты с 3000 по 3006 заняты!');
                }
            } else {
                console.error('❌ Server error:', err);
            }
        });
}

// Запускаем сервер
startServer(3000);
