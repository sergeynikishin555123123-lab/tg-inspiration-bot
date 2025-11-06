import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './styles/index.css'

// Инициализация Telegram WebApp
if (window.Telegram && window.Telegram.WebApp) {
  const WebApp = window.Telegram.WebApp;
  WebApp.expand();
  WebApp.setBackgroundColor('#f8f9fa');
  console.log('Telegram WebApp initialized');
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
