const express = require('express');
const bcrypt = require('bcrypt');
const pool = require('../db');
const passport = require('passport');

const authRouter = express.Router();

//login

authRouter.post('/login', (req, res, next) => {
    if (req.isAuthenticated()) {
        return res.status(200).json({message: 'Already logged in', user: { id: req.user.id, email: req.user.email, role: req.user.role }})
    }
    passport.authenticate('local', (err, user, info) => {
        if (err) {
            return next(err); // Passes any errors to the error handler
        }
        if (!user) {
            return res.status(401).json({ error: info.message }); // Authentication failed, sends back error message
        }
        // establish a session for the authenticated user after successful authentication
        req.logIn(user, (err) => {
            if (err) {
                return next(err);
            }
            res.status(200).json({ message: 'Login successful', user: { id: user.id, email: user.email, role: user.role } });
        });
    })(req, res, next);
});

authRouter.post('/logout', (req, res, next)=> {
    if(!req.isAuthenticated() || !req.user) {
        return res.status(401).json({error: 'Unauthorized: Private resource. User is not logged in'})
    } 
    req.logOut((err) => {
        if (err) {
            return next(err); 
        }
        res.status(200).json({message: "You have successfully logged out"})
    })
});


//register
authRouter.post('/register', async(req, res, next) => {

    const {email, password, role} = req.body;

    try {
        // check if the email is in the correct format
        const emailRegex = /^[^@]+@[^@]+\.[^@]+$/; // Regex for email validation
        if (!emailRegex.test(email)) {
            return res.status(400).json({ error: "Invalid email format" });
        }

        if (role !== 'seller' && role!== 'customer') {
            return res.status(400).json({error: `Invalid role. Role must be 'customer' or 'seller`})
        }

        //checks if user exists in the db
        const userExistsQuery = 'SELECT * FROM users WHERE email = $1';
        const userExistsResult = await pool.query(userExistsQuery, [email]);

        if(userExistsResult.rows.length > 0) {
            return res.status(400).json({error: "User already exists"}) //sends response and prevents the rest of the code from executing
        }

        //hash password
        const salt = await bcrypt.genSalt(10);
        const hash = await bcrypt.hash(password, salt);

        //insert user details
        const insertUserQuery = 'INSERT INTO users(email, password, role) VALUES($1, $2, $3) RETURNING *';
        const insertUserResult = await pool.query(insertUserQuery, [email, hash, role]);

        res.status(201).json({
            message: 'User registered successfully',
            user: {id: insertUserResult.rows[0].id, email: insertUserResult.rows[0].email, role: insertUserResult.rows[0].role}
        })

    } catch(err) {
        next(err);
    }
});

module.exports = authRouter;
