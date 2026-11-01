FROM node:22-slim AS build
WORKDIR /app
COPY client/package*.json client/
RUN npm install --prefix client
COPY client client
RUN npm run build --prefix client
FROM node:22-slim
RUN apt-get update && apt-get install -y python3 make g++ && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY server/package*.json server/
RUN npm install --omit=dev --prefix server
COPY server server
COPY --from=build /app/client/dist client/dist
ENV NODE_ENV=production DB_FILE=/data/school.db
EXPOSE 3000
CMD ["node","server/src/server.js"]
