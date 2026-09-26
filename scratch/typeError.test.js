import test from 'node:test';
import assert from 'node:assert';

test('TypeError test', async () => {
  const res = { statusCode: 200, data: undefined };
  assert.strictEqual(res.statusCode, 200);
  assert.strictEqual(res.data.status, 'shipped'); // Throws TypeError
});
