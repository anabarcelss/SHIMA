# AGENTS.md — Shimã Sushi API (SHIMA)

Guia para agentes de IA (e humanos) que trabalham neste repositório.

## Visão geral

API REST para um restaurante de sushi ("Shimã Sushi"), com CRUD de **clientes**, **itens do cardápio**, **pedidos** e notificações automáticas via **WhatsApp Web**.

- **Runtime:** Node.js (CommonJS — use `require`/`module.exports`, nunca `import`/`export`)
- **Framework:** Express 5
- **Banco:** MySQL via **Sequelize 6** (ORM) + `sequelize-cli` (migrations/seeders)
- **Auth:** `jsonwebtoken` (JWT) e `bcrypt` (hash de senha) integrados às rotas de registro, login, cardápio e pedidos
- **WhatsApp:** `whatsapp-web.js` (`github:wwebjs/whatsapp-web.js`) + `qrcode-terminal` em `src/cfg/whatsappWeb.js`
- Idioma do código: nomes em inglês; comentários, mensagens de erro e commits em **português**

## Regras Inegociáveis de Testes e Não-Regressão

> **ATENÇÃO — LEIA ANTES DE QUALQUER ALTERAÇÃO:**

1. **NUNCA, EM HIPÓTESE ALGUMA, altere os testes para que o resultado passe (O Teste é o Ultimato):**
   - É terminantemente **proibido** alterar, afrouxar, remover asserções, comentar ou pular (`skip`) testes existentes para forçar aprovação.
   - **O teste é o ultimato:** se o código não passar na bateria de testes, essa linha de desenvolvimento está incorreta e **NÃO irá para frente**. Corrija a implementação ou descarte a abordagem — jamais o teste.
2. **Teste de Não-Regressão Automático para Cada Bug Corrigido:**
   - Para **cada bug corrigido** neste projeto, deve ser criado **automaticamente** um teste de não-regressão correspondente (em `tests/regression.test.js` ou na suíte pertinente dentro de `tests/`) que reproduza o cenário da falha e garanta que ela nunca mais ocorra.
3. **Portão Obrigatório de Continuidade (`npm run test` 100% verde):**
   - O desenvolvimento **apenas continua** (e nenhuma tarefa pode ser considerada concluída) quando **toda a suíte de testes (`npm run test`) estiver passando com sucesso total** (`exit code 0`, zero falhas).

## Comandos

| Tarefa | Comando |
|---|---|
| Instalar dependências | `npm install` |
| Subir MySQL (Docker) | `docker compose up -d` |
| Rodar em dev (watch) | `npm run dev` → `http://0.0.0.0:3000` |
| Rodar bateria completa de testes | `npm run test` (detalhes em `tests.md`) |
| Rodar apenas testes da API | `npm run test:api` |
| Rodar apenas testes do Bot WhatsApp | `npm run test:bot` |
| Rodar apenas testes de não-regressão | `npm run test:regression` |
| Enviar pedido aleatório via CLI (WhatsApp) | `npm run test:random -- <numero>` |
| Liberar pedido como Admin via CLI (WhatsApp) | `npm run test:dispatch -- <numero> [order_id]` |
| Iniciar bot do WhatsApp | `node src/cfg/whatsappWeb.js` |
| Rodar migrations | `npx sequelize-cli db:migrate` |
| Desfazer migrations | `npx sequelize-cli db:migrate:undo:all` |
| Popular dados demo | `npx sequelize-cli db:seed:all` |
| Gerar migration | `npx sequelize-cli migration:generate --name <nome>` |
| Seed via HTTP (script) | `npm run seed` (ver "Pendências conhecidas") |

> Valide **sempre** qualquer alteração executando `npm run test` (documentado em `tests.md`).

O `.sequelizerc` aponta o CLI para `src/config/config.json`, `src/models`, `src/migrations` e `src/seeders`.

## Estrutura

```
server.js                 # Sobe o app na porta 3000 (ou PORT do .env)
app.js                    # Monta Express: rotas → handler404 → errorHandler
tests.md                  # Documentação completa da bateria de testes e resultados possíveis
docs/
  whatsapp-bot.md         # Documentação das funções e fluxo do bot de WhatsApp
tests/
  runTests.js             # Orquestrador da bateria executado por `npm run test`
  api.test.js             # Bateria dos endpoints HTTP da API
  whatsappBot.test.js     # Bateria funcional do bot de WhatsApp
  regression.test.js      # Suíte de não-regressão do estado atual e bugs corrigidos
  sendRandomOrder.js      # CLI executável para sortear e enviar pedido real do DB no WhatsApp
  dispatchLastOrder.js    # CLI executável para liberar entrega como admin e notificar no WhatsApp
src/
  routes/                 # index.js agrega customer/order/menuItem routes
  controller/             # Controller.js (base genérica) + subclasses por entidade
  services/               # Services.js (base genérica) + subclasses por entidade
  models/                 # Modelos Sequelize; index.js carrega todos automaticamente
  migrations/             # Migrations do sequelize-cli (ordem por timestamp)
  seeders/                # Dados demo (customers, menu_items, orders)
  errors/                 # BaseError, NotFound (404), RequisicaoIncorreta (400)
  middlewares/            # errorHandler, handler404, jwToken (JWT)
  cfg/                    # bcryptHash.js, whatsappWeb.js; dbConnect.js (legado, mysql2 cru)
  config/config.json      # Config do Sequelize por ambiente (NODE_ENV)
scripts/seedUsers.js      # Gera usuários fake via HTTP
```

