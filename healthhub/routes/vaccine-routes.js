/**
 * Vaccine routes (Member 6). Mounted at /api/vaccines in app.js.
 */
const express = require( 'express' );
const vaccineController = require( '../controllers/vaccine-controller' );

const router = express.Router();

router.get( '/search', vaccineController.searchVaccines );

module.exports = router;
