const Controller = require('./Controller.js');
const OrderServices = require("../services/OrderServices.js");
const BaseError = require("../errors/BaseError.js");
const RequisicaoIncorreta = require("../errors/RequisicaoIncorreta.js");
const dataSource = require("../models");

const orderServices = new OrderServices();

class OrderController extends Controller {
    constructor() {
        super(orderServices);
    }

    // Valida referências no banco e persiste apenas os atributos limpos do model Order
    async createData(req, res, next) {
        const {
            customer_id,
            order_date,
            order_items_id,
            total_amount,
            status = 'Em preparo',
        } = req.body || {};

        if (!customer_id || !order_items_id || total_amount === undefined) {
            return next(new RequisicaoIncorreta("Dados para criação não fornecidos"));
        }

        try {
            const [customer, menuItem] = await Promise.all([
                dataSource.Customer.findByPk(customer_id, { attributes: ['id'] }),
                dataSource.Menu_item.findByPk(order_items_id, { attributes: ['id'] }),
            ]);

            if (!customer || !menuItem) {
                return next(
                    new RequisicaoIncorreta("Cliente ou item do cardápio não encontrado")
                );
            }

            const newOrder = await this.entityService.createRegistry({
                customer_id,
                order_date: order_date || new Date(),
                order_items_id,
                total_amount,
                status,
            });
            return res.status(201).json(newOrder);
        } catch (erro) {
            return next(erro);
        }
    }

    async _ensureAdmin(req) {
        const tokenUser = req.user?.user || req.user;
        if (!tokenUser) {
            throw new BaseError(
                'Acesso negado: apenas administradores podem liberar pedidos para entrega.',
                403
            );
        }
        if (tokenUser.role === 'admin') {
            return tokenUser;
        }
        if (!tokenUser.role && tokenUser.id) {
            const adminRecord = await dataSource.Admin.findByPk(tokenUser.id, {
                attributes: ['id', 'role'],
            });
            if (adminRecord && adminRecord.role === 'admin') {
                return adminRecord;
            }
        }
        throw new BaseError(
            'Acesso negado: apenas administradores podem liberar pedidos para entrega.',
            403
        );
    }

    async _executeAdminDispatch(req, res, next, dispatchFn) {
        try {
            await this._ensureAdmin(req);
            const whatsapp = require("../cfg/whatsappWeb.js");
            await whatsapp.waitUntilBotReady(15000);
            const result = await dispatchFn(whatsapp);
            return res.status(200).json({
                msg: `Pedido #${result.orderId} liberado para entrega e cliente notificado.`,
                orderId: result.orderId,
                status: result.status,
                chatId: result.chatId,
            });
        } catch (erro) {
            return next(erro);
        }
    }

    // Libera um pedido específico pelo ID para entrega (apenas admin) e envia aviso no WhatsApp
    async dispatchOrderById(req, res, next) {
        return this._executeAdminDispatch(req, res, next, (whatsapp) =>
            whatsapp.dispatchOrderForDelivery(req.params.id, {
                ...(req.body || {}),
                adminRole: 'admin',
            })
        );
    }

    // Libera o último pedido pendente ('Em preparo') para entrega (apenas admin) e envia aviso no WhatsApp
    async dispatchLastOrder(req, res, next) {
        return this._executeAdminDispatch(req, res, next, (whatsapp) =>
            whatsapp.dispatchLastCustomerOrder({
                ...(req.body || {}),
                adminRole: 'admin',
            })
        );
    }

    async getThisCustomerOrders(req, res, next) {
        const { id } = req.body;
        try {
            const result = await this.entityService.getOrdersByCustomerId(id);
            return res.status(200).json({ msg: `Tudo certo ${result}` });
        } catch (error) {
            return next(error);
        }
    }
}

module.exports = OrderController;
