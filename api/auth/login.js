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
      return badRequest(res, '請提供角色、用戶名與密碼');
    }

    if (!['merchant', 'buyer'].includes(role)) {
      return badRequest(res, '角色只允許 merchant 或 buyer');
    }

    const table = role === 'merchant' ? 'merchants' : 'buyers';
    const fields =
      role === 'merchant'
        ? 'id, username, password_hash, name, phone, shop_name'
        : 'id, username, password_hash, real_name, phone, address';

    const { rows } = await pool.query(
      `SELECT ${fields} FROM ${table} WHERE username = $1 LIMIT 1`,
      [username],
    );

    if (!rows.length) {
      return json(res, 401, { error: '用戶不存在或密碼錯誤' });
    }

    const user = rows[0];
    const match = await bcrypt.compare(password, user.password_hash);
    if (!match) {
      return json(res, 401, { error: '用戶不存在或密碼錯誤' });
    }

    delete user.password_hash;
    return json(res, 200, { user: { ...user, role } });
  } catch (err) {
    console.error('login error', err);
    return json(res, 500, { error: '登入失敗，請稍後再試' });
  }
};


