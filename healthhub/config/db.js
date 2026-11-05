/**
 * Database connection module.
 * Creates ONE shared connection pool that every Model file uses.
 *
 * @module db
 */
const mysql = require( 'mysql2/promise' );
require( 'dotenv' ).config( { quiet: true } );

const pool = mysql.createPool( {
	host: process.env.DB_HOST || 'localhost',
	port: Number( process.env.DB_PORT ) || 3306,
	user: process.env.DB_USER || 'root',
	password: process.env.DB_PASSWORD || '',
	database: process.env.DB_NAME || 'healthhub',
	waitForConnections: true,
	connectionLimit: 10,
	dateStrings: true, // DATE columns come back as text like '2026-11-05', not as JS Date objects
} );

module.exports = pool;
