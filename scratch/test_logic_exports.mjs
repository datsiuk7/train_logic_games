import * as logic from '../logic.mjs';
import assert from 'node:assert/strict';

console.log('Exports:', Object.keys(logic));
assert.ok(typeof logic.step === 'function');
assert.ok(typeof logic.validateLevel === 'function');
assert.ok(typeof logic.executeProgram === 'function');
assert.ok(typeof logic.validateProgram === 'function');
assert.ok(typeof logic.createMemory === 'function');
assert.ok(typeof logic.valueOf === 'function');
assert.ok(typeof logic.conditionValue === 'function');
assert.ok(typeof logic.getLevelDescription === 'function');
console.log('Sanity check passed!');
