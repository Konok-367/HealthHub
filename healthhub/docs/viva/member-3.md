# Member 3 - Doctor Profile and Appointment Booking

**SRS parts:** 3.1.4 Appointment Booking (+ doctor profile from the testing wiki, + notifications) · **Database tables:** `doctors`, `appointment_slots`, `appointments`, `notifications`.

## 1. What you are responsible for

- Search doctors, view a doctor profile with free time slots.
- Patient books, reschedules and cancels an appointment. Status: Booked / Rescheduled / Cancelled.
- Never allow two patients to get the same slot.
- Doctor sees their own schedule. Patient gets simple notifications.

## 2. Files you own

| File | Layer |
|---|---|
| `models/doctor-model.js`, `models/appointment-model.js` | Model |
| `controllers/doctor-controller.js`, `controllers/appointment-controller.js` | Controller |
| `routes/doctor-routes.js`, `routes/appointment-routes.js` | Route |
| `views/doctors.html`, `views/appointments.html` | View |
| `public/js/doctors.js`, `public/js/appointments.js` | View logic |
| `tests/unit/appointment.test.js`, `tests/integration/appointment.test.js` | Tests |

## 3. Branch and commands

```bash
git checkout main
git pull origin main
git checkout -b feature/member-3-appointments
# ...paste your files...
git add models/doctor-model.js models/appointment-model.js
git add controllers/doctor-controller.js controllers/appointment-controller.js
git add routes/doctor-routes.js routes/appointment-routes.js
git add views/doctors.html views/appointments.html public/js/doctors.js public/js/appointments.js
git add tests/unit/appointment.test.js tests/integration/appointment.test.js
git commit -m "feat(appointments): add doctor profile, booking, reschedule and cancel"
git push -u origin feature/member-3-appointments
```

## 4. Code (copy-paste)

Create each file with exactly this name and content. They are in the order: Model, Controller, Route, View, page script, tests.

### `models/doctor-model.js`

```js
/**
 * Doctor Model (Member 3): doctor profiles and their free time slots.
 *
 * @module doctorModel
 */
const pool = require( '../config/db' );

/**
 * Searches doctors by name/hospital text and/or specialty.
 *
 * @async
 * @param {string} [keyword] Part of a doctor name or hospital name.
 * @param {string} [specialty] Part of a specialty name.
 * @returns {Promise<Array>} Matching doctors with their hospital name.
 */
async function searchDoctors( keyword, specialty ) {
	let sql = 'SELECT d.id, d.name, d.specialty, d.qualification, d.experience_years, d.consultation_fee, '
		+ 'h.name AS hospital_name, h.city FROM doctors d '
		+ 'JOIN hospitals h ON h.id = d.hospital_id WHERE 1 = 1';
	const params = [];

	if ( keyword ) {
		sql += ' AND (d.name LIKE ? OR h.name LIKE ?)';
		params.push( '%' + keyword + '%', '%' + keyword + '%' );
	}
	if ( specialty ) {
		sql += ' AND d.specialty LIKE ?';
		params.push( '%' + specialty + '%' );
	}
	sql += ' ORDER BY d.name';

	const [ rows ] = await pool.execute( sql, params );
	return rows;
}

/**
 * Gets one doctor's full profile.
 *
 * @async
 * @param {number} id Doctor id.
 * @returns {Promise<Object|null>} Doctor row or null.
 */
async function getDoctorById( id ) {
	const sql = 'SELECT d.*, h.name AS hospital_name, h.city, h.address AS hospital_address '
		+ 'FROM doctors d JOIN hospitals h ON h.id = d.hospital_id WHERE d.id = ?';
	const [ rows ] = await pool.execute( sql, [ id ] );
	return rows[ 0 ] || null;
}

/**
 * Gets the free (not booked) future slots of a doctor.
 *
 * @async
 * @param {number} doctorId Doctor id.
 * @returns {Promise<Array>} Free slots, earliest first.
 */
async function getAvailableSlots( doctorId ) {
	const sql = 'SELECT id, slot_date, slot_time FROM appointment_slots '
		+ 'WHERE doctor_id = ? AND is_booked = 0 '
		+ 'AND (slot_date > CURDATE() OR (slot_date = CURDATE() AND slot_time > CURTIME())) '
		+ 'ORDER BY slot_date, slot_time';
	const [ rows ] = await pool.execute( sql, [ doctorId ] );
	return rows;
}

module.exports = { searchDoctors, getDoctorById, getAvailableSlots };
```

### `models/appointment-model.js`

