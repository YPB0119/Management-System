const { pool, ensureDatabase, json, STATUS_VALUES } = require('./db');
const { parseBody, methodNotAllowed, badRequest } = require('./utils');

module.exports = async (req, res) => {
  await ensureDatabase();

  const method = req.method;
  if (!['GET', 'POST', 'PATCH'].includes(method)) {
    return methodNotAllowed(res, ['GET', 'POST', 'PATCH']);
  }

  try {
    if (method === 'GET') {
      const { role, userId } = req.query || {};
      if (!role || !userId) {
        return badRequest(res, '缺少角色或用户编号');
      }

      if (role === 'merchant') {
        const { rows } = await pool.query(
          `
            SELECT o.*, p.name AS product_name, p.merchant_id, b.username AS buyer_username
            FROM orders o
            LEFT JOIN products p ON p.id = o.product_id
            LEFT JOIN buyers b ON b.id = o.buyer_id
            WHERE p.merchant_id = $1
            ORDER BY o.created_at DESC;
          `,
          [userId],
        );
        return json(res, 200, { orders: rows });
      }

      if (role === 'buyer') {
        const { rows } = await pool.query(
          `
            SELECT o.*, p.name AS product_name, p.merchant_id, m.shop_name
            FROM orders o
            LEFT JOIN products p ON p.id = o.product_id
            LEFT JOIN merchants m ON m.id = p.merchant_id
            WHERE o.buyer_id = $1
            ORDER BY o.created_at DESC;
          `,
          [userId],
        );
        return json(res, 200, { orders: rows });
      }

      return badRequest(res, '未知角色');
    }

    const body = await parseBody(req);

    if (method === 'POST') {
      const { buyerId, productId, quantity } = body;
      if (!buyerId || !productId || !quantity || Number(quantity) <= 0) {
        return badRequest(res, '缺少必要参数或数量不正确');
      }

      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        const productResult = await client.query(
          'SELECT id, price, stock, merchant_id, name FROM products WHERE id = $1 FOR UPDATE',
          [productId],
        );
        if (!productResult.rows.length) {
          await client.query('ROLLBACK');
          return json(res, 404, { error: '商品不存在' });
        }

        const product = productResult.rows[0];
        if (product.stock < Number(quantity)) {
          await client.query('ROLLBACK');
          return json(res, 400, { error: '库存不足' });
        }

        const amount = Number(product.price) * Number(quantity);

        await client.query('UPDATE products SET stock = stock - $1 WHERE id = $2', [
          quantity,
          productId,
        ]);

        const { rows } = await client.query(
          `
            INSERT INTO orders (buyer_id, product_id, quantity, amount, status)
            VALUES ($1, $2, $3, $4, '待发货')
            RETURNING *;
          `,
          [buyerId, productId, quantity, amount],
        );

        await client.query('COMMIT');
        return json(res, 201, { order: rows[0], product });
      } catch (err) {
        await client.query('ROLLBACK');
        console.error('order create error', err);
        return json(res, 500, { error: '下单失败' });
      } finally {
        client.release();
      }
    }

    if (method === 'PATCH') {
      const { orderId, status, merchantId } = body;
      if (!orderId || !status || !merchantId) {
        return badRequest(res, '缺少必要参数');
      }
      if (!STATUS_VALUES.includes(status)) {
        return badRequest(res, '状态值不合法');
      }

      const orderInfo = await pool.query(
        `
          SELECT o.id, p.merchant_id
          FROM orders o
          LEFT JOIN products p ON p.id = o.product_id
          WHERE o.id = $1
        `,
        [orderId],
      );

      if (!orderInfo.rows.length) {
        return json(res, 404, { error: '订单不存在' });
      }

      if (Number(orderInfo.rows[0].merchant_id) !== Number(merchantId)) {
        return json(res, 403, { error: '无权修改其他商户的订单' });
      }

      const { rows } = await pool.query(
        `
          UPDATE orders
          SET status = $1, updated_at = NOW()
          WHERE id = $2
          RETURNING *;
        `,
        [status, orderId],
      );
      return json(res, 200, { order: rows[0] });
    }
  } catch (err) {
    console.error('orders error', err);
    return json(res, 500, { error: '订单操作失败' });
  }
};