## Arquitetura (camadas)

`Route → Controller → Service → Model (Sequelize)`

- **`Services`** (`src/services/Services.js`) recebe o **nome do modelo** como string (ex.: `'Customer'`) e acessa `require('../models')[modelName]`. Métodos: `getAllRegistries`, `getRegistryById`, `createRegistry`, `updateRegistry`, `deleteRegistry`.
- **`Controller`** (`src/controller/Controller.js`) recebe uma instância de service e implementa `getAll`, `getById`, `createData`, `updateData`, `deleteData`.
- Subclasses (`CustomerController`, `OrderServices`, etc.) só passam a dependência no `super(...)`. **Lógica específica de entidade deve ir em métodos novos na subclasse**, não na base.
- Rotas chamam o controller com arrow function repassando `next`:
  ```js
  routes.get("/pedidos/:id", (req, res, next) => orderController.getById(req, res, next));
  ```

### Endpoints atuais

| Recurso | Base / Rotas | Modelo / Tabela |
|---|---|---|
| Raiz | `GET /` | — |
| Auth & Clientes | `/register`, `/login`, `/users/` | `Customer` / `Admin` / `customers` |
| Itens do cardápio | `/menu/` (`POST`, `PUT`, `DELETE` com `tokenValidate`) | `Menu_item` / `menu_items` |
| Pedidos | `/pedidos/`, `PATCH /pedidos/despachar-ultimo`, `PATCH /pedidos/:id/despachar` | `Order` / `orders` |

### Modelos e relações

- `Customer` (e subclasse `Admin` com `role: 'admin'`): name, password, email, address, phone, role — `hasMany Order` (`customer_id`, alias `customerOrders`)
- `Menu_item`: name, category, ingredients, price, description, quantity, stock — `hasMany Order` (`order_items_id`)
- `Order`: customer_id, order_date, order_items_id, total_amount, status (`defaultValue: 'Em preparo'`) — `belongsTo Customer` e `Menu_item`

## Convenções

### Tratamento de erros
- **Nunca** responda erro direto no controller com `res.status(...)`. Faça `return next(new NotFound("..."))` ou `next(erro)` no `catch`.
- Erros customizados estendem `BaseError` (`message`, `status`, `sendResponse(res)`). Novos tipos vão em `src/errors/`.
- `errorHandler` converte erros MySQL (`ER_*`) e erros `Sequelize*Error` em **400 RequisicaoIncorreta**; o resto vira 500. Ao adicionar novos códigos tratáveis, atualize as listas lá.
- Formato de resposta de erro: `{ "msg": "...", "status": <código> }`.

### Banco de dados
- Toda mudança de schema = **nova migration** (nunca edite uma migration já aplicada). Mantenha o modelo em `src/models/` em sincronia.
- Modelos usam `tableName` explícito em snake_case plural e campos em snake_case.
- Novos modelos são carregados automaticamente por `src/models/index.js`; defina relações em `static associate(models)`.

### Adicionando uma nova entidade
1. `npx sequelize-cli model:generate` ou crie migration + model manualmente.
2. `src/services/<Entidade>Services.js` estendendo `Services` com `super('<ModelName>')`.
3. `src/controller/<Entidade>Controller.js` estendendo `Controller`.
4. `src/routes/<entidade>Routes.js` e registrar em `src/routes/index.js`.
5. (Opcional) seeder em `src/seeders/`.
6. Testes correspondentes na pasta `tests/`.

### Estilo
- CommonJS, `async/await`, classes para controllers/services.
- Sem linter/formatter configurado — siga o estilo do arquivo que estiver editando.
- Comentários curtos em português explicando o "porquê" da mudança.

## Variáveis de ambiente (`.env`, não versionado)

`PORT`, `HOST`, `USERDB`, `PASSWORD`, `DATABASE` (usadas pelo legado `dbConnect.js`), `SALTROUNDS` (bcrypt), `JWTSECRET` (JWT), `CHROME_EXECUTABLE_PATH` (opcional, WhatsApp). Carregadas com `require("dotenv/config")`.

> O Sequelize **não** lê o `.env`: usa `src/config/config.json`.

## Segurança — atenção

- **Nunca** commite `.env`, `.wwebjs_auth/` ou `.wwebjs_cache/`, nem exponha o conteúdo do `.env` em logs ou respostas.
- `src/config/config.json` contém credenciais e **não está no `.gitignore`**; `docker-compose.yml` tem senha root hardcoded. Não espalhe essas credenciais; prefira migrar para `use_env_variable`/`.env`.
- `CustomerServices` e `OrderServices` excluem `password` das consultas públicas (`attributes: { exclude: ['password'] }`); mantenha essa exclusão em qualquer nova consulta de cliente.
- O histórico já corrigiu um problema de **BOLA** (acesso a recurso de outro usuário). Ao proteger rotas com `tokenValidate`, sempre verifique se o `id` ou `role` do token corresponde ao recurso acessado.

## Pendências conhecidas (contexto, não corrija sem pedir)

- `scripts/seedUsers.js` ainda aponta para `POST /register` com campos legados (`age`, `number`).
- `src/cfg/dbConnect.js` é legado e não é importado por ninguém.
