import assert from 'node:assert/strict';
import path from 'node:path';

const testUrl = process.env.TEST_DATABASE_URL;
const productionUrl = process.env.DATABASE_URL;
console.log(`TEST DATABASE: ${testUrl ? 'configured (value hidden)' : 'NOT CONFIGURED'}`);
console.log(`TEST STORAGE ROOT: ${process.env.TEST_STORAGE_ROOT ?? '/home/wyz/tzz-test-data'}`);
if (!testUrl) { console.log('SKIP: TEST_DATABASE_URL is required; destructive integration tests refused.'); process.exit(0); }
if (productionUrl && testUrl === productionUrl) throw new Error('TEST_DATABASE_URL equals DATABASE_URL; refusing destructive tests.');
const dbName = new URL(testUrl).pathname.slice(1); if (!dbName || /prod|production|tzz_workspace/i.test(dbName)) throw new Error('Test database name is not safely distinguishable from production.');
assert.ok(path.resolve(process.env.TEST_STORAGE_ROOT ?? '/home/wyz/tzz-test-data').startsWith('/home/wyz/'));
console.log('FAIL: real PostgreSQL fixture harness is not configured in this checkout; no database or filesystem mutation was performed.');
process.exitCode = 2;
