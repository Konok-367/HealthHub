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
