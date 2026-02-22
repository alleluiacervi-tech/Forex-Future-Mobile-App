import Stripe from 'stripe';
import Logger from '../utils/logger.js';

const logger = new Logger('PaymentService');

// initialize stripe client if key provided
const stripeKey = process.env.STRIPE_SECRET_KEY || '';
const stripe = stripeKey ? new Stripe(stripeKey, { apiVersion: '2022-11-15' }) : null;

class PaymentService {
  /**
   * Tokenize a card using Stripe (or other provider).
   * The card object should NOT contain sensitive CVV in logs.
   * Returns the token object from Stripe (or a fake stub in dev).
   */
  async tokenizeCard(card) {
    if (!stripe) {
      logger.warn('Stripe not configured; returning mock token');
      // never store real card info in db; here we simulate
      return {
        id: `card_tok_${Date.now()}`,
        card: {
          brand: 'visa',
          last4: String(card.cardNumber).slice(-4),
          exp_month: card.cardExpMonth,
          exp_year: card.cardExpYear,
          name: card.name,
          address_zip: card.billingPostalCode || null
        }
      };
    }

    try {
      const token = await stripe.tokens.create({
        card: {
          number: card.cardNumber,
          exp_month: card.cardExpMonth,
          exp_year: card.cardExpYear,
          cvc: card.cardCvc,
          name: card.name,
          address_zip: card.billingPostalCode
        }
      });

      return token;
    } catch (error) {
      logger.error('Stripe tokenization error', { error: error.message });
      throw new Error('Failed to tokenize card');
    }
  }
}

export default new PaymentService();
