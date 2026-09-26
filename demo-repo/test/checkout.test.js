const { CheckoutService } = require('../src/CheckoutService');

describe('CheckoutService', () => {
  let checkout;

  beforeEach(() => {
    checkout = new CheckoutService();
  });

  test('successfully processes a valid payment', () => {
    const cart = [{ name: 'Widget', price: 25 }, { name: 'Gadget', price: 15 }];
    const result = checkout.checkout(cart, '4111111111111111');
    expect(result.success).toBe(true);
    expect(result.total).toBe(40);
    expect(result.transactionId).toMatch(/^txn_/);
  });

  // Regression test: this exposes the null-dereference bug
  test('handles gateway timeout gracefully (should not throw)', () => {
    const cart = [{ name: 'Widget', price: 10 }];
    // cardNumber 'timeout' causes the gateway to return null
    expect(() => checkout.checkout(cart, 'timeout')).not.toThrow();
  });

  test('calculates cart total correctly', () => {
    const cart = [{ name: 'A', price: 5 }, { name: 'B', price: 10 }, { name: 'C', price: 15 }];
    const result = checkout.checkout(cart, '4111111111111111');
    expect(result.total).toBe(30);
  });
});
