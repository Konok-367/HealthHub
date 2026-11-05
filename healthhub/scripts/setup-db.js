/**
 * Creates the healthhub database and runs every SQL file in database/ in order.
 * Run with: npm run db:setup
 * WARNING: it deletes the old healthhub database first, so it always starts fresh.
 */
const fs = require( 'fs' );
const path = require( 'path' );
const mysql = require( 'mysql2/promise' );
require( 'dotenv' ).config( { quiet: true } );

async function setupDatabase() {
	const databaseName = process.env.DB_NAME || 'healthhub';

	// Connect WITHOUT choosing a database, because it may not exist yet.
	const connection = await mysql.createConnection( {
		host: process.env.DB_HOST || 'localhost',
		port: Number( process.env.DB_PORT ) || 3306,
		user: process.env.DB_USER || 'root',
		password: process.env.DB_PASSWORD || '',
		multipleStatements: true,
	} );

	await connection.query( `DROP DATABASE IF EXISTS \`${ databaseName }\`` );
	await connection.query( `CREATE DATABASE \`${ databaseName }\`` );
	await connection.query( `USE \`${ databaseName }\`` );
	console.log( `Database "${ databaseName }" created.` );

	// Files are named 01-..., 02-... so sorting by name gives the right order.
	const folder = path.join( __dirname, '..', 'database' );
	const sqlFiles = fs.readdirSync( folder ).filter( ( file ) => file.endsWith( '.sql' ) ).sort();

	for ( const file of sqlFiles ) {
		const sql = fs.readFileSync( path.join( folder, file ), 'utf8' );
		await connection.query( sql );
		console.log( `Ran ${ file }` );
	}

	await connection.end();
	console.log( 'Done. Demo password for all users: Password123' );
}

setupDatabase().catch( ( error ) => {
	console.error( 'Database setup failed:', error.message );
	process.exit( 1 );
} );
