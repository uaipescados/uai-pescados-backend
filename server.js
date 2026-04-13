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
   CRIAÇÃO DE TABELAS
========================= */
async function criarTabelas() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS clientes (
      id SERIAL PRIMARY KEY,
      nome TEXT
    );

    CREATE TABLE IF NOT EXISTS contas_receber (
      id SERIAL PRIMARY KEY,
      cliente_id INTEGER,
      nome_cliente TEXT,
      valor_original NUMERIC,
      valor_aberto NUMERIC,
      data_vencimento DATE,
      status TEXT DEFAULT 'aberto',
      criado_em TIMESTAMP DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS contas_pagar (
      id SERIAL PRIMARY KEY,
      descricao TEXT,
      valor NUMERIC,
      data_vencimento DATE,
      status TEXT DEFAULT 'aberto',
      criado_em TIMESTAMP DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS cheques (
      id SERIAL PRIMARY KEY,
      cliente_id INTEGER,
      numero_cheque TEXT,
      valor NUMERIC,
      data_vencimento DATE,
      status TEXT DEFAULT 'em carteira'
    );

    CREATE TABLE IF NOT EXISTS lancamentos_financeiros (
      id SERIAL PRIMARY KEY,
      tipo TEXT,
      categoria TEXT,
      valor NUMERIC,
      data_lancamento TIMESTAMP DEFAULT NOW(),
      observacoes TEXT
    );
  `);
}
criarTabelas();

/* =========================
   CONTAS A RECEBER
========================= */

app.get('/contas-receber', async (req, res) => {
  const r = await pool.query('SELECT * FROM contas_receber ORDER BY id DESC');
  res.json(r.rows);
});

app.post('/contas-receber', async (req, res) => {
  const { cliente_id, nome_cliente, valor, vencimento } = req.body;

  const r = await pool.query(`
    INSERT INTO contas_receber
    (cliente_id, nome_cliente, valor_original, valor_aberto, data_vencimento)
    VALUES ($1,$2,$3,$3,$4) RETURNING *
  `, [cliente_id, nome_cliente, valor, vencimento]);

  res.json(r.rows[0]);
});

app.post('/contas-receber/:id/receber', async (req, res) => {
  const id = req.params.id;

  const titulo = await pool.query(
    'SELECT * FROM contas_receber WHERE id=$1',
    [id]
  );

  if (!titulo.rows.length) return res.status(404).send('Erro');

  const t = titulo.rows[0];

  await pool.query(
    'UPDATE contas_receber SET status=$1, valor_aberto=0 WHERE id=$2',
    ['recebido', id]
  );

  await pool.query(`
    INSERT INTO lancamentos_financeiros
    (tipo,categoria,valor,observacoes)
    VALUES ('RECEITA','RECEBIMENTO',$1,$2)
  `, [t.valor_aberto, 'Recebimento']);

  res.send({ ok: true });
});

/* =========================
   CONTAS A PAGAR
========================= */

app.get('/contas-pagar', async (req, res) => {
  const r = await pool.query('SELECT * FROM contas_pagar ORDER BY id DESC');
  res.json(r.rows);
});

app.post('/contas-pagar', async (req, res) => {
  const { descricao, valor, vencimento } = req.body;

  const r = await pool.query(`
    INSERT INTO contas_pagar
    (descricao, valor, data_vencimento)
    VALUES ($1,$2,$3) RETURNING *
  `, [descricao, valor, vencimento]);

  res.json(r.rows[0]);
});

app.post('/contas-pagar/:id/pagar', async (req, res) => {
  const id = req.params.id;

  const conta = await pool.query(
    'SELECT * FROM contas_pagar WHERE id=$1',
    [id]
  );

  const c = conta.rows[0];

  await pool.query(
    'UPDATE contas_pagar SET status=$1 WHERE id=$2',
    ['pago', id]
  );

  await pool.query(`
    INSERT INTO lancamentos_financeiros
    (tipo,categoria,valor,observacoes)
    VALUES ('DESPESA','PAGAMENTO',$1,$2)
  `, [c.valor, c.descricao]);

  res.send({ ok: true });
});

/* =========================
   CHEQUES
========================= */

app.post('/cheques', async (req, res) => {
  const { cliente_id, numero, valor, vencimento } = req.body;

  const r = await pool.query(`
    INSERT INTO cheques
    (cliente_id, numero_cheque, valor, data_vencimento)
    VALUES ($1,$2,$3,$4) RETURNING *
  `, [cliente_id, numero, valor, vencimento]);

  res.json(r.rows[0]);
});

app.post('/cheques/:id/devolver', async (req, res) => {
  const id = req.params.id;

  const cheque = await pool.query(
    'SELECT * FROM cheques WHERE id=$1',
    [id]
  );

  const c = cheque.rows[0];

  await pool.query(
    'UPDATE cheques SET status=$1 WHERE id=$2',
    ['devolvido', id]
  );

  await pool.query(`
    INSERT INTO contas_receber
    (cliente_id, nome_cliente, valor_original, valor_aberto, data_vencimento)
    VALUES ($1,'Cliente',$2,$2,$3)
  `, [c.cliente_id, c.valor, c.data_vencimento]);

  res.send({ ok: true });
});

/* =========================
   ANTECIPAÇÃO
========================= */

app.post('/antecipar', async (req, res) => {
  const { ids, liquido } = req.body;

  let total = 0;

  for (let id of ids) {
    const t = await pool.query(
      'SELECT * FROM contas_receber WHERE id=$1',
      [id]
    );

    total += Number(t.rows[0].valor_aberto);

    await pool.query(
      'UPDATE contas_receber SET status=$1, valor_aberto=0 WHERE id=$2',
      ['antecipado', id]
    );
  }

  const taxa = total - liquido;

  await pool.query(`
    INSERT INTO lancamentos_financeiros
    (tipo,categoria,valor,observacoes)
    VALUES ('RECEITA','ANTECIPACAO',$1,'Liquido')
  `, [liquido]);

  await pool.query(`
    INSERT INTO lancamentos_financeiros
    (tipo,categoria,valor,observacoes)
    VALUES ('DESPESA','TAXA',$1,'Taxa')
  `, [taxa]);

  res.send({ ok: true });
});

/* ========================= */

app.listen(3000, () => {
  console.log('Servidor rodando');
});
