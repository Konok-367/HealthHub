# Member 5 - Emergency Contact Management and Ambulance Search

**SRS parts:** 3.1.8 Manage Emergency Contact, 3.1.11 Ambulance Search · **Database tables:** `emergency_contacts`, `ambulance_services` (reads `hospitals`).

## 1. What you are responsible for

- Anyone can search emergency contacts of hospitals and press **Call Now** (`tel:` link).
- Hospital authority and admin can **add, update, delete** contacts (this is the "Manage" part and matches the testing wiki: add / update / delete / retrieve).
- Anyone can search ambulances by city or district; ambulance providers and admin can change availability.

## 2. Files you own

| File | Layer |
|---|---|
| `models/emergency-model.js`, `models/ambulance-model.js` | Model |
| `controllers/emergency-controller.js`, `controllers/ambulance-controller.js` | Controller |
| `routes/emergency-routes.js`, `routes/ambulance-routes.js` | Route |
| `views/emergency.html`, `views/ambulance.html` | View |
| `public/js/emergency.js`, `public/js/ambulance.js` | View logic |
| `tests/unit/emergency-ambulance.test.js`, `tests/integration/emergency-ambulance.test.js` | Tests |

## 3. Branch and commands

```bash
git checkout main
git pull origin main
git checkout -b feature/member-5-emergency-ambulance
# ...paste your files...
git add models/emergency-model.js models/ambulance-model.js
git add controllers/emergency-controller.js controllers/ambulance-controller.js
git add routes/emergency-routes.js routes/ambulance-routes.js
git add views/emergency.html views/ambulance.html public/js/emergency.js public/js/ambulance.js
git add tests/unit/emergency-ambulance.test.js tests/integration/emergency-ambulance.test.js
git commit -m "feat(emergency): add emergency contacts and ambulance search"
git push -u origin feature/member-5-emergency-ambulance
```

## 4. Code (copy-paste)

Create each file with exactly this name and content. They are in the order: Model, Controller, Route, View, page script, tests.

### `models/emergency-model.js`

```js
/**
 * Emergency Contact Model (Member 5): emergency_contacts table (one row per hospital).
 *
 * @module emergencyModel
 */
const pool = require( '../config/db' );

const CONTACT_SELECT = 'SELECT ec.id, ec.hospital_id, ec.emergency_hotline, ec.ambulance_number, ec.general_number, '
	+ 'h.name AS hospital_name, h.city, h.district, h.address '
	+ 'FROM emergency_contacts ec JOIN hospitals h ON h.id = ec.hospital_id';

/**
 * Searches emergency contacts by hospital name, city or district.
 *
 * @async
 * @param {string} [keyword] Search text (empty = all).
 * @returns {Promise<Array>} Contacts with hospital info.
 */
async function searchContacts( keyword ) {
	let sql = CONTACT_SELECT + ' WHERE 1 = 1';
	const params = [];
	if ( keyword ) {
		sql += ' AND (h.name LIKE ? OR h.city LIKE ? OR h.district LIKE ?)';
		const pattern = '%' + keyword + '%';
		params.push( pattern, pattern, pattern );
	}
	sql += ' ORDER BY h.name';
	const [ rows ] = await pool.execute( sql, params );
	return rows;
}

/**
 * Gets the emergency contact of one hospital.
 *
 * @async
 * @param {number} hospitalId Hospital id.
 * @returns {Promise<Object|null>} Contact or null.
 */
async function getContactByHospital( hospitalId ) {
	const [ rows ] = await pool.execute( CONTACT_SELECT + ' WHERE ec.hospital_id = ?', [ hospitalId ] );
	return rows[ 0 ] || null;
}

/**
 * Checks that a hospital exists (the hospitals table belongs to Member 2).
 *
 * @async
 * @param {number} hospitalId Hospital id.
 * @returns {Promise<boolean>} True if it exists.
 */
async function hospitalExists( hospitalId ) {
	const [ rows ] = await pool.execute( 'SELECT id FROM hospitals WHERE id = ?', [ hospitalId ] );
	return rows.length > 0;
}

/**
 * Adds an emergency contact for a hospital.
 *
 * @async
 * @param {number} hospitalId Hospital id.
 * @param {Object} contact emergencyHotline, ambulanceNumber, generalNumber.
 * @returns {Promise<number>} New contact id.
 */
async function createContact( hospitalId, contact ) {
	const sql = 'INSERT INTO emergency_contacts (hospital_id, emergency_hotline, ambulance_number, general_number) VALUES (?, ?, ?, ?)';
	const [ result ] = await pool.execute( sql, [ hospitalId, contact.emergencyHotline, contact.ambulanceNumber, contact.generalNumber ] );
	return result.insertId;
}

/**
 * Updates the three phone numbers of a contact.
 *
 * @async
 * @param {number} id Contact id.
 * @param {Object} contact emergencyHotline, ambulanceNumber, generalNumber.
 * @returns {Promise<boolean>} True if a row was found and updated.
 */
async function updateContact( id, contact ) {
	const sql = 'UPDATE emergency_contacts SET emergency_hotline = ?, ambulance_number = ?, general_number = ? WHERE id = ?';
	const [ result ] = await pool.execute( sql, [ contact.emergencyHotline, contact.ambulanceNumber, contact.generalNumber, id ] );
	return result.affectedRows === 1;
}

/**
 * Deletes a contact.
 *
 * @async
 * @param {number} id Contact id.
 * @returns {Promise<boolean>} True if a row was deleted.
 */
async function deleteContact( id ) {
	const [ result ] = await pool.execute( 'DELETE FROM emergency_contacts WHERE id = ?', [ id ] );
	return result.affectedRows === 1;
}

module.exports = {
	searchContacts,
	getContactByHospital,
	hospitalExists,
	createContact,
	updateContact,
	deleteContact,
};
```

