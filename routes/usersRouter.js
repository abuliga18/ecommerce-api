const express = require('express');
const pool = require('../db');
const bcrypt = require('bcrypt');
const authorizeUser = require('../authMiddlewares/authorizeUser');

const usersRouter = express.Router();

// helper function to validate email format
const isValidEmail = (email) => {
    const emailPattern = /^[^@]+@[^@]+\.[^@]+$/;
    return emailPattern.test(email);
};

// helper function to hash passwords
const hashPassword = async (password) => {
    const salt = await bcrypt.genSalt(10);
    return await bcrypt.hash(password, salt);
};

usersRouter.get('/:id', authorizeUser, async (req, res, next) => {
    const userId = req.params.id; 

    try {
        const result = await pool.query('SELECT id, email, role FROM users WHERE id = $1', [userId]);
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'User not found' });
        };
        res.status(200).json(result.rows[0]); 
    } catch (err) {
        next(err); 
    }
});

usersRouter.put('/:id', authorizeUser, async(req, res, next)=> {
    const userId = req.params.id; 
    const {email, password} = req.body;

    try {
        const existingUser = await pool.query('SELECT * FROM users WHERE id = $1', [userId]);
        if (existingUser.rows.length === 0) {
            return res.status(404).json({error: 'User does not exist'})
        }

        const fieldsToUpdate = [];
        const values = [];

        //validate email address
        if (email) {
            if(!isValidEmail(email)) {
                return res.status(400).json({ error: 'Invalid email format' });
            } 
            fieldsToUpdate.push(`email=$${values.length + 1}`);
            values.push(email)  
        } 
         //compare passwords 
         if (password && typeof password === 'string') {
            const passwordMatch = await bcrypt.compare(password, existingUser.rows[0].password);
            if (passwordMatch) {
                return res.status(400).json({error: 'You chose the same password'})
            };
            const hashedPassword = await hashPassword(password);
            fieldsToUpdate.push(`password=$${values.length+1}`);
            values.push(hashedPassword)
        };

        if (fieldsToUpdate.length === 0) {
            return res.status(400).json({ error: 'No fields to update' });
        }

        const updateQuery = `UPDATE users SET ${fieldsToUpdate.join(', ')} WHERE id=$${values.length+1}`;
        values.push(userId);

        await pool.query(updateQuery, values);

        const updatedUserResult = await pool.query('SELECT id, email, role FROM users WHERE id = $1', [userId]);

        res.status(200).json({message: 'User profile update', user: updatedUserResult.rows[0]})
    } catch(error) {
        next(error)
    }
});

usersRouter.delete('/:id', authorizeUser, async(req, res, next)=> {
    const userId = req.params.id;
    try {
        const result = await pool.query('DELETE FROM users WHERE id=$1', [userId]);

        if (result.rowCount === 0) {
            return res.status(404).json({ error: 'User not found' });
        }
        res.status(200).json({message: 'User profile deleted'})
    } catch(error) {
        next(error)
    }
});

module.exports = usersRouter;