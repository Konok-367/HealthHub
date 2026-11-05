# Member 2 - Hospital Search, ICU/CCU Search and Hospital Recommendation

**SRS parts:** 3.1.3 Hospital Search, 3.1.9 Search ICU & CCU, 3.1.10 Hospital Recommendation · **Database table:** `hospitals` (also read by Members 3, 5 and 6).

## 1. What you are responsible for

- Search hospitals by name, city, district; show beds, ICU, departments, hours; show one hospital's full details.
- Search ICU/CCU availability with a filter (ICU, CCU or both).
- Recommend hospitals by city, specialty, maximum cost and emergency need, sorted by rating; compare hospitals side by side.

## 2. Files you own

| File | Layer |
|---|---|
| `models/hospital-model.js` | Model |
| `controllers/hospital-controller.js` | Controller |
| `routes/hospital-routes.js` | Route |
| `views/hospital-search.html`, `views/icu-search.html`, `views/recommendation.html` | View |
| `public/js/hospital-search.js`, `public/js/icu-search.js`, `public/js/recommendation.js` | View logic |
| `tests/unit/hospital.test.js`, `tests/integration/hospital.test.js` | Tests |

## 3. Branch and commands

```bash
git checkout main
git pull origin main
git checkout -b feature/member-2-hospitals
# ...paste your files...
git add models/hospital-model.js controllers/hospital-controller.js routes/hospital-routes.js
git add views/hospital-search.html views/icu-search.html views/recommendation.html
git add public/js/hospital-search.js public/js/icu-search.js public/js/recommendation.js
git add tests/unit/hospital.test.js tests/integration/hospital.test.js
git commit -m "feat(hospitals): add hospital search, ICU/CCU search and recommendation"
git push -u origin feature/member-2-hospitals
```

## 4. Code (copy-paste)

Create each file with exactly this name and content. They are in the order: Model, Controller, Route, View, page script, tests.

### `models/hospital-model.js`

```js
/**
 * Hospital Model (Member 2).
 * All SQL for hospital search, ICU/CCU search and recommendation lives here.
 * User input is NEVER joined into the SQL text. It always goes into the params list (the ? marks).
 *
 * @module hospitalModel
 */
const pool = require( '../config/db' );

/**
 * Builds the SQL for a hospital search (pure function, easy to unit test).
 *
 * @param {Object} filters Optional name, city, district.
 * @returns {{sql: string, params: Array}} SQL text and the values for the ? marks.
 */
function buildHospitalSearch( filters ) {
	let sql = 'SELECT * FROM hospitals WHERE 1 = 1';
	const params = [];

	if ( filters.name ) {
		sql += ' AND name LIKE ?';
		params.push( '%' + filters.name + '%' );
	}
	if ( filters.city ) {
		sql += ' AND city LIKE ?';
		params.push( '%' + filters.city + '%' );
	}
	if ( filters.district ) {
		sql += ' AND district LIKE ?';
		params.push( '%' + filters.district + '%' );
	}
	sql += ' ORDER BY name';

	return { sql: sql, params: params };
}

/**
 * Searches hospitals by name, city and/or district.
 *
 * @async
 * @param {Object} filters Optional name, city, district.
 * @returns {Promise<Array>} Matching hospitals.
 */
async function searchHospitals( filters ) {
	const query = buildHospitalSearch( filters );
	const [ rows ] = await pool.execute( query.sql, query.params );
	return rows;
}

/**
 * Gets one hospital with all its details.
 *
 * @async
 * @param {number} id Hospital id.
 * @returns {Promise<Object|null>} Hospital row or null.
 */
async function getHospitalById( id ) {
	const [ rows ] = await pool.execute( 'SELECT * FROM hospitals WHERE id = ?', [ id ] );
	return rows[ 0 ] || null;
}

/**
 * Finds hospitals by ICU / CCU availability.
 *
 * @async
 * @param {string} keyword Text matched with name, city or district.
 * @param {string} filter '' (all), 'icu', 'ccu' or 'both'.
 * @returns {Promise<Array>} Matching hospitals.
 */
async function searchCriticalCare( keyword, filter ) {
	let sql = 'SELECT id, name, city, district, address, phone, icu_available, ccu_available '
		+ 'FROM hospitals WHERE 1 = 1';
	const params = [];

	if ( keyword ) {
		sql += ' AND (name LIKE ? OR city LIKE ? OR district LIKE ?)';
		const pattern = '%' + keyword + '%';
		params.push( pattern, pattern, pattern );
	}
	// These conditions are fixed text (no user input), so they are safe to add.
	if ( filter === 'icu' ) {
		sql += ' AND icu_available > 0';
	} else if ( filter === 'ccu' ) {
		sql += ' AND ccu_available > 0';
	} else if ( filter === 'both' ) {
		sql += ' AND icu_available > 0 AND ccu_available > 0';
	}
	sql += ' ORDER BY name';

	const [ rows ] = await pool.execute( sql, params );
	return rows;
}

/**
 * Recommends hospitals: best rating first, then the cheaper one.
 *
 * @async
 * @param {Object} filters city, specialty, maxCost (number or null), emergency (boolean).
 * @returns {Promise<Array>} Recommended hospitals.
 */
async function recommendHospitals( filters ) {
	let sql = 'SELECT * FROM hospitals WHERE 1 = 1';
	const params = [];

	if ( filters.city ) {
		sql += ' AND (city LIKE ? OR district LIKE ?)';
		params.push( '%' + filters.city + '%', '%' + filters.city + '%' );
	}
	if ( filters.specialty ) {
		sql += ' AND departments LIKE ?';
		params.push( '%' + filters.specialty + '%' );
	}
	if ( filters.maxCost ) {
		sql += ' AND treatment_cost <= ?';
		params.push( filters.maxCost );
	}
	if ( filters.emergency ) {
		sql += ' AND departments LIKE ? AND (icu_available > 0 OR ccu_available > 0)';
		params.push( '%Emergency%' );
	}
	sql += ' ORDER BY rating DESC, treatment_cost ASC';

	const [ rows ] = await pool.execute( sql, params );
	return rows;
}

module.exports = {
	buildHospitalSearch,
	searchHospitals,
	getHospitalById,
	searchCriticalCare,
	recommendHospitals,
};
```

