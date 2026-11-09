/**
 * Health Record Controller (Member 4): upload, list, view, download and delete records.
 * Every record is checked against the logged-in patient, so nobody can open another person's file.
 *
 * @module healthRecordController
 */
const fs = require( 'fs' );
const path = require( 'path' );
const healthRecordModel = require( '../models/health-record-model' );
const { UPLOAD_DIR } = require( '../middleware/upload-middleware' );
const { isPositiveInteger } = require( '../utils/validators' );

const CATEGORIES = [ 'Lab Report', 'Prescription', 'X-Ray / Scan', 'Vaccination', 'Other' ];
const SERVER_ERROR_MESSAGE = 'Something went wrong. Please try again.';

/**
 * Checks the title and category typed in the upload form.
 *
 * @param {Object} body title, category, description.
 * @returns {string|null} Error message, or null when valid.
 */
function validateRecordInput( body ) {
	if ( !body.title || body.title.trim() === '' || !body.category ) {
		return 'Please enter the record title and category.';
	}
	if ( body.title.length > 100 ) {
		return 'Title must be 100 characters or less.';
	}
	if ( !CATEGORIES.includes( body.category ) ) {
		return 'Please choose a valid category.';
	}
	return null;
}

/**
 * Finds a record that belongs to the logged-in patient.
 *
 * @async
 * @param {Object} req Express request.
 * @returns {Promise<Object|null>} Record or null.
 */
async function findOwnRecord( req ) {
	if ( !isPositiveInteger( req.params.id ) ) {
		return null;
	}
	const record = await healthRecordModel.getRecordById( Number( req.params.id ) );
	if ( record === null || record.patient_id !== req.session.user.id ) {
		return null;
	}
	return record;
}

/**
 * POST /api/health-records  (multipart form: title, category, description, recordFile)
 *
 * @async
 * @param {Object} req Express request.
 * @param {Object} res Express response.
 */
async function uploadRecord( req, res ) {
	try {
		if ( !req.file ) {
			return res.status( 400 ).json( { success: false, message: 'Please choose a file to upload.' } );
		}
		const body = req.body || {};
		const errorMessage = validateRecordInput( body );
		if ( errorMessage !== null ) {
			fs.unlink( req.file.path, () => {} ); // remove the file we just saved
			return res.status( 400 ).json( { success: false, message: errorMessage } );
		}

		const recordId = await healthRecordModel.createRecord( {
			patientId: req.session.user.id,
			title: body.title.trim(),
			category: body.category,
			description: body.description ? body.description.trim() : '',
			originalName: req.file.originalname,
			storedName: req.file.filename,
			fileType: req.file.mimetype,
			fileSize: req.file.size,
		} );
		return res.status( 201 ).json( { success: true, message: 'Health record uploaded successfully.', data: { recordId: recordId } } );
	} catch ( error ) {
		console.error( error );
		return res.status( 500 ).json( { success: false, message: SERVER_ERROR_MESSAGE } );
	}
}

/**
 * GET /api/health-records - list of the patient's records.
 *
 * @async
 * @param {Object} req Express request.
 * @param {Object} res Express response.
 */
async function listRecords( req, res ) {
	try {
		const records = await healthRecordModel.getRecordsByPatient( req.session.user.id );
		return res.status( 200 ).json( { success: true, data: records } );
	} catch ( error ) {
		console.error( error );
		return res.status( 500 ).json( { success: false, message: SERVER_ERROR_MESSAGE } );
	}
}

/**
 * GET /api/health-records/:id/view - opens the file in the browser.
 *
 * @async
 * @param {Object} req Express request.
 * @param {Object} res Express response.
 */
async function viewRecord( req, res ) {
	try {
		const record = await findOwnRecord( req );
		if ( record === null ) {
			return res.status( 404 ).json( { success: false, message: 'Record not found.' } );
		}
		return res.sendFile( path.join( UPLOAD_DIR, record.stored_name ) );
	} catch ( error ) {
		console.error( error );
		return res.status( 500 ).json( { success: false, message: SERVER_ERROR_MESSAGE } );
	}
}

/**
 * GET /api/health-records/:id/download - downloads the file with its original name.
 *
 * @async
 * @param {Object} req Express request.
 * @param {Object} res Express response.
 */
async function downloadRecord( req, res ) {
	try {
		const record = await findOwnRecord( req );
		if ( record === null ) {
			return res.status( 404 ).json( { success: false, message: 'Record not found.' } );
		}
		return res.download( path.join( UPLOAD_DIR, record.stored_name ), record.original_name );
	} catch ( error ) {
		console.error( error );
		return res.status( 500 ).json( { success: false, message: SERVER_ERROR_MESSAGE } );
	}
}

/**
 * DELETE /api/health-records/:id - removes the database row and the file.
 *
 * @async
 * @param {Object} req Express request.
 * @param {Object} res Express response.
 */
async function deleteRecord( req, res ) {
	try {
		const record = await findOwnRecord( req );
		if ( record === null ) {
			return res.status( 404 ).json( { success: false, message: 'Record not found.' } );
		}
		await healthRecordModel.deleteRecord( record.id );
		fs.unlink( path.join( UPLOAD_DIR, record.stored_name ), () => {} );
		return res.status( 200 ).json( { success: true, message: 'Health record deleted.' } );
	} catch ( error ) {
		console.error( error );
		return res.status( 500 ).json( { success: false, message: SERVER_ERROR_MESSAGE } );
	}
}

module.exports = { validateRecordInput, uploadRecord, listRecords, viewRecord, downloadRecord, deleteRecord };
