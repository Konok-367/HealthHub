# Member 6 - Blood Bank Search and Vaccine & Anti-venom Search

**SRS parts:** 3.1.6 Search Blood in Blood Bank, 3.1.7 Search Vaccine & Anti-Venoms · **Database tables:** `blood_banks`, `blood_inventory`, `vaccines`, `vaccine_stock` (reads `hospitals`) · **Extra duty:** Documentation owner (README, JSDoc output, CI file check, see `TEAM-GUIDE.md`).

## 1. What you are responsible for

- Search blood by blood group, city, area; show availability (units) and blood bank details with all groups.
- Search vaccines and anti-venoms by name, type, city or area; show which hospitals have them and how many.
- Show the exact SRS messages for "no result" and "currently unavailable".

## 2. Files you own

| File | Layer |
|---|---|
| `models/blood-bank-model.js`, `models/vaccine-model.js` | Model |
| `controllers/blood-bank-controller.js`, `controllers/vaccine-controller.js` | Controller |
| `routes/blood-bank-routes.js`, `routes/vaccine-routes.js` | Route |
| `views/blood-bank.html`, `views/vaccine.html` | View |
| `public/js/blood-bank.js`, `public/js/vaccine.js` | View logic |
| `tests/unit/blood-vaccine.test.js`, `tests/integration/blood-vaccine.test.js` | Tests |

## 3. Branch and commands

```bash
git checkout main
git pull origin main
git checkout -b feature/member-6-blood-vaccine
# ...paste your files...
git add models/blood-bank-model.js models/vaccine-model.js
git add controllers/blood-bank-controller.js controllers/vaccine-controller.js
git add routes/blood-bank-routes.js routes/vaccine-routes.js
git add views/blood-bank.html views/vaccine.html public/js/blood-bank.js public/js/vaccine.js
git add tests/unit/blood-vaccine.test.js tests/integration/blood-vaccine.test.js
git commit -m "feat(search): add blood bank and vaccine/anti-venom search"
git push -u origin feature/member-6-blood-vaccine
```

## 4. Code (copy-paste)

Create each file with exactly this name and content. They are in the order: Model, Controller, Route, View, page script, tests.

### `models/blood-bank-model.js`

```js
/**
 * Blood Bank Model (Member 6): blood_banks and blood_inventory tables.
 *
 * @module bloodBankModel
 */
const pool = require( '../config/db' );

/**
 * Searches blood banks. If a blood group is given, each row also shows the units of that group.
 * LEFT JOIN keeps banks that have no row for the group (their units will be null).
 *
 * @async
 * @param {Object} filters bloodGroup (or ''), city, area.
 * @returns {Promise<Array>} Blood banks.
 */
async function searchBloodBanks( filters ) {
	let sql = 'SELECT bb.id, bb.name, bb.city, bb.area, bb.address, bb.phone, inv.units '
		+ 'FROM blood_banks bb '
		+ 'LEFT JOIN blood_inventory inv ON inv.blood_bank_id = bb.id AND inv.blood_group = ? '
		+ 'WHERE 1 = 1';
	// First ? belongs to the JOIN. null never matches, so units stays null when no group is chosen.
	const params = [ filters.bloodGroup || null ];

	if ( filters.city ) {
		sql += ' AND bb.city LIKE ?';
		params.push( '%' + filters.city + '%' );
	}
	if ( filters.area ) {
		sql += ' AND bb.area LIKE ?';
		params.push( '%' + filters.area + '%' );
	}
	sql += ' ORDER BY inv.units DESC, bb.name';

	const [ rows ] = await pool.execute( sql, params );
	return rows;
}

/**
 * Gets one blood bank.
 *
 * @async
 * @param {number} id Blood bank id.
 * @returns {Promise<Object|null>} Blood bank or null.
 */
async function getBloodBankById( id ) {
	const [ rows ] = await pool.execute( 'SELECT * FROM blood_banks WHERE id = ?', [ id ] );
	return rows[ 0 ] || null;
}

/**
 * Gets the stock of every blood group in one blood bank.
 *
 * @async
 * @param {number} bloodBankId Blood bank id.
 * @returns {Promise<Array>} Rows with blood_group and units.
 */
async function getInventory( bloodBankId ) {
	const sql = 'SELECT blood_group, units FROM blood_inventory WHERE blood_bank_id = ? ORDER BY blood_group';
	const [ rows ] = await pool.execute( sql, [ bloodBankId ] );
	return rows;
}

module.exports = { searchBloodBanks, getBloodBankById, getInventory };
```

