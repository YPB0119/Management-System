const { pool, ensureDatabase, json } = require('./db');
const { parseBody, methodNotAllowed, badRequest } = require('./utils');

module.exports = async (req, res) => {
  await ensureDatabase();

  const method = req.method;
  if (!['GET', 'POST', 'PUT', 'DELETE'].includes(method)) {
    return methodNotAllowed(res, ['GET', 'POST', 'PUT', 'DELETE']);
  }

  try {
    if (method === 'GET') {
      const { rows } = await pool.query(`
        SELECT p.*, m.shop_name
        FROM products p
        LEFT JOIN merchants m ON m.id = p.merchant_id
        ORDER BY p.created_at DESC;
      `);
      return json(res, 200, { products: rows });
    }

    const body = await parseBody(req);

    if (method === 'POST') {
      const {
        merchantId,
        name,
        price,
        stock,
        category = '',
        description = '',
        imageUrl = '',
      } = body;
      if (!merchantId || !name || price === undefined || stock === undefined) {
        return badRequest(res, '缺少必要参数');
      }

      const merchantCheck = await pool.query('SELECT id FROM merchants WHERE id = $1', [merchantId]);
      if (!merchantCheck.rows.length) {
        return json(res, 404, { error: '商户不存在' });
      }

      const { rows } = await pool.query(
        `
          INSERT INTO products (merchant_id, name, price, stock, category, description, image_url)
          VALUES ($1, $2, $3, $4, $5, $6, $7)
          RETURNING *;
        `,
        [merchantId, name, price, stock, category, description, imageUrl],
      );
      return json(res, 201, { product: rows[0] });
    }

    if (method === 'PUT') {
      const id = Number(req.query?.id || body.id);
      const { merchantId, name, price, stock, category, description, imageUrl } = body;
      if (!id || !merchantId) {
        return badRequest(res, '缺少商品编号或商户信息');
      }

      const ownerCheck = await pool.query('SELECT merchant_id FROM products WHERE id = $1', [id]);
      if (!ownerCheck.rows.length) {
        return json(res, 404, { error: '商品不存在' });
      }
      if (ownerCheck.rows[0].merchant_id !== Number(merchantId)) {
        return json(res, 403, { error: '无权修改其他商户的商品' });
      }

      const fields = [];
      const values = [];
      const addField = (column, value) => {
        if (value === undefined) return;
        values.push(value);
        fields.push(`${column} = $${values.length}`);
      };

      addField('name', name);
      addField('price', price);
      addField('stock', stock);
      addField('category', category);
      addField('description', description);
      addField('image_url', imageUrl);
      values.push(id);

      if (!fields.length) {
        return badRequest(res, '没有需要更新的内容');
      }

      const { rows } = await pool.query(
        `
          UPDATE products
          SET ${fields.join(', ')}, updated_at = NOW()
          WHERE id = $${values.length}
          RETURNING *;
        `,
        values,
      );
      return json(res, 200, { product: rows[0] });
    }

    if (method === 'DELETE') {
      const id = Number(req.query?.id || body.id);
      const { merchantId } = body;
      if (!id || !merchantId) {
        return badRequest(res, '缺少商品编号或商户信息');
      }

      const ownerCheck = await pool.query('SELECT merchant_id FROM products WHERE id = $1', [id]);
      if (!ownerCheck.rows.length) {
        return json(res, 404, { error: '商品不存在' });
      }
      if (ownerCheck.rows[0].merchant_id !== Number(merchantId)) {
        return json(res, 403, { error: '无权删除其他商户的商品' });
      }

      await pool.query('DELETE FROM products WHERE id = $1', [id]);
      return json(res, 200, { success: true });
    }
  } catch (err) {
    console.error('products error', err);
    return json(res, 500, { error: '商品操作失败' });
  }
};


