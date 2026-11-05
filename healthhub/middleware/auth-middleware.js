/**
 * Login and role checks used by routes.
 * A route can say: router.get( '/x', requireLogin, controller.fn )
 *
 * @module authMiddleware
 */

/**
 * Lets the request continue only if the user is logged in.
 *
 * @param {Object} req Express request.
 * @param {Object} res Express response.
 * @param {Function} next Calls the next function in the chain.
 */
function requireLogin( req, res, next ) {
	if ( !req.session.user ) {
		return res.status( 401 ).json( { success: false, message: 'Please log in first.' } );
	}
	next();
}

/**
 * Creates a function that lets only the listed roles continue.
 *
 * @param {...string} allowedRoles Roles that may use the route.
 * @returns {Function} Express middleware.
 */
function requireRole( ...allowedRoles ) {
	return ( req, res, next ) => {
		if ( !req.session.user ) {
			return res.status( 401 ).json( { success: false, message: 'Please log in first.' } );
		}
		if ( !allowedRoles.includes( req.session.user.role ) ) {
			return res.status( 403 ).json( { success: false, message: 'You are not allowed to do this.' } );
		}
		next();
	};
}

module.exports = { requireLogin, requireRole };
