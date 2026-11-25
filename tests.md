# Bateria de Testes — Shimã Sushi API & Bot do WhatsApp

Documentação completa da estrutura de testes em `tests/`, dos comandos executáveis via `npm run test` e de **todos os cenários e resultados possíveis** para a API REST, as funções do bot de WhatsApp e os utilitários CLI.

---

## 1. Estrutura da pasta `tests/`

```text
tests/
├── runTests.js            # Orquestrador principal acionado por `npm run test`
├── api.test.js            # Bateria automatizada dos endpoints HTTP da API (26 testes / 5 suítes)
├── whatsappBot.test.js    # Bateria automatizada do Bot WhatsApp (10 testes / 5 suítes)
├── regression.test.js     # Suíte de não-regressão do estado atual e bugs corrigidos (8 testes REG-001..REG-008)
├── sendRandomOrder.js     # Utilitário CLI executável: sorteia um pedido real do banco e envia no WhatsApp
└── dispatchLastOrder.js   # Utilitário CLI executável: libera pedido para entrega como admin e notifica
```

---

## 2. Pré-requisitos

1. **Dependências instaladas:** `npm install`
2. **Arquivo `.env` configurado na raiz** com as variáveis usadas pelo bcrypt e JWT (`SALTROUNDS`, `JWTSECRET`).
3. **Banco MySQL ativo e migrado:**
   ```bash
   docker compose up -d
   npx sequelize-cli db:migrate
   npx sequelize-cli db:seed:all
   ```
   > As suítes `tests/api.test.js` e `tests/whatsappBot.test.js` criam seus próprios registros temporários no MySQL (identificados por timestamp único) e os removem automaticamente no bloco `after()`, mantendo os dados originais intactos.
4. **Sessão WhatsApp Web conectada (somente para os modos ao vivo `--random`, `--dispatch` ou `npm run test -- <numero>`):**
   - Inicie o cliente principal (`node src/cfg/whatsappWeb.js`) e escaneie o QR Code se ainda não houver sessão salva em `.wwebjs_auth/`.
   - Os modos automatizados padrão (`npm run test`, `--api`, `--bot`) usam dublês controlados para WhatsApp/Puppeteer e **não** disparam mensagens reais nem interferem no navegador em execução.

---

## 3. Comandos disponíveis

| Comando | O que executa | Envia WhatsApp real? | Código de saída esperado |
|---|---|---|---|
| `npm run test` | Bateria completa automatizada: `api.test.js` + `whatsappBot.test.js` + `regression.test.js` + validação CLI sem argumentos | Não | `0` (tudo passou) ou `1` (alguma falha) |
| `npm run test -- --api` (ou `npm run test:api`) | Apenas a suíte HTTP `tests/api.test.js` | Não | `0` ou `1` |
| `npm run test -- --bot` (ou `npm run test:bot`) | Apenas a suíte funcional `tests/whatsappBot.test.js` | Não | `0` ou `1` |
| `npm run test -- --regression` (ou `npm run test:regression`) | Apenas a suíte de não-regressão `tests/regression.test.js` | Não | `0` ou `1` |
| `npm run test -- --random <numero>` (ou `npm run test:random -- <numero>`) | Executa `tests/sendRandomOrder.js <numero>` | Sim | `0` (enviado) ou `1` (erro/args inválidos) |
| `npm run test -- --dispatch <numero> [id]` (ou `npm run test:dispatch -- <numero> [id]`) | Executa `tests/dispatchLastOrder.js <numero> [id]` como admin | Sim | `0` (enviado) ou `1` (erro/args inválidos) |
| `npm run test -- <numero>` (ou `--all <numero>`) | Bateria automatizada completa + envio aleatório + despacho de um pedido temporário limpo ao final | Sim | `0` ou `1` |
| `npm run test -- --help` | Exibe ajuda rápida dos modos no terminal | Não | `0` |

> Também é possível chamar os scripts CLI diretamente:
> ```bash
> node tests/sendRandomOrder.js 27988460599
> ./tests/sendRandomOrder.js 27988460599
> node tests/dispatchLastOrder.js 27988460599
> ./tests/dispatchLastOrder.js 27988460599 24
> ```

