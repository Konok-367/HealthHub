# Member 4 - Online Payment and Health Record Upload

**SRS parts:** 3.1.12 Payment Integration, 3.1.13 Health Record Upload · **Database tables:** `payments`, `health_records` (also updates `appointments.payment_status`) · **Package:** `multer` (file upload).

## 1. What you are responsible for

- Show a payment summary, accept a payment (card / mobile banking / wallet), show Successful / Failed / Pending, keep history, show a receipt, mark the appointment Paid.
- Never charge the same appointment twice.
- Upload health records (PDF, JPG, JPEG, PNG, max 5 MB), list, view, download, delete. A patient sees only their own files.

> The payment gateway is **simulated** (a normal course project cannot use a real bank). Test rule: card/phone ending `0002` fails, ending `9999` stays pending, anything else succeeds. Say this clearly in the viva.

## 2. Files you own

| File | Layer |
|---|---|
| `models/payment-model.js`, `models/health-record-model.js` | Model |
| `controllers/payment-controller.js`, `controllers/health-record-controller.js` | Controller |
| `middleware/upload-middleware.js` | Upload settings (multer), used by the route |
| `routes/payment-routes.js`, `routes/health-record-routes.js` | Route |
| `views/payment.html`, `views/health-records.html` | View |
| `public/js/payment.js`, `public/js/health-records.js` | View logic |
| `tests/unit/payment.test.js`, `tests/integration/payment.test.js`, `tests/integration/health-record.test.js` | Tests |

## 3. Branch and commands

```bash
git checkout main
git pull origin main
git checkout -b feature/member-4-payment-records
# ...paste your files...
git add models/payment-model.js models/health-record-model.js
git add controllers/payment-controller.js controllers/health-record-controller.js
git add middleware/upload-middleware.js routes/payment-routes.js routes/health-record-routes.js
git add views/payment.html views/health-records.html public/js/payment.js public/js/health-records.js
git add tests/unit/payment.test.js tests/integration/payment.test.js tests/integration/health-record.test.js
git commit -m "feat(payment): add payments and health record upload"
git push -u origin feature/member-4-payment-records
```

## 4. Code (copy-paste)

Create each file with exactly this name and content. They are in the order: Model, Controller, Route, View, page script, tests.

### `models/payment-model.js`

```js
/**
 * Payment Model (Member 4): payments table + the appointment's payment status.
 *
 * @module paymentModel
 */
const pool = require( '../config/db' );

/**
 * Gets an appointment together with the doctor's fee.
 *
 * @async
 * @param {number} appointmentId Appointment id.
 * @returns {Promise<Object|null>} Appointment info or null.
 */
async function getAppointmentForPayment( appointmentId ) {
	const sql = 'SELECT a.id, a.patient_id, a.status, a.payment_status, d.name AS doctor_name, '
		+ 'd.consultation_fee, s.slot_date, s.slot_time '
		+ 'FROM appointments a JOIN doctors d ON d.id = a.doctor_id '
		+ 'JOIN appointment_slots s ON s.id = a.slot_id WHERE a.id = ?';
	const [ rows ] = await pool.execute( sql, [ appointmentId ] );
	return rows[ 0 ] || null;
}

/**
 * Marks an appointment Paid, but only if it is still Unpaid.
 * This works like a lock: if two requests arrive together, only one can change the row.
 *
 * @async
 * @param {number} appointmentId Appointment id.
 * @returns {Promise<boolean>} True if this call changed it to Paid.
 */
async function markAppointmentPaid( appointmentId ) {
	const sql = 'UPDATE appointments SET payment_status = \'Paid\' WHERE id = ? AND payment_status = \'Unpaid\'';
	const [ result ] = await pool.execute( sql, [ appointmentId ] );
	return result.affectedRows === 1;
}

/**
 * Saves one payment attempt (successful, failed or pending). Failed ones are kept as a log.
 *
 * @async
 * @param {Object} payment appointmentId, patientId, amount, method, accountLast4, status, transactionRef.
 * @returns {Promise<number>} New payment id.
 */
async function createPayment( payment ) {
	const sql = 'INSERT INTO payments (appointment_id, patient_id, amount, method, account_last4, status, transaction_ref) '
		+ 'VALUES (?, ?, ?, ?, ?, ?, ?)';
	const [ result ] = await pool.execute( sql, [
		payment.appointmentId,
		payment.patientId,
		payment.amount,
		payment.method,
		payment.accountLast4,
		payment.status,
		payment.transactionRef,
	] );
	return result.insertId;
}

/**
 * Gets the payment history of a patient (newest first).
 *
 * @async
 * @param {number} patientId Patient id.
 * @returns {Promise<Array>} Payments.
 */
async function getPaymentsByPatient( patientId ) {
	const sql = 'SELECT p.id, p.appointment_id, p.amount, p.method, p.status, p.transaction_ref, p.created_at, '
		+ 'd.name AS doctor_name FROM payments p '
		+ 'JOIN appointments a ON a.id = p.appointment_id JOIN doctors d ON d.id = a.doctor_id '
		+ 'WHERE p.patient_id = ? ORDER BY p.id DESC';
	const [ rows ] = await pool.execute( sql, [ patientId ] );
	return rows;
}

/**
 * Gets one payment with everything needed for a receipt.
 *
 * @async
 * @param {number} paymentId Payment id.
 * @returns {Promise<Object|null>} Payment details or null.
 */
async function getPaymentById( paymentId ) {
	const sql = 'SELECT p.id, p.patient_id, p.appointment_id, p.amount, p.method, p.account_last4, p.status, '
		+ 'p.transaction_ref, p.created_at, d.name AS doctor_name, u.full_name AS patient_name, '
		+ 's.slot_date, s.slot_time FROM payments p '
		+ 'JOIN appointments a ON a.id = p.appointment_id JOIN doctors d ON d.id = a.doctor_id '
		+ 'JOIN appointment_slots s ON s.id = a.slot_id JOIN users u ON u.id = p.patient_id WHERE p.id = ?';
	const [ rows ] = await pool.execute( sql, [ paymentId ] );
	return rows[ 0 ] || null;
}

module.exports = {
	getAppointmentForPayment,
	markAppointmentPaid,
	createPayment,
	getPaymentsByPatient,
	getPaymentById,
};
```