### `models/vaccine-model.js`

```js
/**
 * Vaccine Model (Member 6): vaccines, anti-venoms and the stock each hospital has.
 *
 * @module vaccineModel
 */
const pool = require( '../config/db' );

/**
 * Searches vaccines / anti-venoms and the hospitals that keep them.
 *
 * @async
 * @param {Object} filters name, category ('Vaccine' or 'Anti-venom'), location.
 * @returns {Promise<Array>} One row per hospital + vaccine.
 */
async function searchVaccines( filters ) {
	let sql = 'SELECT v.id AS vaccine_id, v.name AS vaccine_name, v.category, vs.quantity, '
		+ 'h.id AS hospital_id, h.name AS hospital_name, h.address, h.city, h.district, h.phone '
		+ 'FROM vaccine_stock vs '
		+ 'JOIN vaccines v ON v.id = vs.vaccine_id '
		+ 'JOIN hospitals h ON h.id = vs.hospital_id '
		+ 'WHERE 1 = 1';
	const params = [];

	if ( filters.name ) {
		sql += ' AND v.name LIKE ?';
		params.push( '%' + filters.name + '%' );
	}
	if ( filters.category ) {
		sql += ' AND v.category = ?';
		params.push( filters.category );
	}
	if ( filters.location ) {
		sql += ' AND (h.city LIKE ? OR h.district LIKE ? OR h.address LIKE ?)';
		const pattern = '%' + filters.location + '%';
		params.push( pattern, pattern, pattern );
	}
	sql += ' ORDER BY v.name, vs.quantity DESC, h.name';

	const [ rows ] = await pool.execute( sql, params );
	return rows;
}

module.exports = { searchVaccines };
```

### `controllers/blood-bank-controller.js`

```js
/**
 * Blood Bank Controller (Member 6): search blood by group/city/area and view a blood bank.
 *
 * @module bloodBankController
 */
const bloodBankModel = require( '../models/blood-bank-model' );
const { isValidSearchText, isPositiveInteger } = require( '../utils/validators' );

const BLOOD_GROUPS = [ 'A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-' ];
const SERVER_ERROR_MESSAGE = 'Blood availability information could not be retrieved. Please try again later.';

/**
 * Fixes a blood group typed directly in the browser address bar.
 * In a URL, "+" means "space", so "O+" arrives as "O ". We turn the space back into "+".
 *
 * @param {string} text Blood group text from the query string.
 * @returns {string} Fixed text.
 */
function normalizeBloodGroup( text ) {
	return String( text || '' ).replace( / /g, '+' );
}

/**
 * Checks a blood group. Empty is allowed (it means "any group").
 *
 * @param {string} bloodGroup Normalized blood group.
 * @returns {boolean} True when empty or one of the 8 real groups.
 */
function isValidBloodGroup( bloodGroup ) {
	return bloodGroup === '' || BLOOD_GROUPS.includes( bloodGroup );
}

/**
 * GET /api/blood-banks/search?bloodGroup=&city=&area=
 *
 * @async
 * @param {Object} req Express request.
 * @param {Object} res Express response.
 */
async function searchBloodBanks( req, res ) {
	try {
		const bloodGroup = normalizeBloodGroup( req.query.bloodGroup );
		const { city, area } = req.query;
		if ( !isValidBloodGroup( bloodGroup ) || !isValidSearchText( city ) || !isValidSearchText( area ) ) {
			return res.status( 400 ).json( { success: false, message: 'Please provide valid search criteria.' } );
		}

		const bloodBanks = await bloodBankModel.searchBloodBanks( { bloodGroup, city, area } );
		if ( bloodBanks.length === 0 ) {
			return res.status( 200 ).json( { success: true, message: 'No blood available.', data: [] } );
		}
		// A group was requested but no bank has any unit of it.
		if ( bloodGroup !== '' && !bloodBanks.some( ( bank ) => bank.units > 0 ) ) {
			return res.status( 200 ).json( {
				success: true,
				message: 'The requested blood group is currently unavailable.',
				data: bloodBanks,
			} );
		}
		return res.status( 200 ).json( { success: true, data: bloodBanks } );
	} catch ( error ) {
		console.error( error );
		return res.status( 500 ).json( { success: false, message: SERVER_ERROR_MESSAGE } );
	}
}

/**
 * GET /api/blood-banks/:id - blood bank details with all blood groups.
 *
 * @async
 * @param {Object} req Express request.
 * @param {Object} res Express response.
 */
async function getBloodBankDetails( req, res ) {
	try {
		if ( !isPositiveInteger( req.params.id ) ) {
			return res.status( 400 ).json( { success: false, message: 'Invalid blood bank id.' } );
		}
		const bloodBank = await bloodBankModel.getBloodBankById( Number( req.params.id ) );
		if ( bloodBank === null ) {
			return res.status( 404 ).json( { success: false, message: 'Blood bank not found.' } );
		}
		const inventory = await bloodBankModel.getInventory( bloodBank.id );
		return res.status( 200 ).json( { success: true, data: { bloodBank: bloodBank, inventory: inventory } } );
	} catch ( error ) {
		console.error( error );
		return res.status( 500 ).json( { success: false, message: SERVER_ERROR_MESSAGE } );
	}
}

module.exports = { normalizeBloodGroup, isValidBloodGroup, searchBloodBanks, getBloodBankDetails };
```

