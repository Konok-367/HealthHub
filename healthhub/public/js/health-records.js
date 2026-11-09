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