### `models/health-record-model.js`

```js
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
```

### `controllers/payment-controller.js`

```js
/**
 * Payment Controller (Member 4): payment summary, paying, history, receipt.
 * The "payment gateway" is simulated, because a real gateway needs a company account.
 *
 * @module paymentController
 */
const paymentModel = require( '../models/payment-model' );
const { isPositiveInteger } = require( '../utils/validators' );

const PAYMENT_METHODS = [ 'card', 'mobile_banking', 'wallet' ];
const SERVER_ERROR_MESSAGE = 'Payment could not be processed. Please try again later.';

/**
 * Checks the payment form data.
 *
 * @param {Object} body appointmentId, method, accountNumber.
 * @returns {string|null} Error message, or null when valid.
 */
function validatePaymentInput( body ) {
	const invalidMessage = 'Please provide valid payment details.';
	if ( !isPositiveInteger( body.appointmentId ) || !PAYMENT_METHODS.includes( body.method ) ) {
		return invalidMessage;
	}
	const accountNumber = String( body.accountNumber || '' ).replace( /\s/g, '' );
	if ( body.method === 'card' && !/^\d{16}$/.test( accountNumber ) ) {
		return invalidMessage;
	}
	// Mobile banking and wallet use a phone number like 01712345678.
	if ( body.method !== 'card' && !/^01\d{9}$/.test( accountNumber ) ) {
		return invalidMessage;
	}
	return null;
}

/**
 * Pretends to be the payment gateway.
 * Test rules: account ending 0002 fails, account ending 9999 stays pending, all others succeed.
 *
 * @param {string} accountNumber Card or phone number.
 * @returns {string} 'Successful', 'Failed' or 'Pending'.
 */
function simulateGateway( accountNumber ) {
	const last4 = String( accountNumber ).slice( -4 );
	if ( last4 === '0002' ) {
		return 'Failed';
	}
	if ( last4 === '9999' ) {
		return 'Pending';
	}
	return 'Successful';
}

/**
 * Creates a unique transaction reference such as HH-1730000000000-4821.
 *
 * @returns {string} Reference text.
 */
function generateTransactionRef() {
	return 'HH-' + Date.now() + '-' + Math.floor( 1000 + Math.random() * 9000 );
}

/**
 * Finds an appointment that belongs to the logged-in patient.
 *
 * @async
 * @param {*} appointmentId Id from the request.
 * @param {number} patientId Logged-in user's id.
 * @returns {Promise<Object|null>} Appointment or null.
 */
async function findOwnAppointment( appointmentId, patientId ) {
	if ( !isPositiveInteger( appointmentId ) ) {
		return null;
	}
	const appointment = await paymentModel.getAppointmentForPayment( Number( appointmentId ) );
	if ( appointment === null || appointment.patient_id !== patientId ) {
		return null;
	}
	return appointment;
}

/**
 * GET /api/payments/summary/:appointmentId - what the patient is about to pay.
 *
 * @async
 * @param {Object} req Express request.
 * @param {Object} res Express response.
 */
async function getPaymentSummary( req, res ) {
	try {
		const appointment = await findOwnAppointment( req.params.appointmentId, req.session.user.id );
		if ( appointment === null ) {
			return res.status( 404 ).json( { success: false, message: 'Appointment not found.' } );
		}
		return res.status( 200 ).json( { success: true, data: appointment } );
	} catch ( error ) {
		console.error( error );
		return res.status( 500 ).json( { success: false, message: SERVER_ERROR_MESSAGE } );
	}
}

/**
 * POST /api/payments  body: { appointmentId, method, accountNumber }
 *
 * @async
 * @param {Object} req Express request.
 * @param {Object} res Express response.
 */
async function makePayment( req, res ) {
	try {
		const body = req.body || {};
		const errorMessage = validatePaymentInput( body );
		if ( errorMessage !== null ) {
			return res.status( 400 ).json( { success: false, message: errorMessage } );
		}

		const appointment = await findOwnAppointment( body.appointmentId, req.session.user.id );
		if ( appointment === null ) {
			return res.status( 404 ).json( { success: false, message: 'Appointment not found.' } );
		}
		if ( appointment.status === 'Cancelled' ) {
			return res.status( 400 ).json( { success: false, message: 'A cancelled appointment cannot be paid.' } );
		}
		if ( appointment.payment_status === 'Paid' ) {
			return res.status( 409 ).json( { success: false, message: 'This appointment is already paid.' } );
		}

		const accountNumber = String( body.accountNumber ).replace( /\s/g, '' );
		const status = simulateGateway( accountNumber );

		// Only one request can win this UPDATE, so a double click never charges twice.
		if ( status === 'Successful' ) {
			const isMarkedPaid = await paymentModel.markAppointmentPaid( appointment.id );
			if ( !isMarkedPaid ) {
				return res.status( 409 ).json( { success: false, message: 'This appointment is already paid.' } );
			}
		}

		// Every attempt is saved, so failed payments can be investigated later.
		const paymentId = await paymentModel.createPayment( {
			appointmentId: appointment.id,
			patientId: req.session.user.id,
			amount: appointment.consultation_fee,
			method: body.method,
			accountLast4: accountNumber.slice( -4 ), // never save the full card number
			status: status,
			transactionRef: generateTransactionRef(),
		} );

		if ( status === 'Failed' ) {
			console.error( 'Payment failed for appointment ' + appointment.id + ' (payment #' + paymentId + ')' );
			return res.status( 402 ).json( { success: false, message: 'Payment Failed. Please try again.', data: { paymentId: paymentId, status: status } } );
		}
		if ( status === 'Pending' ) {
			return res.status( 202 ).json( { success: true, message: 'Payment is pending. Please check your payment history.', data: { paymentId: paymentId, status: status } } );
		}
		return res.status( 201 ).json( { success: true, message: 'Payment successful.', data: { paymentId: paymentId, status: status } } );
	} catch ( error ) {
		console.error( error );
		return res.status( 500 ).json( { success: false, message: SERVER_ERROR_MESSAGE } );
	}
}

/**
 * GET /api/payments/history
 *
 * @async
 * @param {Object} req Express request.
 * @param {Object} res Express response.
 */
async function getPaymentHistory( req, res ) {
	try {
		const payments = await paymentModel.getPaymentsByPatient( req.session.user.id );
		return res.status( 200 ).json( { success: true, data: payments } );
	} catch ( error ) {
		console.error( error );
		return res.status( 500 ).json( { success: false, message: SERVER_ERROR_MESSAGE } );
	}
}

/**
 * GET /api/payments/:id/receipt - only for successful payments of the logged-in patient.
 *
 * @async
 * @param {Object} req Express request.
 * @param {Object} res Express response.
 */
async function getReceipt( req, res ) {
	try {
		if ( !isPositiveInteger( req.params.id ) ) {
			return res.status( 400 ).json( { success: false, message: 'Invalid payment id.' } );
		}
		const payment = await paymentModel.getPaymentById( Number( req.params.id ) );
		if ( payment === null || payment.patient_id !== req.session.user.id ) {
			return res.status( 404 ).json( { success: false, message: 'Payment not found.' } );
		}
		if ( payment.status !== 'Successful' ) {
			return res.status( 400 ).json( { success: false, message: 'A receipt is only available for successful payments.' } );
		}
		return res.status( 200 ).json( { success: true, data: payment } );
	} catch ( error ) {
		console.error( error );
		return res.status( 500 ).json( { success: false, message: SERVER_ERROR_MESSAGE } );
	}
}

module.exports = {
	validatePaymentInput,
	simulateGateway,
	generateTransactionRef,
	getPaymentSummary,
	makePayment,
	getPaymentHistory,
	getReceipt,
};
```