### `controllers/vaccine-controller.js`

```js
/**
 * Vaccine Controller (Member 6): search vaccines and anti-venoms.
 *
 * @module vaccineController
 */
const vaccineModel = require( '../models/vaccine-model' );
const { isValidSearchText } = require( '../utils/validators' );

const CATEGORIES = [ '', 'Vaccine', 'Anti-venom' ];

/**
 * GET /api/vaccines/search?name=&category=&location=
 *
 * @async
 * @param {Object} req Express request.
 * @param {Object} res Express response.
 */
async function searchVaccines( req, res ) {
	try {
		const { name, location } = req.query;
		const category = req.query.category || '';
		if ( !isValidSearchText( name ) || !isValidSearchText( location ) || !CATEGORIES.includes( category ) ) {
			return res.status( 400 ).json( { success: false, message: 'Please enter valid search information.' } );
		}

		const results = await vaccineModel.searchVaccines( { name, category, location } );
		if ( results.length === 0 ) {
			return res.status( 200 ).json( { success: true, message: 'No vaccine or anti-venom found.', data: [] } );
		}
		// Found, but every hospital has zero stock.
		if ( results.every( ( item ) => item.quantity === 0 ) ) {
			return res.status( 200 ).json( {
				success: true,
				message: 'The searched vaccine or anti-venom is currently unavailable.',
				data: results,
			} );
		}
		return res.status( 200 ).json( { success: true, data: results } );
	} catch ( error ) {
		console.error( error );
		return res.status( 500 ).json( {
			success: false,
			message: 'Availability information could not be retrieved. Please try again later.',
		} );
	}
}

module.exports = { searchVaccines };
```

### `routes/blood-bank-routes.js`

```js
/**
 * Blood bank routes (Member 6). Mounted at /api/blood-banks in app.js.
 */
const express = require( 'express' );
const bloodBankController = require( '../controllers/blood-bank-controller' );

const router = express.Router();

router.get( '/search', bloodBankController.searchBloodBanks );
router.get( '/:id', bloodBankController.getBloodBankDetails );

module.exports = router;
```

### `routes/vaccine-routes.js`

```js
/**
 * Vaccine routes (Member 6). Mounted at /api/vaccines in app.js.
 */
const express = require( 'express' );
const vaccineController = require( '../controllers/vaccine-controller' );

const router = express.Router();

router.get( '/search', vaccineController.searchVaccines );

module.exports = router;
```

### `views/blood-bank.html`

