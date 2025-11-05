import React from 'react'

function App() {
  return (
    <div style={styles.container}>
      <header style={styles.header}>
        <h1 style={styles.title}>🎨 Мастерская Вдохновения</h1>
        <p style={styles.subtitle}>Ваш личный кабинет</p>
      </header>

      <main style={styles.main}>
        <div style={styles.card}>
          <h3 style={styles.cardTitle}>🚀 Система запущена!</h3>
          <p style={styles.cardText}>
            Бот и Mini App успешно работают. Скоро здесь появятся:
          </p>
          <ul style={styles.list}>
            <li>✅ Задания и квизы</li>
            <li>✅ Система уровней и звёзд</li>
            <li>✅ Персональные бонусы</li>
            <li>✅ Прогресс обучения</li>
          </ul>
        </div>

        <div style={styles.card}>
          <h3 style={styles.cardTitle}>📊 Текущий статус</h3>
          <div style={styles.status}>
            <div style={styles.statusItem}>
              <span>Backend:</span>
              <span style={styles.statusSuccess}>✅ Работает</span>
            </div>
            <div style={styles.statusItem}>
              <span>Frontend:</span>
              <span style={styles.statusSuccess}>✅ Загружен</span>
            </div>
            <div style={styles.statusItem}>
              <span>База данных:</span>
              <span style={styles.statusSuccess}>✅ Подключена</span>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}

const styles = {
  container: {
    minHeight: '100vh',
    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
    padding: '20px',
    color: 'white'
  },
  header: {
    textAlign: 'center',
    marginBottom: '30px'
  },
  title: {
    fontSize: '28px',
    fontWeight: 'bold',
    margin: '0 0 10px 0',
    textShadow: '0 2px 4px rgba(0,0,0,0.3)'
  },
  subtitle: {
    fontSize: '16px',
    opacity: 0.9,
    margin: 0
  },
  main: {
    maxWidth: '400px',
    margin: '0 auto'
  },
  card: {
    background: 'rgba(255,255,255,0.1)',
    borderRadius: '15px',
    padding: '20px',
    marginBottom: '20px',
    backdropFilter: 'blur(10px)',
    border: '1px solid rgba(255,255,255,0.2)'
  },
  cardTitle: {
    fontSize: '20px',
    margin: '0 0 15px 0',
    fontWeight: '600'
  },
  cardText: {
    fontSize: '14px',
    opacity: 0.8,
    margin: '0 0 15px 0',
    lineHeight: '1.4'
  },
  list: {
    paddingLeft: '20px',
    fontSize: '14px',
    opacity: 0.8
  },
  status: {
    display: 'flex',
    flexDirection: 'column',
    gap: '10px'
  },
  statusItem: {
    display: 'flex',
    justifyContent: 'space-between',
    fontSize: '14px',
    padding: '5px 0'
  },
  statusSuccess: {
    color: '#90EE90',
    fontWeight: '500'
  }
}

export default App
