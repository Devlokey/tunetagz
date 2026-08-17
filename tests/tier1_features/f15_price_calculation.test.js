/**
 * Tier 1 — Feature 15: Server-Side Price Calculation & Anti-Tampering
 * Verifies that the server strictly enforces database prices and ignores
 * client-supplied price parameters to prevent price tampering attacks.
 */

const { generateTestCustomer } = require('../helpers/cryptoHelper');

module.exports = {
  title: 'F15: Server-Side Price Calculation & Anti-Tampering',
  featureId: 'F15',
  run: async (t, client) => {
    // 1. Fetch products to get Spotify Code Tag (price 699)
    const productsRes = await client.get('/api/products');
    const products = Array.isArray(productsRes.data) ? productsRes.data : productsRes.data?.data || productsRes.data?.products || [];
    const spotifyProduct = products.find(p => p.sku === 'SPT-001' || (p.name && p.name.toLowerCase().includes('spotify'))) || products[0];
    t.assert(Boolean(spotifyProduct), 'Spotify product required for pricing test');

    const expectedUnitPrice = Number(spotifyProduct.price); // e.g. 699
    const quantity = 3;
    const expectedTotal = expectedUnitPrice * quantity; // 2097

    // 2. Submit order with TAMPERED price (e.g. ₹1 instead of ₹699, totalAmount = 3)
    const customerData = generateTestCustomer();
    const tamperedPayload = {
      customer: customerData,
      shippingAddress: customerData.shippingAddress,
      items: [
        {
          productId: spotifyProduct.id,
          quantity: quantity,
          price: 1, // TAMPERED
          unitPrice: 1, // TAMPERED
          subtotal: 1,
          customText: 'Tamper Test'
        }
      ],
      totalAmount: 3 // TAMPERED
    };

    let orderRes = await client.post('/api/orders', tamperedPayload);
    if (orderRes.status === 404) {
      orderRes = await client.post('/api/payments/create-order', tamperedPayload);
    }

    t.assert(
      orderRes.status === 201 || orderRes.status === 200,
      `Order creation should complete, got ${orderRes.status}`
    );

    const order = orderRes.data?.order || orderRes.data?.data || orderRes.data;
    const calculatedTotal = Number(order.totalAmount || order.total_amount || order.amount);

    // 3. Verify server recalculated total from DB (2097 or 209700 in paise), completely ignoring client ₹3
    const isCorrect = (calculatedTotal === expectedTotal) || (calculatedTotal === expectedTotal * 100);
    t.assert(
      isCorrect,
      `Server must calculate total (${expectedTotal}), received ${calculatedTotal}. Client price manipulation must be blocked!`
    );

    // 4. Verify negative quantity is rejected with 400 Bad Request
    const negativeQtyPayload = {
      customer: customerData,
      shippingAddress: customerData.shippingAddress,
      items: [
        {
          productId: spotifyProduct.id,
          quantity: -2,
          customText: 'Negative Qty'
        }
      ]
    };
    const badQtyRes = await client.post('/api/orders', negativeQtyPayload);
    t.assert(
      badQtyRes.status === 400 || badQtyRes.status === 422,
      'Negative quantity must be rejected with 400/422 Bad Request'
    );

    // 5. Verify empty items array is rejected
    const emptyQtyPayload = {
      customer: customerData,
      shippingAddress: customerData.shippingAddress,
      items: []
    };
    const emptyQtyRes = await client.post('/api/orders', emptyQtyPayload);
    t.assert(
      emptyQtyRes.status === 400 || emptyQtyRes.status === 422,
      'Empty items must be rejected with 400/422 Bad Request'
    );

    // 6. Verify zero quantity is rejected with 400 Bad Request
    const zeroQtyPayload = {
      customer: customerData,
      shippingAddress: customerData.shippingAddress,
      items: [
        {
          productId: spotifyProduct.id,
          quantity: 0,
          customText: 'Zero Qty Test'
        }
      ]
    };
    const zeroQtyRes = await client.post('/api/orders', zeroQtyPayload);
    t.assert(
      zeroQtyRes.status === 400 || zeroQtyRes.status === 422,
      'Zero quantity must be rejected with 400/422 Bad Request'
    );
  }
};