---

## 4. Bateria de Testes da API (`tests/api.test.js`)

A suíte sobe o servidor Express (`app.js`) em porta efêmera (`127.0.0.1:0`), injeta um dublê de `src/cfg/whatsappWeb.js` (que persiste no MySQL via `OrderServices` mas simula o envio WhatsApp) e testa todas as rotas abaixo.

### Padrão de resposta de erro da API
Todos os erros tratados pelo `errorHandler` seguem o formato JSON:
```json
{ "msg": "<mensagem descritiva>", "status": 400 }
```

### 4.1 Rotas gerais e middleware 404

| Método & Rota | Cenário testado | Resultado possível | Payload / Comportamento esperado |
|---|---|---|---|
| `GET /` | Raiz da API | `200 OK` | Texto `"Shimã Sushi API"` |
| `GET /rota-que-nao-existe` | Rota não mapeada (`handler404`) | `404 Not Found` | `{ "msg": "Página não encontrada", "status": 404 }` |

### 4.2 Clientes & Autenticação (`/register`, `/users/`, `/login`)

| Método & Rota | Cenário testado | Resultado possível | Payload / Comportamento esperado |
|---|---|---|---|
| `POST /register` | Campos obrigatórios ausentes | `400 Bad Request` | `{ "msg": "Todos os campos obrigatórios (name, password, repeatPassword, email, address, phone) devem ser informados", "status": 400 }` |
| `POST /register` | `password !== repeatPassword` | `400 Bad Request` | `{ "msg": "As senhas não coincidem", "status": 400 }` |
| `POST /register` | E-mail já cadastrado | `400 Bad Request` | `{ "msg": "Email já cadastrado", "status": 400 }` |
| `POST /register` / `POST /users/` | Cadastro válido | `201 Created` | `{ "msg": "Usuário criado com sucesso", "user": { ... } }` com `role: "user"` e **sem** campo `password` |
| `POST /login` | `email` ou `password` ausentes | `400 Bad Request` | `{ "msg": "Email e senha são obrigatórios", "status": 400 }` |
| `POST /login` | E-mail não encontrado | `404 Not Found` | `{ "msg": "Usuário não encontrado", "status": 404 }` |
| `POST /login` | Senha incorreta | `400 Bad Request` | `{ "msg": "Erro na requisição, senha ou email incorretos", "status": 400 }` |
| `POST /login` | Credenciais válidas (cliente ou admin) | `200 OK` | `{ "msg": "Tudo correto, Logando", "token": "<jwt>" }` + header `authorization` |
| `GET /users/` | Listagem pública | `200 OK` | Array de clientes sem o campo `password` |
| `GET /users/:id` | ID existente | `200 OK` | Objeto do cliente sem o campo `password` |
| `GET /users/:id` | ID inexistente (`999999`) | `404 Not Found` | `{ "msg": "Registro não encontrado", "status": 404 }` |
| `PUT /users/:id` | Corpo `{}` vazio | `400 Bad Request` | `{ "msg": "Um ou mais dados fornecidos estão incorretos", "status": 400 }` |
| `PUT /users/:id` | ID inexistente | `404 Not Found` | `{ "msg": "Registro não encontrado", "status": 404 }` |
| `PUT /users/:id` | Atualização de dados e/ou senha | `200 OK` | `{ "msg": "Alterado com sucesso", "update": true }` (nova senha re-criptografada e validada via `/login`) |
| `DELETE /users/:id` | ID inexistente | `404 Not Found` | `{ "msg": "ID 999999 não encontrado", "status": 404 }` |
| `DELETE /users/:id` | Exclusão válida | `200 OK` | `{ "msg": "ID <id> deletado com sucesso" }` |

### 4.3 Cardápio (`/menu/`)

