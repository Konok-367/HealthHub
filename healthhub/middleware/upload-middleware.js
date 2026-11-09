/**
 * File upload settings for health records (Member 4), using the multer package.
 *
 * @module uploadMiddleware
 */
const fs = require( 'fs' );
const path = require( 'path' );
const multer = require( 'multer' );

const UPLOAD_DIR = path.join( __dirname, '..', 'uploads' );
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5 MB
const ALLOWED_EXTENSIONS = [ '.pdf', '.jpg', '.jpeg', '.png' ];
const ALLOWED_MIME_TYPES = [ 'application/pdf', 'image/jpeg', 'image/png' ];

fs.mkdirSync( UPLOAD_DIR, { recursive: true } );

/**
 * Checks the file extension and the file type sent by the browser.
 *
 * @param {string} fileName Original file name.
 * @param {string} mimeType Type such as application/pdf.
 * @returns {boolean} True when the file is allowed.
 */
function isAllowedFileType( fileName, mimeType ) {
	const extension = path.extname( fileName ).toLowerCase();
	return ALLOWED_EXTENSIONS.includes( extension ) && ALLOWED_MIME_TYPES.includes( mimeType );
}

const storage = multer.diskStorage( {
	destination: ( req, file, callback ) => {
		callback( null, UPLOAD_DIR );
	},
	// Random name, so two files with the same name never overwrite each other.
	filename: ( req, file, callback ) => {
		const uniqueName = Date.now() + '-' + Math.round( Math.random() * 1e9 ) + path.extname( file.originalname ).toLowerCase();
		callback( null, uniqueName );
	},
} );

const upload = multer( {
	storage: storage,
	limits: { fileSize: MAX_FILE_SIZE },
	fileFilter: ( req, file, callback ) => {
		if ( !isAllowedFileType( file.originalname, file.mimetype ) ) {
			return callback( new Error( 'INVALID_FILE_TYPE' ) );
		}
		callback( null, true );
	},
} );

/**
 * Runs multer and turns its errors into friendly JSON messages.
 * The form field name must be "recordFile".
 *
 * @param {Object} req Express request.
 * @param {Object} res Express response.
 * @param {Function} next Next function.
 */
function handleUpload( req, res, next ) {
	upload.single( 'recordFile' )( req, res, ( error ) => {
		if ( !error ) {
			return next();
		}
		if ( error.code === 'LIMIT_FILE_SIZE' ) {
			return res.status( 400 ).json( { success: false, message: 'File size exceeds the allowed limit.' } );
		}
		if ( error.message === 'INVALID_FILE_TYPE' ) {
			return res.status( 400 ).json( { success: false, message: 'Invalid file type.' } );
		}
		console.error( error );
		return res.status( 500 ).json( { success: false, message: 'Upload failed. Please try again.' } );
	} );
}

module.exports = { UPLOAD_DIR, MAX_FILE_SIZE, isAllowedFileType, handleUpload };
