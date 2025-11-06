#!/bin/bash

echo "🚀 Starting deployment process..."

# Проверяем Node.js
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed"
    exit 1
fi

echo "✅ Node.js version: $(node -v)"

# Устанавливаем зависимости
echo "📦 Installing dependencies..."
npm install

# Устанавливаем и собираем клиент
echo "🔨 Building client..."
cd client
npm install
npm run build
cd ..

echo "✅ Build completed!"
echo "📁 Client built in: client/dist/"

# Проверяем что сборка существует
if [ -d "client/dist" ]; then
    echo "✅ Client build verified"
    echo "📊 Build size: $(du -sh client/dist | cut -f1)"
else
    echo "❌ Client build failed"
    exit 1
fi

echo "🎉 Deployment preparation completed!"
echo "👉 Run: npm start"