### `controllers/health-record-controller.js`

```js
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
```

### `middleware/upload-middleware.js`

```js
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
```

### `routes/payment-routes.js`

```js
/**
 * Payment routes (Member 4). Mounted at /api/payments in app.js.
 */
const express = require( 'express' );
const paymentController = require( '../controllers/payment-controller' );
const { requireRole } = require( '../middleware/auth-middleware' );

const router = express.Router();

router.get( '/summary/:appointmentId', requireRole( 'patient' ), paymentController.getPaymentSummary );
router.get( '/history', requireRole( 'patient' ), paymentController.getPaymentHistory );
router.get( '/:id/receipt', requireRole( 'patient' ), paymentController.getReceipt );
router.post( '/', requireRole( 'patient' ), paymentController.makePayment );

module.exports = router;
```

### `routes/health-record-routes.js`

```js
/**
 * Health record routes (Member 4). Mounted at /api/health-records in app.js.
 * requireRole runs BEFORE handleUpload, so guests cannot upload files.
 */
const express = require( 'express' );
const healthRecordController = require( '../controllers/health-record-controller' );
const { requireRole } = require( '../middleware/auth-middleware' );
const { handleUpload } = require( '../middleware/upload-middleware' );

const router = express.Router();

router.get( '/', requireRole( 'patient' ), healthRecordController.listRecords );
router.post( '/', requireRole( 'patient' ), handleUpload, healthRecordController.uploadRecord );
router.get( '/:id/view', requireRole( 'patient' ), healthRecordController.viewRecord );
router.get( '/:id/download', requireRole( 'patient' ), healthRecordController.downloadRecord );
router.delete( '/:id', requireRole( 'patient' ), healthRecordController.deleteRecord );

module.exports = router;
```

### `views/payment.html`

