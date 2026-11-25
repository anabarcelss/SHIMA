# Bot do WhatsApp — Shimã Sushi API

Documentação das funções exportadas por `src/cfg/whatsappWeb.js` e do fluxo de envio de mensagens e pedidos via WhatsApp Web (`whatsapp-web.js`).

---

## 1. Visão geral e inicialização

O módulo `src/cfg/whatsappWeb.js` gerencia a conexão com o WhatsApp Web via Puppeteer (`Client` + `LocalAuth`) e exporta funções prontas para uso pelos controllers da API e por scripts CLI.

### Como iniciar o bot

```bash
node src/cfg/whatsappWeb.js
# ou em modo desenvolvimento (watch):
node --watch src/cfg/whatsappWeb.js
```

1. Na primeira execução, o QR Code é exibido no terminal (`qrcode-terminal`).
2. Escaneie o QR Code no aplicativo WhatsApp do celular (**Dispositivos conectados → Conectar dispositivo**).
3. A sessão autenticada e o cache da versão do WhatsApp Web são salvos na raiz do projeto em:
   - `.wwebjs_auth/` (dados da sessão `session-shima`)
   - `.wwebjs_cache/` (cache local do HTML do WhatsApp Web)
   > Ambos os diretórios estão listados no `.gitignore`.

### Reutilização automática de sessão entre processos

Se uma instância do bot já estiver rodando em outro terminal (ex.: `node --watch src/cfg/whatsappWeb.js`), outro script Node que importe `src/cfg/whatsappWeb.js` detecta o arquivo `.wwebjs_auth/session-shima/DevToolsActivePort` e conecta ao navegador já aberto via `puppeteer.connect`, evitando conflito de `SingletonLock`.

Ao finalizar um script CLI que reutilizou o navegador ativo, use `await disconnectBot()` para desconectar o Puppeteer sem derrubar o processo principal.

### Variáveis de ambiente relacionadas

| Variável | Obrigatória | Descrição |
|---|---|---|
| `CHROME_EXECUTABLE_PATH` | Não | Caminho do executável do Chrome/Chromium. Quando omitido, usa `/usr/bin/google-chrome` (se existir) ou o Chromium gerenciado pelo Puppeteer. |

---

## 2. Referência das exportações (`src/cfg/whatsappWeb.js`)

```js
const {
    bot,
    sendCustomerOrder,
    sendRandomCustomerOrder,
    dispatchOrderForDelivery,
    dispatchLastCustomerOrder,
    sendTextMessage,
    formatOrderMessage,
    formatDispatchMessage,
    waitUntilBotReady,
    disconnectBot,
} = require('../cfg/whatsappWeb.js');
```

### `sendCustomerOrder(orderInput, appOrderData = {})`

Busca o pedido no MySQL pelo ID informado (via `OrderServices.getOrderWithDetailsById(orderId)`), combina os dados do banco com os dados extras enviados pelo app e envia a mensagem padronizada de confirmação para o WhatsApp do cliente.

#### Dados carregados automaticamente do banco (MySQL / Sequelize)
- **`Order`**: `id`, `customer_id`, `order_date`, `order_items_id`, `total_amount`, `createdAt`
- **`Customer`**: `id`, `name`, `email`, `address`, `phone`, `role` (`password` é explicitamente excluído)
- **`Menu_item`**: `id`, `name`, `category`, `ingredients`, `price`, `description`, `quantity`, `stock`

#### Parâmetros

| Parâmetro | Tipo | Obrigatório | Descrição |
|---|---|---|---|
| `orderInput` | `number \| string \| object` | Sim | ID numérico do pedido (`order.id`) ou objeto contendo `orderId`, `order_id` ou `id` (também pode trazer campos extras do app, que são mesclados com `appOrderData`). |
| `appOrderData` | `object` | Não | Dados complementares do pedido vindos do app. Valores informados aqui têm prioridade sobre os valores do banco quando ambos existem. |

#### Campos aceitos em `appOrderData` (ou diretamente no objeto `orderInput`)