### `controllers/hospital-controller.js`

```js
/**
 * Hospital Controller (Member 2): hospital search, details, ICU/CCU search, recommendation.
 *
 * @module hospitalController
 */
const hospitalModel = require( '../models/hospital-model' );
const { isValidSearchText, isPositiveInteger } = require( '../utils/validators' );

const INVALID_SEARCH_MESSAGE = 'Please provide valid search criteria.';
const SERVER_ERROR_MESSAGE = 'Hospital information could not be retrieved. Please try again later.';
const CRITICAL_CARE_FILTERS = [ '', 'icu', 'ccu', 'both' ];

/**
 * Checks that every search text in the list is valid.
 *
 * @param {Array<string>} texts Search texts from the query string.
 * @returns {boolean} True when all are valid.
 */
function areSearchTextsValid( texts ) {
	return texts.every( ( text ) => isValidSearchText( text ) );
}

/**
 * GET /api/hospitals/search?name=&city=&district=
 *
 * @async
 * @param {Object} req Express request.
 * @param {Object} res Express response.
 */
async function searchHospitals( req, res ) {
	try {
		const { name, city, district } = req.query;
		if ( !areSearchTextsValid( [ name, city, district ] ) ) {
			return res.status( 400 ).json( { success: false, message: INVALID_SEARCH_MESSAGE } );
		}

		const hospitals = await hospitalModel.searchHospitals( { name, city, district } );
		if ( hospitals.length === 0 ) {
			return res.status( 200 ).json( {
				success: true,
				message: 'No hospitals found for the selected search criteria.',
				data: [],
			} );
		}
		return res.status( 200 ).json( { success: true, data: hospitals } );
	} catch ( error ) {
		console.error( error );
		return res.status( 500 ).json( { success: false, message: SERVER_ERROR_MESSAGE } );
	}
}

/**
 * GET /api/hospitals/:id - full details of one hospital.
 *
 * @async
 * @param {Object} req Express request.
 * @param {Object} res Express response.
 */
async function getHospitalDetails( req, res ) {
	try {
		if ( !isPositiveInteger( req.params.id ) ) {
			return res.status( 400 ).json( { success: false, message: 'Invalid hospital id.' } );
		}
		const hospital = await hospitalModel.getHospitalById( Number( req.params.id ) );
		if ( hospital === null ) {
			return res.status( 404 ).json( { success: false, message: 'Hospital not found.' } );
		}
		return res.status( 200 ).json( { success: true, data: hospital } );
	} catch ( error ) {
		console.error( error );
		return res.status( 500 ).json( { success: false, message: SERVER_ERROR_MESSAGE } );
	}
}

/**
 * GET /api/hospitals/critical-care?keyword=&filter=icu|ccu|both
 *
 * @async
 * @param {Object} req Express request.
 * @param {Object} res Express response.
 */
async function searchCriticalCare( req, res ) {
	try {
		const keyword = req.query.keyword;
		const filter = req.query.filter || '';
		if ( !isValidSearchText( keyword ) || !CRITICAL_CARE_FILTERS.includes( filter ) ) {
			return res.status( 400 ).json( { success: false, message: INVALID_SEARCH_MESSAGE } );
		}

		const hospitals = await hospitalModel.searchCriticalCare( keyword, filter );
		if ( hospitals.length === 0 ) {
			return res.status( 200 ).json( { success: true, message: 'No hospitals found.', data: [] } );
		}
		return res.status( 200 ).json( { success: true, data: hospitals } );
	} catch ( error ) {
		console.error( error );
		return res.status( 500 ).json( { success: false, message: SERVER_ERROR_MESSAGE } );
	}
}

/**
 * GET /api/hospitals/recommend?city=&specialty=&maxCost=&emergency=true
 *
 * @async
 * @param {Object} req Express request.
 * @param {Object} res Express response.
 */
async function recommendHospitals( req, res ) {
	try {
		const { city, specialty, maxCost, emergency } = req.query;
		const isCostValid = maxCost === undefined || maxCost === '' || isPositiveInteger( maxCost );
		if ( !areSearchTextsValid( [ city, specialty ] ) || !isCostValid ) {
			return res.status( 400 ).json( { success: false, message: INVALID_SEARCH_MESSAGE } );
		}

		const hospitals = await hospitalModel.recommendHospitals( {
			city: city,
			specialty: specialty,
			maxCost: maxCost ? Number( maxCost ) : null,
			emergency: emergency === 'true',
		} );

		if ( hospitals.length === 0 ) {
			const message = specialty
				? 'The required specialty is not available. No recommended hospitals found.'
				: 'No recommended hospitals found.';
			return res.status( 200 ).json( { success: true, message: message, data: [] } );
		}
		return res.status( 200 ).json( { success: true, data: hospitals } );
	} catch ( error ) {
		console.error( error );
		return res.status( 500 ).json( { success: false, message: SERVER_ERROR_MESSAGE } );
	}
}

module.exports = {
	areSearchTextsValid,
	searchHospitals,
	getHospitalDetails,
	searchCriticalCare,
	recommendHospitals,
};
```

