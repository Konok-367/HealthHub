/**
 * Health Record Model (Member 4): the health_records table.
 * The Model saves information ABOUT the file. The file itself is in the uploads/ folder.
 *
 * @module healthRecordModel
 */
const pool = require( '../config/db' );

/**
 * Saves a new record.
 *
 * @async
 * @param {Object} record patientId, title, category, description, originalName, storedName, fileType, fileSize.
 * @returns {Promise<number>} New record id.
 */
async function createRecord( record ) {
	const sql = 'INSERT INTO health_records (patient_id, title, category, description, original_name, stored_name, file_type, file_size) '
		+ 'VALUES (?, ?, ?, ?, ?, ?, ?, ?)';
	const [ result ] = await pool.execute( sql, [
		record.patientId,
		record.title,
		record.category,
		record.description,
		record.originalName,
		record.storedName,
		record.fileType,
		record.fileSize,
	] );
	return result.insertId;
}

/**
 * Gets all records of one patient (newest first).
 *
 * @async
 * @param {number} patientId Patient id.
 * @returns {Promise<Array>} Records.
 */
async function getRecordsByPatient( patientId ) {
	const sql = 'SELECT id, title, category, description, original_name, file_type, file_size, uploaded_at '
		+ 'FROM health_records WHERE patient_id = ? ORDER BY id DESC';
	const [ rows ] = await pool.execute( sql, [ patientId ] );
	return rows;
}

/**
 * Gets one record.
 *
 * @async
 * @param {number} id Record id.
 * @returns {Promise<Object|null>} Record or null.
 */
async function getRecordById( id ) {
	const [ rows ] = await pool.execute( 'SELECT * FROM health_records WHERE id = ?', [ id ] );
	return rows[ 0 ] || null;
}

/**
 * Deletes one record row.
 *
 * @async
 * @param {number} id Record id.
 */
async function deleteRecord( id ) {
	await pool.execute( 'DELETE FROM health_records WHERE id = ?', [ id ] );
}

module.exports = { createRecord, getRecordsByPatient, getRecordById, deleteRecord };
