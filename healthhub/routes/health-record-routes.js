/**
 * Health record routes (Member 4). Mounted at /api/health-records in app.js.
 * requireRole runs BEFORE handleUpload, so guests cannot upload files.
 */
const express = require( 'express' );
const healthRecordController = require( '../controllers/health-record-controller' );
const { requireRole } = require( '../middleware/auth-middleware' );
const { handleUpload } = require( '../middleware/upload-middleware' );

const router = express.Router();

router.get( '/', requireRole( 'patient' ), healthRecordController.listRecords );
router.post( '/', requireRole( 'patient' ), handleUpload, healthRecordController.uploadRecord );
router.get( '/:id/view', requireRole( 'patient' ), healthRecordController.viewRecord );
router.get( '/:id/download', requireRole( 'patient' ), healthRecordController.downloadRecord );
router.delete( '/:id', requireRole( 'patient' ), healthRecordController.deleteRecord );

module.exports = router;