### `routes/hospital-routes.js`

```js
/**
 * Hospital routes (Member 2). Mounted at /api/hospitals in app.js.
 * Fixed words (search, critical-care, recommend) come BEFORE '/:id',
 * otherwise Express would treat the word "search" as an id.
 */
const express = require( 'express' );
const hospitalController = require( '../controllers/hospital-controller' );

const router = express.Router();

router.get( '/search', hospitalController.searchHospitals );
router.get( '/critical-care', hospitalController.searchCriticalCare );
router.get( '/recommend', hospitalController.recommendHospitals );
router.get( '/:id', hospitalController.getHospitalDetails );

module.exports = router;
```

### `views/hospital-search.html`

```html
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Hospital Search - HealthHub</title>
    <link rel="stylesheet" href="/css/style.css">
</head>
<body>
    <div id="navbar"></div>
    <div class="container">
        <div class="card">
            <h1>Hospital Search</h1>
            <form id="searchForm" class="inline-form">
                <div class="form-row"><label for="name">Hospital name</label><input type="text" id="name"></div>
                <div class="form-row"><label for="city">City</label><input type="text" id="city"></div>
                <div class="form-row"><label for="district">District</label><input type="text" id="district"></div>
                <button type="submit">Search</button>
            </form>
            <div id="message" class="message"></div>
        </div>
        <div class="card" id="resultsCard" style="display:none">
            <h2>Results</h2>
            <div class="table-wrap">
                <table>
                    <thead>
                        <tr><th>Name</th><th>City</th><th>Phone</th><th>Available beds</th><th>ICU beds</th><th></th></tr>
                    </thead>
                    <tbody id="resultsBody"></tbody>
                </table>
            </div>
        </div>
        <div class="card" id="detailsCard" style="display:none">
            <h2>Hospital details</h2>
            <div id="detailsBox"></div>
        </div>
    </div>
    <script src="/js/common.js"></script>
    <script src="/js/hospital-search.js"></script>
</body>
</html>
```

### `views/icu-search.html`

```html
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>ICU and CCU Search - HealthHub</title>
    <link rel="stylesheet" href="/css/style.css">
</head>
<body>
    <div id="navbar"></div>
    <div class="container">
        <div class="card">
            <h1>ICU and CCU Availability</h1>
            <form id="searchForm" class="inline-form">
                <div class="form-row"><label for="keyword">Hospital, city or area</label><input type="text" id="keyword"></div>
                <div class="form-row">
                    <label for="filter">Show</label>
                    <select id="filter">
                        <option value="">All hospitals</option>
                        <option value="icu">ICU available</option>
                        <option value="ccu">CCU available</option>
                        <option value="both">ICU and CCU available</option>
                    </select>
                </div>
                <button type="submit">Search</button>
            </form>
            <div id="message" class="message"></div>
        </div>
        <div class="card" id="resultsCard" style="display:none">
            <div class="table-wrap">
                <table>
                    <thead><tr><th>Hospital</th><th>Address</th><th>Phone</th><th>ICU</th><th>CCU</th><th></th></tr></thead>
                    <tbody id="resultsBody"></tbody>
                </table>
            </div>
        </div>
    </div>
    <script src="/js/common.js"></script>
    <script src="/js/icu-search.js"></script>
</body>
</html>
```

