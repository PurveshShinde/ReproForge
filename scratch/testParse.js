const fs = require('fs');

const output = `✖ failing tests:

test at test\\auth.test.js:5:1
✖ Authentication succeeds for valid token (1.0092ms)
  AssertionError [ERR_ASSERTION]: Expected values to be strictly equal:
  
  false !== true
  
      at TestContext.<anonymous> (file:///D:/Repo/ReproForge/scratch/ReproForge-test/test/auth.test.js:8:10)

test at test\\gateway.test.js:5:1
✖ Gateway preserves all body fields from service response (2.1915ms)
  AssertionError [ERR_ASSERTION]: Expected values to be strictly equal:
  
  undefined !== '123'
  
      at TestContext.<anonymous> (file:///D:/Repo/ReproForge/scratch/ReproForge-test/test/gateway.test.js:9:10)

test at test\\orders.test.js:5:1
✖ Router correctly routes to orders service (1.2719ms)
  AssertionError [ERR_ASSERTION]: Expected values to be strictly equal:
  
  404 !== 200
  
      at TestContext.<anonymous> (file:///D:/Repo/ReproForge/scratch/ReproForge-test/test/orders.test.js:12:10)

test at test\\payments.test.js:5:1
✖ Payment service calculates total correctly (3.1154ms)
  AssertionError [ERR_ASSERTION]: Expected values to be strictly equal:
  
  52 !== 100
  
      at TestContext.<anonymous> (file:///D:/Repo/ReproForge/scratch/ReproForge-test/test/payments.test.js:13:10)
`;

const failures = [];
let m;

const nodeFailPattern = /✖ (.+?) \(/g;
while ((m = nodeFailPattern.exec(output)) !== null) {
  const testName = m[1]?.trim() ?? '';
  if (!failures.some(f => f.test === testName)) {
    failures.push({ test: testName, error: 'Test failed' });
  }
}

const assertionBlockPattern = /AssertionError[^\n]*\n\s*([\s\S]+?)\n\s+at\s+\S+\s+\((?:file:\/\/\/)?([^)]+?):(\d+):\d+\)/g;
while ((m = assertionBlockPattern.exec(output)) !== null) {
  const detail = m[1]?.trim() ?? '';
  const rawFile = m[2]?.trim() ?? '';
  const lineNo = parseInt(m[3] ?? '0', 10);
  const fileBase = rawFile.split(/[\\/]/).pop() ?? rawFile;

  const targetFailure = failures.find(f => !f.assertionDetail) || (failures.length > 0 ? failures[failures.length - 1] : null);

  if (targetFailure) {
    if (detail) targetFailure.assertionDetail = detail;
    if (detail && !targetFailure.error.includes('!==')) targetFailure.error = detail;
    if (fileBase) targetFailure.file = fileBase;
    if (lineNo > 0) targetFailure.line = lineNo;
  } else {
    failures.push({ error: detail || 'AssertionError', file: fileBase || undefined, line: lineNo || undefined, assertionDetail: detail || undefined });
  }
}

console.log(failures);
