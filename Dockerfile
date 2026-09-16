FROM node:22-alpine
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm install --omit=dev
COPY index.html admin.html server.js ./
COPY css ./css
COPY js ./js
COPY assets ./assets
COPY lib ./lib
COPY migrations ./migrations
ENV NODE_ENV=production
EXPOSE 3000
CMD ["node", "server.js"]
