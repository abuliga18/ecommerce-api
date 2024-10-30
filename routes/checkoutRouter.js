const express = require('express');
const pool = require('../db');
const authorizeCustomer = require('../authMiddlewares/authorizeCustomer');

const checkoutRouter = express.Router();

checkoutRouter.post('/', authorizeCustomer, async(req, res, next)=> {
    const user_id = req.user.id;
    try {
        //check if cart exists
        const cartResult = await pool.query('SELECT * FROM carts WHERE user_id=$1', [user_id]);
        const cart = cartResult.rows;
        if(cart.length === 0) {
            return res.status(400).json({error: "The user doesn't have a cart"})
        }
        const cart_id = cart[0].id;

        //check if there are products in the cart
        const query = 'SELECT products.id AS product_id, products.name, products.price, products.stock_qty, cart_products.quantity FROM carts JOIN cart_products ON carts.id = cart_products.cart_id JOIN products ON cart_products.product_id = products.id WHERE carts.user_id = $1'       
        const cartQuery = await pool.query(query, [user_id]);
        const cartItems = cartQuery.rows;
        if(cartItems.length === 0) {
            return res.status(400).json({message: "The cart is empty."})
        };

        //check stock availability
        for (const item of cartItems) {
            if (item.quantity > item.stock_qty) {
              return res.status(400).json({ error: `Insufficient stock for ${item.name}. Available stock: ${item.stock_qty}` });
            }
        }

        //simulate a successful payment process. In a real setup, I'd integrate a payment processor here
        const paymentSuccess = true; //simulated payment result
        if (!paymentSuccess) {
            return res.status(500).json({error: "Payment processing failed"})
        }

        //calculate total cost of the order
        let totalCost = 0;
        for (const item of cartItems) {
            totalCost += item.price * item.quantity;
        }

        //create an order
        const orderResult= await pool.query('INSERT INTO orders (user_id, date, amount) VALUES($1, $2, $3) RETURNING *', [user_id, new Date(), totalCost]);
        const order_id = orderResult.rows[0].id;

        //insert order items
        const insertQuery = 'INSERT INTO order_products (order_id, product_id, quantity, price) VALUES($1, $2, $3, $4)';
        for(const item of cartItems) {
            await pool.query(insertQuery, [order_id, item.product_id, item.quantity, item.price])    
            //update the stock
             await pool.query('UPDATE products SET stock_qty= stock_qty -$1 WHERE id = $2', [item.quantity, item.product_id])
        };

        //clear cart
        await pool.query('DELETE FROM carts WHERE id=$1', [cart_id]);

        res.status(201).json({message: 'Order created successfully. Order number:', order_id});

    } catch(error) {
        next(error)
    }
})  

module.exports = checkoutRouter;