### `models/ambulance-model.js`

```js
/**
 * Ambulance Model (Member 5): ambulance_services table.
 *
 * @module ambulanceModel
 */
const pool = require( '../config/db' );

/**
 * Searches ambulance providers by city or district.
 *
 * @async
 * @param {string} [location] City or district text (empty = all).
 * @param {boolean} onlyAvailable True to hide providers that are busy.
 * @returns {Promise<Array>} Providers.
 */
async function searchAmbulances( location, onlyAvailable ) {
	let sql = 'SELECT * FROM ambulance_services WHERE 1 = 1';
	const params = [];
	if ( location ) {
		sql += ' AND (city LIKE ? OR district LIKE ?)';
		params.push( '%' + location + '%', '%' + location + '%' );
	}
	if ( onlyAvailable ) {
		sql += ' AND is_available = 1';
	}
	sql += ' ORDER BY is_available DESC, provider_name';
	const [ rows ] = await pool.execute( sql, params );
	return rows;
}

/**
 * Gets one provider.
 *
 * @async
 * @param {number} id Provider id.
 * @returns {Promise<Object|null>} Provider or null.
 */
async function getAmbulanceById( id ) {
	const [ rows ] = await pool.execute( 'SELECT * FROM ambulance_services WHERE id = ?', [ id ] );
	return rows[ 0 ] || null;
}

/**
 * Changes the availability of a provider.
 *
 * @async
 * @param {number} id Provider id.
 * @param {boolean} isAvailable New availability.
 * @returns {Promise<boolean>} True if the provider exists.
 */
async function updateAvailability( id, isAvailable ) {
	const [ result ] = await pool.execute( 'UPDATE ambulance_services SET is_available = ? WHERE id = ?', [ isAvailable ? 1 : 0, id ] );
	return result.affectedRows === 1;
}

module.exports = { searchAmbulances, getAmbulanceById, updateAvailability };
```

### `controllers/emergency-controller.js`

