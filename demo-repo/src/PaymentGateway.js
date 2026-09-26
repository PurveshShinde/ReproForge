/**
 * PaymentGateway - simulates a third-party payment processor.
 * Intentionally returns null when the card number is "timeout".
 */
class PaymentGateway {
  charge(amount, cardNumber) {
    if (!cardNumber || cardNumber === 'timeout') {
      // Simulate gateway timeout — returns null instead of a response object
      return null;
    }
    return {
      transactionId: `txn_${Date.now()}`,
      status: 'approved',
      amount,
    };
  }
}

module.exports = { PaymentGateway };
