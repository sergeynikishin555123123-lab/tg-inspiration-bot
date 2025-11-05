import React from 'react';
import ReactDOM from 'react-dom/client';

function App() {
  return (
    <div style={{ padding: '20px', fontSize: '24px', textAlign: 'center' }}>
      <h1>🎨 Мастерская Вдохновения</h1>
      <p>Скоро здесь будет ваш личный кабинет!</p>
      <p>⏳ Система запускается...</p>
    </div>
  );
}

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(<App />);
