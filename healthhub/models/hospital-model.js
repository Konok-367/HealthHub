/**
 * Hospital Model (Member 2).
 * All SQL for hospital search, ICU/CCU search and recommendation lives here.
 * User input is NEVER joined into the SQL text. It always goes into the params list (the ? marks).
 *
 * @module hospitalModel
 */
const pool = require( '../config/db' );

/**
 * Builds the SQL for a hospital search (pure function, easy to unit test).
 *
 * @param {Object} filters Optional name, city, district.
 * @returns {{sql: string, params: Array}} SQL text and the values for the ? marks.
 */
function buildHospitalSearch( filters ) {
	let sql = 'SELECT * FROM hospitals WHERE 1 = 1';
	const params = [];

	if ( filters.name ) {
		sql += ' AND name LIKE ?';
		params.push( '%' + filters.name + '%' );
	}
	if ( filters.city ) {
		sql += ' AND city LIKE ?';
		params.push( '%' + filters.city + '%' );
	}
	if ( filters.district ) {
		sql += ' AND district LIKE ?';
		params.push( '%' + filters.district + '%' );
	}
	sql += ' ORDER BY name';

	return { sql: sql, params: params };
}

/**
 * Searches hospitals by name, city and/or district.
 *
 * @async
 * @param {Object} filters Optional name, city, district.
 * @returns {Promise<Array>} Matching hospitals.
 */
async function searchHospitals( filters ) {
	const query = buildHospitalSearch( filters );
	const [ rows ] = await pool.execute( query.sql, query.params );
	return rows;
}

/**
 * Gets one hospital with all its details.
 *
 * @async
 * @param {number} id Hospital id.
 * @returns {Promise<Object|null>} Hospital row or null.
 */
async function getHospitalById( id ) {
	const [ rows ] = await pool.execute( 'SELECT * FROM hospitals WHERE id = ?', [ id ] );
	return rows[ 0 ] || null;
}

/**
 * Finds hospitals by ICU / CCU availability.
 *
 * @async
 * @param {string} keyword Text matched with name, city or district.
 * @param {string} filter '' (all), 'icu', 'ccu' or 'both'.
 * @returns {Promise<Array>} Matching hospitals.
 */
async function searchCriticalCare( keyword, filter ) {
	let sql = 'SELECT id, name, city, district, address, phone, icu_available, ccu_available '
		+ 'FROM hospitals WHERE 1 = 1';
	const params = [];

	if ( keyword ) {
		sql += ' AND (name LIKE ? OR city LIKE ? OR district LIKE ?)';
		const pattern = '%' + keyword + '%';
		params.push( pattern, pattern, pattern );
	}
	// These conditions are fixed text (no user input), so they are safe to add.
	if ( filter === 'icu' ) {
		sql += ' AND icu_available > 0';
	} else if ( filter === 'ccu' ) {
		sql += ' AND ccu_available > 0';
	} else if ( filter === 'both' ) {
		sql += ' AND icu_available > 0 AND ccu_available > 0';
	}
	sql += ' ORDER BY name';

	const [ rows ] = await pool.execute( sql, params );
	return rows;
}

/**
 * Recommends hospitals: best rating first, then the cheaper one.
 *
 * @async
 * @param {Object} filters city, specialty, maxCost (number or null), emergency (boolean).
 * @returns {Promise<Array>} Recommended hospitals.
 */
async function recommendHospitals( filters ) {
	let sql = 'SELECT * FROM hospitals WHERE 1 = 1';
	const params = [];

	if ( filters.city ) {
		sql += ' AND (city LIKE ? OR district LIKE ?)';
		params.push( '%' + filters.city + '%', '%' + filters.city + '%' );
	}
	if ( filters.specialty ) {
		sql += ' AND departments LIKE ?';
		params.push( '%' + filters.specialty + '%' );
	}
	if ( filters.maxCost ) {
		sql += ' AND treatment_cost <= ?';
		params.push( filters.maxCost );
	}
	if ( filters.emergency ) {
		sql += ' AND departments LIKE ? AND (icu_available > 0 OR ccu_available > 0)';
		params.push( '%Emergency%' );
	}
	sql += ' ORDER BY rating DESC, treatment_cost ASC';

	const [ rows ] = await pool.execute( sql, params );
	return rows;
}

module.exports = {
	buildHospitalSearch,
	searchHospitals,
	getHospitalById,
	searchCriticalCare,
	recommendHospitals,
};
