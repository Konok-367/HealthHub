/**
 * Hospital Controller (Member 2): hospital search, details, ICU/CCU search, recommendation.
 *
 * @module hospitalController
 */
const hospitalModel = require( '../models/hospital-model' );
const { isValidSearchText, isPositiveInteger } = require( '../utils/validators' );

const INVALID_SEARCH_MESSAGE = 'Please provide valid search criteria.';
const SERVER_ERROR_MESSAGE = 'Hospital information could not be retrieved. Please try again later.';
const CRITICAL_CARE_FILTERS = [ '', 'icu', 'ccu', 'both' ];

/**
 * Checks that every search text in the list is valid.
 *
 * @param {Array<string>} texts Search texts from the query string.
 * @returns {boolean} True when all are valid.
 */
function areSearchTextsValid( texts ) {
	return texts.every( ( text ) => isValidSearchText( text ) );
}

/**
 * GET /api/hospitals/search?name=&city=&district=
 *
 * @async
 * @param {Object} req Express request.
 * @param {Object} res Express response.
 */
async function searchHospitals( req, res ) {
	try {
		const { name, city, district } = req.query;
		if ( !areSearchTextsValid( [ name, city, district ] ) ) {
			return res.status( 400 ).json( { success: false, message: INVALID_SEARCH_MESSAGE } );
		}

		const hospitals = await hospitalModel.searchHospitals( { name, city, district } );
		if ( hospitals.length === 0 ) {
			return res.status( 200 ).json( {
				success: true,
				message: 'No hospitals found for the selected search criteria.',
				data: [],
			} );
		}
		return res.status( 200 ).json( { success: true, data: hospitals } );
	} catch ( error ) {
		console.error( error );
		return res.status( 500 ).json( { success: false, message: SERVER_ERROR_MESSAGE } );
	}
}

/**
 * GET /api/hospitals/:id - full details of one hospital.
 *
 * @async
 * @param {Object} req Express request.
 * @param {Object} res Express response.
 */
async function getHospitalDetails( req, res ) {
	try {
		if ( !isPositiveInteger( req.params.id ) ) {
			return res.status( 400 ).json( { success: false, message: 'Invalid hospital id.' } );
		}
		const hospital = await hospitalModel.getHospitalById( Number( req.params.id ) );
		if ( hospital === null ) {
			return res.status( 404 ).json( { success: false, message: 'Hospital not found.' } );
		}
		return res.status( 200 ).json( { success: true, data: hospital } );
	} catch ( error ) {
		console.error( error );
		return res.status( 500 ).json( { success: false, message: SERVER_ERROR_MESSAGE } );
	}
}

/**
 * GET /api/hospitals/critical-care?keyword=&filter=icu|ccu|both
 *
 * @async
 * @param {Object} req Express request.
 * @param {Object} res Express response.
 */
async function searchCriticalCare( req, res ) {
	try {
		const keyword = req.query.keyword;
		const filter = req.query.filter || '';
		if ( !isValidSearchText( keyword ) || !CRITICAL_CARE_FILTERS.includes( filter ) ) {
			return res.status( 400 ).json( { success: false, message: INVALID_SEARCH_MESSAGE } );
		}

		const hospitals = await hospitalModel.searchCriticalCare( keyword, filter );
		if ( hospitals.length === 0 ) {
			return res.status( 200 ).json( { success: true, message: 'No hospitals found.', data: [] } );
		}
		return res.status( 200 ).json( { success: true, data: hospitals } );
	} catch ( error ) {
		console.error( error );
		return res.status( 500 ).json( { success: false, message: SERVER_ERROR_MESSAGE } );
	}
}

/**
 * GET /api/hospitals/recommend?city=&specialty=&maxCost=&emergency=true
 *
 * @async
 * @param {Object} req Express request.
 * @param {Object} res Express response.
 */
async function recommendHospitals( req, res ) {
	try {
		const { city, specialty, maxCost, emergency } = req.query;
		const isCostValid = maxCost === undefined || maxCost === '' || isPositiveInteger( maxCost );
		if ( !areSearchTextsValid( [ city, specialty ] ) || !isCostValid ) {
			return res.status( 400 ).json( { success: false, message: INVALID_SEARCH_MESSAGE } );
		}

		const hospitals = await hospitalModel.recommendHospitals( {
			city: city,
			specialty: specialty,
			maxCost: maxCost ? Number( maxCost ) : null,
			emergency: emergency === 'true',
		} );

		if ( hospitals.length === 0 ) {
			const message = specialty
				? 'The required specialty is not available. No recommended hospitals found.'
				: 'No recommended hospitals found.';
			return res.status( 200 ).json( { success: true, message: message, data: [] } );
		}
		return res.status( 200 ).json( { success: true, data: hospitals } );
	} catch ( error ) {
		console.error( error );
		return res.status( 500 ).json( { success: false, message: SERVER_ERROR_MESSAGE } );
	}
}

module.exports = {
	areSearchTextsValid,
	searchHospitals,
	getHospitalDetails,
	searchCriticalCare,
	recommendHospitals,
};
