/**
 * Starts the HealthHub web server.
 * Run with: npm start
 */
const app = require( './app' );

const PORT = process.env.PORT || 3000;

app.listen( PORT, () => {
	console.log( `HealthHub is running at http://localhost:${ PORT }` );
} );
