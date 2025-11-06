FROM node:18-alpine

WORKDIR /app

# Копируем package.json
COPY package.json ./

# Устанавливаем зависимости простым способом
RUN npm install

# Копируем все файлы
COPY . .

# Создаем папку client/dist если её нет (для избежания ошибок)
RUN mkdir -p client/dist

# Открываем порт
EXPOSE 3000

# Запускаем приложение
CMD ["npm", "start"]
