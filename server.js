
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');

const app = express();
app.use(cors());
app.use(express.json());

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) console.error('DATABASE_URL não definido.');

const pool = new Pool({
  connectionString: DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});

async function criarTabelas() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS clientes (
      id SERIAL PRIMARY KEY,
      codigo TEXT,
      nome TEXT,
      telefone TEXT,
      cidade TEXT,
      limite_credito NUMERIC,
      observacoes TEXT,
      criado_em TIMESTAMP DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS fornecedores (
      id SERIAL PRIMARY KEY,
      codigo TEXT,
      nome TEXT,
      telefone TEXT,
      cidade TEXT,
      tipo TEXT,
      observacoes TEXT,
      criado_em TIMESTAMP DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS produtos (
      id SERIAL PRIMARY KEY,
      codigo TEXT,
      nome TEXT,
      tipo TEXT,
      unidade TEXT,
      criado_em TIMESTAMP DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS vendas (
      id SERIAL PRIMARY KEY,
      codigo TEXT,
      cliente_id INTEGER REFERENCES clientes(id),
      data_venda DATE,
      valor_total NUMERIC DEFAULT 0,
      valor_aberto NUMERIC DEFAULT 0,
      observacoes TEXT,
      criado_em TIMESTAMP DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS venda_itens (
      id SERIAL PRIMARY KEY,
      venda_id INTEGER REFERENCES vendas(id) ON DELETE CASCADE,
      produto_id INTEGER REFERENCES produtos(id),
      quantidade_kg NUMERIC DEFAULT 0,
      valor_unitario NUMERIC DEFAULT 0,
      valor_total NUMERIC DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS pagamentos_venda (
      id SERIAL PRIMARY KEY,
      venda_id INTEGER REFERENCES vendas(id) ON DELETE CASCADE,
      tipo_pagamento TEXT,
      valor NUMERIC DEFAULT 0,
      conta_id INTEGER,
      data_prevista DATE,
      observacoes TEXT,
      criado_em TIMESTAMP DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS cheques (
      id SERIAL PRIMARY KEY,
      codigo TEXT,
      venda_id INTEGER REFERENCES vendas(id) ON DELETE CASCADE,
      cliente_id INTEGER REFERENCES clientes(id),
      numero_cheque TEXT,
      banco TEXT,
      emitente_nome TEXT,
      valor NUMERIC DEFAULT 0,
      data_vencimento DATE,
      status TEXT DEFAULT 'em carteira',
      criado_em TIMESTAMP DEFAULT NOW()
    );

    CREATE INDEX IF NOT EXISTS idx_venda_itens_venda ON venda_itens(venda_id);
    CREATE INDEX IF NOT EXISTS idx_pagamentos_venda_venda ON pagamentos_venda(venda_id);
    CREATE INDEX IF NOT EXISTS idx_cheques_venda ON cheques(venda_id);
  `);
  console.log('Tabelas criadas');
}

criarTabelas().catch(console.error);

app.get('/', (_req, res) => {
  res.json({ ok: true, service: 'uai-pescados-backend' });
});

app.get('/health', async (_req, res) => {
  try {
    const db = await pool.query('select now() as now');
    res.json({ ok: true, db: true, now: db.rows[0].now });
  } catch (error) {
    res.status(500).json({ ok: false, db: false, error: error.message });
  }
});

app.get('/clientes', async (_req, res) => {
  try {
    const result = await pool.query('select * from clientes order by criado_em desc');
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/clientes', async (req, res) => {
  const { codigo, nome, telefone, cidade, limite_credito, observacoes } = req.body;
  try {
    const result = await pool.query(
      `insert into clientes (codigo, nome, telefone, cidade, limite_credito, observacoes)
       values ($1,$2,$3,$4,$5,$6)
       returning *`,
      [codigo, nome, telefone, cidade, limite_credito || null, observacoes || null]
    );
    res.status(201).json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/fornecedores', async (_req, res) => {
  try {
    const result = await pool.query('select * from fornecedores order by criado_em desc');
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/fornecedores', async (req, res) => {
  const { codigo, nome, telefone, cidade, tipo, observacoes } = req.body;
  try {
    const result = await pool.query(
      `insert into fornecedores (codigo, nome, telefone, cidade, tipo, observacoes)
       values ($1,$2,$3,$4,$5,$6)
       returning *`,
      [codigo, nome, telefone, cidade, tipo || null, observacoes || null]
    );
    res.status(201).json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/produtos', async (_req, res) => {
  try {
    const result = await pool.query('select * from produtos order by criado_em desc');
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/produtos', async (req, res) => {
  const { codigo, nome, tipo, unidade } = req.body;
  try {
    const result = await pool.query(
      `insert into produtos (codigo, nome, tipo, unidade)
       values ($1,$2,$3,$4)
       returning *`,
      [codigo, nome, tipo || 'revenda', unidade || 'kg']
    );
    res.status(201).json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/vendas', async (_req, res) => {
  const client = await pool.connect();
  try {
    const vendas = await client.query('select * from vendas order by criado_em desc');
    const vendaIds = vendas.rows.map(v => v.id);
    let itens = { rows: [] }, pagamentos = { rows: [] }, cheques = { rows: [] };
    if (vendaIds.length) {
      itens = await client.query('select * from venda_itens where venda_id = any($1::int[]) order by id asc', [vendaIds]);
      pagamentos = await client.query('select * from pagamentos_venda where venda_id = any($1::int[]) order by id asc', [vendaIds]);
      cheques = await client.query('select * from cheques where venda_id = any($1::int[]) order by id asc', [vendaIds]);
    }
    const payload = vendas.rows.map(v => ({
      id: v.id,
      codigo: v.codigo,
      cliente_id: v.cliente_id,
      data_venda: v.data_venda,
      valor_total: Number(v.valor_total || 0),
      valor_aberto: Number(v.valor_aberto || 0),
      observacoes: v.observacoes || '',
      itens: itens.rows.filter(i => i.venda_id === v.id).map(i => ({
        id: i.id,
        produto_id: i.produto_id,
        quantidade_kg: Number(i.quantidade_kg || 0),
        valor_unitario: Number(i.valor_unitario || 0),
        valor_total: Number(i.valor_total || 0),
      })),
      pagamentos: pagamentos.rows.filter(p => p.venda_id === v.id).map(p => ({
        id: p.id,
        tipo_pagamento: p.tipo_pagamento,
        valor: Number(p.valor || 0),
        conta_id: p.conta_id,
        data_prevista: p.data_prevista,
        observacoes: p.observacoes || ''
      })),
      cheques: cheques.rows.filter(c => c.venda_id === v.id).map(c => ({
        id: c.id,
        codigo: c.codigo,
        cliente_id: c.cliente_id,
        numero_cheque: c.numero_cheque,
        banco: c.banco,
        emitente_nome: c.emitente_nome,
        valor: Number(c.valor || 0),
        data_vencimento: c.data_vencimento,
        status: c.status
      }))
    }));
    res.json(payload);
  } catch (error) {
    res.status(500).json({ error: error.message });
  } finally {
    client.release();
  }
});

app.post('/vendas', async (req, res) => {
  const { codigo, customerId, date, total, openAmount, obs, items, payments } = req.body;
  if (!customerId) return res.status(400).json({ error: 'Cliente é obrigatório.' });
  if (!Array.isArray(items) || !items.length) return res.status(400).json({ error: 'Informe ao menos um item.' });
  if (!Array.isArray(payments) || !payments.length) return res.status(400).json({ error: 'Informe ao menos um pagamento.' });

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const venda = await client.query(
      `insert into vendas (codigo, cliente_id, data_venda, valor_total, valor_aberto, observacoes)
       values ($1,$2,$3,$4,$5,$6)
       returning *`,
      [codigo, customerId, date, total || 0, openAmount || 0, obs || null]
    );
    const vendaId = venda.rows[0].id;

    for (const item of items) {
      await client.query(
        `insert into venda_itens (venda_id, produto_id, quantidade_kg, valor_unitario, valor_total)
         values ($1,$2,$3,$4,$5)`,
        [vendaId, item.productId, item.qty || 0, item.unitPrice || 0, item.total || 0]
      );
    }

    for (const pay of payments) {
      await client.query(
        `insert into pagamentos_venda (venda_id, tipo_pagamento, valor, conta_id, data_prevista, observacoes)
         values ($1,$2,$3,$4,$5,$6)`,
        [vendaId, pay.type, pay.value || 0, pay.accountId || null, pay.dueDate || null, pay.obs || null]
      );

      if (pay.type === 'cheque') {
        await client.query(
          `insert into cheques (codigo, venda_id, cliente_id, numero_cheque, banco, emitente_nome, valor, data_vencimento, status)
           values ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
          [pay.chequeCode || null, vendaId, customerId, pay.number || null, pay.bank || null, pay.emitter || null, pay.value || 0, pay.dueDate || null, 'em carteira']
        );
      }
    }

    await client.query('COMMIT');
    res.status(201).json({ ok: true, id: vendaId });
  } catch (error) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: error.message });
  } finally {
    client.release();
  }
});

app.get('/cheques', async (_req, res) => {
  try {
    const result = await pool.query('select * from cheques order by criado_em desc');
    res.json(result.rows.map(c => ({
      id: c.id,
      codigo: c.codigo,
      venda_id: c.venda_id,
      cliente_id: c.cliente_id,
      numero_cheque: c.numero_cheque,
      banco: c.banco,
      emitente_nome: c.emitente_nome,
      valor: Number(c.valor || 0),
      data_vencimento: c.data_vencimento,
      status: c.status
    })));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Servidor rodando na porta ${PORT}`);
});
