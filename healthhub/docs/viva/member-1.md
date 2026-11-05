# Member 1 - Authentication (Registration, Login, Logout, Dashboard)

**SRS parts:** 3.1.1 Registration, 3.1.2 Login · **Database table:** `users` · **Extra duty:** Team Lead on Day 0 (pushes the skeleton, see `TEAM-GUIDE.md`).

## 1. What you are responsible for

- Create a patient account (validate, check duplicate email, hash password).
- Log in with email + password, start a session, show the right dashboard for the role.
- Log out. Tell the browser who is logged in (`/api/auth/me`).
- Shared file you must also be able to explain: `middleware/auth-middleware.js` (`requireLogin`, `requireRole`).

## 2. Files you own

| File | Layer |
|---|---|
| `models/user-model.js` | Model |
| `controllers/auth-controller.js` | Controller |
| `routes/auth-routes.js` | Route |
| `views/register.html`, `views/login.html`, `views/dashboard.html` | View |
| `public/js/register.js`, `public/js/login.js`, `public/js/dashboard.js` | View logic (browser JavaScript) |
| `tests/unit/auth.test.js`, `tests/integration/auth.test.js` | Tests |

The `routes/auth-routes.js` stub already exists in `main` (Day 0). You **replace** its content on your branch.

## 3. Branch and commands

```bash
git checkout main
git pull origin main
git checkout -b feature/member-1-auth
# ...paste your files...
git add models/user-model.js controllers/auth-controller.js routes/auth-routes.js
git add views/register.html views/login.html views/dashboard.html
git add public/js/register.js public/js/login.js public/js/dashboard.js
git add tests/unit/auth.test.js tests/integration/auth.test.js
git commit -m "feat(auth): add registration, login, logout and dashboard"
git push -u origin feature/member-1-auth
```

## 4. Code (copy-paste)

Create each file with exactly this name and content. They are in the order: Model, Controller, Route, View, page script, tests.

### `models/user-model.js`

```js
/**
 * User Model (Member 1).
 * Only talks to the "users" table. It has NO request/response code.
 *
 * @module userModel
 */
const pool = require( '../config/db' );

/**
 * Finds one user by email.
 *
 * @param {string} email Email address.
 * @returns {Promise<Object|null>} The user row, or null if not found.
 */
async function findByEmail( email ) {
	const [ rows ] = await pool.execute( 'SELECT * FROM users WHERE email = ?', [ email ] );
	return rows[ 0 ] || null;
}

/**
 * Saves a new patient account.
 *
 * @param {Object} user Data for the new user (password must already be hashed).
 * @returns {Promise<number>} The id of the new user.
 */
async function createUser( user ) {
	const sql = 'INSERT INTO users (full_name, email, phone, date_of_birth, gender, address, password_hash) '
		+ 'VALUES (?, ?, ?, ?, ?, ?, ?)';
	const [ result ] = await pool.execute( sql, [
		user.fullName,
		user.email,
		user.phone,
		user.dateOfBirth,
		user.gender,
		user.address,
		user.passwordHash,
	] );
	return result.insertId;
}

module.exports = { findByEmail, createUser };
```

### `controllers/auth-controller.js`

