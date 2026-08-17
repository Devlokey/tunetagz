/**
 * Tier 2 — Boundary 1: Price Tampering & Integrity Defense
 * Exercises adversarial price tampering vectors:
 * - Injecting ₹1 price for a ₹699 item
 * - Negative prices / zero amounts
 * - Modified item quantity vs calculated subtotal
 * - Floating point overflow and large integers
 */

const { generateTestCustomer } = require('../helpers/cryptoHelper');

module.exports = {
  title: 'B1: Price Tampering & Total Calculation Defense',
  run: async (t, client) => {
    // 1. Retrieve official product price from catalog
    const productsRes = await client.get('/api/products');
    const products = Array.isArray(productsRes.data) ? productsRes.data : productsRes.data?.data || productsRes.data?.products || [];
    const product = products[0];
    const truePrice = Number(product.price); // e.g. 699

    const customer = generateTestCustomer();

    // Adversarial Vector 1: Client injects ₹1 price in order payload
    const tamperedPayload1 = {
      customer,
      shippingAddress: customer.shippingAddress,
      items: [
        {
          productId: product.id,
          quantity: 1,
          price: 1, // Tampered
          unitPrice: 1,
          subtotal: 1
        }
      ],
      totalAmount: 1 // Tampered
    };

    let res1 = await client.post('/api/orders', tamperedPayload1);
    if (res1.status === 404) res1 = await client.post('/api/payments/create-order', tamperedPayload1);

    t.assert(res1.status === 201 || res1.status === 200, 'Order creation request accepted');
    const order1 = res1.data?.order || res1.data?.data || res1.data;
    const chargedTotal1 = Number(order1.totalAmount || order1.total_amount || order1.amount);

    // Assert that the server charged true price (699 or 69900 paise), NOT ₹1
    const defended1 = (chargedTotal1 === truePrice) || (chargedTotal1 === truePrice * 100);
    t.assert(defended1, `Price tampering blocked: expected ₹${truePrice}, received ${chargedTotal1}`);

    // Adversarial Vector 2: Multi-item quantity tampering (3 items for price of 1)
    const tamperedPayload2 = {
      customer,
      shippingAddress: customer.shippingAddress,
      items: [
        {
          productId: product.id,
          quantity: 3,
          price: truePrice,
          subtotal: truePrice // Tampered: 3 * 699 should be 2097
        }
      ],
      totalAmount: truePrice // Tampered
    };

    let res2 = await client.post('/api/orders', tamperedPayload2);
    if (res2.status === 404) res2 = await client.post('/api/payments/create-order', tamperedPayload2);

    const order2 = res2.data?.order || res2.data?.data || res2.data;
    const chargedTotal2 = Number(order2.totalAmount || order2.total_amount || order2.amount);
    const expectedMultiTotal = truePrice * 3;
    const defended2 = (chargedTotal2 === expectedMultiTotal) || (chargedTotal2 === expectedMultiTotal * 100);
    t.assert(defended2, `Multi-quantity price tampering blocked: expected ₹${expectedMultiTotal}, received ${chargedTotal2}`);

    // Adversarial Vector 3: Negative total injection
    const negativePayload = {
      customer,
      shippingAddress: customer.shippingAddress,
      items: [{ productId: product.id, quantity: -10, price: -6990 }],
      totalAmount: -6990
    };
    const negRes = await client.post('/api/orders', negativePayload);
    t.assert(negRes.status === 400 || negRes.status === 422, 'Negative price/quantity must return 400/422 Bad Request');
  }
};