```js
/**
 * Emergency Contact Controller (Member 5).
 * Everyone can search. Only hospital authority and admin can add, update or delete.
 *
 * @module emergencyController
 */
const emergencyModel = require( '../models/emergency-model' );
const { isValidSearchText, isValidPhone, isPositiveInteger } = require( '../utils/validators' );

const NOT_FOUND_MESSAGE = 'No emergency contact information found.';
const SERVER_ERROR_MESSAGE = 'Emergency contact information is temporarily unavailable. Please try again later.';

/**
 * Checks the three phone numbers.
 *
 * @param {Object} body emergencyHotline, ambulanceNumber, generalNumber.
 * @returns {string|null} Error message, or null when valid.
 */
function validateContactInput( body ) {
	const numbers = [ body.emergencyHotline, body.ambulanceNumber, body.generalNumber ];
	if ( !numbers.every( ( number ) => isValidPhone( number ) ) ) {
		return 'Please enter valid phone numbers (5 to 15 digits).';
	}
	return null;
}

/**
 * GET /api/emergency/search?keyword=
 *
 * @async
 * @param {Object} req Express request.
 * @param {Object} res Express response.
 */
async function searchEmergencyContacts( req, res ) {
	try {
		const keyword = req.query.keyword;
		if ( !isValidSearchText( keyword ) ) {
			return res.status( 400 ).json( { success: false, message: 'Please provide valid search criteria.' } );
		}
		const contacts = await emergencyModel.searchContacts( keyword );
		if ( contacts.length === 0 ) {
			return res.status( 200 ).json( { success: true, message: NOT_FOUND_MESSAGE, data: [] } );
		}
		return res.status( 200 ).json( { success: true, data: contacts } );
	} catch ( error ) {
		console.error( error );
		return res.status( 500 ).json( { success: false, message: SERVER_ERROR_MESSAGE } );
	}
}

/**
 * GET /api/emergency/hospital/:hospitalId
 *
 * @async
 * @param {Object} req Express request.
 * @param {Object} res Express response.
 */
async function getHospitalContact( req, res ) {
	try {
		if ( !isPositiveInteger( req.params.hospitalId ) ) {
			return res.status( 400 ).json( { success: false, message: 'Invalid hospital id.' } );
		}
		const contact = await emergencyModel.getContactByHospital( Number( req.params.hospitalId ) );
		if ( contact === null ) {
			return res.status( 404 ).json( { success: false, message: NOT_FOUND_MESSAGE } );
		}
		return res.status( 200 ).json( { success: true, data: contact } );
	} catch ( error ) {
		console.error( error );
		return res.status( 500 ).json( { success: false, message: SERVER_ERROR_MESSAGE } );
	}
}

/**
 * POST /api/emergency  body: { hospitalId, emergencyHotline, ambulanceNumber, generalNumber }
 *
 * @async
 * @param {Object} req Express request.
 * @param {Object} res Express response.
 */
async function addContact( req, res ) {
	try {
		const body = req.body || {};
		if ( !isPositiveInteger( body.hospitalId ) ) {
			return res.status( 400 ).json( { success: false, message: 'Please choose a hospital.' } );
		}
		const errorMessage = validateContactInput( body );
		if ( errorMessage !== null ) {
			return res.status( 400 ).json( { success: false, message: errorMessage } );
		}
		if ( !( await emergencyModel.hospitalExists( Number( body.hospitalId ) ) ) ) {
			return res.status( 404 ).json( { success: false, message: 'Hospital not found.' } );
		}

		try {
			const id = await emergencyModel.createContact( Number( body.hospitalId ), body );
			return res.status( 201 ).json( { success: true, message: 'Emergency contact added.', data: { id: id } } );
		} catch ( insertError ) {
			// The hospital_id column is UNIQUE, so MySQL rejects a second contact for the same hospital.
			if ( insertError.code === 'ER_DUP_ENTRY' ) {
				return res.status( 409 ).json( { success: false, message: 'This hospital already has an emergency contact. Please update it instead.' } );
			}
			throw insertError;
		}
	} catch ( error ) {
		console.error( error );
		return res.status( 500 ).json( { success: false, message: SERVER_ERROR_MESSAGE } );
	}
}

/**
 * PUT /api/emergency/:id
 *
 * @async
 * @param {Object} req Express request.
 * @param {Object} res Express response.
 */
async function updateContact( req, res ) {
	try {
		if ( !isPositiveInteger( req.params.id ) ) {
			return res.status( 400 ).json( { success: false, message: 'Invalid contact id.' } );
		}
		const errorMessage = validateContactInput( req.body || {} );
		if ( errorMessage !== null ) {
			return res.status( 400 ).json( { success: false, message: errorMessage } );
		}
		const isUpdated = await emergencyModel.updateContact( Number( req.params.id ), req.body );
		if ( !isUpdated ) {
			return res.status( 404 ).json( { success: false, message: NOT_FOUND_MESSAGE } );
		}
		return res.status( 200 ).json( { success: true, message: 'Emergency contact updated.' } );
	} catch ( error ) {
		console.error( error );
		return res.status( 500 ).json( { success: false, message: SERVER_ERROR_MESSAGE } );
	}
}

/**
 * DELETE /api/emergency/:id
 *
 * @async
 * @param {Object} req Express request.
 * @param {Object} res Express response.
 */
async function deleteContact( req, res ) {
	try {
		if ( !isPositiveInteger( req.params.id ) ) {
			return res.status( 400 ).json( { success: false, message: 'Invalid contact id.' } );
		}
		const isDeleted = await emergencyModel.deleteContact( Number( req.params.id ) );
		if ( !isDeleted ) {
			return res.status( 404 ).json( { success: false, message: NOT_FOUND_MESSAGE } );
		}
		return res.status( 200 ).json( { success: true, message: 'Emergency contact deleted.' } );
	} catch ( error ) {
		console.error( error );
		return res.status( 500 ).json( { success: false, message: SERVER_ERROR_MESSAGE } );
	}
}

module.exports = {
	validateContactInput,
	searchEmergencyContacts,
	getHospitalContact,
	addContact,
	updateContact,
	deleteContact,
};
```

### `controllers/ambulance-controller.js`

```js
/**
 * Ambulance Controller (Member 5): search ambulance providers and update availability.
 *
 * @module ambulanceController
 */
const ambulanceModel = require( '../models/ambulance-model' );
const { isValidSearchText, isPositiveInteger } = require( '../utils/validators' );

const SERVER_ERROR_MESSAGE = 'Ambulance information could not be retrieved. Please try again later.';

/**
 * GET /api/ambulances/search?location=&available=true
 *
 * @async
 * @param {Object} req Express request.
 * @param {Object} res Express response.
 */
async function searchAmbulances( req, res ) {
	try {
		const location = req.query.location;
		if ( !isValidSearchText( location ) ) {
			return res.status( 400 ).json( { success: false, message: 'Please provide valid search criteria.' } );
		}
		const ambulances = await ambulanceModel.searchAmbulances( location, req.query.available === 'true' );
		if ( ambulances.length === 0 ) {
			return res.status( 200 ).json( { success: true, message: 'No ambulance service found for the selected location.', data: [] } );
		}
		return res.status( 200 ).json( { success: true, data: ambulances } );
	} catch ( error ) {
		console.error( error );
		return res.status( 500 ).json( { success: false, message: SERVER_ERROR_MESSAGE } );
	}
}

/**
 * GET /api/ambulances/:id
 *
 * @async
 * @param {Object} req Express request.
 * @param {Object} res Express response.
 */
async function getAmbulance( req, res ) {
	try {
		if ( !isPositiveInteger( req.params.id ) ) {
			return res.status( 400 ).json( { success: false, message: 'Invalid ambulance id.' } );
		}
		const ambulance = await ambulanceModel.getAmbulanceById( Number( req.params.id ) );
		if ( ambulance === null ) {
			return res.status( 404 ).json( { success: false, message: 'Ambulance service not found.' } );
		}
		return res.status( 200 ).json( { success: true, data: ambulance } );
	} catch ( error ) {
		console.error( error );
		return res.status( 500 ).json( { success: false, message: SERVER_ERROR_MESSAGE } );
	}
}

/**
 * PUT /api/ambulances/:id/availability  body: { isAvailable: true|false }
 *
 * @async
 * @param {Object} req Express request.
 * @param {Object} res Express response.
 */
async function updateAvailability( req, res ) {
	try {
		const isAvailable = ( req.body || {} ).isAvailable;
		if ( !isPositiveInteger( req.params.id ) || typeof isAvailable !== 'boolean' ) {
			return res.status( 400 ).json( { success: false, message: 'Please provide valid availability information.' } );
		}
		const isUpdated = await ambulanceModel.updateAvailability( Number( req.params.id ), isAvailable );
		if ( !isUpdated ) {
			return res.status( 404 ).json( { success: false, message: 'Ambulance service not found.' } );
		}
		return res.status( 200 ).json( { success: true, message: 'Availability updated.' } );
	} catch ( error ) {
		console.error( error );
		return res.status( 500 ).json( { success: false, message: SERVER_ERROR_MESSAGE } );
	}
}

module.exports = { searchAmbulances, getAmbulance, updateAvailability };
```

