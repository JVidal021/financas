# Worker da Pluggy (Cloudflare)

Ponte entre o app e a API da Pluggy (Meu Pluggy, grátis para uso pessoal). O Client Secret da Pluggy fica guardado só no Cloudflare. O app usa um token próprio, que você mesmo cria.

O app busca nos bancos ao abrir e de novo quando passa de 4 h (o Meu Pluggy atualiza os bancos uma vez por dia). Com os dados ele:

- **atualiza o saldo sozinho**: a soma das contas marcadas em **Dados → Bancos** vira o saldo de hoje quando o banco tem dado mais novo que o último que você informou. A conferência continua mostrando o que saiu ou entrou sem registro;
- **lança sozinho as compras conhecidas**: se todas as compras novas de uma fatura são de lojas que você já marcou (Meu / Metade / Não é meu), a fatura entra sem revisão. Com loja nova, ela vai para **Importar fatura → Faturas para revisar**, já com as conhecidas marcadas. Fatura fechada cujo total não bate com as compras também vai para revisar;
- **mostra na tela inicial** o saldo no banco, o limite livre de cada cartão e a fatura fechada a pagar.

As duas automações podem ser desligadas em **Dados → Bancos**. Uma fatura fechada que você já importou (pelo PDF ou por aqui) não volta.

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

## Contas de outra pessoa (mulher, avó…)

1. A pessoa cria a própria conta no Meu Pluggy e conecta os bancos dela (a autorização é no celular dela).
2. No Dashboard, na mesma aplicação, conecte de novo o conector **MeuPluggy** entrando com o login dela. Anote o ID da conexão nova.
3. Rode `npx wrangler secret put ITEM_IDS` com todos os IDs (os seus e os dela), separados por vírgula.
4. No app, em **Dados → Bancos**, escreva de quem é a **Conexão** nova. Até você fazer isso, nada dela entra no app.

Conta e cartão de outra pessoa começam fora do saldo e das faturas. Marque **entra no saldo** ou **uso este cartão** só no que você paga. Na tela inicial o cartão dela aparece com o nome da pessoa.

O Meu Pluggy grátis é para uso pessoal. Confira os termos da Pluggy e tenha a concordância de cada pessoa antes de conectar.

## Se der erro

- **"o token do app não confere"**: o token colado no app é diferente do APP_TOKEN do Worker.
- **"o Worker não respondeu"**: o endereço está errado, ou o site não está em `ALLOWED_ORIGINS` no `wrangler.toml`. Se mudar esse arquivo, rode `npx wrangler deploy` de novo.
- **Nenhuma conta aparece**: o conector MeuPluggy não foi ativado na aplicação (passo 1.4), ou o `ITEM_IDS` está errado.
- **Valores 100 vezes maiores**: a Pluggy mandou os valores em centavos. Avise para ajustar.
- Para ver os erros do Worker em tempo real: `npx wrangler tail`.