| Método & Rota | Cenário testado | Resultado possível | Payload / Comportamento esperado |
|---|---|---|---|
| `GET /menu/` | Listagem pública | `200 OK` | Array de itens do cardápio |
| `GET /menu/:id` | Item existente | `200 OK` | Objeto `Menu_item` |
| `GET /menu/:id` | Item inexistente (`999999`) | `404 Not Found` | `{ "msg": "Registro não encontrado", "status": 404 }` |
| `POST /menu/` | Sem header `authorization` ou token JWT inválido/expirado | `401 Unauthorized` | `{ "msg": "Acesso negado.", "status": 401 }` ou `{ "msg": "Token inválido ou expirado.", "status": 401 }` |
| `POST /menu/` | Corpo `{}` vazio com token válido | `400 Bad Request` | `{ "msg": "Dados para criação não fornecidos", "status": 400 }` |
| `POST /menu/` | Dados válidos com token | `201 Created` | Objeto criado com `id` |
| `PUT /menu/:id` | Sem token | `401 Unauthorized` | `{ "msg": "Acesso negado.", "status": 401 }` |
| `PUT /menu/:id` | Corpo `{}` vazio | `400 Bad Request` | `RequisicaoIncorreta` (`400`) |
| `PUT /menu/:id` | ID inexistente | `404 Not Found` | `NotFound` (`404`) |
| `PUT /menu/:id` | Atualização válida com token | `200 OK` | `{ "msg": "Alterado com sucesso", "update": true }` |
| `DELETE /menu/:id` | Sem token | `401 Unauthorized` | `401` |
| `DELETE /menu/:id` | ID inexistente | `404 Not Found` | `404` |
| `DELETE /menu/:id` | Exclusão válida com token | `200 OK` | `{ "msg": "ID <id> deletado com sucesso" }` |

### 4.4 Pedidos & Despacho pelo Admin (`/pedidos/`)

| Método & Rota | Cenário testado | Resultado possível | Payload / Comportamento esperado |
|---|---|---|---|
| `POST /pedidos/` | Sem token | `401 Unauthorized` | `401` |
| `POST /pedidos/` | Corpo `{}` vazio | `400 Bad Request` | `{ "msg": "Dados para criação não fornecidos", "status": 400 }` |
| `POST /pedidos/` | `customer_id` inexistente (violação de FK no MySQL) | `400 Bad Request` | Convertido por `errorHandler` (`SequelizeForeignKeyConstraintError` / `ER_NO_REFERENCED_ROW_2`) |
| `POST /pedidos/` | Pedido válido com token | `201 Created` | Pedido criado com `status: "Em preparo"` |
| `GET /pedidos/` | Sem token / Com token | `401` / `200 OK` | Array de pedidos |
| `GET /pedidos/:id` | Existente / Inexistente | `200 OK` / `404 Not Found` | Registro do pedido ou `404` |
| `PUT /pedidos/:id` | Corpo vazio / Inexistente / Válido | `400` / `404` / `200 OK` | `{ "msg": "Alterado com sucesso", "update": true }` |
| `PATCH /pedidos/:id/despachar` | Sem token | `401 Unauthorized` | `401` |
| `PATCH /pedidos/:id/despachar` | Token de cliente comum (`role: "user"`) | `403 Forbidden` | `{ "msg": "Acesso negado: apenas administradores podem liberar pedidos para entrega.", "status": 403 }` |
| `PATCH /pedidos/:id/despachar` | Bot WhatsApp desconectado/não pronto | `503 Service Unavailable` | `{ "msg": "Cliente do WhatsApp ainda não está pronto para enviar mensagens.", "status": 503 }` |
| `PATCH /pedidos/:id/despachar` | Pedido inexistente (`999999`) | `404 Not Found` | `{ "msg": "Pedido #999999 não encontrado.", "status": 404 }` |
| `PATCH /pedidos/:id/despachar` | Token `admin` + pedido `'Em preparo'` | `200 OK` | `{ "msg": "Pedido #<id> liberado para entrega e cliente notificado.", "orderId": <id>, "status": "Saiu para entrega", "chatId": "..." }` |
| `PATCH /pedidos/:id/despachar` | Pedido já liberado anteriormente (`status: "Saiu para entrega"`) | `400 Bad Request` | `{ "msg": "O pedido #<id> já foi liberado para entrega (status: Saiu para entrega).", "status": 400 }` |
| `PATCH /pedidos/despachar-ultimo` | Token `role: "user"` | `403 Forbidden` | `403` |
| `PATCH /pedidos/despachar-ultimo` | Sem pedidos pendentes no banco | `404 Not Found` | `{ "msg": "Não há pedidos pendentes (\"Em preparo\") aguardando liberação para entrega.", "status": 404 }` |
| `PATCH /pedidos/despachar-ultimo` | Token `admin` + existe pedido `'Em preparo'` | `200 OK` | Seleciona o maior `id` pendente, atualiza `status` para `"Saiu para entrega"` e retorna `200` |
| `DELETE /pedidos/:id` | Sem token / Inexistente / Válido | `401` / `404` / `200 OK` | `{ "msg": "ID <id> deletado com sucesso" }` |

