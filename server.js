require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');

const app = express();
app.use(cors());
app.use(express.json());

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production'
    ? { rejectUnauthorized: false }
    : false,
});

/* =========================
   CRIAR TABELAS
========================= */
async function criarTabelas() {
  await pool.query(`

  CREATE TABLE IF NOT EXISTS produtos (
    id SERIAL PRIMARY KEY,
    nome TEXT
  );

  CREATE TABLE IF NOT EXISTS compras (
    id SERIAL PRIMARY KEY,
    fornecedor TEXT,
    produto_id INTEGER,
    quantidade NUMERIC,
    custo NUMERIC,
    data DATE DEFAULT CURRENT_DATE
  );

  CREATE TABLE IF NOT EXISTS lotes (
    id SERIAL PRIMARY KEY,
    produto_id INTEGER,
    quantidade NUMERIC,
    custo NUMERIC,
    saldo NUMERIC,
    data DATE DEFAULT CURRENT_DATE
  );

  CREATE TABLE IF NOT EXISTS movimentacoes_estoque (
    id SERIAL PRIMARY KEY,
    produto_id INTEGER,
    tipo TEXT,
    quantidade NUMERIC,
    data TIMESTAMP DEFAULT NOW()
  );

  CREATE TABLE IF NOT EXISTS producoes (
    id SERIAL PRIMARY KEY,
    produto_saida INTEGER,
    quantidade NUMERIC,
    data TIMESTAMP DEFAULT NOW()
  );

  CREATE TABLE IF NOT EXISTS producao_itens (
    id SERIAL PRIMARY KEY,
    producao_id INTEGER,
    lote_id INTEGER,
    quantidade NUMERIC
  );

  CREATE TABLE IF NOT EXISTS contas_pagar (
    id SERIAL PRIMARY KEY,
    descricao TEXT,
    valor NUMERIC,
    status TEXT DEFAULT 'aberto'
  );

  CREATE TABLE IF NOT EXISTS lancamentos_financeiros (
    id SERIAL PRIMARY KEY,
    tipo TEXT,
    valor NUMERIC,
    data TIMESTAMP DEFAULT NOW()
  );

  `);
}
criarTabelas();

/* =========================
   ENTRADA MERCADORIA
========================= */

app.post('/compras', async (req, res) => {
  const { fornecedor, produto_id, quantidade, custo } = req.body;

  const compra = await pool.query(`
    INSERT INTO compras (fornecedor, produto_id, quantidade, custo)
    VALUES ($1,$2,$3,$4) RETURNING *
  `, [fornecedor, produto_id, quantidade, custo]);

  await pool.query(`
    INSERT INTO lotes (produto_id, quantidade, custo, saldo)
    VALUES ($1,$2,$3,$2)
  `, [produto_id, quantidade, custo]);

  await pool.query(`
    INSERT INTO movimentacoes_estoque (produto_id, tipo, quantidade)
    VALUES ($1,'entrada',$2)
  `, [produto_id, quantidade]);

  await pool.query(`
    INSERT INTO contas_pagar (descricao, valor)
    VALUES ($1,$2)
  `, [`Compra fornecedor ${fornecedor}`, quantidade * custo]);

  res.json(compra.rows[0]);
});

/* =========================
   PRODUÇÃO
========================= */

app.post('/producoes', async (req, res) => {
  const { produto_saida, quantidade, insumos } = req.body;

  const prod = await pool.query(`
    INSERT INTO producoes (produto_saida, quantidade)
    VALUES ($1,$2) RETURNING *
  `, [produto_saida, quantidade]);

  for (let i of insumos) {
    await pool.query(
      `UPDATE lotes SET saldo = saldo - $1 WHERE id = $2`,
      [i.quantidade, i.lote_id]
    );

    await pool.query(
      `INSERT INTO producao_itens (producao_id, lote_id, quantidade)
       VALUES ($1,$2,$3)`,
      [prod.rows[0].id, i.lote_id, i.quantidade]
    );

    await pool.query(
      `INSERT INTO movimentacoes_estoque (produto_id, tipo, quantidade)
       VALUES ($1,'saida',$2)`,
      [i.produto_id, i.quantidade]
    );
  }

  await pool.query(`
    INSERT INTO lotes (produto_id, quantidade, custo, saldo)
    VALUES ($1,$2,0,$2)
  `, [produto_saida, quantidade]);

  res.json(prod.rows[0]);
});

/* =========================
   PAGAR CONTA
========================= */

app.post('/contas-pagar/:id/pagar', async (req, res) => {
  const id = req.params.id;

  const conta = await pool.query(
    'SELECT * FROM contas_pagar WHERE id=$1',
    [id]
  );

  await pool.query(
    'UPDATE contas_pagar SET status=$1 WHERE id=$2',
    ['pago', id]
  );

  await pool.query(`
    INSERT INTO lancamentos_financeiros (tipo, valor)
    VALUES ('despesa',$1)
  `, [conta.rows[0].valor]);

  res.send({ ok: true });
});

app.listen(3000, () => console.log('Servidor rodando'));
