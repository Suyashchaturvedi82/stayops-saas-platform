function rbacMiddleware(...allowedRoles) {
  return (req, res, next) => {
    const userRoles = req.auth?.roles || [];
    const isAllowed = userRoles.some((role) => allowedRoles.includes(role));

    if (!isAllowed) {
      return res.status(403).json({ message: 'Forbidden: insufficient role permissions' });
    }

    next();
  };
}

module.exports = rbacMiddleware;
