import React from 'react';
import { Star, Award, User, Calendar } from 'lucide-react';

const UserProfile = ({ user }) => {
  if (!user) return null;

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('ru-RU', {
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    });
  };

  return (
    <div className="card">
      <h2 className="card-title">👤 Ваш профиль</h2>
      
      {/* Основная информация */}
      <div className="status-item">
        <div className="status-label">
          <User size={16} style={{ marginRight: '8px' }} />
          Имя:
        </div>
        <div className="status-value">{user.tg_name}</div>
      </div>
      
      <div className="status-item">
        <div className="status-label">
          <Calendar size={16} style={{ marginRight: '8px' }} />
          Регистрация:
        </div>
        <div className="status-value">{formatDate(user.created_at)}</div>
      </div>

      {/* Звезды и уровень */}
      <div style={{ textAlign: 'center', margin: '20px 0' }}>
        <div className="stars-display">
          ⭐ {user.stars || 0}
        </div>
        <div style={{ fontSize: '18px', fontWeight: '600', color: '#2d3748' }}>
          Уровень: {user.level} 
          <span className="level-badge">{user.level}</span>
        </div>
      </div>

      {/* Класс и персонаж */}
      {user.user_class && (
        <>
          <div className="status-item">
            <div className="status-label">🎨 Класс:</div>
            <div className="status-value">{user.user_class}</div>
          </div>
          
          <div className="status-item">
            <div className="status-label">👤 Персонаж:</div>
            <div className="status-value">{user.character_name}</div>
          </div>
        </>
      )}

      {/* Прогресс до следующего уровня */}
      <div style={{ marginTop: '20px', padding: '16px', background: 'rgba(102, 126, 234, 0.1)', borderRadius: '12px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
          <span style={{ fontSize: '14px', color: '#4a5568' }}>Прогресс до {getNextLevel(user.level)}:</span>
          <span style={{ fontSize: '14px', fontWeight: '600', color: '#667eea' }}>
            {user.stars || 0}/{getNextLevelStars(user.level)}
          </span>
        </div>
        <div style={{ 
          width: '100%', 
          height: '8px', 
          background: '#e2e8f0', 
          borderRadius: '4px',
          overflow: 'hidden'
        }}>
          <div 
            style={{ 
              height: '100%', 
              background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
              width: `${calculateProgress(user.stars || 0, user.level)}%`,
              transition: 'width 0.3s ease'
            }}
          />
        </div>
      </div>
    </div>
  );
};

// Вспомогательные функции
function getNextLevel(currentLevel) {
  const levels = {
    'Ученик': 'Искатель',
    'Искатель': 'Знаток', 
    'Знаток': 'Мастер',
    'Мастер': 'Наставник',
    'Наставник': 'Максимум'
  };
  return levels[currentLevel] || 'Максимум';
}

function getNextLevelStars(currentLevel) {
  const starsRequired = {
    'Ученик': 50,
    'Искатель': 150,
    'Знаток': 300,
    'Мастер': 400,
    'Наставник': 500
  };
  return starsRequired[currentLevel] || 500;
}

function calculateProgress(stars, level) {
  const current = parseFloat(stars) || 0;
  const nextLevelStars = getNextLevelStars(level);
  const progress = (current / nextLevelStars) * 100;
  return Math.min(progress, 100);
}

export default UserProfile;
