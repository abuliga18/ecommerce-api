const authorizeCustomer = (req, res, next) => {
    //check if user is authenticated
    if(!req.isAuthenticated() || !req.user) {
        return res.status(401).json({error: 'Forbidden: You do not have access to this resource. User is not logged in.'})
    };
    //check is user role is customer
    if(req.user.role !== 'customer') {
        return res.status(401).json({error: 'Forbidden: You are not authorized to access this resource'})
    };
    next();
}

module.exports = authorizeCustomer;