const authorizeUser = (req, res, next) => {
    if (!req.isAuthenticated() || !req.user) {
        return res.status(401).json({ error: 'User not logged in' });
    }
    //check that the resource accessed is private
    const userId = parseInt(req.params.id, 10);
    if (req.user.id !== userId) {
        return res.status(403).json({ error: 'Forbidden: Access to this resource is restricted' });
    }
    
    next();
};

module.exports = authorizeUser;