```html
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Payment - HealthHub</title>
    <link rel="stylesheet" href="/css/style.css">
</head>
<body>
    <div id="navbar"></div>
    <div class="container">
        <div class="card">
            <h1>Pay for an appointment</h1>
            <div class="form-row">
                <label for="appointmentSelect">Unpaid appointment</label>
                <select id="appointmentSelect"></select>
            </div>
            <div id="summaryBox"></div>
            <div class="form-row">
                <label for="method">Payment method</label>
                <select id="method">
                    <option value="card">Debit / Credit card</option>
                    <option value="mobile_banking">Mobile banking</option>
                    <option value="wallet">Digital wallet</option>
                </select>
            </div>
            <div class="form-row">
                <label for="accountNumber" id="accountLabel">Card number (16 digits)</label>
                <input type="text" id="accountNumber" autocomplete="off">
            </div>
            <button type="button" id="payButton">Pay now</button>
            <div id="message" class="message"></div>
            <p><small>Test numbers: ending 0002 = fails, ending 9999 = pending, anything else = success.</small></p>
        </div>
        <div class="card" id="receiptCard" style="display:none">
            <h2>Payment receipt</h2>
            <div id="receiptBox"></div>
            <button type="button" class="secondary" onclick="window.print()">Print</button>
        </div>
        <div class="card">
            <h2>Payment history</h2>
            <div class="table-wrap">
                <table>
                    <thead><tr><th>Ref</th><th>Doctor</th><th>Amount</th><th>Method</th><th>Status</th><th></th></tr></thead>
                    <tbody id="historyBody"></tbody>
                </table>
            </div>
        </div>
    </div>
    <script src="/js/common.js"></script>
    <script src="/js/payment.js"></script>
</body>
</html>
```

### `views/health-records.html`

```html
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Health Records - HealthHub</title>
    <link rel="stylesheet" href="/css/style.css">
</head>
<body>
    <div id="navbar"></div>
    <div class="container">
        <div class="card">
            <h1>Upload a health record</h1>
            <form id="uploadForm">
                <div class="form-row"><label for="title">Title *</label><input type="text" id="title" maxlength="100"></div>
                <div class="form-row">
                    <label for="category">Category *</label>
                    <select id="category">
                        <option>Lab Report</option>
                        <option>Prescription</option>
                        <option>X-Ray / Scan</option>
                        <option>Vaccination</option>
                        <option>Other</option>
                    </select>
                </div>
                <div class="form-row"><label for="description">Description</label><textarea id="description" rows="2"></textarea></div>
                <div class="form-row"><label for="recordFile">File (PDF, JPG, JPEG, PNG, max 5 MB) *</label><input type="file" id="recordFile" accept=".pdf,.jpg,.jpeg,.png"></div>
                <button type="submit">Upload</button>
            </form>
            <div id="message" class="message"></div>
        </div>
        <div class="card">
            <h2>My records</h2>
            <div class="table-wrap">
                <table>
                    <thead><tr><th>Title</th><th>Category</th><th>File</th><th>Uploaded</th><th></th></tr></thead>
                    <tbody id="recordsBody"></tbody>
                </table>
            </div>
        </div>
    </div>
    <script src="/js/common.js"></script>
    <script src="/js/health-records.js"></script>
</body>
</html>
```

### `public/js/payment.js`

```js
/**
 * Payment page script (Member 4).
 */
const appointmentSelect = document.getElementById( 'appointmentSelect' );
let unpaidAppointments = [];

/** Shows the payment summary (doctor, date, fee) for the chosen appointment. */
function showSummary() {
	const chosen = unpaidAppointments.find( ( item ) => String( item.id ) === appointmentSelect.value );
	document.getElementById( 'summaryBox' ).innerHTML = chosen
		? '<p><strong>Payment summary:</strong> ' + escapeHtml( chosen.doctor_name ) + ', ' + escapeHtml( chosen.slot_date )
			+ ' ' + escapeHtml( chosen.slot_time.slice( 0, 5 ) ) + ' - <strong>Fee: ' + chosen.consultation_fee + ' BDT</strong></p>'
		: '<p>You have no unpaid appointments.</p>';
}

/** Loads the patient's unpaid appointments into the drop-down. */
async function loadAppointments() {
	const result = await sendJson( 'GET', '/api/appointments/my' );
	if ( result.status !== 200 ) {
		return;
	}
	unpaidAppointments = result.body.data.filter( ( item ) => item.status !== 'Cancelled' && item.payment_status === 'Unpaid' );
	let options = '';
	unpaidAppointments.forEach( ( item ) => {
		options += '<option value="' + item.id + '">#' + item.id + ' - ' + escapeHtml( item.doctor_name ) + ' (' + escapeHtml( item.slot_date ) + ')</option>';
	} );
	appointmentSelect.innerHTML = options;
	showSummary();
}

/** Loads the payment history table. */
async function loadHistory() {
	const result = await sendJson( 'GET', '/api/payments/history' );
	if ( result.status !== 200 ) {
		return;
	}
	let html = '';
	result.body.data.forEach( ( payment ) => {
		const receiptLink = payment.status === 'Successful'
			? '<button type="button" class="receiptButton secondary" data-id="' + payment.id + '">Receipt</button>' : '';
		html += '<tr><td>' + escapeHtml( payment.transaction_ref ) + '</td><td>' + escapeHtml( payment.doctor_name ) + '</td>'
			+ '<td>' + payment.amount + '</td><td>' + escapeHtml( payment.method ) + '</td>'
			+ '<td>' + escapeHtml( payment.status ) + '</td><td>' + receiptLink + '</td></tr>';
	} );
	document.getElementById( 'historyBody' ).innerHTML = html || '<tr><td colspan="6">No payments yet.</td></tr>';
}

/**
 * Loads and shows one receipt.
 *
 * @param {number} paymentId Payment id.
 */
async function showReceipt( paymentId ) {
	const result = await sendJson( 'GET', '/api/payments/' + paymentId + '/receipt' );
	if ( result.status !== 200 ) {
		showMessage( 'message', result.body.message, 'error' );
		return;
	}
	const p = result.body.data;
	document.getElementById( 'receiptBox' ).innerHTML = '<p>Transaction: ' + escapeHtml( p.transaction_ref ) + '</p>'
		+ '<p>Patient: ' + escapeHtml( p.patient_name ) + '</p>'
		+ '<p>Doctor: ' + escapeHtml( p.doctor_name ) + ' (' + escapeHtml( p.slot_date ) + ')</p>'
		+ '<p>Amount: ' + p.amount + ' BDT</p>'
		+ '<p>Method: ' + escapeHtml( p.method ) + ' (****' + escapeHtml( p.account_last4 ) + ')</p>'
		+ '<p>Status: ' + escapeHtml( p.status ) + '</p>'
		+ '<p>Date: ' + escapeHtml( p.created_at ) + '</p>';
	document.getElementById( 'receiptCard' ).style.display = 'block';
}

appointmentSelect.addEventListener( 'change', showSummary );

document.getElementById( 'method' ).addEventListener( 'change', ( event ) => {
	document.getElementById( 'accountLabel' ).textContent = event.target.value === 'card'
		? 'Card number (16 digits)' : 'Mobile number (like 01712345678)';
} );

document.getElementById( 'payButton' ).addEventListener( 'click', async () => {
	const result = await sendJson( 'POST', '/api/payments', {
		appointmentId: Number( appointmentSelect.value ),
		method: document.getElementById( 'method' ).value,
		accountNumber: document.getElementById( 'accountNumber' ).value,
	} );
	const type = result.status === 201 ? 'success' : ( result.status === 202 ? 'info' : 'error' );
	showMessage( 'message', result.body.message, type );
	if ( result.status === 201 ) {
		showReceipt( result.body.data.paymentId );
	}
	loadAppointments();
	loadHistory();
} );

document.getElementById( 'historyBody' ).addEventListener( 'click', ( event ) => {
	if ( event.target.classList.contains( 'receiptButton' ) ) {
		showReceipt( event.target.dataset.id );
	}
} );

/** Starts the page: needs login first. */
async function startPage() {
	const user = await requireLoginPage();
	if ( user !== null ) {
		loadAppointments();
		loadHistory();
	}
}

startPage();
```

