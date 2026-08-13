# syntax=docker/dockerfile:1
FROM node:20-bookworm-slim

WORKDIR /app

# IMPORTANTE: NODE_ENV **não** é definido aqui em cima de propósito.
# O Easypanel envia NODE_ENV=production como build-arg, e com NODE_ENV=production
# o `npm ci` PULA as devDependencies — o que deixava o build sem tailwindcss,
# postcss, autoprefixer e typescript (todos necessários pra buildar).
# NODE_ENV=production só é aplicado no final, valendo para o runtime.
ARG DATABASE_URL
ARG PG_POOL_MAX
ARG CRON_SECRET
ARG NEXT_PUBLIC_POLL_INTERVAL_MS
ARG PORT=3000

ENV DATABASE_URL=$DATABASE_URL
ENV PG_POOL_MAX=$PG_POOL_MAX
ENV CRON_SECRET=$CRON_SECRET
ENV NEXT_PUBLIC_POLL_INTERVAL_MS=$NEXT_PUBLIC_POLL_INTERVAL_MS
ENV PORT=$PORT
ENV NEXT_TELEMETRY_DISABLED=1

# --include=dev garante as devDependencies mesmo que algum NODE_ENV/npm config
# tente omiti-las. NÃO remover: é exatamente esse o bug que quebrava o build.
COPY package.json package-lock.json ./
RUN npm ci --include=dev

# Falha cedo e com mensagem clara se alguma dependência de build sumir.
RUN node -e "['typescript','tailwindcss','postcss','autoprefixer'].forEach(m=>{try{require.resolve(m);console.log('OK   '+m)}catch(e){console.log('FALTA '+m);process.exitCode=1}})"

COPY . .

RUN npm run build

# Só agora marca produção — vale pro runtime, não atrapalha o build acima.
ENV NODE_ENV=production

EXPOSE 3000

CMD ["npm", "start"]