```js
/**
 * Appointment Model (Member 3): slots, appointments and notifications.
 *
 * @module appointmentModel
 */
const pool = require( '../config/db' );

// Same SELECT is reused for patient list, doctor schedule and single lookup.
const APPOINTMENT_COLUMNS = 'a.id, a.patient_id, a.doctor_id, a.slot_id, a.status, a.payment_status, '
	+ 's.slot_date, s.slot_time, d.name AS doctor_name, d.specialty, d.consultation_fee, '
	+ 'h.name AS hospital_name, u.full_name AS patient_name';
const APPOINTMENT_JOINS = 'FROM appointments a '
	+ 'JOIN appointment_slots s ON s.id = a.slot_id '
	+ 'JOIN doctors d ON d.id = a.doctor_id '
	+ 'JOIN hospitals h ON h.id = d.hospital_id '
	+ 'JOIN users u ON u.id = a.patient_id';

/**
 * Gets one slot.
 *
 * @async
 * @param {number} slotId Slot id.
 * @returns {Promise<Object|null>} Slot row or null.
 */
async function getSlotById( slotId ) {
	const [ rows ] = await pool.execute( 'SELECT * FROM appointment_slots WHERE id = ?', [ slotId ] );
	return rows[ 0 ] || null;
}

/**
 * Tries to reserve a slot. The UPDATE only works if the slot is still free and in the future,
 * so two patients can never get the same slot (the database decides who is first).
 *
 * @async
 * @param {number} slotId Slot id.
 * @returns {Promise<boolean>} True if this call reserved the slot.
 */
async function reserveSlot( slotId ) {
	const sql = 'UPDATE appointment_slots SET is_booked = 1 WHERE id = ? AND is_booked = 0 '
		+ 'AND (slot_date > CURDATE() OR (slot_date = CURDATE() AND slot_time > CURTIME()))';
	const [ result ] = await pool.execute( sql, [ slotId ] );
	return result.affectedRows === 1;
}

/**
 * Makes a slot free again.
 *
 * @async
 * @param {number} slotId Slot id.
 */
async function releaseSlot( slotId ) {
	await pool.execute( 'UPDATE appointment_slots SET is_booked = 0 WHERE id = ?', [ slotId ] );
}

/**
 * Saves a new appointment.
 *
 * @async
 * @param {number} patientId Patient (user) id.
 * @param {number} doctorId Doctor id.
 * @param {number} slotId Slot id.
 * @returns {Promise<number>} New appointment id.
 */
async function createAppointment( patientId, doctorId, slotId ) {
	const sql = 'INSERT INTO appointments (patient_id, doctor_id, slot_id) VALUES (?, ?, ?)';
	const [ result ] = await pool.execute( sql, [ patientId, doctorId, slotId ] );
	return result.insertId;
}

/**
 * Gets one appointment with doctor, hospital and time details.
 *
 * @async
 * @param {number} id Appointment id.
 * @returns {Promise<Object|null>} Appointment row or null.
 */
async function getAppointmentById( id ) {
	const [ rows ] = await pool.execute( 'SELECT ' + APPOINTMENT_COLUMNS + ' ' + APPOINTMENT_JOINS + ' WHERE a.id = ?', [ id ] );
	return rows[ 0 ] || null;
}

/**
 * Gets all appointments of a patient, newest slot first.
 *
 * @async
 * @param {number} patientId Patient id.
 * @returns {Promise<Array>} Appointments.
 */
async function getAppointmentsByPatient( patientId ) {
	const sql = 'SELECT ' + APPOINTMENT_COLUMNS + ' ' + APPOINTMENT_JOINS
		+ ' WHERE a.patient_id = ? ORDER BY s.slot_date DESC, s.slot_time DESC';
	const [ rows ] = await pool.execute( sql, [ patientId ] );
	return rows;
}

/**
 * Gets the schedule of the doctor who owns the given login account.
 *
 * @async
 * @param {number} userId Logged-in doctor's user id.
 * @returns {Promise<Array>} Appointments of that doctor (not cancelled).
 */
async function getScheduleByDoctorUser( userId ) {
	const sql = 'SELECT ' + APPOINTMENT_COLUMNS + ' ' + APPOINTMENT_JOINS
		+ ' WHERE d.user_id = ? AND a.status <> \'Cancelled\' ORDER BY s.slot_date, s.slot_time';
	const [ rows ] = await pool.execute( sql, [ userId ] );
	return rows;
}

/**
 * Marks an appointment as Cancelled.
 *
 * @async
 * @param {number} id Appointment id.
 */
async function cancelAppointment( id ) {
	await pool.execute( 'UPDATE appointments SET status = \'Cancelled\' WHERE id = ?', [ id ] );
}

/**
 * Moves an appointment to another slot and marks it Rescheduled.
 *
 * @async
 * @param {number} id Appointment id.
 * @param {number} newSlotId New slot id.
 */
async function rescheduleAppointment( id, newSlotId ) {
	await pool.execute( 'UPDATE appointments SET slot_id = ?, status = \'Rescheduled\' WHERE id = ?', [ newSlotId, id ] );
}

/**
 * Saves a notification message for a user.
 *
 * @async
 * @param {number} userId User id.
 * @param {string} message Text to show.
 */
async function addNotification( userId, message ) {
	await pool.execute( 'INSERT INTO notifications (user_id, message) VALUES (?, ?)', [ userId, message ] );
}

/**
 * Gets the 10 newest notifications of a user.
 *
 * @async
 * @param {number} userId User id.
 * @returns {Promise<Array>} Notifications.
 */
async function getNotifications( userId ) {
	const sql = 'SELECT id, message, created_at FROM notifications WHERE user_id = ? ORDER BY id DESC LIMIT 10';
	const [ rows ] = await pool.execute( sql, [ userId ] );
	return rows;
}

module.exports = {
	getSlotById,
	reserveSlot,
	releaseSlot,
	createAppointment,
	getAppointmentById,
	getAppointmentsByPatient,
	getScheduleByDoctorUser,
	cancelAppointment,
	rescheduleAppointment,
	addNotification,
	getNotifications,
};
```

### `controllers/doctor-controller.js`

