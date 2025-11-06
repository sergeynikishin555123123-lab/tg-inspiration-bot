import React from 'react';

const LoadingSpinner = ({ message = "Загрузка..." }) => {
  return (
    <div className="loading">
      <div className="loading-spinner"></div>
      <p style={{ color: '#718096', fontSize: '14px' }}>{message}</p>
    </div>
  );
};

export default LoadingSpinner;