```html
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Blood Bank Search - HealthHub</title>
    <link rel="stylesheet" href="/css/style.css">
</head>
<body>
    <div id="navbar"></div>
    <div class="container">
        <div class="card">
            <h1>Search Blood</h1>
            <form id="searchForm" class="inline-form">
                <div class="form-row">
                    <label for="bloodGroup">Blood group</label>
                    <select id="bloodGroup">
                        <option value="">Any</option>
                        <option>A+</option><option>A-</option><option>B+</option><option>B-</option>
                        <option>AB+</option><option>AB-</option><option>O+</option><option>O-</option>
                    </select>
                </div>
                <div class="form-row"><label for="city">City</label><input type="text" id="city"></div>
                <div class="form-row"><label for="area">Area</label><input type="text" id="area"></div>
                <button type="submit">Search</button>
            </form>
            <div id="message" class="message"></div>
        </div>
        <div class="card" id="resultsCard" style="display:none">
            <div class="table-wrap">
                <table>
                    <thead><tr><th>Blood bank</th><th>Address</th><th>Phone</th><th id="statusHeader">Availability</th><th></th></tr></thead>
                    <tbody id="resultsBody"></tbody>
                </table>
            </div>
        </div>
        <div class="card" id="detailsCard" style="display:none">
            <h2>Blood bank details</h2>
            <div id="detailsBox"></div>
        </div>
    </div>
    <script src="/js/common.js"></script>
    <script src="/js/blood-bank.js"></script>
</body>
</html>
```

### `views/vaccine.html`

```html
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Vaccine and Anti-venom Search - HealthHub</title>
    <link rel="stylesheet" href="/css/style.css">
</head>
<body>
    <div id="navbar"></div>
    <div class="container">
        <div class="card">
            <h1>Search Vaccines and Anti-venoms</h1>
            <form id="searchForm" class="inline-form">
                <div class="form-row"><label for="name">Name</label><input type="text" id="name" placeholder="e.g. Rabies"></div>
                <div class="form-row">
                    <label for="category">Type</label>
                    <select id="category">
                        <option value="">Vaccine and anti-venom</option>
                        <option value="Vaccine">Vaccine</option>
                        <option value="Anti-venom">Anti-venom</option>
                    </select>
                </div>
                <div class="form-row"><label for="location">City or area</label><input type="text" id="location"></div>
                <button type="submit">Search</button>
            </form>
            <div id="message" class="message"></div>
        </div>
        <div class="card" id="resultsCard" style="display:none">
            <div class="table-wrap">
                <table>
                    <thead><tr><th>Name</th><th>Type</th><th>Hospital</th><th>Address</th><th>Phone</th><th>Availability</th><th></th></tr></thead>
                    <tbody id="resultsBody"></tbody>
                </table>
            </div>
        </div>
    </div>
    <script src="/js/common.js"></script>
    <script src="/js/vaccine.js"></script>
</body>
</html>
```

### `public/js/blood-bank.js`

```js
/**
 * Blood bank page script (Member 6).
 */
const resultsBody = document.getElementById( 'resultsBody' );

/**
 * Makes the availability label for one blood bank row.
 *
 * @param {number|null} units Units of the searched group (null if no group was chosen).
 * @returns {string} HTML label.
 */
function availabilityLabel( units ) {
	if ( units === null ) {
		return '-';
	}
	if ( units > 0 ) {
		return '<span class="badge green">Available (' + units + ' units)</span>';
	}
	return '<span class="badge red">Currently unavailable</span>';
}

document.getElementById( 'searchForm' ).addEventListener( 'submit', async ( event ) => {
	event.preventDefault();
	// buildQuery uses encodeURIComponent, so "O+" is sent as "O%2B" and the "+" is not lost.
	const query = buildQuery( {
		bloodGroup: document.getElementById( 'bloodGroup' ).value,
		city: document.getElementById( 'city' ).value.trim(),
		area: document.getElementById( 'area' ).value.trim(),
	} );
	const result = await sendJson( 'GET', '/api/blood-banks/search?' + query );

	if ( result.status !== 200 ) {
		showMessage( 'message', result.body.message, 'error' );
		document.getElementById( 'resultsCard' ).style.display = 'none';
		return;
	}
	showMessage( 'message', result.body.message || result.body.data.length + ' blood bank(s) found.', result.body.message ? 'error' : 'info' );

	let html = '';
	result.body.data.forEach( ( bank ) => {
		html += '<tr><td>' + escapeHtml( bank.name ) + '</td><td>' + escapeHtml( bank.address ) + '</td>'
			+ '<td>' + escapeHtml( bank.phone ) + '</td><td>' + availabilityLabel( bank.units ) + '</td>'
			+ '<td><button type="button" class="detailsButton" data-id="' + bank.id + '">Details</button></td></tr>';
	} );
	resultsBody.innerHTML = html;
	document.getElementById( 'resultsCard' ).style.display = result.body.data.length > 0 ? 'block' : 'none';
} );

resultsBody.addEventListener( 'click', async ( event ) => {
	if ( !event.target.classList.contains( 'detailsButton' ) ) {
		return;
	}
	const result = await sendJson( 'GET', '/api/blood-banks/' + event.target.dataset.id );
	if ( result.status !== 200 ) {
		showMessage( 'message', result.body.message, 'error' );
		return;
	}
	const bank = result.body.data.bloodBank;
	let html = '<p><strong>' + escapeHtml( bank.name ) + '</strong></p><p>' + escapeHtml( bank.address )
		+ ' - Phone: ' + escapeHtml( bank.phone ) + '</p><p>Available blood groups:</p>';
	result.body.data.inventory.forEach( ( item ) => {
		html += item.units > 0
			? '<span class="badge green" style="margin:3px">' + escapeHtml( item.blood_group ) + ': ' + item.units + '</span> '
			: '<span class="badge red" style="margin:3px">' + escapeHtml( item.blood_group ) + ': 0</span> ';
	} );
	document.getElementById( 'detailsBox' ).innerHTML = html;
	document.getElementById( 'detailsCard' ).style.display = 'block';
} );
```