| Campo | Tipo | Padrão / Fallback | Descrição |
|---|---|---|---|
| `phone` / `customerPhone` / `customer_phone` | `string` | `order.Customer.phone` | Número de destino no WhatsApp (aceita DDD + número com 10/11 dígitos, DDI `55...` ou JID `@c.us`/`@lid`). |
| `customerName` / `customer_name` | `string` | `order.Customer.name` ou `'Cliente'` | Nome exibido na mensagem. |
| `address` | `string` | `order.Customer.address` ou `'Não informado'` | Endereço de entrega. |
| `addressNumber` / `numero` | `string \| number` | — | Número ou complemento anexado ao endereço (`", Nº <valor>"`) caso ainda não conste em `address`. |
| `items` | `Array<string \| object> \| string` | `order.Menu_item` | Lista detalhada de itens. Objetos aceitam `{ name \| title, quantity \| qty, price \| unitPrice }`. |
| `quantity` | `number` | `1` | Quantidade aplicada ao `order.Menu_item` quando `items` não é informado. |
| `orderDate` / `order_date` | `Date \| string \| number` | `order.order_date \|\| order.createdAt \|\| new Date()` | Data/hora do pedido (formatada em `America/Sao_Paulo`). |
| `estimatedTime` / `estimated_time` | `number \| string` | `'40 a 50 minutos'` | Tempo estimado de preparo/entrega (números são convertidos para `"<N> minutos"`). |
| `price` / `subtotal` | `number` | `order.total_amount` (ou `0`) | Valor dos itens antes da taxa de entrega. |
| `deliveryFee` / `delivery_fee` | `number` | `0` | Taxa de entrega. Quando `0`, exibe `Grátis (R$ 0,00)`. |
| `totalWithDelivery` | `number` | `itemsPrice + deliveryFee` | Total final exibido na mensagem. |

#### Retorno (`Promise<object>`)

```js
{
    orderId,     // ID do pedido no banco
    chatId,      // JID resolvido no WhatsApp (ex.: '5527988460599@c.us' ou '...@lid')
    message,     // Texto final enviado
    sentMessage, // Objeto Message retornado pelo whatsapp-web.js
}
```

#### Erros lançados
- **`RequisicaoIncorreta` (`400`)**: ID do pedido ausente (`orderId` vazio/`null`/`undefined`), telefone não encontrado ou telefone com menos de 10 dígitos.
- **`NotFound` (`404`)**: pedido não encontrado no banco ou número sem conta ativa no WhatsApp (`bot.getNumberId`).
- **`BaseError` (`503`)**: cliente do WhatsApp ainda não está pronto (`!bot.info || !bot.pupPage`).

#### Exemplo da mensagem enviada

```text
🍣 *Shimã Sushi — Confirmação de Pedido*

📋 *Número do pedido:* #1
👤 *Cliente:* Lucas Silva
📞 *Número do cliente:* (27) 98846-0599
📍 *Endereço:* Rua das Flores, 120 - Centro, Nº Apto 204

🍱 *Itens do pedido:*
• 1x Combo Shimã Prime (40 peças) (R$ 189,90)

🕒 *Hora do pedido:* 25/11/2026 às 14:40
⏱️ *Tempo estimado:* 30 a 40 minutos

💰 *Preço:* R$ 189,90
🛵 *Taxa de entrega:* R$ 7,90
🧾 *Total:* R$ 197,80

Obrigado pela preferência! Em breve seu pedido sairá para entrega. 🥢
```

---

### `sendRandomCustomerOrder(phone, appOrderData = {})`

Busca todos os `id`s cadastrados na tabela `orders` (`OrderServices.getAllOrderIds()`), sorteia um `id` existente via `crypto.randomInt` e envia os dados reais daquele pedido no banco para o número informado.

- **Parâmetros:**
  - `phone` (`string`): número ou JID de destino no WhatsApp.
  - `appOrderData` (`object`, opcional): dados complementares opcionais mesclados no envio.
- **Retorno:** mesmo objeto retornado por `sendCustomerOrder`.
- **Erros:** `NotFound` (`404`) se não houver pedidos na tabela `orders` ou o número não estiver no WhatsApp; demais erros de `sendCustomerOrder`.

---

### `dispatchOrderForDelivery(orderInput, dispatchData = {})`

Libera um pedido específico para entrega quando o administrador autoriza o despacho: valida `adminRole === 'admin'` (quando informado), valida o número no WhatsApp antes de persistir, atualiza `orders.status` no MySQL de `'Em preparo'` para `'Saiu para entrega'` e envia a mensagem de saída para entrega via `formatDispatchMessage`.