### `routes/emergency-routes.js`

```js
/**
 * Emergency contact routes (Member 5). Mounted at /api/emergency in app.js.
 * Reading is open to everyone. Changing data needs a staff role.
 */
const express = require( 'express' );
const emergencyController = require( '../controllers/emergency-controller' );
const { requireRole } = require( '../middleware/auth-middleware' );

const router = express.Router();
const STAFF_ROLES = [ 'hospital_authority', 'admin' ];

router.get( '/search', emergencyController.searchEmergencyContacts );
router.get( '/hospital/:hospitalId', emergencyController.getHospitalContact );
router.post( '/', requireRole( ...STAFF_ROLES ), emergencyController.addContact );
router.put( '/:id', requireRole( ...STAFF_ROLES ), emergencyController.updateContact );
router.delete( '/:id', requireRole( ...STAFF_ROLES ), emergencyController.deleteContact );

module.exports = router;
```

### `routes/ambulance-routes.js`

```js
/**
 * Ambulance routes (Member 5). Mounted at /api/ambulances in app.js.
 */
const express = require( 'express' );
const ambulanceController = require( '../controllers/ambulance-controller' );
const { requireRole } = require( '../middleware/auth-middleware' );

const router = express.Router();

router.get( '/search', ambulanceController.searchAmbulances );
router.get( '/:id', ambulanceController.getAmbulance );
router.put( '/:id/availability', requireRole( 'ambulance_provider', 'admin' ), ambulanceController.updateAvailability );

module.exports = router;
```

### `views/emergency.html`

```html
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Emergency Contacts - HealthHub</title>
    <link rel="stylesheet" href="/css/style.css">
</head>
<body>
    <div id="navbar"></div>
    <div class="container">
        <div class="card">
            <h1>Emergency Contacts</h1>
            <form id="searchForm" class="inline-form">
                <div class="form-row"><label for="keyword">Hospital name, city or area</label><input type="text" id="keyword"></div>
                <button type="submit">Search</button>
            </form>
            <div id="message" class="message"></div>
        </div>
        <div id="resultsBox"></div>

        <div class="card" id="manageCard" style="display:none">
            <h2 id="manageTitle">Add emergency contact (staff only)</h2>
            <form id="manageForm">
                <input type="hidden" id="contactId">
                <div class="form-row" id="hospitalRow"><label for="hospitalId">Hospital</label><select id="hospitalId"></select></div>
                <div class="form-row"><label for="emergencyHotline">Emergency hotline</label><input type="text" id="emergencyHotline"></div>
                <div class="form-row"><label for="ambulanceNumber">Ambulance number</label><input type="text" id="ambulanceNumber"></div>
                <div class="form-row"><label for="generalNumber">General number</label><input type="text" id="generalNumber"></div>
                <button type="submit">Save</button>
                <button type="button" class="secondary" id="resetForm">Clear</button>
            </form>
            <div id="manageMessage" class="message"></div>
        </div>
    </div>
    <script src="/js/common.js"></script>
    <script src="/js/emergency.js"></script>
</body>
</html>
```

### `views/ambulance.html`

```html
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Ambulance Search - HealthHub</title>
    <link rel="stylesheet" href="/css/style.css">
</head>
<body>
    <div id="navbar"></div>
    <div class="container">
        <div class="card">
            <h1>Ambulance Search</h1>
            <form id="searchForm" class="inline-form">
                <div class="form-row"><label for="location">City or district</label><input type="text" id="location"></div>
                <div class="form-row"><label><input type="checkbox" id="onlyAvailable" style="width:auto"> Show available only</label></div>
                <button type="submit">Search</button>
            </form>
            <div id="message" class="message"></div>
        </div>
        <div class="card" id="resultsCard" style="display:none">
            <div class="table-wrap">
                <table>
                    <thead><tr><th>Provider</th><th>Service area</th><th>Contact</th><th>Emergency</th><th>Status</th><th></th></tr></thead>
                    <tbody id="resultsBody"></tbody>
                </table>
            </div>
        </div>
    </div>
    <script src="/js/common.js"></script>
    <script src="/js/ambulance.js"></script>
</body>
</html>
```

### `public/js/emergency.js`

