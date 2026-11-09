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
