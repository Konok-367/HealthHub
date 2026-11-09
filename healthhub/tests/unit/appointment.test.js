import { describe, it, expect } from 'vitest';
import appointmentController from '../../controllers/appointment-controller.js';

const { validateSlotId } = appointmentController;

describe( 'Member 3 - validateSlotId', () => {
	it( 'accepts a positive number', () => {
		expect( validateSlotId( 5 ) ).toBe( null );
		expect( validateSlotId( '12' ) ).toBe( null );
	} );

	it( 'rejects missing, zero, negative and text values', () => {
		const message = 'Please select a valid appointment date and time.';
		expect( validateSlotId( undefined ) ).toBe( message );
		expect( validateSlotId( 0 ) ).toBe( message );
		expect( validateSlotId( -1 ) ).toBe( message );
		expect( validateSlotId( 'abc' ) ).toBe( message );
	} );
} );
