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