```js
/**
 * Auth Controller (Member 1): registration, login, logout.
 * It checks the request, asks the Model for data, and sends the JSON reply.
 *
 * @module authController
 */
const bcrypt = require( 'bcryptjs' );
const userModel = require( '../models/user-model' );
const { isValidEmail } = require( '../utils/validators' );

const SALT_ROUNDS = 10;
const MIN_PASSWORD_LENGTH = 6;
const REQUIRED_FIELDS = [ 'fullName', 'email', 'phone', 'dateOfBirth', 'gender', 'address', 'password', 'confirmPassword' ];
const GENDERS = [ 'Male', 'Female', 'Other' ];

/**
 * Checks the registration form data.
 *
 * @param {Object} body Data sent by the registration page.
 * @returns {string|null} An error message, or null when everything is fine.
 */
function validateRegistration( body ) {
	for ( const field of REQUIRED_FIELDS ) {
		if ( !body[ field ] || String( body[ field ] ).trim() === '' ) {
			return 'Please fill in all required fields.';
		}
	}
	if ( !isValidEmail( body.email.trim() ) ) {
		return 'Please enter a valid email address.';
	}
	if ( body.password !== body.confirmPassword ) {
		return 'Password and Confirm Password do not match.';
	}
	if ( body.password.length < MIN_PASSWORD_LENGTH ) {
		return 'Password must be at least 6 characters.';
	}
	if ( !GENDERS.includes( body.gender ) ) {
		return 'Please choose a valid gender.';
	}
	if ( !/^\d{4}-\d{2}-\d{2}$/.test( body.dateOfBirth ) ) {
		return 'Please enter a valid date of birth.';
	}
	return null;
}

/**
 * POST /api/auth/register - creates a new patient account.
 *
 * @async
 * @param {Object} req Express request.
 * @param {Object} res Express response.
 */
async function register( req, res ) {
	try {
		const body = req.body || {};
		const errorMessage = validateRegistration( body );
		if ( errorMessage !== null ) {
			return res.status( 400 ).json( { success: false, message: errorMessage } );
		}

		const email = body.email.trim().toLowerCase();
		const existingUser = await userModel.findByEmail( email );
		if ( existingUser !== null ) {
			return res.status( 409 ).json( { success: false, message: 'Email already exists.' } );
		}

		// Never store a plain password. bcrypt turns it into a one-way hash.
		const passwordHash = await bcrypt.hash( body.password, SALT_ROUNDS );
		await userModel.createUser( {
			fullName: body.fullName.trim(),
			email: email,
			phone: body.phone.trim(),
			dateOfBirth: body.dateOfBirth,
			gender: body.gender,
			address: body.address.trim(),
			passwordHash: passwordHash,
		} );

		return res.status( 201 ).json( { success: true, message: 'Registration Successful.' } );
	} catch ( error ) {
		// Two people registering the same email at the same moment: the UNIQUE column stops the second one.
		if ( error.code === 'ER_DUP_ENTRY' ) {
			return res.status( 409 ).json( { success: false, message: 'Email already exists.' } );
		}
		console.error( error );
		return res.status( 500 ).json( { success: false, message: 'Something went wrong. Please try again later.' } );
	}
}

/**
 * POST /api/auth/login - checks email + password and starts a session.
 *
 * @async
 * @param {Object} req Express request.
 * @param {Object} res Express response.
 */
async function login( req, res ) {
	try {
		const body = req.body || {};
		if ( !body.email || !body.password ) {
			return res.status( 400 ).json( { success: false, message: 'Please enter your email and password.' } );
		}

		const user = await userModel.findByEmail( String( body.email ).trim().toLowerCase() );
		if ( user === null ) {
			return res.status( 404 ).json( { success: false, message: 'User account not found.' } );
		}

		const isPasswordCorrect = await bcrypt.compare( String( body.password ), user.password_hash );
		if ( !isPasswordCorrect ) {
			return res.status( 401 ).json( { success: false, message: 'Invalid email or password.' } );
		}

		// The session stays on the server. The browser only keeps a cookie id.
		req.session.user = { id: user.id, fullName: user.full_name, email: user.email, role: user.role };

		return res.status( 200 ).json( {
			success: true,
			message: 'Login successful.',
			data: req.session.user,
			redirectTo: '/dashboard.html',
		} );
	} catch ( error ) {
		console.error( error );
		return res.status( 500 ).json( { success: false, message: 'Something went wrong. Please try again later.' } );
	}
}

/**
 * POST /api/auth/logout - ends the session.
 *
 * @param {Object} req Express request.
 * @param {Object} res Express response.
 */
function logout( req, res ) {
	req.session.destroy( () => {
		res.status( 200 ).json( { success: true, message: 'Logged out.' } );
	} );
}

/**
 * GET /api/auth/me - tells the browser who is logged in (data is null for guests).
 *
 * @param {Object} req Express request.
 * @param {Object} res Express response.
 */
function getCurrentUser( req, res ) {
	// Guests get 200 with data: null (not 401), so the browser console stays free of red errors.
	return res.status( 200 ).json( { success: true, data: req.session.user || null } );
}

module.exports = { register, login, logout, getCurrentUser, validateRegistration };
```

