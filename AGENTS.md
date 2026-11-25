# AGENTS.md — Shimã Sushi API (SHIMA)

Guia para agentes de IA (e humanos) que trabalham neste repositório.

## Visão geral

API REST para um restaurante de sushi ("Shimã Sushi"), com CRUD de **clientes**, **itens do cardápio** e **pedidos**.

- **Runtime:** Node.js (CommonJS — use `require`/`module.exports`, nunca `import`/`export`)
- **Framework:** Express 5
- **Banco:** MySQL via **Sequelize 6** (ORM) + `sequelize-cli` (migrations/seeders)
- **Auth:** `jsonwebtoken` (JWT) e `bcrypt` (hash de senha) — existem, mas **ainda não estão ligados às rotas**
- Idioma do código: nomes em inglês; comentários, mensagens de erro e commits em **português**

## Comandos

| Tarefa | Comando |
|---|---|
| Instalar dependências | `npm install` |
| Subir MySQL (Docker) | `docker compose up -d` |
| Rodar em dev (watch) | `npm run dev` → `http://0.0.0.0:3000` |
| Rodar migrations | `npx sequelize-cli db:migrate` |
| Desfazer migrations | `npx sequelize-cli db:migrate:undo:all` |
| Popular dados demo | `npx sequelize-cli db:seed:all` |
| Gerar migration | `npx sequelize-cli migration:generate --name <nome>` |
| Seed via HTTP (script) | `npm run seed` (ver "Pendências conhecidas") |

> Não há suíte de testes (`npm test` falha de propósito). Valide mudanças subindo o servidor e chamando os endpoints (curl/Postman).

O `.sequelizerc` aponta o CLI para `src/config/config.json`, `src/models`, `src/migrations` e `src/seeders`.

## Estrutura

```
server.js                 # Sobe o app na porta 3000
app.js                    # Monta Express: rotas → handler404 → errorHandler
src/
  routes/                 # index.js agrega customer/order/menuItem routes
  controller/             # Controller.js (base genérica) + subclasses por entidade
  services/               # Services.js (base genérica) + subclasses por entidade
  models/                 # Modelos Sequelize; index.js carrega todos automaticamente
  migrations/             # Migrations do sequelize-cli (ordem por timestamp)
  seeders/                # Dados demo (customers, menu_items, orders)
  errors/                 # BaseError, NotFound (404), RequisicaoIncorreta (400)
  middlewares/            # errorHandler, handler404, jwToken (JWT)
  cfg/                    # bcryptHash.js; dbConnect.js (legado, mysql2 cru, não usado)
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
  routes.get("/orders/:id", (req, res, next) => orderController.getById(req, res, next));
  ```

### Endpoints atuais

| Recurso | Base | Modelo / Tabela |
|---|---|---|
| Clientes | `/users/` | `Customer` / `customers` |
| Itens do cardápio | `/menu_items/` | `Menu_item` / `menu_items` |
| Pedidos | `/orders/` | `Order` / `orders` |

Cada um expõe `POST /`, `GET /`, `GET /:id`, `PUT /:id`, `DELETE /:id`. `GET /` raiz retorna `"Shimã Sushi API"`.

### Modelos e relações

- `Customer`: name, password, email, address, phone — `hasMany Order` (`customer_id`, alias `customerOrders`)
- `Menu_item`: name, category, ingredients, price, description, quantity, stock — `hasMany Order` (`order_items_id`)
- `Order`: customer_id, order_date, order_items_id, total_amount — `belongsTo Customer` e `Menu_item`

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

### Estilo
- CommonJS, `async/await`, classes para controllers/services.
- Sem linter/formatter configurado — siga o estilo do arquivo que estiver editando.
- Comentários curtos em português explicando o "porquê" da mudança.

## Variáveis de ambiente (`.env`, não versionado)

`PORT`, `HOST`, `USERDB`, `PASSWORD`, `DATABASE` (usadas pelo legado `dbConnect.js`), `SALTROUNDS` (bcrypt), `JWTSECRET` (JWT). Carregadas com `require("dotenv/config")`.

> O Sequelize **não** lê o `.env`: usa `src/config/config.json`.

## Segurança — atenção

- **Nunca** commite `.env`, nem exponha seu conteúdo em logs ou respostas.
- `src/config/config.json` contém credenciais e **não está no `.gitignore`**; `docker-compose.yml` tem senha root hardcoded. Não espalhe essas credenciais; prefira migrar para `use_env_variable`/`.env`.
- Senhas de `Customer` hoje são salvas em **texto puro** pelo CRUD genérico (inclusive nos seeders). `EncryptPassword`/`ComparePassword` existem em `src/cfg/bcryptHash.js` para quando o fluxo de registro/login for reativado.
- `GET /users` retorna o campo `password`. Ao mexer em clientes, exclua-o das respostas (`attributes: { exclude: ['password'] }`).
- O histórico já corrigiu um problema de **BOLA** (acesso a recurso de outro usuário). Ao proteger rotas com `tokenValidate`, sempre verifique se o `id` do token corresponde ao recurso acessado.

## Pendências conhecidas (contexto, não corrija sem pedir)

- Rotas de `/register` e `/login` estão comentadas em `customerRoutes.js`; `tokenValidate` é importado mas não aplicado.
- `scripts/seedUsers.js` ainda aponta para `POST /register` (use `API_URL=http://localhost:3000/users/`).
- `jwToken.js` tem `console.log` de debug e assume payload `user[0].id` (formato antigo, de `mysql2`).
- `src/cfg/dbConnect.js` é legado e não é importado por ninguém.
