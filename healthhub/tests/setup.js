import { afterAll } from 'vitest';
import pool from '../config/db.js';

// Close the database pool after each test file so Vitest can exit cleanly.
afterAll( async () => {
	await pool.end();
} );
