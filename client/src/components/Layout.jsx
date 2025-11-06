import React from 'react';

const Layout = ({ children, title, subtitle }) => {
  return (
    <div className="app-container">
      <div className="container">
        {(title || subtitle) && (
          <div className="card card-header">
            {title && <h1 className="card-title">{title}</h1>}
            {subtitle && <p className="card-subtitle">{subtitle}</p>}
          </div>
        )}
        {children}
      </div>
    </div>
  );
};

export default Layout;
