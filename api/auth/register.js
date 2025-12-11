const { pool, ensureDatabase, json, bcrypt } = require('../db');
const { parseBody, methodNotAllowed, badRequest } = require('../utils');

module.exports = async (req, res) => {
  await ensureDatabase();

  if (req.method !== 'POST') {
    return methodNotAllowed(res, ['POST']);
  }

  try {
    const body = await parseBody(req);
    const { role, username, password } = body;

    if (!role || !username || !password) {
      return badRequest(res, '请提供角色、用户名与密码');
    }

    if (!['merchant', 'buyer'].includes(role)) {
      return badRequest(res, '角色只允许 merchant 或 buyer');
    }

    const passwordHash = await bcrypt.hash(password, 10);

    if (role === 'merchant') {
      const { name = '', phone = '', shopName = '' } = body;
      const { rows } = await pool.query(
        `
          INSERT INTO merchants (username, password_hash, name, phone, shop_name)
          VALUES ($1, $2, $3, $4, $5)
          ON CONFLICT (username) DO NOTHING
          RETURNING id, username, name, phone, shop_name;
        `,
        [username, passwordHash, name, phone, shopName],
      );

      if (!rows.length) {
        return json(res, 409, { error: '用户名已被注册' });
      }

      return json(res, 201, { user: { ...rows[0], role } });
    }

    const { realName = '', phone = '', address = '' } = body;
    const { rows } = await pool.query(
      `
        INSERT INTO buyers (username, password_hash, real_name, phone, address)
        VALUES ($1, $2, $3, $4, $5)
        ON CONFLICT (username) DO NOTHING
        RETURNING id, username, real_name, phone, address;
      `,
      [username, passwordHash, realName, phone, address],
    );

    if (!rows.length) {
      return json(res, 409, { error: '用户名已被注册' });
    }

    return json(res, 201, { user: { ...rows[0], role } });
  } catch (err) {
    console.error('register error', err);
    return json(res, 500, { error: '注册失败，请稍后再试' });
  }
};