```js
/**
 * Doctor Controller (Member 3): search doctors and view a doctor profile with free slots.
 *
 * @module doctorController
 */
const doctorModel = require( '../models/doctor-model' );
const { isValidSearchText, isPositiveInteger } = require( '../utils/validators' );

const SERVER_ERROR_MESSAGE = 'Doctor information could not be retrieved. Please try again later.';

/**
 * GET /api/doctors/search?keyword=&specialty=
 *
 * @async
 * @param {Object} req Express request.
 * @param {Object} res Express response.
 */
async function searchDoctors( req, res ) {
	try {
		const { keyword, specialty } = req.query;
		if ( !isValidSearchText( keyword ) || !isValidSearchText( specialty ) ) {
			return res.status( 400 ).json( { success: false, message: 'Please provide valid search criteria.' } );
		}
		const doctors = await doctorModel.searchDoctors( keyword, specialty );
		if ( doctors.length === 0 ) {
			return res.status( 200 ).json( { success: true, message: 'No doctors found.', data: [] } );
		}
		return res.status( 200 ).json( { success: true, data: doctors } );
	} catch ( error ) {
		console.error( error );
		return res.status( 500 ).json( { success: false, message: SERVER_ERROR_MESSAGE } );
	}
}

/**
 * GET /api/doctors/:id - doctor profile plus free slots.
 *
 * @async
 * @param {Object} req Express request.
 * @param {Object} res Express response.
 */
async function getDoctorProfile( req, res ) {
	try {
		if ( !isPositiveInteger( req.params.id ) ) {
			return res.status( 400 ).json( { success: false, message: 'Invalid doctor id.' } );
		}
		const doctor = await doctorModel.getDoctorById( Number( req.params.id ) );
		if ( doctor === null ) {
			return res.status( 404 ).json( { success: false, message: 'Doctor not found.' } );
		}
		const slots = await doctorModel.getAvailableSlots( doctor.id );
		const message = slots.length === 0 ? 'No available appointment slots.' : undefined;
		return res.status( 200 ).json( { success: true, message: message, data: { doctor: doctor, slots: slots } } );
	} catch ( error ) {
		console.error( error );
		return res.status( 500 ).json( { success: false, message: SERVER_ERROR_MESSAGE } );
	}
}

module.exports = { searchDoctors, getDoctorProfile };
```

### `controllers/appointment-controller.js`

```js
/**
 * Appointment Controller (Member 3): book, list, cancel, reschedule, doctor schedule, notifications.
 *
 * @module appointmentController
 */
const appointmentModel = require( '../models/appointment-model' );
const { isPositiveInteger } = require( '../utils/validators' );

const SERVER_ERROR_MESSAGE = 'Something went wrong. Please try again later.';
const SLOT_TAKEN_MESSAGE = 'This slot is no longer available. Please choose another time.';

/**
 * Checks the slot id sent by the browser.
 *
 * @param {*} slotId Value from the request body.
 * @returns {string|null} Error message, or null when valid.
 */
function validateSlotId( slotId ) {
	if ( !isPositiveInteger( slotId ) ) {
		return 'Please select a valid appointment date and time.';
	}
	return null;
}

/**
 * Finds an appointment and makes sure it belongs to the logged-in patient.
 *
 * @async
 * @param {Object} req Express request.
 * @returns {Promise<Object|null>} The appointment, or null if missing / not owned.
 */
async function findOwnAppointment( req ) {
	if ( !isPositiveInteger( req.params.id ) ) {
		return null;
	}
	const appointment = await appointmentModel.getAppointmentById( Number( req.params.id ) );
	if ( appointment === null || appointment.patient_id !== req.session.user.id ) {
		return null;
	}
	return appointment;
}

/**
 * POST /api/appointments  body: { slotId }
 *
 * @async
 * @param {Object} req Express request.
 * @param {Object} res Express response.
 */
async function bookAppointment( req, res ) {
	try {
		const slotId = ( req.body || {} ).slotId;
		const errorMessage = validateSlotId( slotId );
		if ( errorMessage !== null ) {
			return res.status( 400 ).json( { success: false, message: errorMessage } );
		}

		const slot = await appointmentModel.getSlotById( Number( slotId ) );
		if ( slot === null ) {
			return res.status( 400 ).json( { success: false, message: 'Please select a valid appointment date and time.' } );
		}

		const isReserved = await appointmentModel.reserveSlot( slot.id );
		if ( !isReserved ) {
			return res.status( 409 ).json( { success: false, message: SLOT_TAKEN_MESSAGE } );
		}

		let appointmentId;
		try {
			appointmentId = await appointmentModel.createAppointment( req.session.user.id, slot.doctor_id, slot.id );
		} catch ( insertError ) {
			await appointmentModel.releaseSlot( slot.id ); // undo, so the slot is not lost
			throw insertError;
		}

		await appointmentModel.addNotification(
			req.session.user.id,
			'Your appointment #' + appointmentId + ' on ' + slot.slot_date + ' at ' + slot.slot_time.slice( 0, 5 ) + ' is booked.'
		);
		return res.status( 201 ).json( {
			success: true,
			message: 'Appointment booked successfully. A confirmation notification was sent.',
			data: { appointmentId: appointmentId },
		} );
	} catch ( error ) {
		console.error( error );
		return res.status( 500 ).json( { success: false, message: SERVER_ERROR_MESSAGE } );
	}
}

/**
 * GET /api/appointments/my - appointments of the logged-in patient.
 *
 * @async
 * @param {Object} req Express request.
 * @param {Object} res Express response.
 */
async function getMyAppointments( req, res ) {
	try {
		const appointments = await appointmentModel.getAppointmentsByPatient( req.session.user.id );
		return res.status( 200 ).json( { success: true, data: appointments } );
	} catch ( error ) {
		console.error( error );
		return res.status( 500 ).json( { success: false, message: SERVER_ERROR_MESSAGE } );
	}
}

/**
 * PUT /api/appointments/:id/cancel
 *
 * @async
 * @param {Object} req Express request.
 * @param {Object} res Express response.
 */
async function cancelAppointment( req, res ) {
	try {
		const appointment = await findOwnAppointment( req );
		if ( appointment === null ) {
			return res.status( 404 ).json( { success: false, message: 'Appointment not found.' } );
		}
		if ( appointment.status === 'Cancelled' ) {
			return res.status( 400 ).json( { success: false, message: 'This appointment is already cancelled.' } );
		}

		await appointmentModel.cancelAppointment( appointment.id );
		await appointmentModel.releaseSlot( appointment.slot_id );
		await appointmentModel.addNotification( req.session.user.id, 'Your appointment #' + appointment.id + ' was cancelled.' );
		return res.status( 200 ).json( { success: true, message: 'Appointment cancelled.' } );
	} catch ( error ) {
		console.error( error );
		return res.status( 500 ).json( { success: false, message: SERVER_ERROR_MESSAGE } );
	}
}

/**
 * PUT /api/appointments/:id/reschedule  body: { newSlotId }
 *
 * @async
 * @param {Object} req Express request.
 * @param {Object} res Express response.
 */
async function rescheduleAppointment( req, res ) {
	try {
		const newSlotId = ( req.body || {} ).newSlotId;
		const errorMessage = validateSlotId( newSlotId );
		if ( errorMessage !== null ) {
			return res.status( 400 ).json( { success: false, message: errorMessage } );
		}

		const appointment = await findOwnAppointment( req );
		if ( appointment === null ) {
			return res.status( 404 ).json( { success: false, message: 'Appointment not found.' } );
		}
		if ( appointment.status === 'Cancelled' ) {
			return res.status( 400 ).json( { success: false, message: 'A cancelled appointment cannot be rescheduled.' } );
		}

		const newSlot = await appointmentModel.getSlotById( Number( newSlotId ) );
		if ( newSlot === null || newSlot.doctor_id !== appointment.doctor_id ) {
			return res.status( 400 ).json( { success: false, message: 'Please select a valid time of the same doctor.' } );
		}

		const isReserved = await appointmentModel.reserveSlot( newSlot.id );
		if ( !isReserved ) {
			return res.status( 409 ).json( { success: false, message: SLOT_TAKEN_MESSAGE } );
		}

		await appointmentModel.rescheduleAppointment( appointment.id, newSlot.id );
		await appointmentModel.releaseSlot( appointment.slot_id ); // old time becomes free
		await appointmentModel.addNotification( req.session.user.id, 'Your appointment #' + appointment.id + ' was rescheduled.' );
		return res.status( 200 ).json( { success: true, message: 'Appointment rescheduled.' } );
	} catch ( error ) {
		console.error( error );
		return res.status( 500 ).json( { success: false, message: SERVER_ERROR_MESSAGE } );
	}
}

/**
 * GET /api/appointments/schedule - schedule of the logged-in doctor.
 *
 * @async
 * @param {Object} req Express request.
 * @param {Object} res Express response.
 */
async function getDoctorSchedule( req, res ) {
	try {
		const schedule = await appointmentModel.getScheduleByDoctorUser( req.session.user.id );
		return res.status( 200 ).json( { success: true, data: schedule } );
	} catch ( error ) {
		console.error( error );
		return res.status( 500 ).json( { success: false, message: SERVER_ERROR_MESSAGE } );
	}
}

/**
 * GET /api/appointments/notifications
 *
 * @async
 * @param {Object} req Express request.
 * @param {Object} res Express response.
 */
async function getNotifications( req, res ) {
	try {
		const notifications = await appointmentModel.getNotifications( req.session.user.id );
		return res.status( 200 ).json( { success: true, data: notifications } );
	} catch ( error ) {
		console.error( error );
		return res.status( 500 ).json( { success: false, message: SERVER_ERROR_MESSAGE } );
	}
}

module.exports = {
	validateSlotId,
	bookAppointment,
	getMyAppointments,
	cancelAppointment,
	rescheduleAppointment,
	getDoctorSchedule,
	getNotifications,
};
```

