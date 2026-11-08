/**
 * Vaccine Controller (Member 6): search vaccines and anti-venoms.
 *
 * @module vaccineController
 */
const vaccineModel = require( '../models/vaccine-model' );
const { isValidSearchText } = require( '../utils/validators' );

const CATEGORIES = [ '', 'Vaccine', 'Anti-venom' ];

/**
 * GET /api/vaccines/search?name=&category=&location=
 *
 * @async
 * @param {Object} req Express request.
 * @param {Object} res Express response.
 */
async function searchVaccines( req, res ) {
	try {
		const { name, location } = req.query;
		const category = req.query.category || '';
		if ( !isValidSearchText( name ) || !isValidSearchText( location ) || !CATEGORIES.includes( category ) ) {
			return res.status( 400 ).json( { success: false, message: 'Please enter valid search information.' } );
		}

		const results = await vaccineModel.searchVaccines( { name, category, location } );
		if ( results.length === 0 ) {
			return res.status( 200 ).json( { success: true, message: 'No vaccine or anti-venom found.', data: [] } );
		}
		// Found, but every hospital has zero stock.
		if ( results.every( ( item ) => item.quantity === 0 ) ) {
			return res.status( 200 ).json( {
				success: true,
				message: 'The searched vaccine or anti-venom is currently unavailable.',
				data: results,
			} );
		}
		return res.status( 200 ).json( { success: true, data: results } );
	} catch ( error ) {
		console.error( error );
		return res.status( 500 ).json( {
			success: false,
			message: 'Availability information could not be retrieved. Please try again later.',
		} );
	}
}

module.exports = { searchVaccines };