### `public/js/vaccine.js`

```js
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
```

### `tests/unit/blood-vaccine.test.js`

```js
import { describe, it, expect } from 'vitest';
import bloodBankController from '../../controllers/blood-bank-controller.js';

const { normalizeBloodGroup, isValidBloodGroup } = bloodBankController;

describe( 'Member 6 - blood group helpers', () => {
	it( 'accepts the 8 real blood groups', () => {
		[ 'A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-' ].forEach( ( group ) => {
			expect( isValidBloodGroup( group ) ).toBe( true );
		} );
	} );

	it( 'accepts empty (any group) and rejects fake groups', () => {
		expect( isValidBloodGroup( '' ) ).toBe( true );
		expect( isValidBloodGroup( 'C+' ) ).toBe( false );
		expect( isValidBloodGroup( 'O' ) ).toBe( false );
	} );

	it( 'turns a space back into + (browsers change "+" to a space in URLs)', () => {
		expect( normalizeBloodGroup( 'O ' ) ).toBe( 'O+' );
		expect( normalizeBloodGroup( 'AB-' ) ).toBe( 'AB-' );
		expect( normalizeBloodGroup( undefined ) ).toBe( '' );
	} );
} );
```

### `tests/integration/blood-vaccine.test.js`

```js
import { describe, it, expect } from 'vitest';
import request from 'supertest';
import app from '../../app.js';

describe( 'Member 6 - Blood bank API', () => {
	it( 'finds O+ blood in Dhaka with units available', async () => {
		const response = await request( app ).get( '/api/blood-banks/search' ).query( { bloodGroup: 'O+', city: 'Dhaka' } );
		expect( response.status ).toBe( 200 );
		expect( response.body.data[ 0 ].units ).toBeGreaterThan( 0 );
	} );

	it( 'tells the user when the group exists but is out of stock', async () => {
		const response = await request( app ).get( '/api/blood-banks/search' ).query( { bloodGroup: 'AB-', city: 'Savar' } );
		expect( response.status ).toBe( 200 );
		expect( response.body.message ).toBe( 'The requested blood group is currently unavailable.' );
	} );

	it( 'returns "No blood available." when no blood bank matches', async () => {
		const response = await request( app ).get( '/api/blood-banks/search' ).query( { city: 'Atlantis' } );
		expect( response.body.message ).toBe( 'No blood available.' );
		expect( response.body.data ).toEqual( [] );
	} );

	it( 'rejects a fake blood group (400)', async () => {
		const response = await request( app ).get( '/api/blood-banks/search' ).query( { bloodGroup: 'ZZ' } );
		expect( response.status ).toBe( 400 );
	} );

	it( 'shows blood bank details with all 8 blood groups', async () => {
		const response = await request( app ).get( '/api/blood-banks/1' );
		expect( response.status ).toBe( 200 );
		expect( response.body.data.inventory.length ).toBe( 8 );
	} );

	it( 'returns 404 for an unknown blood bank', async () => {
		const response = await request( app ).get( '/api/blood-banks/9999' );
		expect( response.status ).toBe( 404 );
	} );
} );

describe( 'Member 6 - Vaccine and anti-venom API', () => {
	it( 'finds the rabies vaccine and the hospitals that keep it', async () => {
		const response = await request( app ).get( '/api/vaccines/search' ).query( { name: 'Rabies' } );
		expect( response.status ).toBe( 200 );
		response.body.data.forEach( ( item ) => {
			expect( item.vaccine_name ).toContain( 'Rabies' );
			expect( item ).toHaveProperty( 'hospital_name' );
		} );
	} );

	it( 'filters by type (Anti-venom)', async () => {
		const response = await request( app ).get( '/api/vaccines/search' ).query( { category: 'Anti-venom' } );
		response.body.data.forEach( ( item ) => {
			expect( item.category ).toBe( 'Anti-venom' );
		} );
	} );

	it( 'tells the user when everything found is out of stock', async () => {
		const response = await request( app ).get( '/api/vaccines/search' ).query( { name: 'Scorpion', location: 'Khulna' } );
		expect( response.body.message ).toBe( 'The searched vaccine or anti-venom is currently unavailable.' );
	} );

	it( 'returns the "not found" message', async () => {
		const response = await request( app ).get( '/api/vaccines/search' ).query( { name: 'Unicorn' } );
		expect( response.body.message ).toBe( 'No vaccine or anti-venom found.' );
	} );

	it( 'rejects invalid input (400)', async () => {
		const response = await request( app ).get( '/api/vaccines/search' ).query( { category: 'Candy' } );
		expect( response.status ).toBe( 400 );
	} );
} );
```