### `routes/doctor-routes.js`

```js
/**
 * Doctor routes (Member 3). Mounted at /api/doctors in app.js.
 */
const express = require( 'express' );
const doctorController = require( '../controllers/doctor-controller' );

const router = express.Router();

router.get( '/search', doctorController.searchDoctors );
router.get( '/:id', doctorController.getDoctorProfile );

module.exports = router;
```

### `routes/appointment-routes.js`

```js
/**
 * Appointment routes (Member 3). Mounted at /api/appointments in app.js.
 * requireRole( 'patient' ) means only logged-in patients can use the route.
 */
const express = require( 'express' );
const appointmentController = require( '../controllers/appointment-controller' );
const { requireLogin, requireRole } = require( '../middleware/auth-middleware' );

const router = express.Router();

router.get( '/my', requireRole( 'patient' ), appointmentController.getMyAppointments );
router.get( '/schedule', requireRole( 'doctor' ), appointmentController.getDoctorSchedule );
router.get( '/notifications', requireLogin, appointmentController.getNotifications );
router.post( '/', requireRole( 'patient' ), appointmentController.bookAppointment );
router.put( '/:id/cancel', requireRole( 'patient' ), appointmentController.cancelAppointment );
router.put( '/:id/reschedule', requireRole( 'patient' ), appointmentController.rescheduleAppointment );

module.exports = router;
```

### `views/doctors.html`

```html
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Doctors - HealthHub</title>
    <link rel="stylesheet" href="/css/style.css">
</head>
<body>
    <div id="navbar"></div>
    <div class="container">
        <div class="card">
            <h1>Find a Doctor</h1>
            <form id="searchForm" class="inline-form">
                <div class="form-row"><label for="keyword">Doctor or hospital name</label><input type="text" id="keyword"></div>
                <div class="form-row"><label for="specialty">Specialty</label><input type="text" id="specialty" placeholder="e.g. Cardiology"></div>
                <button type="submit">Search</button>
            </form>
            <div id="message" class="message"></div>
        </div>
        <div class="card" id="resultsCard" style="display:none">
            <div class="table-wrap">
                <table>
                    <thead><tr><th>Doctor</th><th>Specialty</th><th>Hospital</th><th>Fee (BDT)</th><th></th></tr></thead>
                    <tbody id="resultsBody"></tbody>
                </table>
            </div>
        </div>
        <div class="card" id="profileCard" style="display:none">
            <h2>Doctor profile</h2>
            <div id="profileBox"></div>
            <h2>Available appointment slots</h2>
            <div id="slotsBox"></div>
            <div id="bookMessage" class="message"></div>
        </div>
    </div>
    <script src="/js/common.js"></script>
    <script src="/js/doctors.js"></script>
</body>
</html>
```