> **Observação sobre erros `500`:** Qualquer erro inesperado não mapeado no `errorHandler.js` retorna `{ "msg": "Erro interno do servidor", "status": 500 }`.

---

## 5. Bateria Funcional do Bot WhatsApp (`tests/whatsappBot.test.js`) e Scripts CLI

A suíte intercepta `whatsapp-web.js` e `puppeteer` via `Module._load` antes de carregar `src/cfg/whatsappWeb.js`, garantindo testes determinísticos contra o banco MySQL real sem tocar no navegador em segundo plano.

### 5.1 Funções exportadas testadas (`src/cfg/whatsappWeb.js`)

| Função | Cenários e Resultados Possíveis |
|---|---|
| `formatOrderMessage(order, appOrderData)` | Retorna `string` com cabeçalho `🍣 *Shimã Sushi — Confirmação de Pedido*`, número do pedido, nome, telefone formatado `(DD) 9XXXX-XXXX`, endereço + complemento (`Nº ...`), itens (lista do app ou inferência de quantidade `total_amount / price`), hora (`America/Sao_Paulo`), tempo estimado, preço, taxa (`Grátis (R$ 0,00)` ou `R$ X,XX`) e total. |
| `formatDispatchMessage(order, dispatchData)` | Retorna `string` com cabeçalho `🛵 *Shimã Sushi — Pedido Saiu para Entrega!*`, status `Saiu para entrega`, linha opcional `🏍️ *Entregador:* ...` (quando `courierName`/`delivererName` for informado), previsão padrão `20 a 30 minutos` (ou customizada) e resumo do pedido. |
| `sendTextMessage(phone, text)` | • **Sucesso (`Promise<{ chatId, message, sentMessage }>`)**: normaliza `27988460599` → `5527988460599`, resolve `@lid`/`@c.us` via `getNumberId` e envia com `{ sendSeen: false }`.<br>• **Erro `400`**: texto vazio/só espaços ou telefone com menos de 10 dígitos.<br>• **Erro `404`**: `bot.getNumberId` retorna `null` (número sem WhatsApp).<br>• **Erro `503`**: `bot.info` ou `bot.pupPage` ausentes. |
| `sendCustomerOrder(orderInput, appOrderData)` | • **Sucesso**: busca `Order` + `Customer` (sem `password`) + `Menu_item` no MySQL e envia mensagem padronizada.<br>• **Erro `400`**: `orderId` ausente ou cliente sem telefone.<br>• **Erro `404`**: pedido inexistente no MySQL ou número sem WhatsApp.<br>• **Erro `503`**: bot não pronto. |
| `sendRandomCustomerOrder(phone, appOrderData)` | • **Sucesso**: consulta `SELECT id FROM orders` (`getAllOrderIds`), sorteia um `id` existente via `crypto.randomInt` e envia o pedido real do banco.<br>• **Erro `404`**: tabela `orders` vazia ou número sem WhatsApp. |
| `dispatchOrderForDelivery(orderInput, dispatchData)` | • **Sucesso**: valida `adminRole === 'admin'`, resolve WhatsApp **antes** de gravar no banco, atualiza `orders.status` para `'Saiu para entrega'` e envia `formatDispatchMessage`.<br>• **Erro `403`**: `adminRole` informado diferente de `'admin'`.<br>• **Erro `404` (Atomicidade)**: quando `getNumberId` retorna `null`, lança `404` e mantém `orders.status` intacto como `'Em preparo'`.<br>• **Erro `400`**: pedido já despachado sem `forceResend: true` (com `forceResend: true`, reenvia com sucesso).<br>• **Erro `503`**: bot não pronto. |
| `dispatchLastCustomerOrder(phoneOrOptions, extraOptions)` | • **Sucesso**: busca maior `id` onde `status NOT IN ('Saiu para entrega', 'Entregue', 'Cancelado')`, altera para `'Saiu para entrega'` e notifica.<br>• **Erro `403`**: `adminRole` diferente de `'admin'`.<br>• **Erro `404`**: nenhum pedido pendente aguardando liberação. |
| Eventos `message` e `message_create` | • **Terceiro (`fromMe: false`, `!ping`)**: dispara `message_create` + `message` e responde **1 única vez** com `TEST_REPLY`.<br>• **Próprio número (`fromMe: true`, `teste`)**: dispara em `message_create` e responde **1 vez** com `{ sendSeen: false }`.<br>• **Ignorados (0 respostas)**: `status@broadcast`, `isStatus: true`, textos comuns (`"bom dia"`) e mensagens do próprio bot (`TEST_REPLY`, `ORDER_HEADER`, `DISPATCH_HEADER`) para evitar loop. |
| `waitUntilBotReady(timeoutMs)` | • **Resolve (`undefined`)**: quando `bot` já está pronto ou ao emitir `'ready'`.<br>• **Erro `504`**: tempo limite `timeoutMs` excedido.<br>• **Erro `401`**: evento `'auth_failure'` disparado durante espera. |

