import React, { useState, useEffect } from 'react';
import Layout from './components/Layout';
import UserProfile from './components/UserProfile';
import RegistrationForm from './components/RegistrationForm';
import LoadingSpinner from './components/LoadingSpinner';

function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [registering, setRegistering] = useState(false);
  const [error, setError] = useState('');

  // Получаем данные пользователя при загрузке
  useEffect(() => {
    fetchUserData();
  }, []);

  const fetchUserData = async () => {
    try {
      setLoading(true);
      
      // Получаем initData от Telegram WebApp
      const initData = window.Telegram?.WebApp?.initDataUnsafe;
      if (!initData?.user?.id) {
        setError('Не удалось получить данные пользователя из Telegram');
        setLoading(false);
        return;
      }

      const userId = initData.user.id;
      
      // Запрашиваем данные пользователя с сервера
      const response = await fetch(`/api/user/${userId}`);
      
      if (response.ok) {
        const data = await response.json();
        
        if (data.exists) {
          setUser(data.user);
        } else {
          // Пользователь не зарегистрирован в базе
          setUser({
            user_id: userId,
            tg_username: initData.user.username,
            tg_name: initData.user.first_name,
            stars: 0,
            level: 'Ученик',
            is_registered: false
          });
        }
      } else {
        throw new Error('Ошибка сервера');
      }
    } catch (error) {
      console.error('Ошибка загрузки данных:', error);
      setError('Ошибка подключения к серверу');
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (registrationData) => {
    try {
      setRegistering(true);
      setError('');

      const response = await fetch('/api/user/register', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId: user.user_id,
          username: user.tg_username,
          name: user.tg_name,
          ...registrationData
        })
      });

      const result = await response.json();

      if (result.success) {
        // Обновляем данные пользователя
        await fetchUserData();
        
        // Показываем сообщение об успехе
        alert(`🎉 Регистрация успешна! Вы получили ${result.starsAdded} звезд!`);
        
        // Закрываем WebApp или показываем сообщение
        if (window.Telegram?.WebApp) {
          window.Telegram.WebApp.showAlert('Регистрация завершена! Добро пожаловать в Мастерскую Вдохновения!');
        }
      } else {
        throw new Error(result.error || 'Ошибка регистрации');
      }
    } catch (error) {
      console.error('Ошибка регистрации:', error);
      setError(error.message);
    } finally {
      setRegistering(false);
    }
  };

  // Показываем загрузку
  if (loading) {
    return (
      <Layout>
        <LoadingSpinner message="Загружаем ваш профиль..." />
      </Layout>
    );
  }

  // Показываем ошибку
  if (error && !user) {
    return (
      <Layout title="❌ Ошибка" subtitle="Не удалось загрузить данные">
        <div className="error-message">
          {error}
        </div>
        <button 
          className="btn btn-primary" 
          onClick={fetchUserData}
        >
          Попробовать снова
        </button>
      </Layout>
    );
  }

  // Если пользователь не зарегистрирован
  if (user && !user.is_registered) {
    return (
      <Layout 
        title="🎨 Мастерская Вдохновения" 
        subtitle="Добро пожаловать! Выберите свой творческий путь"
      >
        {error && <div className="error-message">{error}</div>}
        
        <div className="card">
          <h2 className="card-title">👋 Привет, {user.tg_name}!</h2>
          <p style={{ textAlign: 'center', color: '#718096', marginBottom: '16px' }}>
            Мы рады видеть вас в нашей творческой мастерской! 
            Для начала выберите класс и персонажа, который будет вашим проводником.
          </p>
          
          <div className="status-item">
            <div className="status-label">⭐ Ваши звезды:</div>
            <div className="status-value">{user.stars || 0}</div>
          </div>
          
          <div className="status-item">
            <div className="status-label">📊 Уровень:</div>
            <div className="status-value">{user.level}</div>
          </div>
        </div>

        <RegistrationForm 
          user={user}
          onRegister={handleRegister}
          loading={registering}
        />
      </Layout>
    );
  }

  // Если пользователь зарегистрирован - показываем профиль
  return (
    <Layout 
      title="🎨 Мастерская Вдохновения" 
      subtitle="Ваш личный кабинет"
    >
      {error && <div className="error-message">{error}</div>}
      
      <UserProfile user={user} />
      
      <div className="card">
        <h3 className="card-title">🚀 Доступные действия</h3>
        <p style={{ textAlign: 'center', color: '#718096', marginBottom: '16px' }}>
          Скоро здесь появятся задания, квизы и интерактивы!
        </p>
        
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <button className="btn btn-secondary" disabled>
            📝 Пройти квиз (скоро)
          </button>
          <button className="btn btn-secondary" disabled>
            🎯 Выполнить задание (скоро)
          </button>
          <button className="btn btn-secondary" disabled>
            👥 Пригласить друзей (скоро)
          </button>
        </div>
      </div>

      <div className="card">
        <h3 className="card-title">📊 Ваш прогресс</h3>
        <p style={{ textAlign: 'center', color: '#718096' }}>
          Вы на пути к уровню <strong>{getNextLevel(user.level)}</strong>
        </p>
      </div>
    </Layout>
  );
}

// Вспомогательная функция
function getNextLevel(currentLevel) {
  const levels = {
    'Ученик': 'Искатель',
    'Искатель': 'Знаток', 
    'Знаток': 'Мастер',
    'Мастер': 'Наставник'
  };
  return levels[currentLevel] || 'Максимум';
}

export default App;
