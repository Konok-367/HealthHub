/**
 * Small input-checking functions shared by many controllers.
 * They are plain functions (no database), so they are easy to unit test.
 *
 * @module validators
 */

/**
 * Checks that an email looks like name@site.com.
 *
 * @param {string} email Email text.
 * @returns {boolean} True when the format is valid.
 */
function isValidEmail( email ) {
	return typeof email === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test( email );
}

/**
 * Checks a phone number: 5 to 15 characters, digits with optional + and -.
 *
 * @param {string} phone Phone text.
 * @returns {boolean} True when valid.
 */
function isValidPhone( phone ) {
	return typeof phone === 'string' && /^[0-9+\-]{5,15}$/.test( phone );
}

/**
 * Checks search text. Empty text is allowed (it means "show everything").
 * Only letters, numbers, spaces and . , ' - are allowed, max 50 characters.
 *
 * @param {string} text Search text from the query string.
 * @returns {boolean} True when the text is safe and valid.
 */
function isValidSearchText( text ) {
	if ( text === undefined || text === null || text === '' ) {
		return true;
	}
	return typeof text === 'string' && text.length <= 50 && /^[a-zA-Z0-9 .,'\-]+$/.test( text );
}

/**
 * Checks that a value is a whole number greater than zero (for ids).
 *
 * @param {*} value Value from params or body.
 * @returns {boolean} True when it is a positive integer.
 */
function isPositiveInteger( value ) {
	return /^[0-9]+$/.test( String( value ) ) && Number( value ) > 0;
}

module.exports = { isValidEmail, isValidPhone, isValidSearchText, isPositiveInteger };
