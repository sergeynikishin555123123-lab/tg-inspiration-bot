require('dotenv').config();
const express = require('express');
const { Pool } = require('pg');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json());
app.use(express.static(path.join(__dirname, '../frontend/build')));

// Подключение к БД - БЕЗ SSL
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  // SSL отключен для упрощения
});

// Проверка работы
app.get('/health', async (req, res) => {
  try {
    await pool.query('SELECT 1');
    res.json({ 
      status: 'OK', 
      database: 'connected',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({ 
      status: 'ERROR', 
      database: 'disconnected',
      error: error.message 
    });
  }
});

// Webhook для Telegram (пока заглушка)
app.post('/webhook', (req, res) => {
  console.log('Webhook received:', req.body);
  res.send('OK');
});

// Serve Mini App
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/build/index.html'));
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Health check: ${process.env.APP_URL}/health`);
});