```js
/**
 * Emergency contacts page script (Member 5).
 * Everyone can search. Staff (hospital authority / admin) also see the manage form.
 */
const resultsBox = document.getElementById( 'resultsBox' );
let contactList = [];
let isStaff = false;

/** Builds the list of cards, one per hospital. */
function showContacts() {
	let html = '';
	contactList.forEach( ( contact ) => {
		html += '<div class="card"><h2>' + escapeHtml( contact.hospital_name ) + '</h2>'
			+ '<p>' + escapeHtml( contact.address ) + ', ' + escapeHtml( contact.city ) + '</p>'
			+ '<p>Emergency hotline: <strong>' + escapeHtml( contact.emergency_hotline ) + '</strong> '
			+ '<a class="button call" href="tel:' + escapeHtml( contact.emergency_hotline ) + '">Call Now</a></p>'
			+ '<p>Ambulance: ' + escapeHtml( contact.ambulance_number ) + ' '
			+ '<a class="button call" href="tel:' + escapeHtml( contact.ambulance_number ) + '">Call</a></p>'
			+ '<p>General: ' + escapeHtml( contact.general_number ) + '</p>';
		if ( isStaff ) {
			html += '<button type="button" class="editButton secondary" data-id="' + contact.id + '">Edit</button> '
				+ '<button type="button" class="deleteButton danger" data-id="' + contact.id + '">Delete</button>';
		}
		html += '</div>';
	} );
	resultsBox.innerHTML = html;
}

/** Loads contacts that match the search box. */
async function searchContacts() {
	const query = buildQuery( { keyword: document.getElementById( 'keyword' ).value.trim() } );
	const result = await sendJson( 'GET', '/api/emergency/search?' + query );
	if ( result.status !== 200 ) {
		showMessage( 'message', result.body.message, 'error' );
		return;
	}
	showMessage( 'message', result.body.message || result.body.data.length + ' hospital(s) found.', 'info' );
	contactList = result.body.data;
	showContacts();
}

/** Empties the manage form (back to "add" mode). */
function clearForm() {
	document.getElementById( 'manageForm' ).reset();
	document.getElementById( 'contactId' ).value = '';
	document.getElementById( 'hospitalRow' ).style.display = 'block';
	document.getElementById( 'manageTitle' ).textContent = 'Add emergency contact (staff only)';
}

/** Fills the hospital drop-down using the hospital search API of Member 2. */
async function loadHospitalOptions() {
	const result = await sendJson( 'GET', '/api/hospitals/search' );
	let options = '';
	if ( result.status === 200 ) {
		result.body.data.forEach( ( hospital ) => {
			options += '<option value="' + hospital.id + '">' + escapeHtml( hospital.name ) + '</option>';
		} );
	}
	document.getElementById( 'hospitalId' ).innerHTML = options;
}

document.getElementById( 'searchForm' ).addEventListener( 'submit', ( event ) => {
	event.preventDefault();
	searchContacts();
} );

resultsBox.addEventListener( 'click', async ( event ) => {
	const target = event.target;
	if ( target.classList.contains( 'editButton' ) ) {
		const contact = contactList.find( ( item ) => String( item.id ) === target.dataset.id );
		document.getElementById( 'contactId' ).value = contact.id;
		document.getElementById( 'emergencyHotline' ).value = contact.emergency_hotline;
		document.getElementById( 'ambulanceNumber' ).value = contact.ambulance_number;
		document.getElementById( 'generalNumber' ).value = contact.general_number;
		document.getElementById( 'hospitalRow' ).style.display = 'none';
		document.getElementById( 'manageTitle' ).textContent = 'Edit contact of ' + contact.hospital_name;
		window.scrollTo( 0, document.body.scrollHeight );
	}
	if ( target.classList.contains( 'deleteButton' ) ) {
		const result = await sendJson( 'DELETE', '/api/emergency/' + target.dataset.id );
		showMessage( 'message', result.body.message, result.status === 200 ? 'success' : 'error' );
		searchContacts();
	}
} );

document.getElementById( 'manageForm' ).addEventListener( 'submit', async ( event ) => {
	event.preventDefault();
	const contactId = document.getElementById( 'contactId' ).value;
	const data = {
		hospitalId: Number( document.getElementById( 'hospitalId' ).value ),
		emergencyHotline: document.getElementById( 'emergencyHotline' ).value.trim(),
		ambulanceNumber: document.getElementById( 'ambulanceNumber' ).value.trim(),
		generalNumber: document.getElementById( 'generalNumber' ).value.trim(),
	};
	// No contactId = add a new contact (POST). With a contactId = update it (PUT).
	const result = contactId
		? await sendJson( 'PUT', '/api/emergency/' + contactId, data )
		: await sendJson( 'POST', '/api/emergency', data );
	showMessage( 'manageMessage', result.body.message, result.status < 300 ? 'success' : 'error' );
	if ( result.status < 300 ) {
		clearForm();
		searchContacts();
	}
} );

document.getElementById( 'resetForm' ).addEventListener( 'click', clearForm );

/** Starts the page. The manage form is shown only for staff roles. */
async function startPage() {
	const user = await getCurrentUser();
	isStaff = user !== null && ( user.role === 'hospital_authority' || user.role === 'admin' );
	if ( isStaff ) {
		document.getElementById( 'manageCard' ).style.display = 'block';
		loadHospitalOptions();
	}
	searchContacts();
}

startPage();
```

### `public/js/ambulance.js`

