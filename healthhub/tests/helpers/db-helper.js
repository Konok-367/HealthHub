import pool from '../../config/db.js';

/**
 * Books the first free slot of a doctor for the logged-in patient agent.
 *
 * @param {Object} agent Logged-in Supertest agent.
 * @param {number} doctorId Doctor id.
 * @returns {Promise<{appointmentId: number, slotId: number}>} Ids of the new appointment and its slot.
 */
export async function bookFirstFreeSlot( agent, doctorId ) {
	const profile = await agent.get( '/api/doctors/' + doctorId );
	const slotId = profile.body.data.slots[ 0 ].id;
	const booking = await agent.post( '/api/appointments' ).send( { slotId: slotId } );
	return { appointmentId: booking.body.data.appointmentId, slotId: slotId };
}

/**
 * Removes a test appointment (payments are deleted with it) and frees its slot,
 * so the tests can be run again and again.
 *
 * @param {number} appointmentId Appointment id.
 * @param {number} slotId Slot id.
 */
export async function removeTestAppointment( appointmentId, slotId ) {
	await pool.execute( 'DELETE FROM appointments WHERE id = ?', [ appointmentId ] );
	await pool.execute( 'UPDATE appointment_slots SET is_booked = 0 WHERE id = ?', [ slotId ] );
}

export { pool };