## 5. Viva explanation

### 5.1 The journey of one request (Search O+ blood in Dhaka)

1. On `blood-bank.html` the user picks `O+`, types `Dhaka`, clicks Search.
2. `blood-bank.js` builds the query with `buildQuery`. It uses `encodeURIComponent`, so `O+` is sent as `O%2B`. (A plain `+` in a URL means "space" and the plus would be lost.)
3. `app.js` -> `blood-bank-routes.js` -> `bloodBankController.searchBloodBanks`.
4. The controller fixes and checks the blood group (`normalizeBloodGroup`, `isValidBloodGroup`) and the texts (`isValidSearchText`).
5. The Model runs one SQL with a `LEFT JOIN` and returns banks + units of that group.
6. The controller chooses the message: no banks -> "No blood available."; banks found but all with 0 units -> "The requested blood group is currently unavailable."
7. The page draws green "Available (12 units)" or red "Currently unavailable" labels.

### 5.2 Why is each piece where it is?

| Question | Answer |
|---|---|
| **Why Model?** | Only SQL with JOINs: blood banks + stock, vaccines + hospitals + stock. No `req`/`res`. |
| **Why Controller?** | It validates the blood group and texts, and decides which SRS message to send (none found vs. found but out of stock). That is a business rule. |
| **Why View?** | HTML forms and tables; the page JS creates badges and the details panel. |
| **Why Route?** | `/search` first, `/:id` second. Read-only, so no login needed (emergency information must be easy to reach). |

### 5.3 The SQL, explained

| SQL | Business meaning |
|---|---|
| `SELECT bb.*, inv.units FROM blood_banks bb LEFT JOIN blood_inventory inv ON inv.blood_bank_id = bb.id AND inv.blood_group = ? WHERE 1 = 1 [AND bb.city LIKE ?] [AND bb.area LIKE ?] ORDER BY inv.units DESC, bb.name` | List blood banks and the units of the chosen group. **LEFT JOIN** keeps a bank even if it has no row for that group (units = null). Banks with the most blood come first. If no group is chosen, `null` never matches, so units stay null. |
| `SELECT * FROM blood_banks WHERE id = ?` and `SELECT blood_group, units FROM blood_inventory WHERE blood_bank_id = ?` | Blood bank details and the stock of all 8 groups. |
| `SELECT v.name, v.category, vs.quantity, h.name, h.address, h.phone FROM vaccine_stock vs JOIN vaccines v ... JOIN hospitals h ... WHERE v.name LIKE ? [AND v.category = ?] [AND (h.city LIKE ? OR h.district LIKE ? OR h.address LIKE ?)]` | One row per hospital + vaccine. Three tables are joined because the stock table only has two ids (`hospital_id`, `vaccine_id`). |

