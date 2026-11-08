import { describe, it, expect } from 'vitest';
import request from 'supertest';
import app from '../../app.js';

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
