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