```js
/**
 * Ambulance page script (Member 5).
 * Ambulance providers and admins also get a button to change availability.
 */
const resultsBody = document.getElementById( 'resultsBody' );
let canEdit = false;

/** Searches ambulance providers using the form values. */
async function searchAmbulances() {
	const query = buildQuery( {
		location: document.getElementById( 'location' ).value.trim(),
		available: document.getElementById( 'onlyAvailable' ).checked ? 'true' : '',
	} );
	const result = await sendJson( 'GET', '/api/ambulances/search?' + query );
	if ( result.status !== 200 ) {
		showMessage( 'message', result.body.message, 'error' );
		document.getElementById( 'resultsCard' ).style.display = 'none';
		return;
	}
	showMessage( 'message', result.body.message || result.body.data.length + ' provider(s) found.', 'info' );

	let html = '';
	result.body.data.forEach( ( item ) => {
		const isAvailable = item.is_available === 1;
		const status = isAvailable ? '<span class="badge green">Available</span>' : '<span class="badge red">Busy</span>';
		const toggle = canEdit
			? '<button type="button" class="toggleButton secondary" data-id="' + item.id + '" data-available="' + ( isAvailable ? 'false' : 'true' ) + '">'
				+ ( isAvailable ? 'Mark busy' : 'Mark available' ) + '</button>'
			: '';
		html += '<tr><td>' + escapeHtml( item.provider_name ) + '<br><small>' + escapeHtml( item.city ) + ', ' + escapeHtml( item.district ) + '</small></td>'
			+ '<td>' + escapeHtml( item.service_area ) + '</td>'
			+ '<td><a href="tel:' + escapeHtml( item.contact_number ) + '">' + escapeHtml( item.contact_number ) + '</a></td>'
			+ '<td><a class="button call" href="tel:' + escapeHtml( item.emergency_number ) + '">Call ' + escapeHtml( item.emergency_number ) + '</a></td>'
			+ '<td>' + status + '</td><td>' + toggle + '</td></tr>';
	} );
	resultsBody.innerHTML = html;
	document.getElementById( 'resultsCard' ).style.display = result.body.data.length > 0 ? 'block' : 'none';
}

document.getElementById( 'searchForm' ).addEventListener( 'submit', ( event ) => {
	event.preventDefault();
	searchAmbulances();
} );

resultsBody.addEventListener( 'click', async ( event ) => {
	if ( event.target.classList.contains( 'toggleButton' ) ) {
		const result = await sendJson( 'PUT', '/api/ambulances/' + event.target.dataset.id + '/availability', {
			isAvailable: event.target.dataset.available === 'true',
		} );
		showMessage( 'message', result.body.message, result.status === 200 ? 'success' : 'error' );
		searchAmbulances();
	}
} );

/** Starts the page: finds out if the user may edit availability. */
async function startPage() {
	const user = await getCurrentUser();
	canEdit = user !== null && ( user.role === 'ambulance_provider' || user.role === 'admin' );
	searchAmbulances();
}

startPage();
```

### `tests/unit/emergency-ambulance.test.js`

```js
import { describe, it, expect } from 'vitest';
import emergencyController from '../../controllers/emergency-controller.js';

const { validateContactInput } = emergencyController;

describe( 'Member 5 - validateContactInput', () => {
	it( 'accepts three valid phone numbers', () => {
		const body = { emergencyHotline: '01800000111', ambulanceNumber: '01800000222', generalNumber: '0255501111' };
		expect( validateContactInput( body ) ).toBe( null );
	} );

	it( 'rejects a missing number', () => {
		const body = { emergencyHotline: '01800000111', ambulanceNumber: '', generalNumber: '0255501111' };
		expect( validateContactInput( body ) ).toBe( 'Please enter valid phone numbers (5 to 15 digits).' );
	} );

	it( 'rejects a number with letters', () => {
		const body = { emergencyHotline: 'call-me', ambulanceNumber: '01800000222', generalNumber: '0255501111' };
		expect( validateContactInput( body ) ).not.toBe( null );
	} );
} );
```

### `tests/integration/emergency-ambulance.test.js`

