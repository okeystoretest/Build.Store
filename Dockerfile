# syntax=docker/dockerfile:1
FROM node:20-bookworm-slim

WORKDIR /app

# IMPORTANTE: NODE_ENV **não** é definido aqui em cima de propósito.
# O Easypanel envia NODE_ENV=production como build-arg, e com NODE_ENV=production
# o `npm ci` PULA as devDependencies — o que deixava o build sem tailwindcss,
# postcss, autoprefixer e typescript (todos necessários pra buildar).
# NODE_ENV=production só é aplicado no final, para o runtime.
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

# --include=dev força a instalação das devDependencies mesmo que algum
# NODE_ENV/npm config tente omiti-las.
COPY package.json package-lock.json ./
RUN npm ci --include=dev

# Confere se as devDependencies essenciais chegaram mesmo (falha cedo e claro
# se não chegaram, em vez de dar erro confuso lá na frente).
RUN node -e "['typescript','tailwindcss','postcss','autoprefixer'].forEach(m=>{try{require.resolve(m);console.log('OK   '+m)}catch(e){console.log('FALTA '+m);process.exitCode=1}})"

COPY . .

# Sonda de diagnóstico: mostra o que o **Node** enxerga no filesystem
# (o `ls` do shell já mostrava os arquivos; isso testa a visão do próprio Node,
# que é quem o webpack usa pra resolver os módulos).
RUN node -e "const fs=require('fs');['src/components/ui','src/features/auth/actions','src/features/stores'].forEach(d=>{try{console.log('DIR '+d+' -> '+JSON.stringify(fs.readdirSync(d)))}catch(e){console.log('DIR '+d+' ERRO: '+e.message)}});['src/components/ui/button.tsx','src/components/ui/input.tsx','src/components/ui/label.tsx','src/components/ui/toast.tsx','src/features/auth/actions/auth.ts','src/features/stores/store-context.tsx'].forEach(f=>{try{const s=fs.statSync(f);console.log('STAT '+f+' size='+s.size+' file='+s.isFile())}catch(e){console.log('STAT '+f+' ERRO: '+e.message)}})"

RUN npm run build

# Só agora marca produção — vale pro runtime, não atrapalha o build acima.
ENV NODE_ENV=production

EXPOSE 3000

CMD ["npm", "start"]