### `views/appointments.html`

```html
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Appointments - HealthHub</title>
    <link rel="stylesheet" href="/css/style.css">
</head>
<body>
    <div id="navbar"></div>
    <div class="container">
        <div class="card">
            <h1 id="pageTitle">My Appointments</h1>
            <div id="message" class="message"></div>
            <div class="table-wrap">
                <table>
                    <thead><tr><th>#</th><th id="whoHeader">Doctor</th><th>Hospital</th><th>Date</th><th>Time</th><th>Status</th><th>Payment</th><th></th></tr></thead>
                    <tbody id="appointmentsBody"></tbody>
                </table>
            </div>
        </div>
        <div class="card" id="rescheduleCard" style="display:none">
            <h2>Reschedule appointment <span id="rescheduleId"></span></h2>
            <div class="inline-form">
                <div class="form-row"><label for="newSlot">Choose a new time</label><select id="newSlot"></select></div>
                <button type="button" id="confirmReschedule">Confirm</button>
                <button type="button" class="secondary" id="closeReschedule">Close</button>
            </div>
        </div>
        <div class="card" id="notificationCard">
            <h2>Notifications</h2>
            <div id="notificationBox"></div>
        </div>
    </div>
    <script src="/js/common.js"></script>
    <script src="/js/appointments.js"></script>
</body>
</html>
```

### `public/js/doctors.js`

```js
/**
 * Doctors page script (Member 3): search, view profile, book a slot.
 */
const searchForm = document.getElementById( 'searchForm' );
const resultsBody = document.getElementById( 'resultsBody' );
const slotsBox = document.getElementById( 'slotsBox' );

/**
 * Loads a doctor's profile and free slots, then shows them.
 *
 * @param {number} doctorId Doctor id.
 */
async function showProfile( doctorId ) {
	const result = await sendJson( 'GET', '/api/doctors/' + doctorId );
	if ( result.status !== 200 ) {
		showMessage( 'message', result.body.message, 'error' );
		return;
	}
	const doctor = result.body.data.doctor;
	const slots = result.body.data.slots;

	document.getElementById( 'profileBox' ).innerHTML = '<p><strong>' + escapeHtml( doctor.name ) + '</strong> (' + escapeHtml( doctor.specialty ) + ')</p>'
		+ '<p>' + escapeHtml( doctor.qualification ) + ' - ' + doctor.experience_years + ' years experience</p>'
		+ '<p>Hospital: ' + escapeHtml( doctor.hospital_name ) + ', ' + escapeHtml( doctor.city ) + '</p>'
		+ '<p>Consultation fee: ' + doctor.consultation_fee + ' BDT</p>'
		+ '<p>' + escapeHtml( doctor.bio ) + '</p>';

	if ( slots.length === 0 ) {
		slotsBox.innerHTML = '<p>No available appointment slots.</p>';
	} else {
		let html = '';
		slots.forEach( ( slot ) => {
			html += '<button type="button" class="slotButton" data-id="' + slot.id + '" data-doctor="' + doctor.id + '" style="margin:4px">'
				+ escapeHtml( slot.slot_date ) + ' ' + escapeHtml( slot.slot_time.slice( 0, 5 ) ) + '</button>';
		} );
		slotsBox.innerHTML = html;
	}
	document.getElementById( 'profileCard' ).style.display = 'block';
}

searchForm.addEventListener( 'submit', async ( event ) => {
	event.preventDefault();
	const query = buildQuery( {
		keyword: document.getElementById( 'keyword' ).value.trim(),
		specialty: document.getElementById( 'specialty' ).value.trim(),
	} );
	const result = await sendJson( 'GET', '/api/doctors/search?' + query );
	if ( result.status !== 200 ) {
		showMessage( 'message', result.body.message, 'error' );
		return;
	}
	showMessage( 'message', result.body.message || result.body.data.length + ' doctor(s) found.', 'info' );

	let html = '';
	result.body.data.forEach( ( doctor ) => {
		html += '<tr><td>' + escapeHtml( doctor.name ) + '</td><td>' + escapeHtml( doctor.specialty ) + '</td>'
			+ '<td>' + escapeHtml( doctor.hospital_name ) + '</td><td>' + doctor.consultation_fee + '</td>'
			+ '<td><button type="button" class="profileButton" data-id="' + doctor.id + '">View profile</button></td></tr>';
	} );
	resultsBody.innerHTML = html;
	document.getElementById( 'resultsCard' ).style.display = result.body.data.length > 0 ? 'block' : 'none';
} );

resultsBody.addEventListener( 'click', ( event ) => {
	if ( event.target.classList.contains( 'profileButton' ) ) {
		showProfile( event.target.dataset.id );
	}
} );

slotsBox.addEventListener( 'click', async ( event ) => {
	if ( !event.target.classList.contains( 'slotButton' ) ) {
		return;
	}
	const result = await sendJson( 'POST', '/api/appointments', { slotId: Number( event.target.dataset.id ) } );
	if ( result.status === 401 ) {
		showMessage( 'bookMessage', 'Please log in as a patient to book an appointment.', 'error' );
		return;
	}
	showMessage( 'bookMessage', result.body.message, result.status === 201 ? 'success' : 'error' );
	// Reload the slots so the booked slot disappears (or a taken slot is removed).
	showProfile( event.target.dataset.doctor );
} );
```

### `public/js/appointments.js`

