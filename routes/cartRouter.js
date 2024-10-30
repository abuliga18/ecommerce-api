const express = require('express');
const pool = require('../db');
const authorizeCustomer = require('../authorizeCustomer')

const cartRouter = express.Router();

// helper function to get the user's cart ID
async function getCartId(userId) {
    const cart_idQuery = await pool.query('SELECT id FROM carts WHERE user_id = $1', [userId]);
    return cart_idQuery.rows.length > 0 ? cart_idQuery.rows[0].id : null;
}

cartRouter.get('/', authorizeCustomer, async(req, res, next)=> {
    const userId = req.user.id;
    try {
        const cartQuery = 'SELECT products.name, cart_products.quantity, products.price FROM carts JOIN cart_products ON carts.id = cart_products.cart_id JOIN products ON cart_products.product_id = products.id WHERE carts.user_id = $1'
        const cartResult = await pool.query(cartQuery, [userId]);
        const cart = cartResult.rows;

        if(cart.length === 0) {
           return res.status(200).json({message: 'The cart is empty'})
        }
        res.status(200).json({cart})
    } catch(error) {
        next(error)
    }
});

cartRouter.post('/', authorizeCustomer, async(req, res, next)=> {
    const userId = req.user.id;
    const {name, quantity} = req.body;

    try {
        //fields not provided in the req body
        if (!name || !quantity || quantity <0) {
            return res.status(400).json({error: "Name or quantity field is missing"});
        }
        if (!Number.isInteger(quantity)) {
            return res.status(400).json({error: "Quantity must be an integer"})
        }

        //check if cart exists for the user; if not, create one
        let cart_id = await getCartId(userId);
        if (!cart_id) {
            const insertCartResult = await pool.query('INSERT INTO carts (user_id, created_at, updated_at) VALUES($1, $2, $3) RETURNING id', [userId, new Date(), new Date()]);
            cart_id = insertCartResult.rows[0].id;
        }

        //retrieve product id and available stock
        const productQuery = await pool.query('SELECT id, stock_qty FROM products WHERE name =$1', [name]);
        if (productQuery.rows.length === 0) {
            return res.status(404).json({ error: 'Product not found' });
        }  
        const product_id = productQuery.rows[0].id;
        const availableStock = productQuery.rows[0].stock_qty;

        //check if requested quantity exceeds available stock
        const cartQuantityResult = await pool.query('SELECT quantity FROM cart_products WHERE cart_id=$1 AND product_id=$2', [cart_id, product_id]);
        const cartQuantity = cartQuantityResult.rows.length >0 ? cartQuantityResult.rows[0].quantity : 0;
        if (cartQuantity + quantity > availableStock) {
            return res.status(400).json({ error: `Requested quantity exceeds available stock. Available stock: ${availableStock}, quantity already in the cart: ${cartQuantity}` });
        }

        //check if product already exists in the cart & update quantity
        if (cartQuantity>0) {
            //update quantity if product already exists
            const newQuantity = cartQuantity + quantity;
            await pool.query('UPDATE cart_products SET quantity=$1 WHERE cart_id=$2 AND product_id=$3', [newQuantity, cart_id, product_id]);
            return res.status(200).json({message: 'Quantity updated in the cart'})
        }
        //insert product into the cart if it doesn't exist
        await pool.query('INSERT INTO cart_products (cart_id, product_id, quantity) VALUES($1, $2, $3) RETURNING *', [cart_id, product_id, quantity]);
        res.status(201).json({message: "Product added to the cart"})     
    } catch(error) {
        next(error)
    }
});

cartRouter.delete('/', authorizeCustomer, async(req, res, next)=> {
    const userId = req.user.id;
    try {
        await pool.query('DELETE FROM carts WHERE user_id=$1', [userId]);
        res.status(200).json({message: "The cart is clear"})
    } catch(error) {
        next(error)
    }
});

cartRouter.put('/:productId', authorizeCustomer, async(req, res, next)=> {
    const userId = req.user.id;
    const product_id = req.params.productId;
    const {quantity} = req.body;


    try {

        if (quantity === undefined || quantity < 0) {
            return res.status(400).json({ error: 'Quantity must be provided and should be greater than zero' });
        }

        //retrieve cart id
        const cart_id = await getCartId(userId);
        if(!cart_id) {
            return res.status(404).json({error: 'The cart is empty or does not exist'})
        }
    
        if(quantity === 0) {
           await pool.query('DELETE FROM cart_products WHERE cart_id=$1 AND product_id=$2', [cart_id, product_id]);
           return res.status(200).json({message: 'Product removed from the cart'})
        }

        //update product in the cart
        const updateResult = await pool.query('UPDATE cart_products SET quantity=$1 WHERE product_id=$2 AND cart_id=$3 RETURNING *', [quantity, product_id, cart_id])

        //check if product is not present in the cart
        if(updateResult.rows.length === 0) {
            return res.status(404).json({error: "This product is not present in the cart"})
        }
        res.status(200).json({message: "Product quantity updated"});

    } catch(error) {
        next(error)
    }
});

cartRouter.delete('/:productId', authorizeCustomer, async(req, res, next)=> {
    const userId = req.user.id;
    const product_id = req.params.productId;
    
    try {
        //retrieve cart id
        const cart_id = await getCartId(userId);
        if (!cart_id) {
            return res.status(404).json({ error: 'The cart is empty or does not exist' });
        }

        const deleteResult = await pool.query('DELETE FROM cart_products WHERE cart_id=$1 AND product_id=$2', [cart_id, product_id]);
        if(deleteResult.rowCount === 0) {
           return res.status(404).json({error: "The product does not exist in the cart"})
        }
        res.status(200).json({message: "Product removed successfully"})
    } catch(error) {
        next(error)
    }
})


module.exports = cartRouter;