### `public/js/health-records.js`

```js
/**
 * Health records page script (Member 4).
 * The upload uses FormData, because a file cannot be sent as plain JSON.
 */
const recordsBody = document.getElementById( 'recordsBody' );

/** Loads the patient's records into the table. */
async function loadRecords() {
	const result = await sendJson( 'GET', '/api/health-records' );
	if ( result.status !== 200 ) {
		return;
	}
	let html = '';
	result.body.data.forEach( ( record ) => {
		html += '<tr><td>' + escapeHtml( record.title ) + '</td><td>' + escapeHtml( record.category ) + '</td>'
			+ '<td>' + escapeHtml( record.original_name ) + '</td><td>' + escapeHtml( record.uploaded_at ) + '</td>'
			+ '<td><a class="button" target="_blank" href="/api/health-records/' + record.id + '/view">View</a> '
			+ '<a class="button secondary" href="/api/health-records/' + record.id + '/download">Download</a> '
			+ '<button type="button" class="deleteButton danger" data-id="' + record.id + '">Delete</button></td></tr>';
	} );
	recordsBody.innerHTML = html || '<tr><td colspan="5">No records uploaded yet.</td></tr>';
}

document.getElementById( 'uploadForm' ).addEventListener( 'submit', async ( event ) => {
	event.preventDefault();
	const formData = new FormData();
	formData.append( 'title', document.getElementById( 'title' ).value );
	formData.append( 'category', document.getElementById( 'category' ).value );
	formData.append( 'description', document.getElementById( 'description' ).value );
	// 'recordFile' must be the same name the server uses in upload.single( 'recordFile' ).
	const file = document.getElementById( 'recordFile' ).files[ 0 ];
	if ( file ) {
		formData.append( 'recordFile', file );
	}

	try {
		const response = await fetch( '/api/health-records', { method: 'POST', body: formData } );
		const body = await response.json();
		if ( response.status === 401 ) {
			window.location.href = '/login.html';
			return;
		}
		showMessage( 'message', body.message, response.status === 201 ? 'success' : 'error' );
		if ( response.status === 201 ) {
			document.getElementById( 'uploadForm' ).reset();
			loadRecords(); // show the new list immediately
		}
	} catch ( error ) {
		showMessage( 'message', 'Upload failed. Please try again.', 'error' );
	}
} );

recordsBody.addEventListener( 'click', async ( event ) => {
	if ( event.target.classList.contains( 'deleteButton' ) ) {
		const result = await sendJson( 'DELETE', '/api/health-records/' + event.target.dataset.id );
		showMessage( 'message', result.body.message, result.status === 200 ? 'success' : 'error' );
		loadRecords();
	}
} );

/** Starts the page: needs login first. */
async function startPage() {
	const user = await requireLoginPage();
	if ( user !== null ) {
		loadRecords();
	}
}

startPage();
```

### `tests/unit/payment.test.js`

