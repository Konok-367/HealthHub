import { describe, it, expect } from 'vitest';
import validators from '../../utils/validators.js';

const { isValidEmail, isValidPhone, isValidSearchText, isPositiveInteger } = validators;

describe( 'validators (shared helpers)', () => {
	it( 'accepts a normal email and rejects a bad one', () => {
		expect( isValidEmail( 'user@healthhub.com' ) ).toBe( true );
		expect( isValidEmail( 'user-at-healthhub.com' ) ).toBe( false );
	} );

	it( 'accepts a phone number and rejects letters', () => {
		expect( isValidPhone( '01712345678' ) ).toBe( true );
		expect( isValidPhone( 'abc' ) ).toBe( false );
	} );

	it( 'allows empty search text but rejects dangerous characters', () => {
		expect( isValidSearchText( '' ) ).toBe( true );
		expect( isValidSearchText( undefined ) ).toBe( true );
		expect( isValidSearchText( 'City Hospital' ) ).toBe( true );
		expect( isValidSearchText( '<script>' ) ).toBe( false );
		expect( isValidSearchText( "x'; DROP TABLE users;--" ) ).toBe( false );
	} );

	it( 'accepts only positive whole numbers as ids', () => {
		expect( isPositiveInteger( '5' ) ).toBe( true );
		expect( isPositiveInteger( 0 ) ).toBe( false );
		expect( isPositiveInteger( '-3' ) ).toBe( false );
		expect( isPositiveInteger( 'abc' ) ).toBe( false );
	} );
} );
