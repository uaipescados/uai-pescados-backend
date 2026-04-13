require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');

const app = express();
app.use(cors());
app.use(express.json());

const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  console.error('DATABASE_URL não definido.');
}

// conexão com banco
const pool = new Pool({
  connectionString: DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production'
    ? { rejectUnauthorized: false }
    : false,
});

// criar tabelas automaticamente
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
  `);

  console.log('Tabelas criadas');
}

// executa criação
criarTabelas().catch(console.error);

// ROTAS

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

// CLIENTES

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

// FORNECEDORES

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

// PRODUTOS

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

// START

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Servidor rodando na porta ${PORT}`);
});
