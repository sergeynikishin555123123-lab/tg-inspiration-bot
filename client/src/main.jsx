import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './styles/index.css'

// Инициализация Telegram WebApp
if (window.Telegram && window.Telegram.WebApp) {
  const WebApp = window.Telegram.WebApp;
  
  // Расширяем на весь экран
  WebApp.expand();
  
  // Отключаем свайп для закрытия
  WebApp.disableVerticalSwipes();
  
  // Устанавливаем цвет фона
  WebApp.setBackgroundColor('#f8f9fa');
  
  console.log('Telegram WebApp initialized:', WebApp.initDataUnsafe);
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
