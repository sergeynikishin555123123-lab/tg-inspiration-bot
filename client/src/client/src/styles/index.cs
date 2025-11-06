/* Базовые сбросы стилей */
* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

/* Основные стили для приложения */
body {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', sans-serif;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: #333;
  line-height: 1.6;
  overflow-x: hidden;
}

/* Контейнеры */
.app-container {
  min-height: 100vh;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  padding: 16px;
}

.container {
  max-width: 400px;
  margin: 0 auto;
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

/* Карточки */
.card {
  background: rgba(255, 255, 255, 0.95);
  border-radius: 20px;
  padding: 24px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.1);
  backdrop-filter: blur(10px);
  border: 1px solid rgba(255, 255, 255, 0.2);
}

.card-header {
  text-align: center;
  margin-bottom: 20px;
}

.card-title {
  font-size: 24px;
  font-weight: 700;
  color: #2d3748;
  margin-bottom: 8px;
}

.card-subtitle {
  font-size: 16px;
  color: #718096;
  margin-bottom: 0;
}

/* Кнопки */
.btn {
  width: 100%;
  padding: 16px 24px;
  border: none;
  border-radius: 12px;
  font-size: 16px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.3s ease;
  text-align: center;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
}

.btn-primary {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
}

.btn-primary:hover {
  transform: translateY(-2px);
  box-shadow: 0 8px 25px rgba(102, 126, 234, 0.4);
}

.btn-secondary {
  background: rgba(255, 255, 255, 0.9);
  color: #4a5568;
  border: 2px solid #e2e8f0;
}

.btn-secondary:hover {
  background: white;
  border-color: #667eea;
}

/* Статус и прогресс */
.status-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 0;
  border-bottom: 1px solid #e2e8f0;
}

.status-label {
  color: #4a5568;
  font-size: 14px;
}

.status-value {
  color: #2d3748;
  font-weight: 600;
  font-size: 14px;
}

.status-success {
  color: #38a169;
}

.status-warning {
  color: #d69e2e;
}

/* Звезды и уровни */
.stars-display {
  font-size: 32px;
  font-weight: 700;
  text-align: center;
  color: #f6e05e;
  text-shadow: 0 2px 4px rgba(0, 0, 0, 0.3);
  margin: 16px 0;
}

.level-badge {
  display: inline-block;
  padding: 4px 12px;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  border-radius: 20px;
  font-size: 12px;
  font-weight: 600;
  margin-left: 8px;
}

/* Классы и персонажи */
.classes-grid {
  display: grid;
  gap: 12px;
  margin-top: 16px;
}

.class-card {
  background: white;
  border: 2px solid #e2e8f0;
  border-radius: 12px;
  padding: 16px;
  cursor: pointer;
  transition: all 0.3s ease;
}

.class-card:hover {
  border-color: #667eea;
  transform: translateY(-2px);
}

.class-card.selected {
  border-color: #667eea;
  background: rgba(102, 126, 234, 0.05);
}

.class-title {
  font-size: 18px;
  font-weight: 600;
  color: #2d3748;
  margin-bottom: 8px;
}

.class-description {
  font-size: 14px;
  color: #718096;
  margin-bottom: 12px;
}

.characters-grid {
  display: grid;
  gap: 8px;
  margin-top: 12px;
}

.character-option {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px;
  border: 2px solid #e2e8f0;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.3s ease;
}

.character-option:hover {
  border-color: #667eea;
}

.character-option.selected {
  border-color: #667eea;
  background: rgba(102, 126, 234, 0.05);
}

.character-avatar {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  display: flex;
  align-items: center;
  justify-content: center;
  color: white;
  font-weight: 600;
  font-size: 16px;
}

.character-info {
  flex: 1;
}

.character-name {
  font-weight: 600;
  color: #2d3748;
  margin-bottom: 4px;
}

.character-bonus {
  font-size: 12px;
  color: #718096;
}

/* Загрузка и состояния */
.loading {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 40px;
  text-align: center;
}

.loading-spinner {
  width: 40px;
  height: 40px;
  border: 4px solid #e2e8f0;
  border-top: 4px solid #667eea;
  border-radius: 50%;
  animation: spin 1s linear infinite;
  margin-bottom: 16px;
}

@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}

.error-message {
  background: #fed7d7;
  color: #c53030;
  padding: 16px;
  border-radius: 12px;
  text-align: center;
  margin: 16px 0;
}

.success-message {
  background: #c6f6d5;
  color: #276749;
  padding: 16px;
  border-radius: 12px;
  text-align: center;
  margin: 16px 0;
}

/* Адаптивность */
@media (max-width: 480px) {
  .container {
    padding: 12px;
  }
  
  .card {
    padding: 20px;
    border-radius: 16px;
  }
  
  .card-title {
    font-size: 20px;
  }
}