### 5.2 Utilitários CLI executáveis (`tests/sendRandomOrder.js` e `tests/dispatchLastOrder.js`)

| Script | Entradas | Resultados Possíveis |
|---|---|---|
| `tests/sendRandomOrder.js` | `<numero_whatsapp>` | • **Código `0`**: conecta ao navegador ativo (ou inicia novo), sorteia um `id` real de `orders`, envia o pedido no WhatsApp e exibe o resumo.<br>• **Código `1`**: argumento ausente ou `< 10` dígitos (exibe `Uso: ...` antes de carregar o WhatsApp), banco sem pedidos (`404`), número inválido (`400`/`404`) ou falha de conexão/timeout (`504`). |
| `tests/dispatchLastOrder.js` | `<numero_whatsapp> [order_id]` | • **Código `0`**: atua como `admin`, libera o último pedido `'Em preparo'` (ou o `order_id` opcional), altera `status` no MySQL para `'Saiu para entrega'`, envia `🛵 *Shimã Sushi — Pedido Saiu para Entrega!*` e imprime a mensagem enviada.<br>• **Código `1`**: argumento ausente/`< 10` dígitos, nenhum pedido pendente (`404`), pedido já despachado (`400`), número sem WhatsApp (`404`, mantendo o banco intacto) ou falha de conexão/timeout (`504`). |

---

## 6. Suíte de Não-Regressão (`tests/regression.test.js`)

A suíte de não-regressão garante a estabilidade do estado atual da aplicação e impede que bugs já resolvidos retornem em futuras alterações.

### Política de Testes e Não-Regressão (`AGENTS.md`)

- **O Teste é o Ultimato (Proibido Alterar Testes para Passar):** nunca altere, remova, afrouxe ou pule (`skip`) testes existentes para forçar aprovação. Se um teste falhar, a linha de desenvolvimento está errada e **não prossegue** — corrija o código da aplicação ou descarte a abordagem.
- **Novo Bug = Novo Teste de Não-Regressão:** para cada bug corrigido, é obrigatório criar automaticamente um teste correspondente em `tests/regression.test.js` (ou na suíte pertinente em `tests/`).
- **Portão de Continuidade:** o desenvolvimento só continua quando `npm run test` inteiro retornar código `0` com **0 falhas**.

### Catálogo dos casos `REG-001` a `REG-008`

