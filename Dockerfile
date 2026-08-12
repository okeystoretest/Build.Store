# syntax=docker/dockerfile:1
FROM node:20-bookworm-slim

WORKDIR /app

# Variáveis configuradas no serviço "app" do Easypanel chegam aqui como --build-arg.
# Declaramos como ARG + ENV para: (1) NEXT_PUBLIC_POLL_INTERVAL_MS ser inlinado
# corretamente no bundle do cliente durante o build, e (2) as demais ficarem
# disponíveis em runtime dentro da imagem também.
ARG DATABASE_URL
ARG PG_POOL_MAX
ARG CRON_SECRET
ARG NEXT_PUBLIC_POLL_INTERVAL_MS
ARG NODE_ENV=production
ARG PORT=3000

ENV DATABASE_URL=$DATABASE_URL
ENV PG_POOL_MAX=$PG_POOL_MAX
ENV CRON_SECRET=$CRON_SECRET
ENV NEXT_PUBLIC_POLL_INTERVAL_MS=$NEXT_PUBLIC_POLL_INTERVAL_MS
ENV NODE_ENV=$NODE_ENV
ENV PORT=$PORT
ENV NEXT_TELEMETRY_DISABLED=1

# Instala dependências primeiro (melhora cache de camadas em builds futuros)
COPY package.json package-lock.json ./
RUN npm ci

# Copia o restante do código-fonte e builda
COPY . .
RUN npm run build

EXPOSE 3000

CMD ["npm", "start"]