### `views/recommendation.html`

```html
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Hospital Recommendation - HealthHub</title>
    <link rel="stylesheet" href="/css/style.css">
</head>
<body>
    <div id="navbar"></div>
    <div class="container">
        <div class="card">
            <h1>Hospital Recommendation</h1>
            <form id="recommendForm" class="inline-form">
                <div class="form-row"><label for="city">Your city</label><input type="text" id="city"></div>
                <div class="form-row">
                    <label for="specialty">Specialty needed</label>
                    <select id="specialty">
                        <option value="">Any</option>
                        <option>Cardiology</option>
                        <option>Neurology</option>
                        <option>Orthopedics</option>
                        <option>Pediatrics</option>
                        <option>Gynecology</option>
                        <option>Oncology</option>
                        <option>General Medicine</option>
                        <option>Dermatology</option>
                    </select>
                </div>
                <div class="form-row"><label for="maxCost">Max treatment cost (BDT)</label><input type="number" id="maxCost" min="1"></div>
                <div class="form-row"><label><input type="checkbox" id="emergency" style="width:auto"> Emergency (needs ICU/CCU)</label></div>
                <button type="submit">Recommend</button>
            </form>
            <div id="message" class="message"></div>
        </div>
        <div class="card" id="resultsCard" style="display:none">
            <h2>Recommended hospitals (best rating first)</h2>
            <div class="table-wrap">
                <table>
                    <thead><tr><th>Compare</th><th>Name</th><th>City</th><th>Rating</th><th>Cost (BDT)</th><th>ICU</th><th>CCU</th></tr></thead>
                    <tbody id="resultsBody"></tbody>
                </table>
            </div>
            <p><button type="button" id="compareButton">Compare selected</button></p>
        </div>
        <div class="card" id="compareCard" style="display:none">
            <h2>Comparison</h2>
            <div class="table-wrap" id="compareBox"></div>
        </div>
    </div>
    <script src="/js/common.js"></script>
    <script src="/js/recommendation.js"></script>
</body>
</html>
```

### `public/js/hospital-search.js`

```js
/**
 * Hospital search page script (Member 2).
 */
const searchForm = document.getElementById( 'searchForm' );
const resultsBody = document.getElementById( 'resultsBody' );
let hospitalList = [];

/**
 * Shows the hospitals in the results table.
 *
 * @param {Array} hospitals Hospital rows from the API.
 */
function showResults( hospitals ) {
	hospitalList = hospitals;
	let html = '';
	hospitals.forEach( ( hospital ) => {
		html += '<tr>'
			+ '<td>' + escapeHtml( hospital.name ) + '</td>'
			+ '<td>' + escapeHtml( hospital.city ) + '</td>'
			+ '<td>' + escapeHtml( hospital.phone ) + '</td>'
			+ '<td>' + hospital.available_beds + '</td>'
			+ '<td>' + hospital.icu_available + '</td>'
			+ '<td><button type="button" class="detailsButton" data-id="' + hospital.id + '">Details</button></td>'
			+ '</tr>';
	} );
	resultsBody.innerHTML = html;
	document.getElementById( 'resultsCard' ).style.display = hospitals.length > 0 ? 'block' : 'none';
}

/**
 * Loads and shows the complete details of one hospital.
 *
 * @param {number} id Hospital id.
 */
async function showDetails( id ) {
	const result = await sendJson( 'GET', '/api/hospitals/' + id );
	if ( result.status !== 200 ) {
		showMessage( 'message', result.body.message, 'error' );
		return;
	}
	const h = result.body.data;
	document.getElementById( 'detailsBox' ).innerHTML = '<p><strong>' + escapeHtml( h.name ) + '</strong></p>'
		+ '<p>Address: ' + escapeHtml( h.address ) + ', ' + escapeHtml( h.city ) + ', ' + escapeHtml( h.district ) + '</p>'
		+ '<p>Phone: ' + escapeHtml( h.phone ) + '</p>'
		+ '<p>Departments: ' + escapeHtml( h.departments ) + '</p>'
		+ '<p>Opening hours: ' + escapeHtml( h.opening_hours ) + '</p>'
		+ '<p>Beds: ' + h.available_beds + ' available of ' + h.total_beds + '</p>'
		+ '<p>ICU beds available: ' + h.icu_available + '</p>';
	document.getElementById( 'detailsCard' ).style.display = 'block';
}

searchForm.addEventListener( 'submit', async ( event ) => {
	event.preventDefault();
	const query = buildQuery( {
		name: document.getElementById( 'name' ).value.trim(),
		city: document.getElementById( 'city' ).value.trim(),
		district: document.getElementById( 'district' ).value.trim(),
	} );
	const result = await sendJson( 'GET', '/api/hospitals/search?' + query );

	if ( result.status !== 200 ) {
		showMessage( 'message', result.body.message, 'error' );
		showResults( [] );
		return;
	}
	showMessage( 'message', result.body.message || result.body.data.length + ' hospital(s) found.', 'info' );
	showResults( result.body.data );
} );

// One listener for all "Details" buttons (event delegation).
resultsBody.addEventListener( 'click', ( event ) => {
	if ( event.target.classList.contains( 'detailsButton' ) ) {
		showDetails( event.target.dataset.id );
	}
} );

// Other pages can link here with ?id=3 to open one hospital directly.
const idFromUrl = new URLSearchParams( window.location.search ).get( 'id' );
if ( idFromUrl ) {
	showDetails( idFromUrl );
}
```

