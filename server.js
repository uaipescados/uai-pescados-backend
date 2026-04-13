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

function num(v) {
  return Number(v || 0);
}

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

    CREATE TABLE IF NOT EXISTS contas_receber (
      id SERIAL PRIMARY KEY,
      codigo TEXT,
      cliente_id INTEGER REFERENCES clientes(id),
      nome_cliente TEXT,
      categoria TEXT,
      valor_original NUMERIC DEFAULT 0,
      valor_aberto NUMERIC DEFAULT 0,
      data_lancamento DATE,
      data_vencimento DATE,
      status TEXT DEFAULT 'aberto',
      origem TEXT,
      origem_id INTEGER,
      conta_id INTEGER,
      observacoes TEXT,
      criado_em TIMESTAMP DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS lancamentos_financeiros (
      id SERIAL PRIMARY KEY,
      codigo TEXT,
      tipo TEXT,
      categoria TEXT,
      favorecido TEXT,
      conta_id INTEGER,
      valor NUMERIC DEFAULT 0,
      data_lancamento DATE,
      origem TEXT,
      origem_id INTEGER,
      observacoes TEXT,
      criado_em TIMESTAMP DEFAULT NOW()
    );

    CREATE INDEX IF NOT EXISTS idx_venda_itens_venda ON venda_itens(venda_id);
    CREATE INDEX IF NOT EXISTS idx_pagamentos_venda_venda ON pagamentos_venda(venda_id);
    CREATE INDEX IF NOT EXISTS idx_cheques_venda ON cheques(venda_id);
    CREATE INDEX IF NOT EXISTS idx_receber_cliente ON contas_receber(cliente_id);
    CREATE INDEX IF NOT EXISTS idx_financeiro_data ON lancamentos_financeiros(data_lancamento);
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

app.put('/clientes/:id', async (req, res) => {
  const id = Number(req.params.id);
  const { nome, telefone, cidade, limite_credito, observacoes } = req.body;
  try {
    const result = await pool.query(
      `update clientes set nome=$1, telefone=$2, cidade=$3, limite_credito=$4, observacoes=$5 where id=$6 returning *`,
      [nome || '', telefone || null, cidade || null, limite_credito || null, observacoes || null, id]
    );
    res.json(result.rows[0]);
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

app.put('/fornecedores/:id', async (req, res) => {
  const id = Number(req.params.id);
  const { nome, telefone, cidade, tipo, observacoes } = req.body;
  try {
    const result = await pool.query(
      `update fornecedores set nome=$1, telefone=$2, cidade=$3, tipo=$4, observacoes=$5 where id=$6 returning *`,
      [nome || '', telefone || null, cidade || null, tipo || null, observacoes || null, id]
    );
    res.json(result.rows[0]);
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

app.put('/produtos/:id', async (req, res) => {
  const id = Number(req.params.id);
  const { nome, tipo, unidade } = req.body;
  try {
    const result = await pool.query(
      `update produtos set nome=$1, tipo=$2, unidade=$3 where id=$4 returning *`,
      [nome || '', tipo || 'revenda', unidade || 'kg', id]
    );
    res.json(result.rows[0]);
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
      valor_total: num(v.valor_total),
      valor_aberto: num(v.valor_aberto),
      observacoes: v.observacoes || '',
      itens: itens.rows.filter(i => i.venda_id === v.id).map(i => ({
        id: i.id,
        produto_id: i.produto_id,
        quantidade_kg: num(i.quantidade_kg),
        valor_unitario: num(i.valor_unitario),
        valor_total: num(i.valor_total),
      })),
      pagamentos: pagamentos.rows.filter(p => p.venda_id === v.id).map(p => ({
        id: p.id,
        tipo_pagamento: p.tipo_pagamento,
        valor: num(p.valor),
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
        valor: num(c.valor),
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

    const clienteRes = await client.query('select nome from clientes where id = $1', [customerId]);
    const nomeCliente = clienteRes.rows[0] ? clienteRes.rows[0].nome : '';

    for (const item of items) {
      await client.query(
        `insert into venda_itens (venda_id, produto_id, quantidade_kg, valor_unitario, valor_total)
         values ($1,$2,$3,$4,$5)`,
        [vendaId, item.productId, item.qty || 0, item.unitPrice || 0, item.total || 0]
      );
    }

    let recSeq = 1;
    let finSeq = 1;
    let chequeSeq = 1;

    for (const pay of payments) {
      const pagamento = await client.query(
        `insert into pagamentos_venda (venda_id, tipo_pagamento, valor, conta_id, data_prevista, observacoes)
         values ($1,$2,$3,$4,$5,$6)
         returning id`,
        [vendaId, pay.type, pay.value || 0, pay.accountId || null, pay.dueDate || null, pay.obs || null]
      );
      const pagamentoId = pagamento.rows[0].id;

      if (pay.type === 'cheque') {
        await client.query(
          `insert into cheques (codigo, venda_id, cliente_id, numero_cheque, banco, emitente_nome, valor, data_vencimento, status)
           values ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
          [pay.chequeCode || `${codigo}-CHQ${String(chequeSeq++).padStart(2,'0')}`, vendaId, customerId, pay.number || null, pay.bank || null, pay.emitter || null, pay.value || 0, pay.dueDate || null, 'em carteira']
        );
      }

      if (pay.type === 'dinheiro' || pay.type === 'pix') {
        await client.query(
          `insert into lancamentos_financeiros (codigo, tipo, categoria, favorecido, conta_id, valor, data_lancamento, origem, origem_id, observacoes)
           values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
          [`FIN-${codigo}-${String(finSeq++).padStart(2,'0')}`, 'entrada', 'recebimento de venda', nomeCliente, pay.accountId || null, pay.value || 0, date, 'venda', vendaId, pay.type]
        );
      } else if (pay.type === 'boleto' || pay.type === 'cheque' || pay.type === 'cartao') {
        await client.query(
          `insert into contas_receber (codigo, cliente_id, nome_cliente, categoria, valor_original, valor_aberto, data_lancamento, data_vencimento, status, origem, origem_id, observacoes)
           values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)`,
          [`REC-${codigo}-${String(recSeq++).padStart(2,'0')}`, customerId, nomeCliente, `${pay.type} venda`, pay.value || 0, pay.value || 0, date, pay.dueDate || date, 'aberto', 'venda', pagamentoId, pay.obs || null]
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
      valor: num(c.valor),
      data_vencimento: c.data_vencimento,
      status: c.status
    })));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/financeiro', async (_req, res) => {
  try {
    const result = await pool.query('select * from lancamentos_financeiros order by data_lancamento desc, id desc');
    res.json(result.rows.map(f => ({
      id: f.id,
      codigo: f.codigo,
      tipo: f.tipo,
      categoria: f.categoria,
      favorecido: f.favorecido,
      conta_id: f.conta_id,
      valor: num(f.valor),
      data_lancamento: f.data_lancamento,
      origem: f.origem,
      origem_id: f.origem_id,
      observacoes: f.observacoes || ''
    })));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/financeiro', async (req, res) => {
  const { codigo, tipo, categoria, favorecido, contaId, valor, data, origem, origemId, observacoes } = req.body;
  try {
    const result = await pool.query(
      `insert into lancamentos_financeiros (codigo, tipo, categoria, favorecido, conta_id, valor, data_lancamento, origem, origem_id, observacoes)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
       returning *`,
      [codigo || null, tipo, categoria || null, favorecido || null, contaId || null, valor || 0, data || null, origem || 'manual', origemId || null, observacoes || null]
    );
    res.status(201).json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/contas-receber', async (_req, res) => {
  try {
    const result = await pool.query('select * from contas_receber order by data_vencimento desc, id desc');
    res.json(result.rows.map(r => ({
      id: r.id,
      codigo: r.codigo,
      cliente_id: r.cliente_id,
      nome_cliente: r.nome_cliente,
      categoria: r.categoria,
      valor_original: num(r.valor_original),
      valor_aberto: num(r.valor_aberto),
      data_lancamento: r.data_lancamento,
      data_vencimento: r.data_vencimento,
      status: r.status,
      origem: r.origem,
      origem_id: r.origem_id,
      conta_id: r.conta_id,
      observacoes: r.observacoes || ''
    })));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/contas-receber', async (req, res) => {
  const { codigo, customerId, category, value, date, dueDate, receiveNow, accountId, obs } = req.body;
  if (!customerId) return res.status(400).json({ error: 'Cliente é obrigatório.' });
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const clienteRes = await client.query('select nome from clientes where id=$1', [customerId]);
    const nomeCliente = clienteRes.rows[0] ? clienteRes.rows[0].nome : '';
    const openValue = receiveNow ? 0 : num(value);
    const status = receiveNow ? 'recebido' : 'aberto';
    const result = await client.query(
      `insert into contas_receber (codigo, cliente_id, nome_cliente, categoria, valor_original, valor_aberto, data_lancamento, data_vencimento, status, origem, conta_id, observacoes)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
       returning *`,
      [codigo || null, customerId, nomeCliente, category || 'manual', value || 0, openValue, date || null, dueDate || date || null, status, 'manual', receiveNow ? accountId || null : null, obs || null]
    );
    if (receiveNow) {
      await client.query(
        `insert into lancamentos_financeiros (codigo, tipo, categoria, favorecido, conta_id, valor, data_lancamento, origem, origem_id, observacoes)
         values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
        [`FIN-${codigo || 'REC'}`, 'entrada', category || 'manual', nomeCliente, accountId || null, value || 0, date || null, 'conta_receber', result.rows[0].id, obs || null]
      );
    }
    await client.query('COMMIT');
    res.status(201).json(result.rows[0]);
  } catch (error) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: error.message });
  } finally {
    client.release();
  }
});

app.post('/contas-receber/:id/receber', async (req, res) => {
  const id = Number(req.params.id);
  const { value, accountId, date, obs } = req.body;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const atual = await client.query('select * from contas_receber where id=$1', [id]);
    if (!atual.rows.length) throw new Error('Conta a receber não encontrada.');
    const rec = atual.rows[0];
    const novoAberto = Math.max(0, num(rec.valor_aberto) - num(value));
    const novoStatus = novoAberto === 0 ? 'recebido' : 'parcial';
    const updated = await client.query(
      `update contas_receber
       set valor_aberto=$1, status=$2, conta_id=$3
       where id=$4
       returning *`,
      [novoAberto, novoStatus, accountId || rec.conta_id || null, id]
    );
    await client.query(
      `insert into lancamentos_financeiros (codigo, tipo, categoria, favorecido, conta_id, valor, data_lancamento, origem, origem_id, observacoes)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
      [`FIN-REC-${id}-${Date.now()}`, 'entrada', updated.rows[0].categoria || 'recebimento', updated.rows[0].nome_cliente || '', accountId || null, value || 0, date || null, 'conta_receber', id, obs || null]
    );
    await client.query('COMMIT');
    res.json(updated.rows[0]);
  } catch (error) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: error.message });
  } finally {
    client.release();
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Servidor rodando na porta ${PORT}`);
});