```js
/**
 * Appointments page script (Member 3).
 * Patients see their appointments (cancel / reschedule). Doctors see their schedule.
 */
const appointmentsBody = document.getElementById( 'appointmentsBody' );
let currentUser = null;
let appointmentToReschedule = null;

/** Loads the notification list. */
async function loadNotifications() {
	const result = await sendJson( 'GET', '/api/appointments/notifications' );
	let html = '';
	if ( result.status === 200 ) {
		result.body.data.forEach( ( item ) => {
			html += '<p>' + escapeHtml( item.message ) + ' <small>(' + escapeHtml( item.created_at ) + ')</small></p>';
		} );
	}
	document.getElementById( 'notificationBox' ).innerHTML = html || '<p>No notifications.</p>';
}

/** Loads appointments (patient) or schedule (doctor) into the table. */
async function loadAppointments() {
	const isDoctor = currentUser.role === 'doctor';
	const result = await sendJson( 'GET', isDoctor ? '/api/appointments/schedule' : '/api/appointments/my' );
	if ( result.status !== 200 ) {
		showMessage( 'message', result.body.message, 'error' );
		return;
	}
	let html = '';
	result.body.data.forEach( ( item ) => {
		const isActive = item.status !== 'Cancelled';
		const actions = ( !isDoctor && isActive )
			? '<button type="button" class="cancelButton danger" data-id="' + item.id + '">Cancel</button> '
				+ '<button type="button" class="rescheduleButton secondary" data-id="' + item.id + '" data-doctor="' + item.doctor_id + '">Reschedule</button>'
			: '';
		html += '<tr><td>' + item.id + '</td>'
			+ '<td>' + escapeHtml( isDoctor ? item.patient_name : item.doctor_name ) + '</td>'
			+ '<td>' + escapeHtml( item.hospital_name ) + '</td>'
			+ '<td>' + escapeHtml( item.slot_date ) + '</td>'
			+ '<td>' + escapeHtml( item.slot_time.slice( 0, 5 ) ) + '</td>'
			+ '<td>' + escapeHtml( item.status ) + '</td>'
			+ '<td>' + escapeHtml( item.payment_status ) + '</td>'
			+ '<td>' + actions + '</td></tr>';
	} );
	appointmentsBody.innerHTML = html || '<tr><td colspan="8">No appointments yet.</td></tr>';
}

/** Starts the page: checks login, then loads data. */
async function startPage() {
	currentUser = await requireLoginPage();
	if ( currentUser === null ) {
		return;
	}
	if ( currentUser.role === 'doctor' ) {
		document.getElementById( 'pageTitle' ).textContent = 'My Schedule';
		document.getElementById( 'whoHeader' ).textContent = 'Patient';
	}
	loadAppointments();
	loadNotifications();
}

appointmentsBody.addEventListener( 'click', async ( event ) => {
	const target = event.target;
	if ( target.classList.contains( 'cancelButton' ) ) {
		const result = await sendJson( 'PUT', '/api/appointments/' + target.dataset.id + '/cancel' );
		showMessage( 'message', result.body.message, result.status === 200 ? 'success' : 'error' );
		loadAppointments();
		loadNotifications();
	}
	if ( target.classList.contains( 'rescheduleButton' ) ) {
		appointmentToReschedule = target.dataset.id;
		const result = await sendJson( 'GET', '/api/doctors/' + target.dataset.doctor );
		let options = '';
		result.body.data.slots.forEach( ( slot ) => {
			options += '<option value="' + slot.id + '">' + escapeHtml( slot.slot_date ) + ' ' + escapeHtml( slot.slot_time.slice( 0, 5 ) ) + '</option>';
		} );
		document.getElementById( 'newSlot' ).innerHTML = options || '<option value="">No available slots</option>';
		document.getElementById( 'rescheduleId' ).textContent = '#' + appointmentToReschedule;
		document.getElementById( 'rescheduleCard' ).style.display = 'block';
	}
} );

document.getElementById( 'confirmReschedule' ).addEventListener( 'click', async () => {
	const newSlotId = Number( document.getElementById( 'newSlot' ).value );
	const result = await sendJson( 'PUT', '/api/appointments/' + appointmentToReschedule + '/reschedule', { newSlotId: newSlotId } );
	showMessage( 'message', result.body.message, result.status === 200 ? 'success' : 'error' );
	document.getElementById( 'rescheduleCard' ).style.display = 'none';
	loadAppointments();
	loadNotifications();
} );

document.getElementById( 'closeReschedule' ).addEventListener( 'click', () => {
	document.getElementById( 'rescheduleCard' ).style.display = 'none';
} );

startPage();
```

### `tests/unit/appointment.test.js`

```js
import { describe, it, expect } from 'vitest';
import appointmentController from '../../controllers/appointment-controller.js';

const { validateSlotId } = appointmentController;

describe( 'Member 3 - validateSlotId', () => {
	it( 'accepts a positive number', () => {
		expect( validateSlotId( 5 ) ).toBe( null );
		expect( validateSlotId( '12' ) ).toBe( null );
	} );

	it( 'rejects missing, zero, negative and text values', () => {
		const message = 'Please select a valid appointment date and time.';
		expect( validateSlotId( undefined ) ).toBe( message );
		expect( validateSlotId( 0 ) ).toBe( message );
		expect( validateSlotId( -1 ) ).toBe( message );
		expect( validateSlotId( 'abc' ) ).toBe( message );
	} );
} );
```

### `tests/integration/appointment.test.js`