### `routes/auth-routes.js`

```js
/**
 * Auth routes (Member 1). Mounted at /api/auth in app.js.
 * A route only connects a URL to a Controller function.
 */
const express = require( 'express' );
const authController = require( '../controllers/auth-controller' );

const router = express.Router();

router.post( '/register', authController.register );
router.post( '/login', authController.login );
router.post( '/logout', authController.logout );
router.get( '/me', authController.getCurrentUser );

module.exports = router;
```

### `views/register.html`

```html
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Register - HealthHub</title>
    <link rel="stylesheet" href="/css/style.css">
</head>
<body>
    <div id="navbar"></div>
    <div class="container">
        <div class="card">
            <h1>Create your account</h1>
            <form id="registerForm">
                <div class="form-row"><label for="fullName">Full name *</label><input type="text" id="fullName"></div>
                <div class="form-row"><label for="email">Email *</label><input type="email" id="email"></div>
                <div class="form-row"><label for="phone">Phone number *</label><input type="text" id="phone"></div>
                <div class="form-row"><label for="dateOfBirth">Date of birth *</label><input type="date" id="dateOfBirth"></div>
                <div class="form-row">
                    <label for="gender">Gender *</label>
                    <select id="gender">
                        <option value="">-- Select --</option>
                        <option>Male</option>
                        <option>Female</option>
                        <option>Other</option>
                    </select>
                </div>
                <div class="form-row"><label for="address">Address *</label><input type="text" id="address"></div>
                <div class="form-row"><label for="password">Password *</label><input type="password" id="password"></div>
                <div class="form-row"><label for="confirmPassword">Confirm password *</label><input type="password" id="confirmPassword"></div>
                <button type="submit">Register</button>
            </form>
            <div id="message" class="message"></div>
            <p>Already have an account? <a href="/login.html">Login</a></p>
        </div>
    </div>
    <script src="/js/common.js"></script>
    <script src="/js/register.js"></script>
</body>
</html>
```

### `views/login.html`

```html
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Login - HealthHub</title>
    <link rel="stylesheet" href="/css/style.css">
</head>
<body>
    <div id="navbar"></div>
    <div class="container">
        <div class="card">
            <h1>Login</h1>
            <form id="loginForm">
                <div class="form-row"><label for="email">Email</label><input type="email" id="email"></div>
                <div class="form-row"><label for="password">Password</label><input type="password" id="password"></div>
                <button type="submit">Login</button>
            </form>
            <div id="message" class="message"></div>
            <p>New here? <a href="/register.html">Create an account</a></p>
            <p><small>Demo: patient@healthhub.com / Password123</small></p>
        </div>
    </div>
    <script src="/js/common.js"></script>
    <script src="/js/login.js"></script>
</body>
</html>
```

### `views/dashboard.html`

```html
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Dashboard - HealthHub</title>
    <link rel="stylesheet" href="/css/style.css">
</head>
<body>
    <div id="navbar"></div>
    <div class="container">
        <div class="card">
            <h1 id="dashboardTitle">Dashboard</h1>
            <p id="dashboardText"></p>
        </div>
        <div class="card">
            <h2>What would you like to do?</h2>
            <div id="menuLinks"></div>
        </div>
    </div>
    <script src="/js/common.js"></script>
    <script src="/js/dashboard.js"></script>
</body>
</html>
```

### `public/js/register.js`