### 5.4 Block by block

- **`BLOOD_GROUPS` and `isValidBloodGroup`**: only the 8 real groups (or empty = any) are accepted. Fake groups give 400.
- **`normalizeBloodGroup`**: if someone types `?bloodGroup=O+` in the address bar, the server receives `O ` (space). We turn the space back into `+`. The page itself never needs this because `encodeURIComponent` is used.
- **Two "empty" messages**: `data.length === 0` -> "No blood available." / "No vaccine or anti-venom found." Found but all zero -> "...currently unavailable." Both come from the SRS.
- **`UNIQUE (blood_bank_id, blood_group)`** in the table: one stock row per group per bank (no duplicates).
- **Seed data formula**: demo stock is generated by `MOD(...)` so some groups are 0 (out of stock) to show the "unavailable" case.
- **`availabilityLabel`** (page JS): turns a number into a green or red badge.
- **`/hospital-search.html?id=...`**: the vaccine page links to Member 2's page for full hospital details. We reuse it instead of copying it.

### 5.5 Tests

- **Unit**: `isValidBloodGroup` (8 good groups, empty OK, `C+` and `O` rejected) and `normalizeBloodGroup` (`O ` -> `O+`).
- **Integration**: O+ in Dhaka has units; AB- in Savar gives "currently unavailable"; unknown city gives "No blood available."; fake group 400; details have 8 groups; unknown id 404. Vaccines: name search, type filter, "currently unavailable" (Scorpion in Khulna), "not found", invalid type 400.

### 5.6 Questions the teacher may ask

**Q: What is the difference between JOIN and LEFT JOIN? Why LEFT JOIN here?**
A: `JOIN` keeps only rows that match in both tables. `LEFT JOIN` keeps every row from the left table (blood banks) even when there is no match. We need that to show a bank that has no stock row for the group, as "unavailable" instead of hiding it.

**Q: Why does the page use `encodeURIComponent`?**
A: In URLs `+` means space. `O+` would arrive as `O `. `encodeURIComponent( 'O+' )` gives `O%2B`, and the server decodes it correctly back to `O+`.

**Q: How do you know the user did not send a fake blood group?**
A: `isValidBloodGroup` checks it against the list of 8. Anything else gets 400 before any SQL runs.

**Q: What is the difference between "No blood available." and "currently unavailable"?**
A: The first means no blood bank matched the search at all. The second means blood banks matched, but they have 0 units of that group. Both messages are in the SRS.

**Q: Why is this search public (no login)?**
A: In an emergency people should not have to log in. These routes only read public information. Changing data needs login and a role.

**Q: Why does the vaccine search join three tables?**
A: `vaccine_stock` only stores two ids and a quantity. To show the vaccine name and hospital address we join `vaccines` and `hospitals`. This keeps the data in one place each (no copies).

**Q: How is SQL injection prevented?**
A: Texts are validated by `isValidSearchText`, and all values go into `?` placeholders. The category is also checked against the allowed list.

**Q: Where does the data come from, and is it correct?**
A: Demo data from `database/07-blood-banks.sql` and `08-vaccines.sql`. The SRS says real data must be updated by blood bank staff; we did not build the update screens (future work).

### 5.7 Demo script (2 minutes)

1. Blood page: group `O+`, city `Dhaka` -> green badge. Click Details -> all 8 groups.
2. Group `AB-`, city `Savar` -> "The requested blood group is currently unavailable."
3. City `Atlantis` -> "No blood available."
4. Vaccine page: name `Rabies` -> hospitals with quantities. Choose type Anti-venom. Search `Scorpion` + `Khulna` -> unavailable message. Click **Hospital details**.
5. Open the address bar and type `/api/blood-banks/search?bloodGroup=O+` -> JSON still works (explain `normalizeBloodGroup`).
