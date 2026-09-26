# Demo Buggy Shop

A small Node.js e-commerce backend used as a **ReproForge Visual** demo target.

## The Bug

`PaymentService.processPayment()` dereferences the gateway response without checking for null.
When the payment gateway times out, it returns `null`, causing:

```
TypeError: Cannot read properties of null (reading 'transactionId')
    at PaymentService.processPayment (src/PaymentService.js:18:22)
```

## Structure

```
src/
  PaymentGateway.js   — third-party gateway stub
  PaymentService.js   — contains the bug
  CheckoutService.js  — orchestrates checkout flow
test/
  checkout.test.js    — includes regression test that fails
```

## Running

```bash
npm install
npm test
```

The regression test `handles gateway timeout gracefully` will **fail** on the buggy version.