```js
import { describe, it, expect } from 'vitest';
import paymentController from '../../controllers/payment-controller.js';
import healthRecordController from '../../controllers/health-record-controller.js';
import uploadMiddleware from '../../middleware/upload-middleware.js';

const { validatePaymentInput, simulateGateway, generateTransactionRef } = paymentController;
const { validateRecordInput } = healthRecordController;
const { isAllowedFileType } = uploadMiddleware;

describe( 'Member 4 - validatePaymentInput', () => {
	it( 'accepts a card payment with 16 digits', () => {
		const body = { appointmentId: 1, method: 'card', accountNumber: '4242 4242 4242 4242' };
		expect( validatePaymentInput( body ) ).toBe( null );
	} );

	it( 'accepts mobile banking with an 11 digit number', () => {
		const body = { appointmentId: 1, method: 'mobile_banking', accountNumber: '01712345678' };
		expect( validatePaymentInput( body ) ).toBe( null );
	} );

	it( 'rejects a short card number', () => {
		const body = { appointmentId: 1, method: 'card', accountNumber: '1234' };
		expect( validatePaymentInput( body ) ).toBe( 'Please provide valid payment details.' );
	} );

	it( 'rejects an unknown payment method', () => {
		const body = { appointmentId: 1, method: 'bitcoin', accountNumber: '4242424242424242' };
		expect( validatePaymentInput( body ) ).toBe( 'Please provide valid payment details.' );
	} );
} );

describe( 'Member 4 - simulateGateway and transaction reference', () => {
	it( 'succeeds for a normal number', () => {
		expect( simulateGateway( '4242424242424242' ) ).toBe( 'Successful' );
	} );

	it( 'fails when the number ends with 0002', () => {
		expect( simulateGateway( '4000000000000002' ) ).toBe( 'Failed' );
	} );

	it( 'stays pending when the number ends with 9999', () => {
		expect( simulateGateway( '4000000000009999' ) ).toBe( 'Pending' );
	} );

	it( 'creates a different reference each time', () => {
		expect( generateTransactionRef() ).toMatch( /^HH-\d+-\d{4}$/ );
	} );
} );

describe( 'Member 4 - health record validation', () => {
	it( 'allows pdf, jpg, jpeg and png only', () => {
		expect( isAllowedFileType( 'report.pdf', 'application/pdf' ) ).toBe( true );
		expect( isAllowedFileType( 'scan.PNG', 'image/png' ) ).toBe( true );
		expect( isAllowedFileType( 'virus.exe', 'application/octet-stream' ) ).toBe( false );
		expect( isAllowedFileType( 'trick.pdf.exe', 'application/pdf' ) ).toBe( false );
	} );

	it( 'needs a title and a valid category', () => {
		expect( validateRecordInput( { title: 'Blood test', category: 'Lab Report' } ) ).toBe( null );
		expect( validateRecordInput( { title: '', category: 'Lab Report' } ) ).toBe( 'Please enter the record title and category.' );
		expect( validateRecordInput( { title: 'X', category: 'Secret' } ) ).toBe( 'Please choose a valid category.' );
	} );
} );
```

### `tests/integration/payment.test.js`

```js
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import app from '../../app.js';
import { loginAs } from '../helpers/login-helper.js';
import { bookFirstFreeSlot, removeTestAppointment } from '../helpers/db-helper.js';

let patient;
let booked;
let paymentId;

beforeAll( async () => {
	patient = await loginAs( 'patient@healthhub.com' );
	booked = await bookFirstFreeSlot( patient, 4 ); // a fresh unpaid appointment for the test
} );

afterAll( async () => {
	await removeTestAppointment( booked.appointmentId, booked.slotId );
} );

describe( 'Member 4 - Payment API', () => {
	it( 'blocks a guest (401)', async () => {
		const response = await request( app ).post( '/api/payments' ).send( {} );
		expect( response.status ).toBe( 401 );
	} );

	it( 'shows a payment summary with the doctor fee', async () => {
		const response = await patient.get( '/api/payments/summary/' + booked.appointmentId );
		expect( response.status ).toBe( 200 );
		expect( response.body.data.consultation_fee ).toBe( 1500 );
	} );

	it( 'rejects invalid payment details (400)', async () => {
		const response = await patient.post( '/api/payments' ).send( { appointmentId: booked.appointmentId, method: 'card', accountNumber: '12' } );
		expect( response.status ).toBe( 400 );
	} );

	it( 'shows "Payment Failed" for a failing card (402) and keeps the appointment Unpaid', async () => {
		const response = await patient.post( '/api/payments' ).send( {
			appointmentId: booked.appointmentId,
			method: 'card',
			accountNumber: '4000000000000002',
		} );
		expect( response.status ).toBe( 402 );
		expect( response.body.message ).toBe( 'Payment Failed. Please try again.' );

		const mine = ( await patient.get( '/api/appointments/my' ) ).body.data.find( ( item ) => item.id === booked.appointmentId );
		expect( mine.payment_status ).toBe( 'Unpaid' );
	} );

	it( 'accepts a good card (201) and marks the appointment Paid', async () => {
		const response = await patient.post( '/api/payments' ).send( {
			appointmentId: booked.appointmentId,
			method: 'card',
			accountNumber: '4242424242424242',
		} );
		expect( response.status ).toBe( 201 );
		expect( response.body.data.status ).toBe( 'Successful' );
		paymentId = response.body.data.paymentId;

		const mine = ( await patient.get( '/api/appointments/my' ) ).body.data.find( ( item ) => item.id === booked.appointmentId );
		expect( mine.payment_status ).toBe( 'Paid' );
	} );

	it( 'does not charge twice (409)', async () => {
		const response = await patient.post( '/api/payments' ).send( {
			appointmentId: booked.appointmentId,
			method: 'card',
			accountNumber: '4242424242424242',
		} );
		expect( response.status ).toBe( 409 );
	} );

	it( 'lists the payments in history, including the failed one', async () => {
		const response = await patient.get( '/api/payments/history' );
		const mine = response.body.data.filter( ( item ) => item.appointment_id === booked.appointmentId );
		expect( mine.map( ( item ) => item.status ).sort() ).toEqual( [ 'Failed', 'Successful' ] );
	} );

	it( 'gives a receipt for the successful payment', async () => {
		const response = await patient.get( '/api/payments/' + paymentId + '/receipt' );
		expect( response.status ).toBe( 200 );
		expect( response.body.data.account_last4 ).toBe( '4242' );
	} );
} );
```

