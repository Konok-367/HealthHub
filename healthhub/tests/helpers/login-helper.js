import request from 'supertest';
import app from '../../app.js';

/** Password used by every seeded demo account. */
export const DEMO_PASSWORD = 'Password123';

/**
 * Logs in as a seeded demo user and returns a Supertest agent.
 * The agent remembers the session cookie, so later requests are "logged in".
 *
 * @param {string} email Email of a seeded user.
 * @returns {Promise<Object>} Supertest agent.
 */
export async function loginAs( email ) {
	const agent = request.agent( app );
	await agent.post( '/api/auth/login' ).send( { email: email, password: DEMO_PASSWORD } );
	return agent;
}
