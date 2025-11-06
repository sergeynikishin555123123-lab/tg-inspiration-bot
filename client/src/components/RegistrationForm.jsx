import React, { useState, useEffect } from 'react';
import { Users, Palette, Scissors, Hammer, BookOpen } from 'lucide-react';

const RegistrationForm = ({ user, onRegister, loading }) => {
  const [selectedClass, setSelectedClass] = useState('');
  const [selectedCharacter, setSelectedCharacter] = useState('');
  const [characters, setCharacters] = useState([]);
  const [filteredCharacters, setFilteredCharacters] = useState([]);

  // Загружаем персонажей при монтировании
  useEffect(() => {
    fetchCharacters();
  }, []);

  // Фильтруем персонажей при выборе класса
  useEffect(() => {
    if (selectedClass) {
      setFilteredCharacters(characters.filter(char => char.class === selectedClass));
    } else {
      setFilteredCharacters([]);
    }
  }, [selectedClass, characters]);

  const fetchCharacters = async () => {
    try {
      const response = await fetch('/api/characters');
      if (response.ok) {
        const data = await response.json();
        setCharacters(data);
      }
    } catch (error) {
      console.error('Ошибка загрузки персонажей:', error);
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (selectedClass && selectedCharacter) {
      onRegister({
        userClass: selectedClass,
        character: selectedCharacter
      });
    }
  };

  const classIcons = {
    'Художники': <Palette size={20} />,
    'Стилисты': <Scissors size={20} />,
    'Мастера': <Hammer size={20} />,
    'Историки искусства': <BookOpen size={20} />
  };

  const classDescriptions = {
    'Художники': 'Рисование, живопись, цветовые эксперименты',
    'Стилисты': 'Мода, образы, подбор цветов и аксессуаров', 
    'Мастера': 'Рукоделие, поделки, работа с материалами',
    'Историки искусства': 'История искусств, факты, анализ произведений'
  };

  return (
    <div className="card">
      <h2 className="card-title">🎯 Выбор пути</h2>
      <p style={{ textAlign: 'center', color: '#718096', marginBottom: '24px' }}>
        Выберите класс и персонажа, чтобы начать свое путешествие в мире творчества!
      </p>

      <form onSubmit={handleSubmit}>
        {/* Выбор класса */}
        <div style={{ marginBottom: '24px' }}>
          <h3 style={{ fontSize: '18px', fontWeight: '600', marginBottom: '12px', color: '#2d3748' }}>
            🎨 Выберите класс:
          </h3>
          <div className="classes-grid">
            {['Художники', 'Стилисты', 'Мастера', 'Историки искусства'].map((className) => (
              <div
                key={className}
                className={`class-card ${selectedClass === className ? 'selected' : ''}`}
                onClick={() => setSelectedClass(className)}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
                  {classIcons[className]}
                  <span className="class-title">{className}</span>
                </div>
                <p className="class-description">{classDescriptions[className]}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Выбор персонажа */}
        {selectedClass && (
          <div style={{ marginBottom: '24px' }}>
            <h3 style={{ fontSize: '18px', fontWeight: '600', marginBottom: '12px', color: '#2d3748' }}>
              👤 Выберите персонажа:
            </h3>
            <div className="characters-grid">
              {filteredCharacters.map((character) => (
                <div
                  key={character.character_name}
                  className={`character-option ${selectedCharacter === character.character_name ? 'selected' : ''}`}
                  onClick={() => setSelectedCharacter(character.character_name)}
                >
                  <div className="character-avatar">
                    {character.character_name.charAt(0)}
                  </div>
                  <div className="character-info">
                    <div className="character-name">{character.character_name}</div>
                    <div className="character-bonus">
                      {getBonusDescription(character.bonus_type, character.bonus_value)}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Кнопка подтверждения */}
        {selectedClass && selectedCharacter && (
          <button 
            type="submit" 
            className="btn btn-primary"
            disabled={loading}
          >
            {loading ? (
              <>
                <div className="loading-spinner" style={{ width: '16px', height: '16px' }}></div>
                Регистрация...
              </>
            ) : (
              <>
                <Users size={18} />
                Начать путешествие!
              </>
            )}
          </button>
        )}
      </form>
    </div>
  );
};

// Функция для описания бонусов
function getBonusDescription(type, value) {
  const descriptions = {
    'percent_bonus': `+${value}% к звездам за творческие задания`,
    'forgiveness': `${value} право на ошибку в месяц`,
    'random_bonus': `Случайный бонус +${value} звезд`,
    'secret_access': 'Доступ к секретным материалам',
    'series_bonus': `+${value} звезда за серии заданий`,
    'photo_bonus': `+${value} звезда за каждое фото`,
    'weekly_bonus': `Еженедельные задания +${value} звезд`,
    'mini_quest': `Мини-квесты +${value} звезды`,
    'hint': `${value} подсказка в викторинах`,
    'fact_star': `+${value} факт-звезда в день`,
    'multiplier': `Множитель x${value} за серии`
  };
  return descriptions[type] || 'Особый бонус';
}

export default RegistrationForm;