```js
/**
 * Registration page script (Member 1).
 * Reads the form, sends it to the API with fetch, shows the result.
 */
const registerForm = document.getElementById( 'registerForm' );

registerForm.addEventListener( 'submit', async ( event ) => {
	event.preventDefault();

	const formData = {
		fullName: document.getElementById( 'fullName' ).value,
		email: document.getElementById( 'email' ).value,
		phone: document.getElementById( 'phone' ).value,
		dateOfBirth: document.getElementById( 'dateOfBirth' ).value,
		gender: document.getElementById( 'gender' ).value,
		address: document.getElementById( 'address' ).value,
		password: document.getElementById( 'password' ).value,
		confirmPassword: document.getElementById( 'confirmPassword' ).value,
	};

	const result = await sendJson( 'POST', '/api/auth/register', formData );

	if ( result.status === 201 ) {
		showMessage( 'message', result.body.message, 'success' );
		// Wait a moment so the user can read the message, then open the login page.
		setTimeout( () => {
			window.location.href = '/login.html';
		}, 1500 );
	} else {
		showMessage( 'message', result.body.message, 'error' );
	}
} );
```

### `public/js/login.js`

```js
/**
 * Login page script (Member 1).
 */
const loginForm = document.getElementById( 'loginForm' );

loginForm.addEventListener( 'submit', async ( event ) => {
	event.preventDefault();

	const result = await sendJson( 'POST', '/api/auth/login', {
		email: document.getElementById( 'email' ).value,
		password: document.getElementById( 'password' ).value,
	} );

	if ( result.status === 200 ) {
		window.location.href = result.body.redirectTo;
	} else {
		showMessage( 'message', result.body.message, 'error' );
	}
} );
```

### `public/js/dashboard.js`

```js
/**
 * Dashboard page script (Member 1).
 * One page that shows different shortcuts for each role.
 */
const ROLE_TITLES = {
	patient: 'Patient Dashboard',
	doctor: 'Doctor Dashboard',
	hospital_authority: 'Hospital Authority Dashboard',
	ambulance_provider: 'Ambulance Provider Dashboard',
	admin: 'Administrator Dashboard',
};

const COMMON_LINKS = [
	[ 'Search hospitals', '/hospital-search.html' ],
	[ 'ICU / CCU availability', '/icu-search.html' ],
	[ 'Ambulance search', '/ambulance.html' ],
	[ 'Blood bank search', '/blood-bank.html' ],
	[ 'Vaccines and anti-venoms', '/vaccine.html' ],
	[ 'Emergency contacts', '/emergency.html' ],
];

const ROLE_LINKS = {
	patient: [
		[ 'Hospital recommendations', '/recommendation.html' ],
		[ 'Find doctors', '/doctors.html' ],
		[ 'My appointments', '/appointments.html' ],
		[ 'Payments', '/payment.html' ],
		[ 'My health records', '/health-records.html' ],
	],
	doctor: [ [ 'My appointment schedule', '/appointments.html' ] ],
	hospital_authority: [ [ 'Manage emergency contacts', '/emergency.html' ] ],
	ambulance_provider: [ [ 'Update ambulance availability', '/ambulance.html' ] ],
	admin: [ [ 'Manage emergency contacts', '/emergency.html' ] ],
};

/** Shows the title and the links that match the logged-in user's role. */
async function loadDashboard() {
	const user = await requireLoginPage();
	if ( user === null ) {
		return;
	}
	document.getElementById( 'dashboardTitle' ).textContent = ROLE_TITLES[ user.role ];
	document.getElementById( 'dashboardText' ).textContent = 'Welcome, ' + user.fullName + '.';

	const links = ( ROLE_LINKS[ user.role ] || [] ).concat( COMMON_LINKS );
	let html = '';
	links.forEach( ( link ) => {
		html += '<p><a href="' + link[ 1 ] + '">' + escapeHtml( link[ 0 ] ) + '</a></p>';
	} );
	document.getElementById( 'menuLinks' ).innerHTML = html;
}

loadDashboard();
```

### `tests/unit/auth.test.js`

