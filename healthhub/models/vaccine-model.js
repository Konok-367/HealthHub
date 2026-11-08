/**
 * Vaccine Model (Member 6): vaccines, anti-venoms and the stock each hospital has.
 *
 * @module vaccineModel
 */
const pool = require( '../config/db' );

/**
 * Searches vaccines / anti-venoms and the hospitals that keep them.
 *
 * @async
 * @param {Object} filters name, category ('Vaccine' or 'Anti-venom'), location.
 * @returns {Promise<Array>} One row per hospital + vaccine.
 */
async function searchVaccines( filters ) {
	let sql = 'SELECT v.id AS vaccine_id, v.name AS vaccine_name, v.category, vs.quantity, '
		+ 'h.id AS hospital_id, h.name AS hospital_name, h.address, h.city, h.district, h.phone '
		+ 'FROM vaccine_stock vs '
		+ 'JOIN vaccines v ON v.id = vs.vaccine_id '
		+ 'JOIN hospitals h ON h.id = vs.hospital_id '
		+ 'WHERE 1 = 1';
	const params = [];

	if ( filters.name ) {
		sql += ' AND v.name LIKE ?';
		params.push( '%' + filters.name + '%' );
	}
	if ( filters.category ) {
		sql += ' AND v.category = ?';
		params.push( filters.category );
	}
	if ( filters.location ) {
		sql += ' AND (h.city LIKE ? OR h.district LIKE ? OR h.address LIKE ?)';
		const pattern = '%' + filters.location + '%';
		params.push( pattern, pattern, pattern );
	}
	sql += ' ORDER BY v.name, vs.quantity DESC, h.name';

	const [ rows ] = await pool.execute( sql, params );
	return rows;
}

module.exports = { searchVaccines };
