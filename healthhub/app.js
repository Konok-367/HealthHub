/**
 * Express application setup.
 * This file only builds the app (middleware + route mounting).
 * server.js starts it, and the tests import it without opening a port.
 *
 * @module app
 */
const path = require( 'path' );
const express = require( 'express' );
const session = require( 'express-session' );
require( 'dotenv' ).config( { quiet: true } );

const app = express();

// Read JSON bodies (fetch requests) and form bodies.
app.use( express.json() );
app.use( express.urlencoded( { extended: true } ) );

// Remember logged-in users with a session cookie.
app.use( session( {
	secret: process.env.SESSION_SECRET || 'healthhub-dev-secret',
	resave: false,
	saveUninitialized: false,
	cookie: { maxAge: 60 * 60 * 1000 }, // 1 hour, then the user must log in again
} ) );

// VIEW files: HTML pages live in views/, CSS and browser JS live in public/.
app.use( express.static( path.join( __dirname, 'views' ) ) );
app.use( express.static( path.join( __dirname, 'public' ) ) );

// ROUTES: every member owns their own route files, so this list is written once
// on Day 0 and nobody has to edit app.js again (this prevents merge conflicts).
app.use( '/api/auth', require( './routes/auth-routes' ) );                       // Member 1
app.use( '/api/hospitals', require( './routes/hospital-routes' ) );              // Member 2
app.use( '/api/doctors', require( './routes/doctor-routes' ) );                  // Member 3
app.use( '/api/appointments', require( './routes/appointment-routes' ) );        // Member 3
app.use( '/api/payments', require( './routes/payment-routes' ) );                // Member 4
app.use( '/api/health-records', require( './routes/health-record-routes' ) );    // Member 4
app.use( '/api/emergency', require( './routes/emergency-routes' ) );             // Member 5
app.use( '/api/ambulances', require( './routes/ambulance-routes' ) );            // Member 5
app.use( '/api/blood-banks', require( './routes/blood-bank-routes' ) );          // Member 6
app.use( '/api/vaccines', require( './routes/vaccine-routes' ) );                // Member 6

// Unknown API address -> JSON error (instead of an HTML error page).
app.use( '/api', ( req, res ) => {
	res.status( 404 ).json( { success: false, message: 'API route not found.' } );
} );

module.exports = app;
