# Build.Store — Guia de Deploy (Supabase + Vercel)

Este guia leva o app do modo local para produção, no ar, com backend real. O
código já detecta as credenciais automaticamente: sem elas, roda offline-local;
com elas, ativa login, RLS e sincronização em nuvem. Você não muda nenhuma linha
de código — só configura variáveis de ambiente.

Tempo estimado: 20–30 minutos.

---

## Parte 1 — Supabase (backend)

### 1.1 Criar o projeto
1. Acesse https://supabase.com e faça login (ou crie conta).
2. Clique em **New project**.
3. Escolha a organização, dê um nome (ex.: `build-store`), defina uma senha
   forte para o banco (guarde-a) e selecione a região mais próxima do Brasil
   (ex.: **South America (São Paulo)**).
4. Clique em **Create new project** e aguarde ~2 min o provisionamento.

### 1.2 Aplicar o schema
1. No menu lateral, abra **SQL Editor**.
2. Clique em **New query**.
3. Cole todo o conteúdo de `supabase/schema.sql` (incluso no projeto).
4. Clique em **Run**. Isso cria tabelas, enums, o trigger de baixa de estoque e
   todas as políticas de RLS (cada linha isolada por loja).

### 1.3 Criar a primeira loja e o dono
Ainda no **SQL Editor**, rode (ajuste o nome):

```sql
insert into stores (name) values ('Serene Boutique') returning id;
```

Copie o `id` retornado — é o `store_id` da loja.

### 1.4 Criar o usuário dono
1. Menu lateral → **Authentication** → **Users** → **Add user** →
   **Create new user**.
2. Informe e-mail e senha do dono. Confirme.
3. Copie o **User UID** do usuário criado.
4. Volte ao **SQL Editor** e vincule o usuário à loja como `owner` (troque os
   dois valores):

```sql
insert into profiles (id, store_id, full_name, role)
values ('USER_UID_AQUI', 'STORE_ID_AQUI', 'Nome do Dono', 'owner');
```

Para operadoras de caixa, repita 1.4 com `role` = `'operator'` (sem acesso a
estorno). Gerentes usam `'manager'`.

### 1.5 Pegar as chaves de API
Menu lateral → **Project Settings** → **API**. Anote:
- **Project URL** → vira `NEXT_PUBLIC_SUPABASE_URL`
- **anon public** key → vira `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- **service_role** key → vira `SUPABASE_SERVICE_ROLE_KEY` (secreta, nunca no
  cliente)

---

## Parte 2 — Vercel (hospedagem)

### 2.1 Subir o código
Coloque o projeto num repositório Git (GitHub, GitLab ou Bitbucket):

```bash
git init
git add .
git commit -m "Build.Store"
git branch -M main
git remote add origin SEU_REPO_URL
git push -u origin main
```

### 2.2 Importar na Vercel
1. Acesse https://vercel.com e faça login.
2. **Add New** → **Project** → importe o repositório.
3. A Vercel detecta Next.js automaticamente — não mude os comandos de build.

### 2.3 Configurar variáveis de ambiente
Antes de fazer deploy, em **Environment Variables**, adicione (valores da 1.5):

| Nome | Valor |
|------|-------|
| `NEXT_PUBLIC_SUPABASE_URL` | Project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | anon public key |
| `SUPABASE_SERVICE_ROLE_KEY` | service_role key |

Marque as três para **Production**, **Preview** e **Development**.

### 2.4 Deploy
Clique em **Deploy**. Em ~2 min o app estará no ar numa URL `*.vercel.app`.

### 2.5 Configurar URLs de autenticação
De volta ao Supabase → **Authentication** → **URL Configuration**:
- **Site URL**: a URL da Vercel (ex.: `https://build-store.vercel.app`).
- **Redirect URLs**: adicione a mesma URL.

Isso garante que o login redirecione corretamente em produção.

---

## Parte 3 — Verificação

1. Abra a URL da Vercel. Você deve cair na tela de **login** (não mais no modo
   local).
2. Entre com o e-mail/senha do dono criado na 1.4.
3. Faça uma venda no PDV. Confira no Supabase → **Table Editor** → `orders` que
   a venda apareceu, e em `products` que o estoque baixou (o trigger agiu).
4. Teste o offline: nas DevTools (aba Network), marque **Offline**, faça uma
   venda — ela é salva localmente. Volte para online: o badge do PDV mostra a
   sincronização e a venda sobe para o Supabase.
5. Logue como `operator` e confirme que o botão de **estornar** não aparece.

---

## Parte 4 — Sincronização com o painel do fabricante

O `SupabaseTransport` já grava cada venda e movimentação de estoque no banco
central, com `store_id` por parceiro. O painel administrativo da marca lê esse
mesmo banco:

- **Opção A (recomendada):** um segundo app (dashboard da marca) usando a
  `service_role` key, com uma view agregando vendas por `store_id`.
- **Opção B:** habilite **Realtime** nas tabelas `orders` e `stock_movements`
  (Supabase → Database → Replication) para o painel receber vendas ao vivo.

Como o RLS isola cada loja, o painel central deve usar a `service_role` key
(server-side apenas) para enxergar todas as lojas.

---

## Solução de problemas

- **App abre em "modo local" na Vercel:** as env vars não foram lidas. Confirme
  os nomes exatos e refaça o deploy (**Deployments** → **Redeploy**).
- **Erro de RLS ao salvar venda:** o usuário não tem `profiles` vinculado, ou o
  `store_id` do perfil não bate com o da loja. Revise a 1.4.
- **Login não redireciona:** confira **Site URL** / **Redirect URLs** na 2.5.
- **PWA não instala:** a Vercel serve HTTPS por padrão; force um refresh para o
  service worker registrar.
