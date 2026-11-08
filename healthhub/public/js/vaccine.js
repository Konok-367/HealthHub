/**
 * Vaccine and anti-venom page script (Member 6).
 */
document.getElementById( 'searchForm' ).addEventListener( 'submit', async ( event ) => {
	event.preventDefault();
	const query = buildQuery( {
		name: document.getElementById( 'name' ).value.trim(),
		category: document.getElementById( 'category' ).value,
		location: document.getElementById( 'location' ).value.trim(),
	} );
	const result = await sendJson( 'GET', '/api/vaccines/search?' + query );

	if ( result.status !== 200 ) {
		showMessage( 'message', result.body.message, 'error' );
		document.getElementById( 'resultsCard' ).style.display = 'none';
		return;
	}
	showMessage( 'message', result.body.message || result.body.data.length + ' result(s) found.', result.body.message ? 'error' : 'info' );

	let html = '';
	result.body.data.forEach( ( item ) => {
		const status = item.quantity > 0
			? '<span class="badge green">Available (' + item.quantity + ')</span>'
			: '<span class="badge red">Out of stock</span>';
		html += '<tr><td>' + escapeHtml( item.vaccine_name ) + '</td><td>' + escapeHtml( item.category ) + '</td>'
			+ '<td>' + escapeHtml( item.hospital_name ) + '</td>'
			+ '<td>' + escapeHtml( item.address ) + '</td><td>' + escapeHtml( item.phone ) + '</td>'
			+ '<td>' + status + '</td>'
			+ '<td><a href="/hospital-search.html?id=' + item.hospital_id + '">Hospital details</a></td></tr>';
	} );
	document.getElementById( 'resultsBody' ).innerHTML = html;
	document.getElementById( 'resultsCard' ).style.display = result.body.data.length > 0 ? 'block' : 'none';
} );