```js
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import app from '../../app.js';
import { loginAs } from '../helpers/login-helper.js';
import { pool } from '../helpers/db-helper.js';

const TEST_HOSPITAL_ID = 8; // this hospital has no seeded contact
let staff;
let patient;
let contactId;

const goodContact = { hospitalId: TEST_HOSPITAL_ID, emergencyHotline: '01800000888', ambulanceNumber: '01800000889', generalNumber: '0915501008' };

beforeAll( async () => {
	staff = await loginAs( 'hospital@healthhub.com' );
	patient = await loginAs( 'patient@healthhub.com' );
	await pool.execute( 'DELETE FROM emergency_contacts WHERE hospital_id = ?', [ TEST_HOSPITAL_ID ] );
} );

afterAll( async () => {
	await pool.execute( 'DELETE FROM emergency_contacts WHERE hospital_id = ?', [ TEST_HOSPITAL_ID ] );
} );

describe( 'Member 5 - Emergency contact API', () => {
	it( 'lets anyone search by city', async () => {
		const response = await request( app ).get( '/api/emergency/search' ).query( { keyword: 'Savar' } );
		expect( response.status ).toBe( 200 );
		expect( response.body.data.length ).toBeGreaterThan( 0 );
		expect( response.body.data[ 0 ] ).toHaveProperty( 'emergency_hotline' );
	} );

	it( 'returns the "not found" message when nothing matches', async () => {
		const response = await request( app ).get( '/api/emergency/search' ).query( { keyword: 'Nowhere' } );
		expect( response.body.message ).toBe( 'No emergency contact information found.' );
	} );

	it( 'rejects invalid search text (400)', async () => {
		const response = await request( app ).get( '/api/emergency/search' ).query( { keyword: '<b>' } );
		expect( response.status ).toBe( 400 );
	} );

	it( 'gets the contact of one hospital', async () => {
		const response = await request( app ).get( '/api/emergency/hospital/1' );
		expect( response.status ).toBe( 200 );
		expect( response.body.data.hospital_id ).toBe( 1 );
	} );

	it( 'blocks guests (401) and patients (403) from adding contacts', async () => {
		const guest = await request( app ).post( '/api/emergency' ).send( goodContact );
		expect( guest.status ).toBe( 401 );
		const asPatient = await patient.post( '/api/emergency' ).send( goodContact );
		expect( asPatient.status ).toBe( 403 );
	} );

	it( 'lets hospital staff add a contact (201)', async () => {
		const response = await staff.post( '/api/emergency' ).send( goodContact );
		expect( response.status ).toBe( 201 );
		contactId = response.body.data.id;
	} );

	it( 'does not allow a second contact for the same hospital (409)', async () => {
		const response = await staff.post( '/api/emergency' ).send( goodContact );
		expect( response.status ).toBe( 409 );
	} );

	it( 'rejects a bad phone number (400)', async () => {
		const response = await staff.put( '/api/emergency/' + contactId ).send( { ...goodContact, emergencyHotline: 'abc' } );
		expect( response.status ).toBe( 400 );
	} );

	it( 'updates the contact', async () => {
		const response = await staff.put( '/api/emergency/' + contactId ).send( { ...goodContact, emergencyHotline: '01899999999' } );
		expect( response.status ).toBe( 200 );
		const check = await request( app ).get( '/api/emergency/hospital/' + TEST_HOSPITAL_ID );
		expect( check.body.data.emergency_hotline ).toBe( '01899999999' );
	} );

	it( 'deletes the contact', async () => {
		const response = await staff.delete( '/api/emergency/' + contactId );
		expect( response.status ).toBe( 200 );
		const check = await request( app ).get( '/api/emergency/hospital/' + TEST_HOSPITAL_ID );
		expect( check.status ).toBe( 404 );
	} );
} );

describe( 'Member 5 - Ambulance API', () => {
	it( 'finds ambulances by city or district', async () => {
		const response = await request( app ).get( '/api/ambulances/search' ).query( { location: 'Dhaka' } );
		expect( response.status ).toBe( 200 );
		expect( response.body.data.length ).toBeGreaterThan( 0 );
	} );

	it( 'shows only available providers when asked', async () => {
		const response = await request( app ).get( '/api/ambulances/search' ).query( { available: 'true' } );
		response.body.data.forEach( ( item ) => {
			expect( item.is_available ).toBe( 1 );
		} );
	} );

	it( 'returns the "no ambulance" message for an unknown place', async () => {
		const response = await request( app ).get( '/api/ambulances/search' ).query( { location: 'Atlantis' } );
		expect( response.body.message ).toBe( 'No ambulance service found for the selected location.' );
	} );

	it( 'rejects invalid search text (400)', async () => {
		const response = await request( app ).get( '/api/ambulances/search' ).query( { location: '<x>' } );
		expect( response.status ).toBe( 400 );
	} );

	it( 'lets the ambulance provider change availability, but not a patient', async () => {
		const provider = await loginAs( 'ambulance@healthhub.com' );
		const denied = await patient.put( '/api/ambulances/1/availability' ).send( { isAvailable: false } );
		expect( denied.status ).toBe( 403 );

		const changed = await provider.put( '/api/ambulances/1/availability' ).send( { isAvailable: false } );
		expect( changed.status ).toBe( 200 );
		expect( ( await request( app ).get( '/api/ambulances/1' ) ).body.data.is_available ).toBe( 0 );

		await provider.put( '/api/ambulances/1/availability' ).send( { isAvailable: true } ); // put it back
	} );
} );
```



## 5. Viva explanation

### 5.1 The journey of one request (Add an emergency contact)

1. Hospital staff logs in, opens `emergency.html`. `emergency.js` sees the role and shows the manage form.
2. Staff chooses a hospital, types three numbers, clicks Save. `emergency.js` sends `POST /api/emergency`.
3. Route: `requireRole( 'hospital_authority', 'admin' )` -> `emergencyController.addContact`.
4. Controller: hospital id valid? numbers valid? hospital exists? Then `createContact`.
5. If the hospital already has a contact, MySQL refuses (the column is `UNIQUE`) and the controller answers 409.
6. The page clears the form and reloads the list.

### 5.2 Why is each piece where it is?

| Question | Answer |
|---|---|
| **Why Model?** | Only SQL: search with a JOIN, insert, update, delete, `hospitalExists`. Ambulance model: search with filters and update availability. |
| **Why Controller?** | Validation (`validateContactInput`), messages from the SRS, translating the database "duplicate" error into a friendly 409, status codes. |
| **Why View?** | Cards with **Call Now** buttons and a table with ambulance details. The edit form is only shown to staff roles (but the server **also** protects the API). |
| **Why Route?** | The route file says who may do what: GET is open to everyone; POST / PUT / DELETE need `STAFF_ROLES`; availability needs `ambulance_provider` or `admin`. |

