# Worker da Pluggy (Cloudflare)

Ponte entre o app e a API da Pluggy (Meu Pluggy, grátis para uso pessoal). O Client Secret da Pluggy fica guardado só no Cloudflare. O app usa um token próprio, que você mesmo cria.

O app busca nos bancos uma vez por dia, ao abrir. As faturas dos cartões chegam em **Importar fatura → Faturas para revisar**, no mesmo fluxo de marcar Meu / Metade / Não é meu. Uma fatura fechada que você já importou (pelo PDF ou por aqui) não volta. A fatura em aberto vem como "aberta". O saldo da conta corrente aparece em **Dados → Bancos**, com o botão "Usar como saldo de hoje".

## 1. Pluggy (uma vez)

1. Crie a conta em <https://meu.pluggy.ai>. Clique em **Conectar Minha Conta** e conecte o Itaú, o Santander e a conta corrente. Cada banco abre o app dele para você autorizar.
2. Crie a conta em <https://dashboard.pluggy.ai> e crie uma aplicação.
3. Na aba **Aplicação**, copie o **Client ID** e o **Client Secret**.
4. Na aplicação, ative o conector **MeuPluggy** e faça login com a conta do Meu Pluggy. Não use o conector do próprio banco nem o Sandbox.
5. Anote o **ID de cada conexão (item)** que aparece no Dashboard depois do passo 4. A API não lista as conexões no plano grátis, então o Worker precisa desses IDs.

## 2. Cloudflare (uma vez)

Precisa do Node instalado. No terminal, dentro desta pasta (`financas/worker`):

```bash
npx wrangler login
```

```bash
npx wrangler secret put PLUGGY_CLIENT_ID
```

```bash
npx wrangler secret put PLUGGY_CLIENT_SECRET
```

```bash
npx wrangler secret put ITEM_IDS
```

Em `ITEM_IDS`, cole os IDs das conexões separados por vírgula.

```bash
npx wrangler secret put APP_TOKEN
```

Em `APP_TOKEN`, invente uma senha longa (pelo menos 32 caracteres aleatórios). É ela que você cola no app.

```bash
npx wrangler deploy
```

O deploy mostra o endereço do Worker, algo como `https://financas-pluggy.SEU-USUARIO.workers.dev`.

## 3. No app (em cada aparelho)

Abra **Dados → Bancos (Open Finance)**, cole o endereço do Worker e o APP_TOKEN e clique em **Conectar**. Na lista de contas, confira se cada cartão está ligado ao cartão certo do app ("no app é o cartão").

## Se der erro

- **"o token do app não confere"**: o token colado no app é diferente do APP_TOKEN do Worker.
- **"o Worker não respondeu"**: o endereço está errado, ou o site não está em `ALLOWED_ORIGINS` no `wrangler.toml`. Se mudar esse arquivo, rode `npx wrangler deploy` de novo.
- **Nenhuma conta aparece**: o conector MeuPluggy não foi ativado na aplicação (passo 1.4), ou o `ITEM_IDS` está errado.
- **Valores 100 vezes maiores**: a Pluggy mandou os valores em centavos. Avise para ajustar.
- Para ver os erros do Worker em tempo real: `npx wrangler tail`.