- **Parâmetros:**
  - `orderInput` (`number | string | object`): ID do pedido ou objeto contendo `orderId`/`order_id`/`id`.
  - `dispatchData` (`object`, opcional): aceita os campos extras de endereço/preço/previsão de `sendCustomerOrder`, além de:
    - `adminRole` (`string`): quando informado, exige `'admin'` (retorna `403` caso contrário).
    - `courierName` / `delivererName` (`string`): nome opcional do entregador exibido na mensagem.
    - `estimatedTime` / `estimated_time` (`number | string`): previsão de chegada (padrão `'20 a 30 minutos'`).
    - `forceResend` (`boolean`): permite reenviar mesmo se o pedido já estiver com status `'Saiu para entrega'` ou `'Entregue'`.
- **Retorno:** `Promise<{ orderId, status, chatId, message, sentMessage }>`
- **Erros:** `BaseError` (`403`) se não for admin, `RequisicaoIncorreta` (`400`) se já tiver sido despachado ou sem ID/telefone válido, `NotFound` (`404`) se o pedido ou WhatsApp não existir, `BaseError` (`503`) se o bot não estiver pronto.

---

### `dispatchLastCustomerOrder(phoneOrOptions = {}, extraOptions = {})`

Busca o último pedido ainda pendente (`status` diferente de `'Saiu para entrega'`, `'Entregue'` e `'Cancelado'`, ordenado por `id DESC`), atualiza seu status para `'Saiu para entrega'` e envia a notificação de saída para entrega no WhatsApp.

- **Parâmetros:**
  - `phoneOrOptions` (`string | object`): número de destino (ex.: usado pelo CLI `dispatchLastOrder.js`) ou objeto de opções (usado pelas rotas da API, enviando para o `Customer.phone` cadastrado no banco).
  - `extraOptions` (`object`, opcional): opções extras (`adminRole`, `courierName`, `estimatedTime`, etc.) mescladas quando o primeiro argumento é uma `string`.
- **Retorno:** `Promise<{ orderId, status, chatId, message, sentMessage }>`
- **Erros:** `BaseError` (`403`) se `adminRole` não for `'admin'`, `NotFound` (`404`) se não houver pedidos pendentes aguardando liberação, além dos erros de `dispatchOrderForDelivery`.

---

### `sendTextMessage(phone, text)`

Envia uma mensagem de texto avulsa para o número informado, normalizando telefones brasileiros (adiciona DDI `55` automaticamente quando possui 10 ou 11 dígitos) e validando se o número possui WhatsApp ativo via `bot.getNumberId`.

- **Parâmetros:**
  - `phone` (`string`): telefone ou JID (`@c.us`, `@lid`, `@g.us`).
  - `text` (`string`): conteúdo textual não vazio.
- **Retorno:** `Promise<{ chatId, message, sentMessage }>`
- **Erros:** `RequisicaoIncorreta` (`400`) para texto/telefone vazio ou inválido; `NotFound` (`404`) se o número não existir no WhatsApp; `BaseError` (`503`) se o bot não estiver pronto.

---

### `formatOrderMessage(order, appOrderData = {})`

Função pura que monta e retorna a `string` padronizada de confirmação inicial do pedido sem consultar o banco nem enviar mensagens. Útil para pré-visualização ou testes.

- **Parâmetros:**
  - `order` (`object`): instância/objeto no formato do model `Order` (com `Customer` e `Menu_item`).
  - `appOrderData` (`object`, opcional): mesmos campos aceitos em `sendCustomerOrder`.
- **Retorno:** `string`

---

### `formatDispatchMessage(order, dispatchData = {})`

Função pura que monta e retorna a `string` padronizada de saída para entrega (`🛵 *Shimã Sushi — Pedido Saiu para Entrega!*`), informando status `'Saiu para entrega'`, horário da liberação, previsão de chegada, entregador opcional, itens, endereço e totais.

- **Parâmetros:**
  - `order` (`object`): instância/objeto no formato do model `Order` (com `Customer` e `Menu_item`).
  - `dispatchData` (`object`, opcional): mesmos campos aceitos em `dispatchOrderForDelivery`.
- **Retorno:** `string`

---

### `waitUntilBotReady(timeoutMs = 60000)`

Aguarda até que o bot emita `ready` (ou conecte à instância ativa). Rejeita com `BaseError` (`504`) ao atingir `timeoutMs` ou `BaseError` (`401`) em caso de `auth_failure`.