### `public/js/icu-search.js`

```js
/**
 * ICU / CCU search page script (Member 2).
 */
const searchForm = document.getElementById( 'searchForm' );

/**
 * Makes a coloured label for a bed count.
 *
 * @param {number} count Number of free beds.
 * @returns {string} HTML for the label.
 */
function bedBadge( count ) {
	if ( count > 0 ) {
		return '<span class="badge green">' + count + ' available</span>';
	}
	return '<span class="badge red">Not available</span>';
}

searchForm.addEventListener( 'submit', async ( event ) => {
	event.preventDefault();
	const query = buildQuery( {
		keyword: document.getElementById( 'keyword' ).value.trim(),
		filter: document.getElementById( 'filter' ).value,
	} );
	const result = await sendJson( 'GET', '/api/hospitals/critical-care?' + query );

	if ( result.status !== 200 ) {
		showMessage( 'message', result.body.message, 'error' );
		document.getElementById( 'resultsCard' ).style.display = 'none';
		return;
	}
	showMessage( 'message', result.body.message || result.body.data.length + ' hospital(s) found.', 'info' );

	let html = '';
	result.body.data.forEach( ( hospital ) => {
		html += '<tr>'
			+ '<td>' + escapeHtml( hospital.name ) + '</td>'
			+ '<td>' + escapeHtml( hospital.address ) + '</td>'
			+ '<td>' + escapeHtml( hospital.phone ) + '</td>'
			+ '<td>' + bedBadge( hospital.icu_available ) + '</td>'
			+ '<td>' + bedBadge( hospital.ccu_available ) + '</td>'
			+ '<td><a href="/hospital-search.html?id=' + hospital.id + '">Full details</a></td>'
			+ '</tr>';
	} );
	document.getElementById( 'resultsBody' ).innerHTML = html;
	document.getElementById( 'resultsCard' ).style.display = result.body.data.length > 0 ? 'block' : 'none';
} );
```

### `public/js/recommendation.js`

