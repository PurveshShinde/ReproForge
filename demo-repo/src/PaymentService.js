const { PaymentGateway } = require('./PaymentGateway');

/**
 * PaymentService - processes payments for the checkout flow.
 *
 * BUG: When the gateway returns null (timeout scenario),
 * accessing response.transactionId throws a TypeError.
 * Fix: check if response is null before dereferencing it.
 */
class PaymentService {
  constructor() {
    this.gateway = new PaymentGateway();
  }

  processPayment(amount, cardNumber) {
    const response = this.gateway.charge(amount, cardNumber);
    // BUG: response can be null when the gateway times out
    return {
      transactionId: response.transactionId,
      status: response.status,
      amount: response.amount,
    };
  }
}

module.exports = { PaymentService };
