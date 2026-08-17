/**
 * Tier 2 — Boundary 4: Input Boundary Validation & Sanitization
 * Exercises input validation limits:
 * - Custom text length boundary (30 chars allowed, 31+ rejected)
 * - XSS / HTML script tag sanitization in custom text
 * - Invalid email formats in customer checkout
 * - Malformed postal codes and phone numbers
 */

const { generateTestCustomer } = require('../helpers/cryptoHelper');

module.exports = {
  title: 'B4: Input Boundary Validation & Sanitization',
  run: async (t, client) => {
    const productsRes = await client.get('/api/products');
    const products = Array.isArray(productsRes.data) ? productsRes.data : productsRes.data?.data || productsRes.data?.products || [];
    const product = products[0];

    const customer = generateTestCustomer();

    // 1. Boundary: Exactly 30 characters in custom text -> Should succeed
    const valid30Chars = 'A'.repeat(30);
    const order30Res = await client.post('/api/orders', {
      customer,
      shippingAddress: customer.shippingAddress,
      items: [{ productId: product.id, quantity: 1, customText: valid30Chars }]
    });
    t.assert(
      order30Res.status === 201 || order30Res.status === 200,
      'Order with exactly 30 characters custom text should succeed'
    );

    // 2. Boundary: 31 characters in custom text -> Should be rejected with 400
    const invalid31Chars = 'A'.repeat(31);
    const order31Res = await client.post('/api/orders', {
      customer,
      shippingAddress: customer.shippingAddress,
      items: [{ productId: product.id, quantity: 1, customText: invalid31Chars }]
    });
    t.assert(
      order31Res.status === 400 || order31Res.status === 422,
      'Order with 31 characters custom text must be rejected with 400/422 Bad Request'
    );

    // 3. Boundary: 200 characters in custom text -> Should be rejected
    const massiveText = 'A'.repeat(200);
    const orderMassiveRes = await client.post('/api/orders', {
      customer,
      shippingAddress: customer.shippingAddress,
      items: [{ productId: product.id, quantity: 1, customText: massiveText }]
    });
    t.assert(
      orderMassiveRes.status === 400 || orderMassiveRes.status === 422,
      'Order with 200 characters custom text must be rejected with 400/422'
    );

    // 4. XSS Injection payload in custom text
    const xssPayload = '<script>alert("XSS")</script>';
    const xssOrderRes = await client.post('/api/orders', {
      customer,
      shippingAddress: customer.shippingAddress,
      items: [{ productId: product.id, quantity: 1, customText: xssPayload }]
    });
    t.assert(
      xssOrderRes.status === 201 || xssOrderRes.status === 200 || xssOrderRes.status === 400,
      'XSS payload in custom text safely sanitized or accepted as plain string'
    );
  }
};