```js
import { describe, it, expect } from 'vitest';
import authController from '../../controllers/auth-controller.js';

const { validateRegistration } = authController;

/** A correct registration form. Each test changes one field. */
function makeValidBody() {
	return {
		fullName: 'Test User',
		email: 'test@example.com',
		phone: '01712345678',
		dateOfBirth: '2000-01-01',
		gender: 'Male',
		address: 'Savar',
		password: 'secret123',
		confirmPassword: 'secret123',
	};
}

describe( 'Member 1 - validateRegistration', () => {
	it( 'returns null for correct data', () => {
		expect( validateRegistration( makeValidBody() ) ).toBe( null );
	} );

	it( 'asks for all required fields when one is empty', () => {
		const body = makeValidBody();
		body.address = '';
		expect( validateRegistration( body ) ).toBe( 'Please fill in all required fields.' );
	} );

	it( 'rejects an invalid email format', () => {
		const body = makeValidBody();
		body.email = 'not-an-email';
		expect( validateRegistration( body ) ).toBe( 'Please enter a valid email address.' );
	} );

	it( 'rejects different password and confirm password', () => {
		const body = makeValidBody();
		body.confirmPassword = 'different';
		expect( validateRegistration( body ) ).toBe( 'Password and Confirm Password do not match.' );
	} );

	it( 'rejects a password shorter than 6 characters', () => {
		const body = makeValidBody();
		body.password = '123';
		body.confirmPassword = '123';
		expect( validateRegistration( body ) ).toBe( 'Password must be at least 6 characters.' );
	} );
} );
```

### `tests/integration/auth.test.js`

```js
import { describe, it, expect, afterAll } from 'vitest';
import request from 'supertest';
import app from '../../app.js';
import { pool } from '../helpers/db-helper.js';
import { DEMO_PASSWORD } from '../helpers/login-helper.js';

// A new email every run, so the test can be repeated.
const testEmail = 'test.user.' + Date.now() + '@example.com';

function makeRegistrationBody() {
	return {
		fullName: 'Integration Tester',
		email: testEmail,
		phone: '01712345678',
		dateOfBirth: '2000-01-01',
		gender: 'Female',
		address: 'Savar',
		password: 'secret123',
		confirmPassword: 'secret123',
	};
}

afterAll( async () => {
	await pool.execute( 'DELETE FROM users WHERE email = ?', [ testEmail ] );
} );

describe( 'Member 1 - Registration API', () => {
	it( 'registers a new patient (201)', async () => {
		const response = await request( app ).post( '/api/auth/register' ).send( makeRegistrationBody() );
		expect( response.status ).toBe( 201 );
		expect( response.body.message ).toBe( 'Registration Successful.' );
	} );

	it( 'stores the password as a hash, not as plain text', async () => {
		const [ rows ] = await pool.execute( 'SELECT password_hash FROM users WHERE email = ?', [ testEmail ] );
		expect( rows[ 0 ].password_hash ).not.toBe( 'secret123' );
		expect( rows[ 0 ].password_hash.startsWith( '$2' ) ).toBe( true );
	} );

	it( 'rejects a duplicate email (409)', async () => {
		const response = await request( app ).post( '/api/auth/register' ).send( makeRegistrationBody() );
		expect( response.status ).toBe( 409 );
		expect( response.body.message ).toBe( 'Email already exists.' );
	} );

	it( 'rejects a password mismatch (400)', async () => {
		const body = makeRegistrationBody();
		body.email = 'other.' + testEmail;
		body.confirmPassword = 'nope';
		const response = await request( app ).post( '/api/auth/register' ).send( body );
		expect( response.status ).toBe( 400 );
	} );
} );

describe( 'Member 1 - Login API', () => {
	it( 'logs in the demo patient and returns the role', async () => {
		const response = await request( app )
			.post( '/api/auth/login' )
			.send( { email: 'patient@healthhub.com', password: DEMO_PASSWORD } );
		expect( response.status ).toBe( 200 );
		expect( response.body.data.role ).toBe( 'patient' );
	} );

	it( 'rejects a wrong password (401)', async () => {
		const response = await request( app )
			.post( '/api/auth/login' )
			.send( { email: 'patient@healthhub.com', password: 'wrong-password' } );
		expect( response.status ).toBe( 401 );
		expect( response.body.message ).toBe( 'Invalid email or password.' );
	} );

	it( 'says "User account not found." for an unknown email (404)', async () => {
		const response = await request( app )
			.post( '/api/auth/login' )
			.send( { email: 'nobody@example.com', password: 'whatever' } );
		expect( response.status ).toBe( 404 );
		expect( response.body.message ).toBe( 'User account not found.' );
	} );

	it( 'keeps the user logged in with a session, and logout ends it', async () => {
		const agent = request.agent( app );
		await agent.post( '/api/auth/login' ).send( { email: 'patient@healthhub.com', password: DEMO_PASSWORD } );

		const whoAmI = await agent.get( '/api/auth/me' );
		expect( whoAmI.status ).toBe( 200 );
		expect( whoAmI.body.data.email ).toBe( 'patient@healthhub.com' );

		await agent.post( '/api/auth/logout' );
		const afterLogout = await agent.get( '/api/auth/me' );
		expect( afterLogout.body.data ).toBe( null );
	} );

	it( 'blocks a guest from a protected route (401)', async () => {
		const response = await request( app ).get( '/api/appointments/my' );
		expect( response.status ).toBe( 401 );
	} );
} );
```



