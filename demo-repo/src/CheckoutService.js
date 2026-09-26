const { PaymentService } = require('./PaymentService');

/**
 * CheckoutService - orchestrates the checkout process.
 */
class CheckoutService {
  constructor() {
    this.paymentService = new PaymentService();
  }

  checkout(cart, cardNumber) {
    const total = cart.reduce((sum, item) => sum + item.price, 0);
    const result = this.paymentService.processPayment(total, cardNumber);
    return {
      success: true,
      transactionId: result.transactionId,
      total,
    };
  }
}

module.exports = { CheckoutService };
