# SHIMA — Shimã Sushi API

API REST em Node.js (CommonJS, Express 5, Sequelize 6 e MySQL) para gestão de clientes, cardápio, pedidos e notificações via WhatsApp do restaurante **Shimã Sushi**.

## Documentação

- [Bot do WhatsApp (`whatsappWeb.js`) — Guia de uso e referência das funções](docs/whatsapp-bot.md)

## Início rápido

```bash
# 1. Instalar dependências
npm install

# 2. Subir MySQL com Docker
docker compose up -d

# 3. Rodar migrations e seeders
npx sequelize-cli db:migrate
npx sequelize-cli db:seed:all

# 4. Iniciar o bot do WhatsApp (escanear QR Code na primeira vez)
node src/cfg/whatsappWeb.js

# 5. Enviar um pedido aleatório real ou simular liberação de entrega pelo admin via WhatsApp
node sendRandomOrder.js 27988460599
node dispatchLastOrder.js 27988460599
```