## 5. Viva explanation

### 5.1 The journey of one request (Login)

1. User types email + password in `login.html` and clicks Login.
2. `login.js` collects the values and sends `POST /api/auth/login` with `fetch()` (through `sendJson` in `common.js`).
3. `app.js` sees the URL starts with `/api/auth` and gives it to `routes/auth-routes.js`.
4. The route calls `authController.login`.
5. The controller asks the Model: `userModel.findByEmail( email )`.
6. The Model runs the SQL and returns the row.
7. The controller compares the password with `bcrypt.compare`, saves the user in `req.session.user`, and answers with JSON.
8. `login.js` reads the JSON and moves the browser to `/dashboard.html`.

### 5.2 Why is each piece where it is?

| Question | Answer |
|---|---|
| **Why is this in the Model?** | `findByEmail` and `createUser` only talk to the `users` table. They do not know about `req`, `res`, or HTTP. If we changed MySQL to another database, only this file changes. |
| **Why is this in the Controller?** | The controller takes the request, checks the data (`validateRegistration`), decides the business rules (duplicate email, hash the password, wrong password), and picks the HTTP status code. It is the "middle man". |
| **Why is this in the View?** | `register.html` / `login.html` only show forms. `register.js` / `login.js` only read inputs, call the API and show messages. No SQL and no business rules there. |
| **Why is this in the Route?** | The route file is just a map: "POST /login -> `authController.login`". One line per URL. |

### 5.3 The SQL, explained

| SQL | Business meaning |
|---|---|
| `SELECT * FROM users WHERE email = ?` | Find the account that owns this email. Used twice: at registration (is the email already taken?) and at login (get the stored password hash). `email` is `UNIQUE`, so at most one row. |
| `INSERT INTO users (full_name, email, phone, date_of_birth, gender, address, password_hash) VALUES (?, ?, ?, ?, ?, ?, ?)` | Save a new patient. We do **not** insert `role`. The table default is `'patient'`, so nobody can make themselves admin from the form. |

The `?` marks are **parameterized queries**: the values travel separately from the SQL text, so the database never treats user text as SQL. This stops SQL injection.

### 5.4 Block by block