### 5.3 The SQL, explained

| SQL | Business meaning |
|---|---|
| `SELECT ec.*, h.name, h.city ... FROM emergency_contacts ec JOIN hospitals h ON h.id = ec.hospital_id WHERE (h.name LIKE ? OR h.city LIKE ? OR h.district LIKE ?)` | Find emergency numbers by hospital name, city or area. The JOIN is needed because the contact table only keeps `hospital_id`. |
| `SELECT id FROM hospitals WHERE id = ?` | Check the hospital exists before adding a contact (the `hospitals` table belongs to Member 2). |
| `INSERT INTO emergency_contacts (hospital_id, emergency_hotline, ambulance_number, general_number) VALUES (?, ?, ?, ?)` | Add a contact. `hospital_id` is `UNIQUE`, so a hospital cannot have two rows (data integrity: no duplicates). |
| `UPDATE emergency_contacts SET emergency_hotline = ?, ambulance_number = ?, general_number = ? WHERE id = ?` | Update the numbers. `affectedRows` tells us whether the id existed. |
| `DELETE FROM emergency_contacts WHERE id = ?` | Remove a contact. |
| `SELECT * FROM ambulance_services WHERE (city LIKE ? OR district LIKE ?) [AND is_available = 1] ORDER BY is_available DESC, provider_name` | Ambulance search. Available ones are listed first. |
| `UPDATE ambulance_services SET is_available = ? WHERE id = ?` | Provider marks the ambulance busy or available. |

### 5.4 Block by block

- **`validateContactInput`**: all three numbers must pass `isValidPhone` (5-15 characters: digits, `+`, `-`).
- **Duplicate handling**: `insertError.code === 'ER_DUP_ENTRY'` is MySQL's code for "UNIQUE rule broken". We catch it and send 409 with "update it instead".
- **`STAFF_ROLES` and the spread `...STAFF_ROLES`**: one array reused on three routes. `requireRole( ...STAFF_ROLES )` is the same as `requireRole( 'hospital_authority', 'admin' )`.
- **`typeof isAvailable !== 'boolean'`**: the availability must be exactly `true` or `false`.
- **`tel:` links**: `<a href="tel:01800000101">Call Now</a>` opens the phone dialer on a mobile device (SRS: "Call Now" button). On a computer the browser may do nothing; that is a device limit.
- **`emergency.js` form**: one form for both Add and Edit. A hidden `contactId` decides: empty = POST (add), filled = PUT (update).
- **Dropdown of hospitals**: filled by calling Member 2's API `/api/hospitals/search`. This is allowed because modules talk through the API.

### 5.5 Tests

- **Unit**: `validateContactInput` with good numbers, a missing number and a number with letters.
- **Integration**: search works; no match gives "No emergency contact information found."; bad text gives 400; guest 401 and patient 403 cannot add; staff can add (201); second contact for the same hospital 409; bad phone 400; update; delete. Ambulance: search, available-only filter, "No ambulance service found...", bad text 400, provider can change availability but a patient gets 403. The tests clean up after themselves.

### 5.6 Questions the teacher may ask

**Q: Who can add or delete an emergency contact? How do you enforce it?**
A: Only `hospital_authority` and `admin`. The route uses `requireRole`, which checks `req.session.user.role` on the server. Hiding the form in the browser is only for looks; the server is the real protection.

**Q: What does 401 mean and what does 403 mean?**
A: 401 = not logged in. 403 = logged in, but your role is not allowed.

**Q: How do you stop two contacts for the same hospital?**
A: The column `hospital_id` is `UNIQUE`. MySQL rejects the second insert and we show a clear message.

**Q: Why do you check `hospitalExists` if there is a foreign key?**
A: The foreign key would also stop it, but the error would be an ugly database error. Checking first lets us show a clear "Hospital not found." (404).

**Q: How does the Call Now button work?**
A: It is a normal link with `href="tel:number"`. Phones open the dialer. If a device cannot call, nothing happens; that is a device limitation named in the SRS.

**Q: Why is `/search` before `/:id` in the ambulance route?**
A: Express reads from top to bottom; `/:id` would catch the word "search".

**Q: How is availability shown?**
A: `is_available` is 1 or 0 in the table. The page turns it into a green "Available" or red "Busy" badge.

**Q: Your ambulance provider can change any ambulance, not only their own. Is that a problem?**
A: Yes, it is a known limit. A better version would add `provider_user_id` to the table and check ownership (like `findOwnAppointment` in Member 3). We kept it simple.

### 5.7 Demo script (3 minutes)

1. Emergency page as a guest: search "Savar" -> card with **Call Now**. Search "Atlantis" -> "No emergency contact information found."
2. Login as `hospital@healthhub.com` -> Emergency page -> the manage form appears. Add a contact for "Dhaka Child and Women Hospital" -> appears. Add again -> 409 message. Edit, then delete.
3. Login as the patient -> no manage form. (Optional: show a 403 in DevTools.)
4. Ambulance page: search "Dhaka", tick "Show available only".
5. Login as `ambulance@healthhub.com` -> Ambulance page -> "Mark busy" button appears.
