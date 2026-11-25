const Controller = require('./Controller.js');
const MenuItemServices = require("../services/MenuItemServices.js");
const menuItemServices = new MenuItemServices();

class MenuItemController extends Controller {
    constructor() {
        super(menuItemServices);
    }
}

module.exports = MenuItemController;
