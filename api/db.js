const { Pool } = require('pg');
const bcrypt = require('bcryptjs');
require('dotenv').config();

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error('缺少 DATABASE_URL 环境变量，用于连接 Neon 数据库。');
}

const pool = new Pool({
  connectionString,
  ssl: { rejectUnauthorized: false },
});

// 兼容繁/简写法，写入统一用简体
const STATUS_VALUES = ['待付款', '待发货', '已发货', '已完成', '待發貨', '已發貨'];
let initPromise;

async function ensureDatabase() {
  if (initPromise) return initPromise;
  initPromise = (async () => {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS merchants (
        id SERIAL PRIMARY KEY,
        username TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        name TEXT,
        phone TEXT,
        shop_name TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS buyers (
        id SERIAL PRIMARY KEY,
        username TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        real_name TEXT,
        phone TEXT,
        address TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS products (
        id SERIAL PRIMARY KEY,
        merchant_id INTEGER REFERENCES merchants(id) ON DELETE CASCADE,
        name TEXT NOT NULL,
        price NUMERIC(10,2) NOT NULL,
        stock INTEGER NOT NULL DEFAULT 0,
        category TEXT,
        description TEXT,
        image_url TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);

    await pool.query(`
      ALTER TABLE products
      ADD COLUMN IF NOT EXISTS image_url TEXT;
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS orders (
        id SERIAL PRIMARY KEY,
        buyer_id INTEGER REFERENCES buyers(id) ON DELETE SET NULL,
        product_id INTEGER REFERENCES products(id) ON DELETE SET NULL,
        quantity INTEGER NOT NULL,
        amount NUMERIC(10,2) NOT NULL,
        status TEXT NOT NULL DEFAULT '待付款',
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);

    await pool.query(`
      DO $$
      BEGIN
        IF EXISTS (
          SELECT 1 FROM pg_constraint WHERE conname = 'orders_status_check'
        ) THEN
          ALTER TABLE orders DROP CONSTRAINT orders_status_check;
        END IF;
        ALTER TABLE orders
        ADD CONSTRAINT orders_status_check
        CHECK (status IN ('待付款','待发货','已发货','已完成','待發貨','已發貨'));
      END $$;
    `);

    await seedDefaults();
  })();
  return initPromise;
}

async function seedDefaults() {
  const merchantPassword = await bcrypt.hash('merchant', 10);
  const buyerPassword = await bcrypt.hash('buyer', 10);

  await pool.query(
    `
    INSERT INTO merchants (username, password_hash, name, phone, shop_name)
    VALUES ($1, $2, '预设商户', '13000000000', '示例店铺')
    ON CONFLICT (username) DO NOTHING;
  `,
    ['merchant', merchantPassword],
  );

  await pool.query(
    `
    INSERT INTO buyers (username, password_hash, real_name, phone, address)
    VALUES ($1, $2, '预设购物者', '13100000000', '示例地址')
    ON CONFLICT (username) DO NOTHING;
  `,
    ['buyer', buyerPassword],
  );
}

function json(res, status, payload) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(payload));
}

module.exports = {
  pool,
  ensureDatabase,
  json,
  STATUS_VALUES,
  bcrypt,
};