---

### `disconnectBot()`

Encerra o cliente de forma segura:
- Quando o processo se conectou a um navegador já aberto via `DevToolsActivePort`, executa apenas `bot.pupBrowser.disconnect()` (mantendo o processo principal online).
- Quando o processo abriu o próprio navegador, executa `await bot.destroy()`.

---

### `bot` e comandos interativos de teste

`bot` é a instância de `Client` do `whatsapp-web.js` com listeners configurados para:
- Mensagens recebidas de outros contatos (`bot.on('message', ...)`)
- Mensagens enviadas pelo próprio número autenticado (`bot.on('message_create', ...)` filtrando `message.fromMe`)

Ao enviar **`ping`**, **`!ping`**, **`teste`** ou **`!teste`**, o bot responde automaticamente com:
```text
🍣 Olá! Bot do Shimã Sushi online e funcionando!
```
Mensagens automáticas iniciadas por `🍣 *Shimã Sushi` e mensagens de `status@broadcast` são ignoradas para evitar loops.

---

## 3. Exemplos práticos

### Integração no `OrderController.js` (ao criar pedido)

```js
const { sendCustomerOrder } = require('../cfg/whatsappWeb.js');

// Exemplo dentro de um método do OrderController após criar o registro no banco:
async createOrderAndNotify(req, res, next) {
    try {
        const createdOrder = await this.entityService.createRegistry(req.body);

        // Envio não bloqueante ou aguardado conforme necessidade da rota
        await sendCustomerOrder(createdOrder.id, {
            estimatedTime: req.body.estimatedTime,
            deliveryFee: req.body.deliveryFee,
            addressNumber: req.body.addressNumber,
            items: req.body.items,
            subtotal: req.body.subtotal,
        });

        return res.status(201).json(createdOrder);
    } catch (error) {
        return next(error);
    }
}
```

### Rotas protegidas de liberação pelo Admin (`OrderController.js`)

As rotas abaixo em `src/routes/orderRoutes.js` exigem token JWT válido (`tokenValidate`) pertencente a um usuário com `role === 'admin'`:

- `PATCH /pedidos/despachar-ultimo` → libera o último pedido pendente (`'Em preparo'`) via `dispatchLastCustomerOrder`, altera o status para `'Saiu para entrega'` e envia o aviso ao telefone do cliente.
- `PATCH /pedidos/:id/despachar` → libera o pedido `:id` via `dispatchOrderForDelivery`, altera o status para `'Saiu para entrega'` e envia o aviso ao telefone do cliente.

Exemplo de corpo opcional enviado pelo painel admin:

```json
{
    "courierName": "João Motoboy",
    "estimatedTime": "25 minutos"
}
```

### Utilitários executáveis via CLI (`sendRandomOrder.js` e `dispatchLastOrder.js`)

Com o MySQL rodando (`docker compose up -d` e migrations/seeders aplicados) e a sessão do WhatsApp autenticada, você pode executar qualquer um dos dois scripts diretamente pelo terminal informando o número de destino:

#### 1. Sortear e enviar um pedido real do banco (`sendRandomOrder.js`)

```bash
node sendRandomOrder.js 27988460599
# ou diretamente como executável:
./sendRandomOrder.js 27988460599
```

O executável [sendRandomOrder.js](../sendRandomOrder.js) chama `sendRandomCustomerOrder(phone)`, que consulta os `id`s existentes na tabela `orders`, sorteia um ID real e envia os dados reais do pedido correspondente (`Order`, `Customer` e `Menu_item`).

#### 2. Liberar para entrega o último pedido pendente (`dispatchLastOrder.js`)

```bash
# Libera o último pedido com status 'Em preparo' e envia o aviso de saída para entrega:
node dispatchLastOrder.js 27988460599
# ou diretamente como executável:
./dispatchLastOrder.js 27988460599

# Opcionalmente, informe um order_id específico como segundo argumento:
node dispatchLastOrder.js 27988460599 24
```

O executável [dispatchLastOrder.js](../dispatchLastOrder.js) atua como admin (`adminRole: 'admin'`), busca o último pedido pendente na tabela `orders` (ou o `order_id` informado), atualiza o `status` para `'Saiu para entrega'` e envia a mensagem de saída para entrega para o número digitado no comando.