### `tests/integration/health-record.test.js`

```js
import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import app from '../../app.js';
import { loginAs } from '../helpers/login-helper.js';

let patient;
let recordId;

beforeAll( async () => {
	patient = await loginAs( 'patient@healthhub.com' );
} );

describe( 'Member 4 - Health record API', () => {
	it( 'blocks a guest (401)', async () => {
		const response = await request( app ).get( '/api/health-records' );
		expect( response.status ).toBe( 401 );
	} );

	it( 'uploads a PDF (201)', async () => {
		const response = await patient
			.post( '/api/health-records' )
			.field( 'title', 'Blood test' )
			.field( 'category', 'Lab Report' )
			.attach( 'recordFile', Buffer.from( 'fake pdf content' ), 'blood-test.pdf' );
		expect( response.status ).toBe( 201 );
		recordId = response.body.data.recordId;
	} );

	it( 'rejects an unsupported file type', async () => {
		const response = await patient
			.post( '/api/health-records' )
			.field( 'title', 'Bad file' )
			.field( 'category', 'Other' )
			.attach( 'recordFile', Buffer.from( 'program' ), 'virus.exe' );
		expect( response.status ).toBe( 400 );
		expect( response.body.message ).toBe( 'Invalid file type.' );
	} );

	it( 'rejects a file bigger than 5 MB', async () => {
		const response = await patient
			.post( '/api/health-records' )
			.field( 'title', 'Huge' )
			.field( 'category', 'Other' )
			.attach( 'recordFile', Buffer.alloc( 6 * 1024 * 1024 ), 'huge.pdf' );
		expect( response.status ).toBe( 400 );
		expect( response.body.message ).toBe( 'File size exceeds the allowed limit.' );
	} );

	it( 'rejects an upload without a file', async () => {
		const response = await patient.post( '/api/health-records' ).field( 'title', 'No file' ).field( 'category', 'Other' );
		expect( response.status ).toBe( 400 );
		expect( response.body.message ).toBe( 'Please choose a file to upload.' );
	} );

	it( 'shows the new record in the list', async () => {
		const response = await patient.get( '/api/health-records' );
		const titles = response.body.data.map( ( record ) => record.title );
		expect( titles ).toContain( 'Blood test' );
	} );

	it( 'downloads the file with its original name', async () => {
		const response = await patient.get( '/api/health-records/' + recordId + '/download' );
		expect( response.status ).toBe( 200 );
		expect( response.headers[ 'content-disposition' ] ).toContain( 'blood-test.pdf' );
	} );

	it( 'does not let a doctor read patient records (403)', async () => {
		const doctor = await loginAs( 'doctor@healthhub.com' );
		const response = await doctor.get( '/api/health-records/' + recordId + '/download' );
		expect( response.status ).toBe( 403 );
	} );

	it( 'deletes the record', async () => {
		const response = await patient.delete( '/api/health-records/' + recordId );
		expect( response.status ).toBe( 200 );
		const again = await patient.get( '/api/health-records/' + recordId + '/download' );
		expect( again.status ).toBe( 404 );
	} );
} );
```



## 5. Viva explanation

### 5.1 The journey of one request (Pay for an appointment)

1. `payment.html` loads the patient's unpaid appointments (from Member 3's API `/api/appointments/my`) and shows the fee.
2. The patient chooses a method, types the card number and clicks **Pay now**. `payment.js` sends `POST /api/payments`.
3. Route: `requireRole( 'patient' )` -> `paymentController.makePayment`.
4. Controller: validate input -> is this **my** appointment? -> not cancelled? -> not already paid? -> ask the (simulated) gateway.
5. If the gateway says Successful, `markAppointmentPaid` runs an `UPDATE ... WHERE payment_status = 'Unpaid'`. Only one request can win it.
6. The controller saves the payment row (last 4 digits only) and answers 201 / 402 / 202.
7. The page shows the message and the receipt, and refreshes history.

### 5.2 Why is each piece where it is?

| Question | Answer |
|---|---|
| **Why Model?** | `payment-model` is only SQL: read the fee with a JOIN, save a payment, mark the appointment paid, read history and receipt. `health-record-model` saves information **about** the file (title, name, size). |
| **Why Controller?** | The rules are here: method list, card must have 16 digits, phone 11 digits, own appointment only, no double payment, which message for Failed / Pending. For records: title/category checks, ownership checks, deleting the file from disk. |
| **Why a middleware file?** | `upload-middleware.js` is about the HTTP request (reading a file from the form), not about data or business rules. So it is neither Model nor Controller. The route plugs it in before the controller. |
| **Why View?** | HTML forms and tables. `health-records.js` uses `FormData`, because a file cannot be sent as normal JSON. |
| **Why Route?** | Every route is protected with `requireRole( 'patient' )`. For uploads, the role check runs **before** `handleUpload`, so guests cannot even send a file. |

### 5.3 The SQL, explained