```js
/**
 * Hospital recommendation page script (Member 2).
 */
const recommendForm = document.getElementById( 'recommendForm' );
let recommendedHospitals = [];

recommendForm.addEventListener( 'submit', async ( event ) => {
	event.preventDefault();
	const query = buildQuery( {
		city: document.getElementById( 'city' ).value.trim(),
		specialty: document.getElementById( 'specialty' ).value,
		maxCost: document.getElementById( 'maxCost' ).value,
		emergency: document.getElementById( 'emergency' ).checked ? 'true' : '',
	} );
	const result = await sendJson( 'GET', '/api/hospitals/recommend?' + query );

	document.getElementById( 'compareCard' ).style.display = 'none';
	if ( result.status !== 200 ) {
		showMessage( 'message', result.body.message, 'error' );
		document.getElementById( 'resultsCard' ).style.display = 'none';
		return;
	}
	showMessage( 'message', result.body.message || result.body.data.length + ' hospital(s) recommended.', 'info' );

	recommendedHospitals = result.body.data;
	let html = '';
	recommendedHospitals.forEach( ( hospital ) => {
		html += '<tr>'
			+ '<td><input type="checkbox" class="compareBox" value="' + hospital.id + '" style="width:auto"></td>'
			+ '<td>' + escapeHtml( hospital.name ) + '</td>'
			+ '<td>' + escapeHtml( hospital.city ) + '</td>'
			+ '<td>' + hospital.rating + ' / 5</td>'
			+ '<td>' + hospital.treatment_cost + '</td>'
			+ '<td>' + hospital.icu_available + '</td>'
			+ '<td>' + hospital.ccu_available + '</td>'
			+ '</tr>';
	} );
	document.getElementById( 'resultsBody' ).innerHTML = html;
	document.getElementById( 'resultsCard' ).style.display = recommendedHospitals.length > 0 ? 'block' : 'none';
} );

// Compare: builds a side-by-side table from the ticked hospitals (no server call needed).
document.getElementById( 'compareButton' ).addEventListener( 'click', () => {
	const ticked = Array.from( document.querySelectorAll( '.compareBox:checked' ) ).map( ( box ) => Number( box.value ) );
	const chosen = recommendedHospitals.filter( ( hospital ) => ticked.includes( hospital.id ) );
	if ( chosen.length < 2 ) {
		showMessage( 'message', 'Please tick at least two hospitals to compare.', 'error' );
		return;
	}
	const rows = [
		[ 'Rating', 'rating' ], [ 'Treatment cost (BDT)', 'treatment_cost' ], [ 'Departments', 'departments' ],
		[ 'Available beds', 'available_beds' ], [ 'ICU beds', 'icu_available' ], [ 'CCU beds', 'ccu_available' ],
		[ 'City', 'city' ],
	];
	let html = '<table><thead><tr><th>Feature</th>';
	chosen.forEach( ( hospital ) => {
		html += '<th>' + escapeHtml( hospital.name ) + '</th>';
	} );
	html += '</tr></thead><tbody>';
	rows.forEach( ( row ) => {
		html += '<tr><td><strong>' + row[ 0 ] + '</strong></td>';
		chosen.forEach( ( hospital ) => {
			html += '<td>' + escapeHtml( hospital[ row[ 1 ] ] ) + '</td>';
		} );
		html += '</tr>';
	} );
	html += '</tbody></table>';
	document.getElementById( 'compareBox' ).innerHTML = html;
	document.getElementById( 'compareCard' ).style.display = 'block';
} );
```

### `tests/unit/hospital.test.js`

```js
import { describe, it, expect } from 'vitest';
import hospitalModel from '../../models/hospital-model.js';
import hospitalController from '../../controllers/hospital-controller.js';

const { buildHospitalSearch } = hospitalModel;
const { areSearchTextsValid } = hospitalController;

describe( 'Member 2 - buildHospitalSearch', () => {
	it( 'has no filters and no params when nothing is typed', () => {
		const query = buildHospitalSearch( {} );
		expect( query.params ).toEqual( [] );
		expect( query.sql ).toContain( 'ORDER BY name' );
	} );

	it( 'puts the typed name in params, not inside the SQL text', () => {
		const query = buildHospitalSearch( { name: "x' OR '1'='1" } );
		expect( query.sql ).toContain( 'name LIKE ?' );
		expect( query.sql ).not.toContain( 'OR \'1\'' ); // SQL injection text never enters the SQL
		expect( query.params ).toEqual( [ "%x' OR '1'='1%" ] );
	} );

	it( 'adds one ? for each filter', () => {
		const query = buildHospitalSearch( { name: 'City', city: 'Dhaka', district: 'Dhaka' } );
		expect( query.params.length ).toBe( 3 );
	} );
} );

describe( 'Member 2 - areSearchTextsValid', () => {
	it( 'accepts normal and empty texts', () => {
		expect( areSearchTextsValid( [ 'Dhaka', '', undefined ] ) ).toBe( true );
	} );

	it( 'rejects a list that contains dangerous text', () => {
		expect( areSearchTextsValid( [ 'Dhaka', '<b>' ] ) ).toBe( false );
	} );
} );
```

### `tests/integration/hospital.test.js`

