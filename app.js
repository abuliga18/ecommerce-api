const express = require('express');
const bcrypt = require('bcrypt');
const pool = require('./db.js');
const session = require('express-session');
const dotenv = require('dotenv');
const passport = require('passport');
const LocalStrategy = require('passport-local').Strategy;
const authRouter = require('./routes/authRouter.js');
const productsRouter = require('./routes/productsRouter.js');
const usersRouter = require('./routes/usersRouter.js');
const cartRouter = require('./routes/cartRouter.js');
const checkoutRouter = require('./routes/checkoutRouter.js');
const ordersRouter = require('./routes/ordersRouter.js')

dotenv.config(); // Load environment variables from .env file

const app = express();
const PORT = 3000;

app.use(express.json());//converts data to JS and attaches it to req.body

//initialize session upon successful login
app.use(session({
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    store: new session.MemoryStore(),
    cookie: {maxAge: 1000 * 60 * 60 * 24, httpOnly: true, secure: false, sameSite: 'None'}
}));

//initialize passport middleware
app.use(passport.initialize());
app.use(passport.session());

//authentication logic; once logged in, new session is started
passport.use(new LocalStrategy({
    usernameField: 'email',  // Specify that 'email' will be used as the username
    passwordField: 'password'
}, async (email, password, done) => {    
    try {
        const userExistsQuery = 'SELECT * FROM users WHERE email = $1';
        const userExistsResult = await pool.query(userExistsQuery, [email]);
        const user = userExistsResult.rows[0];

        if (!user) {
            return done(null, false, { message: 'Incorrect username.' });
        }

        const passwordMatch = await bcrypt.compare(password, user.password);

        if (!passwordMatch) {
            return done(null, false, { message: 'Incorrect password.' });
        }

        return done(null, user);
    } catch (error) {
        return done(error);
    }
}));

//stores user.id in the session
passport.serializeUser((user, done) => {
    done (null, user.id)
});

//retrieve full user object from the database based on the user ID
passport.deserializeUser(async(id, done)=> {
    try {
        const result = await pool.query('SELECT * FROM users WHERE id = $1', [id]);       
        
        if(result.rows.length > 0) {
            done(null, result.rows[0]);
            //req.users
        } else {
            done (null, false)
        }
        
    } catch(error) {
        return done(error)
    }
})

//define routes

//homepage
app.get('/', (req, res)=> {
    res.send('Hello world!')
});


//login & register handled by router
app.use('/auth', authRouter);

//products
app.use('/products', productsRouter);

//users
app.use('/users', usersRouter);

//cart
app.use('/cart', cartRouter);

//checkout
app.use('/checkout', checkoutRouter);

//orders
app.use('/orders', ordersRouter)

//error handling middleware
app.use((err, req, res, next)=> {
    console.log(err.stack);
    res.status(500).json({error: 'Internal server error'})
});

app.listen(PORT, ()=> {
    console.log(`Server is listening on port ${PORT}`)
});