```js
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import app from '../../app.js';
import { loginAs } from '../helpers/login-helper.js';
import { bookFirstFreeSlot, removeTestAppointment } from '../helpers/db-helper.js';

const DOCTOR_ID = 2; // Dr. Nadia Rahman (has free demo slots)
let patient;
let booked;

beforeAll( async () => {
	patient = await loginAs( 'patient@healthhub.com' );
} );

afterAll( async () => {
	if ( booked ) {
		await removeTestAppointment( booked.appointmentId, booked.slotId );
	}
} );

describe( 'Member 3 - Doctor search and profile API', () => {
	it( 'finds doctors by specialty', async () => {
		const response = await request( app ).get( '/api/doctors/search' ).query( { specialty: 'Cardiology' } );
		expect( response.status ).toBe( 200 );
		expect( response.body.data.length ).toBeGreaterThan( 0 );
		response.body.data.forEach( ( doctor ) => {
			expect( doctor.specialty ).toBe( 'Cardiology' );
		} );
	} );

	it( 'shows a doctor profile with free slots', async () => {
		const response = await request( app ).get( '/api/doctors/' + DOCTOR_ID );
		expect( response.status ).toBe( 200 );
		expect( response.body.data.doctor.id ).toBe( DOCTOR_ID );
		expect( response.body.data.slots.length ).toBeGreaterThan( 0 );
	} );

	it( 'returns 404 for an unknown doctor', async () => {
		const response = await request( app ).get( '/api/doctors/9999' );
		expect( response.status ).toBe( 404 );
	} );
} );

describe( 'Member 3 - Appointment booking API', () => {
	it( 'blocks a guest (401)', async () => {
		const response = await request( app ).post( '/api/appointments' ).send( { slotId: 1 } );
		expect( response.status ).toBe( 401 );
	} );

	it( 'blocks a doctor from booking (403)', async () => {
		const doctor = await loginAs( 'doctor@healthhub.com' );
		const response = await doctor.post( '/api/appointments' ).send( { slotId: 1 } );
		expect( response.status ).toBe( 403 );
	} );

	it( 'rejects an invalid slot (400)', async () => {
		const response = await patient.post( '/api/appointments' ).send( { slotId: 'abc' } );
		expect( response.status ).toBe( 400 );
	} );

	it( 'books a free slot (201) and the slot disappears from the free list', async () => {
		booked = await bookFirstFreeSlot( patient, DOCTOR_ID );
		expect( booked.appointmentId ).toBeGreaterThan( 0 );

		const profile = await request( app ).get( '/api/doctors/' + DOCTOR_ID );
		const freeIds = profile.body.data.slots.map( ( slot ) => slot.id );
		expect( freeIds ).not.toContain( booked.slotId );
	} );

	it( 'does not allow the same slot twice (409)', async () => {
		const response = await patient.post( '/api/appointments' ).send( { slotId: booked.slotId } );
		expect( response.status ).toBe( 409 );
	} );

	it( 'lists the booking in "my appointments" as Booked and Unpaid', async () => {
		const response = await patient.get( '/api/appointments/my' );
		const mine = response.body.data.find( ( item ) => item.id === booked.appointmentId );
		expect( mine.status ).toBe( 'Booked' );
		expect( mine.payment_status ).toBe( 'Unpaid' );
	} );

	it( 'reschedules to another slot of the same doctor', async () => {
		const profile = await request( app ).get( '/api/doctors/' + DOCTOR_ID );
		const newSlotId = profile.body.data.slots[ 0 ].id;
		const response = await patient.put( '/api/appointments/' + booked.appointmentId + '/reschedule' ).send( { newSlotId: newSlotId } );
		expect( response.status ).toBe( 200 );

		const mine = ( await patient.get( '/api/appointments/my' ) ).body.data.find( ( item ) => item.id === booked.appointmentId );
		expect( mine.status ).toBe( 'Rescheduled' );
		booked.slotId = newSlotId; // so cleanup frees the right slot
	} );

	it( 'cancels the appointment and cannot cancel twice', async () => {
		const first = await patient.put( '/api/appointments/' + booked.appointmentId + '/cancel' );
		expect( first.status ).toBe( 200 );
		const second = await patient.put( '/api/appointments/' + booked.appointmentId + '/cancel' );
		expect( second.status ).toBe( 400 );
	} );

	it( 'creates notifications for the patient', async () => {
		const response = await patient.get( '/api/appointments/notifications' );
		expect( response.status ).toBe( 200 );
		expect( response.body.data.length ).toBeGreaterThan( 0 );
	} );

	it( 'shows the doctor their own schedule (the seeded demo appointment)', async () => {
		const doctor = await loginAs( 'doctor@healthhub.com' );
		const response = await doctor.get( '/api/appointments/schedule' );
		expect( response.status ).toBe( 200 );
		expect( Array.isArray( response.body.data ) ).toBe( true );
	} );
} );
```



## 5. Viva explanation

### 5.1 The journey of one request (Book an appointment)

1. On `doctors.html` the patient searches, clicks **View profile**, then clicks a slot button.
2. `doctors.js` sends `POST /api/appointments` with `{ slotId }`.
3. The route runs `requireRole( 'patient' )` first (guest -> 401, doctor -> 403), then `appointmentController.bookAppointment`.
4. The controller checks the slot id, loads the slot, and calls `reserveSlot`.
5. `reserveSlot` runs one `UPDATE`. If it changes 1 row, this patient got the slot. If it changes 0 rows, someone was faster -> 409.
6. The controller inserts the appointment, adds a notification and answers 201.
7. The page reloads the slot list, so the booked slot disappears.

### 5.2 Why is each piece where it is?

| Question | Answer |
|---|---|
| **Why Model?** | Two Models because there are two subjects: `doctor-model` (doctors and free slots) and `appointment-model` (appointments, slot reserving, notifications). Both are only SQL. |
| **Why Controller?** | Business rules live here: a patient can only cancel **their own** appointment (`findOwnAppointment`), a cancelled appointment cannot be cancelled again or rescheduled, a reschedule must stay with the same doctor. |
| **Why View?** | `doctors.html` / `appointments.html` show data and buttons. `appointments.js` shows different columns for a doctor (patient name) and a patient (doctor name). |
| **Why Route?** | Routes also decide **who** may call: `requireRole( 'patient' )` on booking, `requireRole( 'doctor' )` on the schedule. Fixed words (`/my`, `/schedule`, `/notifications`) come before `/:id/...`. |

