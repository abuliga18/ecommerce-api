const express = require('express');
const pool = require('../db');
const authorizeSeller = require('../authorizeSeller');

const productsRouter = express.Router();

productsRouter.get('/', async(req, res, next) => {
    try {
        const allProducts = await pool.query('SELECT * FROM products');
        res.status(200).json(allProducts.rows)
    } catch(error) {
        next(error)
    }    
});

productsRouter.post('/', authorizeSeller, async (req, res, next) => {
    const { name, description, price, stock_qty, on_sale, category } = req.body;

    if (Object.keys(req.body).length === 0) {
        return res.status(400).json({ error: 'No data provided' });
    }

    // Validation logic for POST
    if (!name || typeof name !== 'string' || name.length === 0) {
        return res.status(400).json({ error: 'Name must be a non-empty string' });
    }
    if (!description || typeof description !== 'string') {
        return res.status(400).json({ error: 'Description must be a string' });
    }
    if (typeof price !== 'number' || price <= 0 || !/^\d+(\.\d{1,2})?$/.test(price.toString())) {
        return res.status(400).json({ error: 'Price must be a positive number with up to two decimal places' });
    }
    if (typeof stock_qty !== 'number' || !Number.isInteger(stock_qty) || stock_qty < 0) {
        return res.status(400).json({ error: 'Stock quantity must be a non-negative integer' });
    }
    if (typeof on_sale !== 'boolean') {
        return res.status(400).json({ error: 'On sale must be a boolean' });
    }

    try {
        // Check for existing product
        const existingProduct = await pool.query('SELECT * FROM products WHERE name = $1 AND description = $2', [name, description]);
        if (existingProduct.rows.length > 0) {
            return res.status(409).json({ error: 'Product with the same name and description already exists' });
        }
        //Check for existing category
        const existingCategory = await pool.query('SELECT * FROM categories WHERE name=$1', [category]);
        if (existingCategory.rows.length === 0) {
            return res.status(400).json({error: "Incorrect category"})
        }
        const category_id = existingCategory.rows[0].id;

        // Insert new product
        const insertProductQuery = 'INSERT INTO products (name, description, price, stock_qty, on_sale) VALUES ($1, $2, $3, $4, $5) RETURNING *';
        const newProduct = await pool.query(insertProductQuery, [name, description, price, stock_qty, on_sale]);
        const product_id = newProduct.rows[0].id;
        const product_categoryResult = await pool.query('INSERT INTO products_categories (product_id, category_id) VALUES($1, $2)', [product_id, category_id]);
        res.status(201).json(newProduct.rows[0]);
    } catch (error) {
        next(error);
    }
});

productsRouter.get('/:id', async(req, res, next) => {
    try {
        const product = await pool.query('SELECT * FROM products WHERE id = $1', [req.params.id]);
        if (product.rows.length === 0) {
            return res.status(404).json({message: 'Product does not exist'});
        } res.status(200).json(product.rows[0])
    } catch(error) {
        next(error);
    }
});

productsRouter.put('/:id', authorizeSeller, async (req, res, next) => {
    const { id } = req.params;
    const { name, description, price, stock_qty, on_sale } = req.body;

    try {
        // Retrieve product
        const product = await pool.query('SELECT * FROM products WHERE id = $1', [id]);
        if (product.rows.length === 0) {
            return res.status(404).json({ error: 'Product does not exist' });
        }

        // Validation logic for PUT (fields are optional)
        if (name !== undefined && (typeof name !== 'string' || name.length === 0)) {
        return res.status(400).json({ error: 'Name must be a non-empty string' });
        }
        if (description !== undefined && typeof description !== 'string') {
        return res.status(400).json({ error: 'Description must be a string' });
        }
        if (price !== undefined && (typeof price !== 'number' || price <= 0 || !/^\d+(\.\d{1,2})?$/.test(price.toString()))) {
        return res.status(400).json({ error: 'Price must be a positive number with up to two decimal places' });
        }
        if (stock_qty !== undefined && (typeof stock_qty !== 'number' || !Number.isInteger(stock_qty) || stock_qty < 0)) {
        return res.status(400).json({ error: 'Stock quantity must be a non-negative integer' });
        }
        if (on_sale !== undefined && typeof on_sale !== 'boolean') {
        return res.status(400).json({ error: 'On sale must be a boolean' });
        }

        const updateFields = [];
        const values = [];

        // Constructing update fields
        if (name !== undefined) {
            updateFields.push(`name=$${values.length + 1}`);
            values.push(name);
        }
        if (description !== undefined) {
            updateFields.push(`description=$${values.length + 1}`);
            values.push(description);
        }
        if (price !== undefined) {
            updateFields.push(`price=$${values.length + 1}`);
            values.push(price);
        }
        if (stock_qty !== undefined) {
            updateFields.push(`stock_qty=$${values.length + 1}`);
            values.push(stock_qty);
        }
        if (on_sale !== undefined) {
            updateFields.push(`on_sale=$${values.length + 1}`);
            values.push(on_sale);
        }

        if (updateFields.length === 0) {
            return res.status(400).json({ error: 'No fields provided for update' });
        }

        const query = `UPDATE products SET ${updateFields.join(', ')} WHERE id=$${values.length + 1}`;
        values.push(id);

        await pool.query(query, values);

        const updatedProduct = await pool.query('SELECT * FROM products WHERE id = $1', [id]);
        res.status(200).json({ message: 'Product updated successfully', product: updatedProduct.rows[0] });
    } catch (error) {
        next(error);
    }
});

productsRouter.delete('/:id', authorizeSeller, async(req, res, next) => {
    const {id} = req.params;

    try {
        const deletedProduct = await pool.query('DELETE FROM products WHERE id=$1 RETURNING *', [id]);
        if (deletedProduct.rows.length === 0) {
            return res.status(404).json({message: 'Product not found'})
        }
        res.status(200).json({message: 'Product deleted:', product: deletedProduct.rows[0]});
    } catch(error) {
        next(error)
    }
})

productsRouter.get('/on-sale', async (req, res, next) => {
    try {
        const saleProducts = await pool.query('SELECT * FROM products WHERE on_sale = $1', [true]);
        
        if (saleProducts.rows.length === 0) {
            return res.status(404).json({ message: 'No products on sale' });
        }

        res.status(200).json(saleProducts.rows);
    } catch (error) {
        console.error('Error fetching sale products:', error);
        next(error);
    }
});

//retrieve products for category
productsRouter.get('/categories/:categoryId', async(req, res, next)=> {
    const categoryId = req.params.categoryId;
    try {
        const query = 'SELECT products.* FROM products_categories JOIN products ON products_categories.product_id = products.id WHERE category_id = $1'
        const categoryProducts = await pool.query(query, [categoryId]);
        if(categoryProducts.rows.length === 0) {
            res.status(400).json({message: 'No products found for this category'})
        }
        res.status(200).json(categoryProducts.rows)
    } catch(error) {
        next(error)
    }
});

module.exports=productsRouter;