```js
import { describe, it, expect } from 'vitest';
import request from 'supertest';
import app from '../../app.js';

describe( 'Member 2 - Hospital search API', () => {
	it( 'finds hospitals by city (200)', async () => {
		const response = await request( app ).get( '/api/hospitals/search' ).query( { city: 'Dhaka' } );
		expect( response.status ).toBe( 200 );
		expect( response.body.data.length ).toBeGreaterThan( 0 );
		response.body.data.forEach( ( hospital ) => {
			expect( hospital.city ).toBe( 'Dhaka' );
		} );
	} );

	it( 'returns the "no hospitals" message when nothing matches', async () => {
		const response = await request( app ).get( '/api/hospitals/search' ).query( { name: 'Nonexistent' } );
		expect( response.status ).toBe( 200 );
		expect( response.body.data ).toEqual( [] );
		expect( response.body.message ).toBe( 'No hospitals found for the selected search criteria.' );
	} );

	it( 'rejects invalid search text (400)', async () => {
		const response = await request( app ).get( '/api/hospitals/search' ).query( { name: '<script>' } );
		expect( response.status ).toBe( 400 );
	} );

	it( 'is safe against SQL injection text (400, tables still exist)', async () => {
		const response = await request( app ).get( '/api/hospitals/search' ).query( { name: "' OR 1=1 --" } );
		expect( response.status ).toBe( 400 );
	} );

	it( 'returns the details of one hospital', async () => {
		const response = await request( app ).get( '/api/hospitals/1' );
		expect( response.status ).toBe( 200 );
		expect( response.body.data ).toHaveProperty( 'departments' );
		expect( response.body.data ).toHaveProperty( 'icu_available' );
	} );

	it( 'returns 404 for a hospital that does not exist', async () => {
		const response = await request( app ).get( '/api/hospitals/9999' );
		expect( response.status ).toBe( 404 );
	} );

	it( 'returns 400 for a bad id', async () => {
		const response = await request( app ).get( '/api/hospitals/abc' );
		expect( response.status ).toBe( 400 );
	} );
} );

describe( 'Member 2 - ICU / CCU search API', () => {
	it( 'with filter "both" only returns hospitals that have ICU and CCU', async () => {
		const response = await request( app ).get( '/api/hospitals/critical-care' ).query( { filter: 'both' } );
		expect( response.status ).toBe( 200 );
		expect( response.body.data.length ).toBeGreaterThan( 0 );
		response.body.data.forEach( ( hospital ) => {
			expect( hospital.icu_available ).toBeGreaterThan( 0 );
			expect( hospital.ccu_available ).toBeGreaterThan( 0 );
		} );
	} );

	it( 'rejects an unknown filter (400)', async () => {
		const response = await request( app ).get( '/api/hospitals/critical-care' ).query( { filter: 'xyz' } );
		expect( response.status ).toBe( 400 );
	} );
} );

describe( 'Member 2 - Hospital recommendation API', () => {
	it( 'recommends cardiology hospitals, best rating first', async () => {
		const response = await request( app ).get( '/api/hospitals/recommend' ).query( { specialty: 'Cardiology' } );
		expect( response.status ).toBe( 200 );
		const ratings = response.body.data.map( ( hospital ) => Number( hospital.rating ) );
		const sorted = [ ...ratings ].sort( ( a, b ) => b - a );
		expect( ratings ).toEqual( sorted );
	} );

	it( 'respects the maximum cost', async () => {
		const response = await request( app ).get( '/api/hospitals/recommend' ).query( { maxCost: 5000 } );
		response.body.data.forEach( ( hospital ) => {
			expect( hospital.treatment_cost ).toBeLessThanOrEqual( 5000 );
		} );
	} );

	it( 'says no hospital is recommended when nothing matches', async () => {
		const response = await request( app ).get( '/api/hospitals/recommend' ).query( { specialty: 'Astrology' } );
		expect( response.status ).toBe( 200 );
		expect( response.body.data ).toEqual( [] );
	} );

	it( 'rejects a bad maximum cost (400)', async () => {
		const response = await request( app ).get( '/api/hospitals/recommend' ).query( { maxCost: 'cheap' } );
		expect( response.status ).toBe( 400 );
	} );
} );
```



## 5. Viva explanation

### 5.1 The journey of one request (Hospital search)

1. User fills City = "Dhaka" in `hospital-search.html`, clicks Search.
2. `hospital-search.js` builds `?city=Dhaka` with `buildQuery` and calls `GET /api/hospitals/search?city=Dhaka`.
3. `app.js` -> `hospital-routes.js` -> `hospitalController.searchHospitals`.
4. The controller checks the texts with `isValidSearchText`. Bad text -> 400.
5. The controller calls `hospitalModel.searchHospitals`, which builds the SQL with `buildHospitalSearch` and runs it.
6. The controller sends `{ success, data }` (or the "No hospitals found..." message).
7. The page draws the table rows.

### 5.2 Why is each piece where it is?

| Question | Answer |
|---|---|
| **Why Model?** | All SQL about hospitals (search, details, ICU, recommendation) is in `hospital-model.js`. It receives plain values and returns rows. It never touches `req` or `res`. |
| **Why Controller?** | It validates the search text, calls the right Model function, chooses the message ("No hospitals found...") and the status code (200, 400, 404, 500). |
| **Why View?** | HTML shows forms and tables. The page JS only builds the query string, calls the API and draws rows. The "Compare" table is made in the browser because it only re-arranges data the page already has. |
| **Why Route?** | It maps four URLs to four controller functions. Fixed words (`/search`, `/critical-care`, `/recommend`) are listed **before** `/:id`, otherwise Express would think "search" is an id. |

### 5.3 The SQL, explained