### 5.3 The SQL, explained

| SQL | Business meaning |
|---|---|
| `SELECT d.*, h.name ... FROM doctors d JOIN hospitals h ON h.id = d.hospital_id` | A doctor belongs to a hospital. `JOIN` puts the hospital name next to each doctor. |
| `SELECT ... FROM appointment_slots WHERE doctor_id = ? AND is_booked = 0 AND (slot_date > CURDATE() OR (slot_date = CURDATE() AND slot_time > CURTIME()))` | Free slots only, and only in the future (today only if the time has not passed). |
| `UPDATE appointment_slots SET is_booked = 1 WHERE id = ? AND is_booked = 0 AND (...future...)` | **The key query.** It reserves a slot only if it is still free. `affectedRows` is 1 for the winner and 0 for the loser, so double booking is impossible, even if two patients click at the same moment. |
| `INSERT INTO appointments (patient_id, doctor_id, slot_id) VALUES (?, ?, ?)` | Creates the appointment. Status starts as `Booked`, payment as `Unpaid` (table defaults). |
| `SELECT ... FROM appointments a JOIN appointment_slots s ... JOIN doctors d ... JOIN hospitals h ... JOIN users u ...` | One reusable "full appointment" view of data: doctor, hospital, patient, date, time, status. |
| `UPDATE appointments SET status = 'Cancelled'` + `UPDATE appointment_slots SET is_booked = 0` | Cancel: mark the appointment and give the slot back so others can book it. |
| `UPDATE appointments SET slot_id = ?, status = 'Rescheduled'` | Reschedule: reserve the new slot first, move the appointment, then free the old slot. |
| `WHERE d.user_id = ? AND a.status <> 'Cancelled'` | Doctor schedule: appointments of the doctor whose login account is this user. |

### 5.4 Block by block

- **`bookAppointment`**: order of steps is important: check input -> slot exists? -> reserve -> insert -> notify. If the insert fails after the reserve, the `catch` calls `releaseSlot` so the slot is not lost.
- **`findOwnAppointment`**: loads the appointment and returns `null` if it is missing **or belongs to someone else**. A patient cannot cancel another person's appointment, and cannot even tell if it exists (404).
- **`rescheduleAppointment`**: new slot must belong to the same doctor and must be reservable. Only then are the appointment and the old slot changed.
- **`getDoctorProfile`**: returns the doctor and the free slots together; if there are no slots the message is "No available appointment slots."
- **`APPOINTMENT_COLUMNS` / `APPOINTMENT_JOINS`** (in the Model): constants so the same long SELECT is not copied three times (clean code: no duplicate code).
- **`dateStrings: true`** (in `config/db.js`): MySQL dates arrive as text like `2026-11-05`. Without it JavaScript would turn them into `Date` objects and time zones could shift the day.
- **Reminders** (SRS) are not built. They need a background scheduler. We show notifications when the user opens the page.

### 5.5 Tests

- **Unit**: `validateSlotId` accepts positive numbers and rejects empty, 0, negative and text.
- **Integration**: doctor search and profile; guest -> 401; doctor trying to book -> 403; bad slot -> 400; booking -> 201 and the slot leaves the free list; same slot again -> 409; status `Booked` / `Unpaid`; reschedule -> `Rescheduled`; cancel, then cancel again -> 400; notifications exist; doctor schedule works. The test removes its own appointment at the end (`removeTestAppointment`), so it can run again.

### 5.6 Questions the teacher may ask

**Q: What if two patients click the same slot at the same time?**
A: The `UPDATE ... WHERE is_booked = 0` is the lock. The database runs the two updates one after the other. The first changes 1 row, the second changes 0 rows and receives the message "This slot is no longer available. Please choose another time." (409).

**Q: Why not just `SELECT` the slot, check it, then `UPDATE`?**
A: Between the SELECT and the UPDATE another patient could book. Doing the check **inside** the UPDATE makes it one atomic step.

**Q: Why does the browser only send `slotId`, not the doctor id?**
A: The doctor id is already stored in the slot. If the browser could send both, someone could send a slot of Doctor A with Doctor B. We read the doctor from the database instead (never trust the browser).

**Q: How do you stop a patient from cancelling someone else's appointment?**
A: `findOwnAppointment` compares `appointment.patient_id` with `req.session.user.id` (taken from the server session, not from the request).

**Q: Why is the status an ENUM?**
A: Only `Booked`, `Rescheduled`, `Cancelled` are allowed. MySQL refuses any other word (data integrity).

**Q: Why use a JOIN?**
A: Data is split into tables (no repeated hospital names). JOIN puts it together again when we need to show it.

**Q: Why is a booked slot kept after cancel instead of deleting the row?**
A: The appointment keeps history (status `Cancelled`). The slot is just made free again.

**Q: What does `requireRole( 'patient' )` return?**
A: A function. Express calls it before the controller. It answers 401 for guests, 403 for the wrong role, otherwise `next()`.

### 5.7 Demo script (3 minutes)

1. Login as patient -> Doctors -> search "Cardiology" -> View profile -> click a slot -> "Appointment booked successfully."
2. Click the same time in a second browser tab (already open) -> "This slot is no longer available."
3. Appointments page: Reschedule to another time -> status `Rescheduled`. Cancel -> `Cancelled`.
4. Show notifications at the bottom.
5. Logout, login as `doctor@healthhub.com` -> Appointments page shows the doctor's schedule.