| ID | Bug / Estado Protegido | Resultado `PASS` | Possíveis Causas de Regressão (`FAIL`) |
|---|---|---|---|
| `REG-001` | Incompatibilidade do `whatsapp-web.js@1.34.8` com a rota `/login/` (`WAWebSocketModel === null`) | `package.json` aponta para `github:wwebjs/whatsapp-web.js`, `allowScripts['whatsapp-web.js@1.34.8'] === false` e `Client.js` usa `WAWebBackendEventBus`. | Downgrade de `whatsapp-web.js` para versão npm sem correção de `/login/` ou remoção do `allowScripts`. |
| `REG-002` | Sessão/lock dentro de `src/cfg/session-shima`, vazamento em git e `userAgent` `HeadlessChrome` / `Chrome/101` | `.gitignore` cobre `.env`, `.wwebjs_auth/` e `.wwebjs_cache/`; `src/cfg/session-shima` não existe; `bot.options.userAgent` é moderno e `dataPath` aponta para `.wwebjs_auth`. | Criação acidental de sessão dentro de `src/`, remoção de entradas do `.gitignore` ou volta de `userAgent: false` / `Chrome/101`. |
| `REG-003` | Mensagens enviadas pelo próprio número (`fromMe: true`) não respondidas ou entrando em loop/duplicata | `message_create` + `message` para terceiro responde 1 vez; `message_create` para `fromMe: true` responde 1 vez com `{ sendSeen: false }`; `status@broadcast`, `TEST_REPLY`, `ORDER_HEADER` e `DISPATCH_HEADER` são ignorados. | Remoção do listener `message_create`, duplicação de resposta para terceiros ou quebra dos filtros anti-loop. |
| `REG-004` | Telefones BR de 11 dígitos sem DDI e resolução para JID `@lid` | `27988460599` consulta `getNumberId('5527988460599')`, preserva `2310776348749@lid` e envia com `{ sendSeen: false }`. | Falha na prefixação de `55`, conversão forçada para `@c.us` quebrando `@lid` ou ausência de `sendSeen: false`. |
| `REG-005` | Sincronia da coluna `orders.status` entre Sequelize Model, MySQL e migrations | `Order.rawAttributes.status` tem `allowNull: false` e `defaultValue: 'Em preparo'`, `SHOW COLUMNS` no MySQL confere e `20261125150500-add-status-to-orders.js` consta em `SequelizeMeta`. | Remoção de `status` do model `Order.js`, alteração de default no MySQL ou rollback da migration. |
| `REG-006` | `sendRandomCustomerOrder` fiel aos IDs e itens reais cadastrados em `orders` | `getAllOrderIds()` retorna IDs em ordem crescente e `sendRandomCustomerOrder` envia o item real do pedido sorteado no MySQL. | Quebra na ordenação/consulta de IDs ou substituição dos itens do pedido por dados fictícios desconectados do `Order`. |
| `REG-007` | Controle Admin e atomicidade na liberação de entrega (`dispatchOrderForDelivery`) | `adminRole: 'user'` retorna `403`; falha `404` no WhatsApp preserva `status === 'Em preparo'` no MySQL; `adminRole: 'admin'` muda para `'Saiu para entrega'` com `DISPATCH_HEADER`; reenvio sem `forceResend` retorna `400`. | Falha na checagem de permissão admin, atualização prematura de `status` no DB quando WhatsApp falha (`404`) ou permissão de despacho duplicado. |
| `REG-008` | Integridade CommonJS, `server.js`/`app.js`, exclusão de `password` e formato de erro `{ msg, status }` | `package.json` usa `commonjs`, `server.js` não usa ESM `import`/`export`, `app.js` exporta função Express, `password` é omitido e `BaseError`/`NotFound`/`RequisicaoIncorreta` respondem `{ msg, status }`. | Introdução de `import`/`export` ESM, exclusão de `server.js`, exposição de `password` em queries ou mudança no contrato JSON de erros. |

---

## 7. Diagnóstico rápido de falhas

- **`connect ECONNREFUSED 127.0.0.1:3306`**: o container MySQL está parado. Execute `docker compose up -d` e aguarde alguns segundos antes de rodar `npm run test`.
- **Erro de tabela ou coluna inexistente (`status`)**: rode `npx sequelize-cli db:migrate` e `npx sequelize-cli db:seed:all`.
- **Timeout (`504`) nos comandos `--random`, `--dispatch` ou `npm run test -- <numero>`**: verifique se a sessão em `.wwebjs_auth/session-shima` está autenticada executando `node src/cfg/whatsappWeb.js` para escanear o QR Code caso necessário.
