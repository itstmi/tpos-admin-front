// Export check on tposadminfront: prints only counts, never names or CNIC numbers.
import { cnicReady } from '../src/cnic.js';
import { collectExport } from '../src/export.js';

const started = Date.now();
const { text, stats } = await collectExport();
console.log(`cnic key loaded: ${cnicReady}`);
console.log(`isps ${stats.isps}, customers ${stats.customers}, cnic saved ${stats.cnicSaved}, cnic opened ${stats.cnicOpened}`);
console.log(`size ${Buffer.byteLength(text)} bytes, ${Date.now() - started} ms`);
console.log(stats.cnicSaved === stats.cnicOpened ? 'EXPORT OK' : 'EXPORT CHECK: some CNIC did not open');
