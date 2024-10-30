const authorizeSeller = (req, res, next) => {
    //check if user is authenticated
    if(!req.isAuthenticated() || !req.user) {
        return res.status(401).json({error: 'User not logged in'})
    }
    //check if user's role is 'seller'
    if (req.user.role !== 'seller') {
        return res.status(403).json({error: "Forbidden: You do not have access to this resource"})
    }
    next()
};

module.exports = authorizeSeller;