| SQL | Business meaning |
|---|---|
| `SELECT * FROM hospitals WHERE 1 = 1 [AND name LIKE ?] [AND city LIKE ?] [AND district LIKE ?] ORDER BY name` | Hospital search. `WHERE 1 = 1` is always true, so we can add `AND ...` parts only for the boxes the user filled. `LIKE '%text%'` means "contains". |
| `SELECT * FROM hospitals WHERE id = ?` | Full details of one hospital. |
| `SELECT ... WHERE (name LIKE ? OR city LIKE ? OR district LIKE ?) [AND icu_available > 0] [AND ccu_available > 0]` | ICU/CCU search. The user's keyword can be a name, city or district. The filter adds fixed conditions (`both` = ICU **and** CCU have free beds). |
| `... AND (city LIKE ? OR district LIKE ?) AND departments LIKE ? AND treatment_cost <= ? ... ORDER BY rating DESC, treatment_cost ASC` | Recommendation: keep hospitals in the city that have the specialty and cost not above the limit. Best rating first; if equal, the cheaper one first. With "emergency" it also needs the Emergency department and at least one ICU or CCU bed. |

### 5.4 Block by block

- **`buildHospitalSearch( filters )`**: a pure function that returns `{ sql, params }`. Pure means no database inside, so a unit test can check it. The test proves that a text like `x' OR '1'='1` ends up in `params`, **not** inside the SQL text.
- **`searchCriticalCare`**: the `filter` word (`icu`, `ccu`, `both`) picks a fixed piece of SQL from an `if` list. It is never copied from the user into the SQL.
- **`areSearchTextsValid( texts )`**: one helper that checks many texts. It uses `isValidSearchText` from `utils/validators.js`: letters, numbers, spaces, `. , ' -`, max 50 characters.
- **`recommendHospitals`**: `maxCost` is checked with `isPositiveInteger` and converted with `Number()`.
- **Error messages** are exactly the SRS texts: "No hospitals found for the selected search criteria.", "No hospitals found.", "No recommended hospitals found."
- **`showDetails( id )`** (page JS): calls `/api/hospitals/:id` and writes the details. The page also reads `?id=3` from the address, so other pages (ICU, vaccine) can link to one hospital.
- **Compare**: ticked checkboxes -> `filter` the already loaded list -> build a table where each hospital is a column.

### 5.5 Tests

- **Unit**: `buildHospitalSearch` (no filters, injection text stays in params, one `?` per filter) and `areSearchTextsValid`.
- **Integration (Supertest + real DB)**: city search returns only Dhaka hospitals; no match gives the message; `<script>` and `' OR 1=1 --` give 400; details 200 / 404 / 400; ICU filter `both` only returns hospitals with ICU > 0 and CCU > 0; recommendation is sorted by rating; max cost is respected.

### 5.6 Questions the teacher may ask

**Q: What does `WHERE 1 = 1` do? Is it a trick?**
A: It is always true. It lets every filter start with `AND`, so the code does not need to check "is this the first condition?".

**Q: How do you stop SQL injection in a search box?**
A: Two layers. First, `isValidSearchText` rejects strange characters (400). Second, the text goes into the `?` placeholder, never into the SQL string. Even if the first layer failed, the second one protects us.

**Q: Why `LIKE '%text%'` and why not `=`?**
A: Users type part of a name. `LIKE` with `%` on both sides means "contains".

**Q: Why are ICU numbers in the `hospitals` table and not a separate table?**
A: One place for the data means no two numbers can disagree (data integrity). The hospital search page and the ICU page both read the same columns.

**Q: How does recommendation decide the order?**
A: `ORDER BY rating DESC, treatment_cost ASC`: highest rating first, then cheaper. It is a simple rule, not machine learning.

**Q: SRS also mentions distance, GPS and patient reviews. Did you do it?**
A: No. We use the city typed by the user as "location", and we show the rating only. Distance needs a map service and reviews need another table. We list them as future work.

**Q: Why return 200 with an empty list instead of 404 when nothing is found?**
A: "No results" is a normal answer for a search, not an error. 404 is used when a specific thing (hospital id 9999) does not exist.

**Q: Why is `/:id` last in the route file?**
A: Express reads routes from top to bottom. If `/:id` was first, `/search` would match it with id = "search".

**Q: What is `escapeHtml` for?**
A: Hospital names go into `innerHTML`. If a name contained `<script>`, escaping turns it into harmless text (protection from XSS).

### 5.7 Demo script (2 minutes)

1. Hospital Search: type `Dhaka` in City -> 2 hospitals -> click Details.
2. Type `<script>` in name -> "Please provide valid search criteria."
3. ICU/CCU page: choose "ICU and CCU available" -> only hospitals with both.
4. Recommendation: Specialty Cardiology, max cost 9000 -> sorted by rating; tick two -> Compare.
5. Open DevTools -> Network tab -> show the `/api/hospitals/search?city=Dhaka` request and the JSON answer.
