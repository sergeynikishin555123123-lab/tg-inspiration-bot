import React from 'react';
import ReactDOM from 'react-dom/client';
import { retrieveLaunchParams } from '@tma.js/sdk';

// Основной компонент приложения
function App() {
  const [user, setUser] = React.useState(null);
  const [loading, setLoading] = React.useState(true);
  const [page, setPage] = React.useState('main');

  React.useEffect(() => {
    initializeApp();
  }, []);

  const initializeApp = async () => {
    try {
      const { initData } = retrieveLaunchParams();
      const userId = initData?.user?.id;
      
      if (userId) {
        // Проверяем есть ли пользователь в базе
        const response = await fetch(`/api/user/${userId}`);
        const data = await response.json();
        
        if (data.exists) {
          setUser(data.user);
          if (!data.user.class) {
            setPage('questionnaire');
          }
        } else {
          setPage('questionnaire');
        }
      }
    } catch (error) {
      console.error('Initialization error:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleRegistration = async (userClass, character) => {
    try {
      const { initData } = retrieveLaunchParams();
      const userId = initData.user.id;
      const username = initData.user.username;
      const name = [initData.user.firstName, initData.user.lastName].filter(Boolean).join(' ');

      const response = await fetch('/api/user/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId,
          username,
          name,
          userClass,
          character
        })
      });

      const result = await response.json();
      if (result.success) {
        setUser(prev => ({ ...prev, class: userClass, character }));
        setPage('main');
      }
    } catch (error) {
      console.error('Registration error:', error);
    }
  };

  if (loading) {
    return (
      <div style={styles.container}>
        <div style={styles.loading}>
          <div style={styles.spinner}></div>
          <p style={styles.text}>Загрузка...</p>
        </div>
      </div>
    );
  }

  if (page === 'questionnaire') {
    return <Questionnaire onComplete={handleRegistration} />;
  }

  return (
    <div style={styles.container}>
      <header style={styles.header}>
        <h1 style={styles.title}>🎨 Мастерская Вдохновения</h1>
        {user && (
          <div style={styles.userInfo}>
            <p style={styles.welcome}>Добро пожаловать, {user.tg_name}!</p>
            <div style={styles.stats}>
              <div style={styles.stat}>
                <span style={styles.statLabel}>Уровень:</span>
                <span style={styles.statValue}>{user.level}</span>
              </div>
              <div style={styles.stat}>
                <span style={styles.statLabel}>Звёзды:</span>
                <span style={styles.statValue}>⭐ {user.stars}</span>
              </div>
              {user.class && (
                <div style={styles.stat}>
                  <span style={styles.statLabel}>Класс:</span>
                  <span style={styles.statValue}>{user.class}</span>
                </div>
              )}
            </div>
          </div>
        )}
      </header>

      <main style={styles.main}>
        <div style={styles.card}>
          <h3 style={styles.cardTitle}>📚 Доступные задания</h3>
          <p style={styles.cardText}>Скоро здесь появятся первые задания!</p>
          <button style={styles.button} disabled>
            ⏳ В разработке...
          </button>
        </div>

        <div style={styles.card}>
          <h3 style={styles.cardTitle}>🏆 Ваш прогресс</h3>
          <div style={styles.progress}>
            <div style={styles.progressBar}>
              <div 
                style={{
                  ...styles.progressFill,
                  width: `${(user?.stars || 0) / 500 * 100}%`
                }}
              ></div>
            </div>
            <p style={styles.progressText}>
              До следующего уровня: {50 - (user?.stars || 0)} ⭐
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}

