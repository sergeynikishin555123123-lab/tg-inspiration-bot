FROM node:18-alpine

WORKDIR /app

# Копируем package.json
COPY package.json ./
COPY client/package.json ./client/

# Устанавливаем зависимости
RUN npm install

# Устанавливаем зависимости клиента
RUN cd client && npm install

# Копируем исходный код
COPY . .

# Собираем клиент
RUN cd client && npm run build

# Открываем порт
EXPOSE 3000

# Запускаем приложение
CMD ["npm", "start"]
