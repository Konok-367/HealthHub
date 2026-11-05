import { defineConfig } from 'vitest/config';

export default defineConfig( {
	test: {
		environment: 'node',
		// Run test files one after another because they share one database.
		fileParallelism: false,
		testTimeout: 15000,
		setupFiles: [ './tests/setup.js' ],
	},
} );