// Компонент анкеты
function Questionnaire({ onComplete }) {
  const classes = [
    {
      id: 'artist',
      name: '🎨 Художники',
      characters: [
        { id: 'luka', name: 'Лука Цветной', bonus: '+10% к звёздам за творческие задания' },
        { id: 'marina', name: 'Марина Кисть', bonus: '1 "право на ошибку" в месяц' },
        { id: 'felix', name: 'Феликс Штрих', bonus: 'Случайный подарок после заданий' }
      ]
    },
    {
      id: 'stylist', 
      name: '👗 Стилисты',
      characters: [
        { id: 'estella', name: 'Эстелла Моде', bonus: '+5% к звёздам за стиль' },
        { id: 'roza', name: 'Роза Ателье', bonus: 'Доступ к секретным советам' },
        { id: 'gertruda', name: 'Гертруда Линия', bonus: '+1 звезда за серии заданий' }
      ]
    }
  ];

  const [selectedClass, setSelectedClass] = React.useState(null);

  return (
    <div style={styles.container}>
      <header style={styles.header}>
        <h1 style={styles.title}>🎯 Выберите свой путь</h1>
        <p style={styles.subtitle}>Это поможет нам подобрать задания именно для вас</p>
      </header>

      <main style={styles.main}>
        {!selectedClass ? (
          <div>
            <h3 style={styles.sectionTitle}>Выберите класс:</h3>
            {classes.map(cls => (
              <div 
                key={cls.id}
                style={styles.classCard}
                onClick={() => setSelectedClass(cls)}
              >
                <h4 style={styles.className}>{cls.name}</h4>
                <p style={styles.classDescription}>Нажмите чтобы выбрать персонажа</p>
              </div>
            ))}
          </div>
        ) : (
          <div>
            <h3 style={styles.sectionTitle}>Выберите персонажа:</h3>
            <button 
              style={styles.backButton}
              onClick={() => setSelectedClass(null)}
            >
              ← Назад к классам
            </button>
            {selectedClass.characters.map(char => (
              <div 
                key={char.id}
                style={styles.characterCard}
                onClick={() => onComplete(selectedClass.name, char.name)}
              >
                <h4 style={styles.characterName}>{char.name}</h4>
                <p style={styles.characterBonus}>Бонус: {char.bonus}</p>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}

// Стили
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
    margin: '0 0 10px 0'
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
    backdropFilter: 'blur(10px)'
  },
  cardTitle: {
    fontSize: '20px',
    margin: '0 0 10px 0'
  },
  cardText: {
    fontSize: '14px',
    opacity: 0.8,
    margin: '0 0 15px 0'
  },
  button: {
    width: '100%',
    padding: '12px',
    background: 'rgba(255,255,255,0.2)',
    border: 'none',
    borderRadius: '10px',
    color: 'white',
    fontSize: '16px',
    cursor: 'not-allowed'
  },
  loading: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    height: '100vh'
  },
  spinner: {
    width: '40px',
    height: '40px',
    border: '4px solid rgba(255,255,255,0.3)',
    borderTop: '4px solid white',
    borderRadius: '50%',
    animation: 'spin 1s linear infinite'
  },
  text: {
    marginTop: '20px',
    fontSize: '16px'
  },
  userInfo: {
    marginTop: '20px'
  },
  welcome: {
    fontSize: '18px',
    margin: '0 0 15px 0'
  },
  stats: {
    display: 'flex',
    flexDirection: 'column',
    gap: '10px'
  },
  stat: {
    display: 'flex',
    justifyContent: 'space-between',
    fontSize: '16px'
  },
  statLabel: {
    opacity: 0.8
  },
  statValue: {
    fontWeight: 'bold'
  },
  progress: {
    marginTop: '15px'
  },
  progressBar: {
    width: '100%',
    height: '10px',
    background: 'rgba(255,255,255,0.2)',
    borderRadius: '5px',
    overflow: 'hidden'
  },
  progressFill: {
    height: '100%',
    background: 'linear-gradient(90deg, #ffd700, #ffed4e)',
    transition: 'width 0.3s ease'
  },
  progressText: {
    fontSize: '14px',
    margin: '10px 0 0 0',
    textAlign: 'center'
  },
  classCard: {
    background: 'rgba(255,255,255,0.1)',
    borderRadius: '12px',
    padding: '15px',
    marginBottom: '10px',
    cursor: 'pointer',
    transition: 'background 0.2s',
    ':hover': {
      background: 'rgba(255,255,255,0.2)'
    }
  },
  characterCard: {
    background: 'rgba(255,255,255,0.1)',
    borderRadius: '12px',
    padding: '15px',
    marginBottom: '10px',
    cursor: 'pointer',
    transition: 'background 0.2s'
  },
  className: {
    margin: '0 0 5px 0',
    fontSize: '18px'
  },
  classDescription: {
    margin: 0,
    fontSize: '14px',
    opacity: 0.7
  },
  characterName: {
    margin: '0 0 8px 0',
    fontSize: '16px'
  },
  characterBonus: {
    margin: 0,
    fontSize: '14px',
    opacity: 0.8
  },
  sectionTitle: {
    fontSize: '20px',
    margin: '0 0 15px 0'
  },
  backButton: {
    background: 'rgba(255,255,255,0.1)',
    border: 'none',
    color: 'white',
    padding: '10px 15px',
    borderRadius: '8px',
    marginBottom: '15px',
    cursor: 'pointer',
    fontSize: '14px'
  }
};

// Добавляем анимацию для спиннера
const styleSheet = document.styleSheets[0];
styleSheet.insertRule(`
  @keyframes spin {
    0% { transform: rotate(0deg); }
    100% { transform: rotate(360deg); }
  }
`, styleSheet.cssRules.length);

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(<App />);
