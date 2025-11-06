import React, { useState, useEffect } from 'react';

function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchUserData();
  }, []);

  const fetchUserData = async () => {
    try {
      // Получаем данные из Telegram WebApp
      const initData = window.Telegram?.WebApp?.initDataUnsafe;
      if (initData?.user?.id) {
        const userId = initData.user.id;
        
        // Запрашиваем данные пользователя
        const response = await fetch(`/api/user/${userId}`);
        if (response.ok) {
          const data = await response.json();
          setUser(data.user);
        }
      }
    } catch (error) {
      console.error('Error loading user data:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div style={{ 
        display: 'flex', 
        justifyContent: 'center', 
        alignItems: 'center', 
        height: '100vh',
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        color: 'white'
      }}>
        <div>Загрузка...</div>
      </div>
    );
  }

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
      padding: '20px',
      fontFamily: '-apple-system, BlinkMacSystemFont, sans-serif'
    }}>
      <div style={{
        maxWidth: '400px',
        margin: '0 auto',
        background: 'rgba(255,255,255,0.95)',
        borderRadius: '20px',
        padding: '24px',
        boxShadow: '0 8px 32px rgba(0,0,0,0.1)'
      }}>
        <h1 style={{ 
          textAlign: 'center', 
          color: '#2d3748',
          marginBottom: '8px'
        }}>
          🎨 Мастерская Вдохновения
        </h1>
        
        <p style={{
          textAlign: 'center',
          color: '#718096',
          marginBottom: '24px'
        }}>
          Ваш личный кабинет
        </p>

        {user ? (
          <div>
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: '16px',
              paddingBottom: '16px',
              borderBottom: '1px solid #e2e8f0'
            }}>
              <div>
                <div style={{ fontWeight: '600', color: '#2d3748' }}>
                  {user.tg_name}
                </div>
                <div style={{ fontSize: '14px', color: '#718096' }}>
                  @{user.tg_username}
                </div>
              </div>
              <div style={{
                background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                color: 'white',
                padding: '4px 12px',
                borderRadius: '12px',
                fontSize: '12px',
                fontWeight: '600'
              }}>
                {user.level}
              </div>
            </div>

            <div style={{
              textAlign: 'center',
              margin: '24px 0'
            }}>
              <div style={{
                fontSize: '48px',
                fontWeight: '700',
                color: '#f6e05e',
                textShadow: '0 2px 4px rgba(0,0,0,0.3)'
              }}>
                ⭐ {user.stars}
              </div>
              <div style={{
                fontSize: '16px',
                color: '#718096'
              }}>
                ваших звезд
              </div>
            </div>

            {!user.is_registered && (
              <div style={{
                background: 'rgba(102, 126, 234, 0.1)',
                padding: '16px',
                borderRadius: '12px',
                textAlign: 'center',
                marginTop: '20px'
              }}>
                <div style={{
                  fontWeight: '600',
                  color: '#2d3748',
                  marginBottom: '8px'
                }}>
                  🎯 Выберите свой путь!
                </div>
                <div style={{
                  fontSize: '14px',
                  color: '#718096',
                  marginBottom: '16px'
                }}>
                  Зарегистрируйтесь чтобы получить бонусы и начать обучение
                </div>
                <button
                  onClick={() => alert('Регистрация откроется скоро!')}
                  style={{
                    width: '100%',
                    padding: '12px 24px',
                    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                    color: 'white',
                    border: 'none',
                    borderRadius: '12px',
                    fontWeight: '600',
                    cursor: 'pointer'
                  }}
                >
                  Начать регистрацию
                </button>
              </div>
            )}
          </div>
        ) : (
          <div style={{ textAlign: 'center', color: '#718096' }}>
            Не удалось загрузить данные пользователя
          </div>
        )}

        <div style={{
          marginTop: '24px',
          paddingTop: '24px',
          borderTop: '1px solid #e2e8f0'
        }}>
          <div style={{
            fontSize: '14px',
            color: '#718096',
            textAlign: 'center'
          }}>
            Система находится в разработке
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;
