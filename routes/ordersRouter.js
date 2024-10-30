const express = require('express');
const pool = require('../db');
const authorizeCustomer = require('../authorizeCustomer')

const ordersRouter = express.Router();

module.exports = ordersRouter;

ordersRouter.get('/', authorizeCustomer, async(req, res, next)=> {
    const user_id = req.user.id;
    try {
        const query = 'SELECT orders.id, orders.date, orders.amount, products.name, order_products.quantity, order_products.price FROM orders JOIN order_products ON orders.id = order_products.order_id JOIN products ON order_products.product_id = products.id WHERE user_id = $1';
        const ordersResult = await pool.query(query, [user_id]);
        const orders = ordersResult.rows;
        if (orders.length === 0) {
            return res.status(404).json({error: 'No existing orders for this user'})
        }
        res.status(200).json({orders})
    } catch(error) {
        next(error)
    }
});

ordersRouter.get('/:orderId', authorizeCustomer, async(req, res, next)=> {
    const user_id = req.user.id;
    const order_id = req.params.orderId;
    try {
        const query = 'SELECT orders.date AS order_date, orders.amount, products.name AS product_name, order_products.quantity FROM orders JOIN order_products ON orders.id = order_products.order_id JOIN products ON order_products.product_id = products.id WHERE user_id=$1 AND order_id=$2'
        const orderResult = await pool.query(query, [user_id, order_id]);
        const order = orderResult.rows;
        if(order.length === 0) {
            return res.status(404).json({error: 'An order with this id does not exist.'})
        }
        res.status(200).json(order[0])
    } catch(error) {
        next(error)
    }
})