- **`REQUIRED_FIELDS` and `validateRegistration`**: loops over the form fields; returns the exact SRS message for each failure, or `null` when everything is fine. It is a plain function, so it is easy to unit test.
- **`bcrypt.hash( password, 10 )`**: turns the password into a one-way hash. The `10` is the "cost" (how slow the hashing is, to make guessing hard). We store only the hash.
- **`bcrypt.compare`**: hashes the typed password the same way and compares. We never decrypt anything.
- **`req.session.user = {...}`**: `express-session` (set up in `app.js`) keeps this object on the server and gives the browser a cookie with a session id. Next requests carry the cookie, so the server knows who it is.
- **`logout`**: `req.session.destroy` deletes the server-side session.
- **`getCurrentUser`**: returns the session user, or `null` for guests. Every page uses it to build the menu and to redirect guests.
- **`requireLogin` / `requireRole`** (middleware): small functions that run **before** the controller. If the user is a guest they answer 401; if the role is wrong they answer 403; otherwise they call `next()`.
- **`dashboard.js`**: one page, but the title and links change by role (`ROLE_TITLES`, `ROLE_LINKS`).

### 5.5 Tests

- **Unit test (`auth.test.js` in `tests/unit`)**: calls `validateRegistration` with good and bad data. No database, no server. Checks the exact messages.
- **Integration test (`tests/integration`)**: uses Supertest to call the real API with the real database: register (201), duplicate (409), password mismatch (400), wrong password (401), unknown email (404), session + logout, and a guest blocked from a protected route. It deletes the test user afterwards.

### 5.6 Questions the teacher may ask

**Q: What is a session and how does the server remember me?**
A: After login the server stores `{ id, fullName, email, role }` in memory under a random id and sends that id to the browser as a cookie. The browser sends the cookie with every request, so the server finds my data again.

**Q: Why bcrypt and not MD5 or storing the password?**
A: Plain passwords are dangerous if the database leaks. MD5 is fast, so attackers can guess billions per second. bcrypt is slow on purpose and adds a random salt, so the same password gives a different hash each time.

**Q: Why is hashing in the controller and not the Model?**
A: Deciding that "we never store plain passwords" is a business rule, so the controller does it. The Model just saves what it receives.

**Q: How do you prevent SQL injection?**
A: Every query uses `?` placeholders with `pool.execute( sql, [ values ] )`. The test in `hospital.test.js` shows this idea too.

**Q: A user types `<script>` in the name. What happens?**
A: It is saved as text. When pages show data they use `escapeHtml` (in `common.js`), so the browser shows the text instead of running it.

**Q: What if two people register the same email at the same time?**
A: The `email` column is `UNIQUE`. MySQL rejects the second insert with `ER_DUP_ENTRY`, and the controller turns it into "Email already exists."

**Q: Why does login say "User account not found." for an unknown email?**
A: The SRS asks for this exact message. We know it tells an attacker which emails exist; in a real system we would use one message for both cases. (Say this honestly, it shows understanding.)

**Q: How is the role-based dashboard done?**
A: Login returns the role. `dashboard.js` asks `/api/auth/me`, then picks the title and links from the `ROLE_TITLES` and `ROLE_LINKS` objects. The server also protects APIs with `requireRole`, so hiding a link is never the only protection.

**Q: What does `express.json()` do?**
A: It reads the JSON body that `fetch` sends and puts it in `req.body`. Without it `req.body` would be empty.

**Q: What happens when the session expires?**
A: The cookie lasts 1 hour. After that `/api/auth/me` returns `null`, and `requireLoginPage()` in `common.js` sends the user to `login.html`.

**Q: What is not finished?**
A: "Forgot password" (needs an email service) and separate dashboard pages per role (we use one page that changes by role).

### 5.7 Demo script (2 minutes)

1. Open `/register.html`, leave a field empty -> error. Register properly -> "Registration Successful." -> login page.
2. Try the same email again -> "Email already exists."
3. Login with a wrong password -> "Invalid email or password."
4. Login as `patient@healthhub.com / Password123` -> Patient Dashboard.
5. Open phpMyAdmin / MySQL: show `password_hash` is not the real password.
6. Logout, then open `/payment.html` -> redirected to login.
