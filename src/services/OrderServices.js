const { Op } = require("sequelize");
const Services = require("./Services.js");
const dataSource = require("../models");

class OrderServices extends Services {
    constructor() {
        super('Order');
    }

    async getOrdersByCustomerId(customerId) {
        return dataSource[this.model].findByPk(customerId, {
            where: { customer_id: customerId },
            include: [
                {
                    model: dataSource.Customer,
                    attributes: ['id', 'name', 'email', 'phone'],
                },
            ],
        });
    }

    // Busca o pedido pelo ID trazendo os dados do cliente (sem senha) e do item do cardápio
    async getOrderWithDetailsById(orderId) {
        return dataSource[this.model].findByPk(orderId, {
            include: [
                {
                    model: dataSource.Customer,
                    attributes: { exclude: ['password'] },
                },
                {
                    model: dataSource.Menu_item,
                },
            ],
        });
    }

    // Retorna todos os IDs de pedidos existentes no banco ordenados de forma crescente
    async getAllOrderIds() {
        const rows = await dataSource[this.model].findAll({
            attributes: ['id'],
            order: [['id', 'ASC']],
            raw: true,
        });
        return rows.map((row) => row.id);
    }

    // Retorna o ID do último pedido pendente aguardando liberação do admin para entrega
    async getLastPendingOrderId() {
        const pendingOrder = await dataSource[this.model].findOne({
            attributes: ['id'],
            where: {
                status: {
                    [Op.notIn]: ['Saiu para entrega', 'Entregue', 'Cancelado'],
                },
            },
            order: [['id', 'DESC']],
            raw: true,
        });
        return pendingOrder ? pendingOrder.id : null;
    }

    // Atualiza o status do pedido para 'Saiu para entrega' e retorna os detalhes completos
    async releaseOrderForDelivery(orderId) {
        const order = await this.getOrderWithDetailsById(orderId);
        if (!order) {
            return { order: null, alreadyDispatched: false };
        }
        if (order.status === 'Saiu para entrega' || order.status === 'Entregue') {
            return { order, alreadyDispatched: true };
        }

        await order.update({ status: 'Saiu para entrega' });
        return { order, alreadyDispatched: false };
    }
}

module.exports = OrderServices;