| SQL | Business meaning |
|---|---|
| `SELECT ... d.consultation_fee ... FROM appointments a JOIN doctors d ... JOIN appointment_slots s ... WHERE a.id = ?` | The payment amount is the doctor's fee. We read it from the database, **never from the browser**, so nobody can pay 1 taka for a 1000 taka appointment. |
| `UPDATE appointments SET payment_status = 'Paid' WHERE id = ? AND payment_status = 'Unpaid'` | Marks it Paid only if still Unpaid. If a user double-clicks, the second request changes 0 rows and gets "already paid". This prevents duplicate charges. |
| `INSERT INTO payments (appointment_id, patient_id, amount, method, account_last4, status, transaction_ref) VALUES (...)` | Saves every attempt, also failed ones. The failed ones are our log for investigation (SRS 3.2.3). `transaction_ref` is `UNIQUE`. |
| `SELECT ... FROM payments p JOIN appointments a ... JOIN doctors d ... WHERE p.patient_id = ? ORDER BY p.id DESC` | Payment history of the logged-in patient only. |
| `INSERT INTO health_records (patient_id, title, category, description, original_name, stored_name, file_type, file_size) VALUES (...)` | Saves the record's details. The file itself is in `uploads/` under a random `stored_name`. |
| `SELECT ... FROM health_records WHERE patient_id = ?` | List only my records. |
| `DELETE FROM health_records WHERE id = ?` | Delete the row (then the controller deletes the file with `fs.unlink`). |

### 5.4 Block by block

- **`simulateGateway`**: a plain function that looks at the last 4 characters. Easy to unit test, easy to replace with a real gateway later.
- **`generateTransactionRef`**: `HH-<time>-<4 random digits>`.
- **`accountLast4`**: we never store the full card number. This is good privacy practice (SRS 3.2.2).
- **Status codes**: Successful -> 201, Pending -> 202, Failed -> 402 with "Payment Failed. Please try again."
- **`isAllowedFileType`**: checks the extension **and** the MIME type, so `virus.exe` and `trick.pdf.exe` are rejected.
- **multer `limits.fileSize`**: 5 MB. If too big, multer gives `LIMIT_FILE_SIZE`, and `handleUpload` turns it into "File size exceeds the allowed limit."
- **Random file name**: `Date.now() + random + extension`, so files never overwrite each other and nobody can guess a name from the title.
- **`findOwnRecord`**: loads the record, returns `null` if it belongs to another patient (so a patient cannot open someone else's file by changing the id in the URL).
- **`viewRecord` / `downloadRecord`**: `res.sendFile` shows it in the browser; `res.download` forces a download with the original name.
- **`uploadRecord`**: if the title is wrong **after** multer saved the file, we delete the file (`fs.unlink`) so no orphan files stay in `uploads/`.

### 5.5 Tests

- **Unit**: `validatePaymentInput` (card, mobile, short card, unknown method), `simulateGateway` (success / fail / pending), `generateTransactionRef` format, `isAllowedFileType`, `validateRecordInput`. No database.
- **Integration payment**: books a fresh appointment, then checks: guest 401, summary shows fee 1500, invalid details 400, failing card 402 and appointment stays Unpaid, good card 201 and becomes Paid, second payment 409, history contains both Failed and Successful, receipt shows `4242`.
- **Integration records**: guest 401, upload PDF 201, `.exe` rejected, 6 MB file rejected, no file rejected, list, download header contains the file name, a doctor gets 403, delete then 404.

### 5.6 Questions the teacher may ask

**Q: Is this a real payment gateway?**
A: No. It is a simulation with clear test rules. The code is ready for replacement: only `simulateGateway` would be swapped for a call to a real gateway (for example SSLCommerz or Stripe) and the rest stays the same.

**Q: How do you prevent duplicate charges?**
A: Before paying we check the appointment is Unpaid. Then the `UPDATE ... WHERE payment_status = 'Unpaid'` decides the winner. If two requests arrive together only one changes the row; the other receives 409.

**Q: Why do you read the amount from the database?**
A: The browser can be changed by the user. If the amount came from the page, a user could pay any price. The server always uses the doctor's real fee.

**Q: Why do you store only the last 4 digits?**
A: A stolen database must not contain card numbers. Last 4 digits are enough to show on a receipt.

**Q: Why do you keep Failed payments?**
A: SRS says failed transactions must be logged. The row with status `Failed` is that log.

**Q: How do you make sure only PDF/JPG/PNG are uploaded?**
A: multer's `fileFilter` calls `isAllowedFileType`: extension **and** MIME type must match the allowed lists.

**Q: Can patient A open patient B's record by typing B's record id?**
A: No. `findOwnRecord` compares the record's `patient_id` with the logged-in user id from the session. If it does not match, the answer is 404.

**Q: Why is the file on disk and not in the database?**
A: Big files make the database slow. The database keeps the details; the disk keeps the file. (Limitation: for a real hospital we would use encrypted cloud storage.)

**Q: Why `FormData` and not JSON for upload?**
A: JSON is text. A file is binary data, so the browser sends a `multipart/form-data` request, and multer on the server reads it.

**Q: What if the upload works but the database insert fails?**
A: We would have a file with no row. Our controller handles the validation failure case by deleting the file. For a database crash we show a 500 message; a cleanup job would be future work.

### 5.7 Demo script (3 minutes)

1. Login as patient -> Payments -> the summary shows the fee.
2. Pay with `4000 0000 0000 0002` -> "Payment Failed. Please try again."
3. Pay with `4242 4242 4242 4242` -> success + receipt. Pay again -> the appointment is no longer in the list.
4. Show history (one Failed, one Successful) and the appointment page shows `Paid`.
5. Records: upload a PDF -> appears. Upload a `.txt` or a big file -> error message. View, download, delete.
