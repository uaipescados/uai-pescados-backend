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


    CREATE TABLE IF NOT EXISTS contas_pagar (
      id SERIAL PRIMARY KEY,
      codigo TEXT,
      favorecido TEXT,
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

    CREATE TABLE IF NOT EXISTS compras (
      id SERIAL PRIMARY KEY,
      codigo TEXT,
      fornecedor_id INTEGER REFERENCES fornecedores(id),
      produto_id INTEGER REFERENCES produtos(id),
      quantidade_kg NUMERIC DEFAULT 0,
      valor_custo NUMERIC DEFAULT 0,
      valor_total NUMERIC DEFAULT 0,
      tipo_pagamento TEXT,
      conta_id INTEGER,
      data_compra DATE,
      data_vencimento DATE,
      observacoes TEXT,
      criado_em TIMESTAMP DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS lotes (
      id SERIAL PRIMARY KEY,
      codigo TEXT,
      fornecedor_id INTEGER REFERENCES fornecedores(id),
      data_lote DATE,
      quantidade_kg NUMERIC DEFAULT 0,
      valor_kg NUMERIC DEFAULT 0,
      frete NUMERIC DEFAULT 0,
      valor_total NUMERIC DEFAULT 0,
      status TEXT DEFAULT 'disponível',
      observacoes TEXT,
      criado_em TIMESTAMP DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS producoes (
      id SERIAL PRIMARY KEY,
      codigo TEXT,
      lote_id INTEGER REFERENCES lotes(id),
      prestador TEXT,
      data_producao DATE,
      quantidade_total NUMERIC DEFAULT 0,
      custo_total NUMERIC DEFAULT 0,
      observacoes TEXT,
      criado_em TIMESTAMP DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS producao_itens (
      id SERIAL PRIMARY KEY,
      producao_id INTEGER REFERENCES producoes(id) ON DELETE CASCADE,
      produto_id INTEGER REFERENCES produtos(id),
      quantidade_kg NUMERIC DEFAULT 0,
      custo_unitario NUMERIC DEFAULT 0,
      valor_total NUMERIC DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS movimentacoes_estoque (
      id SERIAL PRIMARY KEY,
      produto_id INTEGER REFERENCES produtos(id),
      tipo TEXT,
      origem TEXT,
      origem_id INTEGER,
      quantidade_kg NUMERIC DEFAULT 0,
      valor_unitario NUMERIC DEFAULT 0,
      data_movimento DATE,
      criado_em TIMESTAMP DEFAULT NOW()
    );


    CREATE INDEX IF NOT EXISTS idx_venda_itens_venda ON venda_itens(venda_id);
    CREATE INDEX IF NOT EXISTS idx_pagamentos_venda_venda ON pagamentos_venda(venda_id);
    CREATE INDEX IF NOT EXISTS idx_cheques_venda ON cheques(venda_id);
    CREATE INDEX IF NOT EXISTS idx_receber_cliente ON contas_receber(cliente_id);
    CREATE INDEX IF NOT EXISTS idx_financeiro_data ON lancamentos_financeiros(data_lancamento);
    CREATE INDEX IF NOT EXISTS idx_pagar_status ON contas_pagar(status);
    CREATE INDEX IF NOT EXISTS idx_compras_produto ON compras(produto_id);
    CREATE INDEX IF NOT EXISTS idx_lotes_fornecedor ON lotes(fornecedor_id);
    CREATE INDEX IF NOT EXISTS idx_producoes_lote ON producoes(lote_id);
    CREATE INDEX IF NOT EXISTS idx_mov_estoque_produto ON movimentacoes_estoque(produto_id);
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
      await client.query(
        `insert into movimentacoes_estoque (produto_id, tipo, origem, origem_id, quantidade_kg, valor_unitario, data_movimento)
         values ($1,$2,$3,$4,$5,$6,$7)`,
        [item.productId, 'saida', 'venda', vendaId, item.qty || 0, item.unitPrice || 0, date]
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

app.post('/cheques/:id/devolver', async (req, res) => {
  const id = Number(req.params.id);
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const chequeRes = await client.query('select * from cheques where id=$1', [id]);
    if (!chequeRes.rows.length) throw new Error('Cheque não encontrado.');
    const cheque = chequeRes.rows[0];
    await client.query('update cheques set status=$1 where id=$2', ['devolvido', id]);
    const clienteRes = await client.query('select nome from clientes where id=$1', [cheque.cliente_id]);
    const nomeCliente = clienteRes.rows[0] ? clienteRes.rows[0].nome : (cheque.emitente_nome || 'Cliente');
    const rec = await client.query(
      `insert into contas_receber (codigo, cliente_id, nome_cliente, categoria, valor_original, valor_aberto, data_lancamento, data_vencimento, status, origem, origem_id, observacoes)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
       returning *`,
      [`DEV-CHQ-${id}`, cheque.cliente_id, nomeCliente, 'cheque devolvido', cheque.valor || 0, cheque.valor || 0, new Date(), cheque.data_vencimento || new Date(), 'aberto', 'cheque_devolvido', id, 'Cheque devolvido']
    );
    await client.query(
      `insert into lancamentos_financeiros (codigo, tipo, categoria, favorecido, conta_id, valor, data_lancamento, origem, origem_id, observacoes)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
      [`FIN-DEV-CHQ-${id}`, 'saida', 'devolucao cheque', nomeCliente, null, cheque.valor || 0, new Date(), 'cheque', id, 'Cheque devolvido']
    );
    await client.query('COMMIT');
    res.json({ ok: true, receivable: rec.rows[0] });
  } catch (error) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: error.message });
  } finally {
    client.release();
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


app.get('/contas-pagar', async (_req, res) => {
  try {
    const result = await pool.query('select * from contas_pagar order by data_vencimento desc, id desc');
    res.json(result.rows.map(r => ({
      id: r.id,
      codigo: r.codigo,
      favorecido: r.favorecido,
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

app.post('/contas-pagar', async (req, res) => {
  const { codigo, favorecido, categoria, valor, date, dueDate, payNow, accountId, obs, origem, origemId } = req.body;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const openValue = payNow ? 0 : num(valor);
    const status = payNow ? 'pago' : 'aberto';
    const result = await client.query(
      `insert into contas_pagar (codigo, favorecido, categoria, valor_original, valor_aberto, data_lancamento, data_vencimento, status, origem, origem_id, conta_id, observacoes)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
       returning *`,
      [codigo || null, favorecido || '', categoria || 'manual', valor || 0, openValue, date || null, dueDate || date || null, status, origem || 'manual', origemId || null, payNow ? accountId || null : null, obs || null]
    );
    if (payNow) {
      await client.query(
        `insert into lancamentos_financeiros (codigo, tipo, categoria, favorecido, conta_id, valor, data_lancamento, origem, origem_id, observacoes)
         values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
        [`FIN-${codigo || 'PAG'}-${result.rows[0].id}`, 'saida', categoria || 'manual', favorecido || '', accountId || null, valor || 0, date || null, 'conta_pagar', result.rows[0].id, obs || null]
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

app.post('/contas-pagar/:id/pagar', async (req, res) => {
  const id = Number(req.params.id);
  const { value, accountId, date, obs } = req.body;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const atual = await client.query('select * from contas_pagar where id=$1', [id]);
    if (!atual.rows.length) throw new Error('Conta a pagar não encontrada.');
    const pag = atual.rows[0];
    const novoAberto = Math.max(0, num(pag.valor_aberto) - num(value));
    const novoStatus = novoAberto === 0 ? 'pago' : 'parcial';
    const updated = await client.query(
      `update contas_pagar
       set valor_aberto=$1, status=$2, conta_id=$3
       where id=$4
       returning *`,
      [novoAberto, novoStatus, accountId || pag.conta_id || null, id]
    );
    await client.query(
      `insert into lancamentos_financeiros (codigo, tipo, categoria, favorecido, conta_id, valor, data_lancamento, origem, origem_id, observacoes)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
      [`FIN-PAG-${id}-${Date.now()}`, 'saida', updated.rows[0].categoria || 'conta a pagar', updated.rows[0].favorecido || '', accountId || null, value || 0, date || null, 'conta_pagar', id, obs || null]
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

app.get('/compras', async (_req, res) => {
  try {
    const result = await pool.query('select * from compras order by data_compra desc, id desc');
    res.json(result.rows.map(c => ({
      id: c.id,
      codigo: c.codigo,
      fornecedor_id: c.fornecedor_id,
      produto_id: c.produto_id,
      quantidade_kg: num(c.quantidade_kg),
      valor_custo: num(c.valor_custo),
      valor_total: num(c.valor_total),
      tipo_pagamento: c.tipo_pagamento,
      conta_id: c.conta_id,
      data_compra: c.data_compra,
      data_vencimento: c.data_vencimento,
      observacoes: c.observacoes || ''
    })));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/compras', async (req, res) => {
  const { codigo, supplierId, productId, qty, costPrice, totalValue, paymentType, accountId, date, dueDate, obs } = req.body;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const total = num(totalValue) || (num(qty) * num(costPrice));
    const compra = await client.query(
      `insert into compras (codigo, fornecedor_id, produto_id, quantidade_kg, valor_custo, valor_total, tipo_pagamento, conta_id, data_compra, data_vencimento, observacoes)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
       returning *`,
      [codigo || null, supplierId || null, productId || null, qty || 0, costPrice || 0, total, paymentType || 'a prazo', paymentType === 'a vista' ? accountId || null : null, date || null, dueDate || date || null, obs || null]
    );
    const compraId = compra.rows[0].id;

    await client.query(
      `insert into movimentacoes_estoque (produto_id, tipo, origem, origem_id, quantidade_kg, valor_unitario, data_movimento)
       values ($1,$2,$3,$4,$5,$6,$7)`,
      [productId || null, 'entrada', 'compra_revenda', compraId, qty || 0, costPrice || 0, date || null]
    );

    const fornecedorRes = await client.query('select nome from fornecedores where id=$1', [supplierId || null]);
    const favorecido = fornecedorRes.rows[0] ? fornecedorRes.rows[0].nome : '';

    if (paymentType === 'a vista') {
      await client.query(
        `insert into lancamentos_financeiros (codigo, tipo, categoria, favorecido, conta_id, valor, data_lancamento, origem, origem_id, observacoes)
         values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
        [`FIN-${codigo || 'ENT'}-${compraId}`, 'saida', 'entrada mercadoria', favorecido, accountId || null, total, date || null, 'compra', compraId, obs || null]
      );
      await client.query(
        `insert into contas_pagar (codigo, favorecido, categoria, valor_original, valor_aberto, data_lancamento, data_vencimento, status, origem, origem_id, conta_id, observacoes)
         values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)`,
        [`PAG-${codigo || 'ENT'}-${compraId}`, favorecido, 'entrada mercadoria', total, 0, date || null, date || null, 'pago', 'compra', compraId, accountId || null, obs || null]
      );
    } else {
      await client.query(
        `insert into contas_pagar (codigo, favorecido, categoria, valor_original, valor_aberto, data_lancamento, data_vencimento, status, origem, origem_id, conta_id, observacoes)
         values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)`,
        [`PAG-${codigo || 'ENT'}-${compraId}`, favorecido, 'entrada mercadoria', total, total, date || null, dueDate || date || null, 'aberto', 'compra', compraId, null, obs || null]
      );
    }

    await client.query('COMMIT');
    res.status(201).json(compra.rows[0]);
  } catch (error) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: error.message });
  } finally {
    client.release();
  }
});

app.delete('/compras/:id', async (req, res) => {
  const id = Number(req.params.id);
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('delete from lancamentos_financeiros where origem=$1 and origem_id=$2', ['compra', id]);
    await client.query('delete from contas_pagar where origem=$1 and origem_id=$2', ['compra', id]);
    await client.query('delete from movimentacoes_estoque where origem=$1 and origem_id=$2', ['compra_revenda', id]);
    await client.query('delete from compras where id=$1', [id]);
    await client.query('COMMIT');
    res.json({ ok: true });
  } catch (error) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: error.message });
  } finally {
    client.release();
  }
});

app.get('/lotes', async (_req, res) => {
  try {
    const result = await pool.query('select * from lotes order by data_lote desc, id desc');
    res.json(result.rows.map(l => ({
      id: l.id,
      codigo: l.codigo,
      fornecedor_id: l.fornecedor_id,
      data_lote: l.data_lote,
      quantidade_kg: num(l.quantidade_kg),
      valor_kg: num(l.valor_kg),
      frete: num(l.frete),
      valor_total: num(l.valor_total),
      status: l.status,
      observacoes: l.observacoes || ''
    })));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/lotes', async (req, res) => {
  const { codigo, supplierId, date, qtyKg, priceKg, freight, obs } = req.body;
  try {
    const total = Number((num(qtyKg) * num(priceKg) + num(freight)).toFixed(2));
    const result = await pool.query(
      `insert into lotes (codigo, fornecedor_id, data_lote, quantidade_kg, valor_kg, frete, valor_total, status, observacoes)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9)
       returning *`,
      [codigo || null, supplierId || null, date || null, qtyKg || 0, priceKg || 0, freight || 0, total, 'disponível', obs || null]
    );
    res.status(201).json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.delete('/lotes/:id', async (req, res) => {
  const id = Number(req.params.id);
  try {
    const has = await pool.query('select 1 from producoes where lote_id=$1 limit 1', [id]);
    if (has.rows.length) return res.status(400).json({ error: 'Esse lote possui produção vinculada.' });
    await pool.query('delete from lotes where id=$1', [id]);
    res.json({ ok: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/producoes', async (_req, res) => {
  const client = await pool.connect();
  try {
    const prods = await client.query('select * from producoes order by data_producao desc, id desc');
    const ids = prods.rows.map(p => p.id);
    let itens = { rows: [] };
    if (ids.length) itens = await client.query('select * from producao_itens where producao_id = any($1::int[]) order by id asc', [ids]);
    res.json(prods.rows.map(p => ({
      id: p.id,
      codigo: p.codigo,
      lote_id: p.lote_id,
      prestador: p.prestador,
      data_producao: p.data_producao,
      quantidade_total: num(p.quantidade_total),
      custo_total: num(p.custo_total),
      observacoes: p.observacoes || '',
      itens: itens.rows.filter(i => i.producao_id === p.id).map(i => ({
        id: i.id,
        produto_id: i.produto_id,
        quantidade_kg: num(i.quantidade_kg),
        custo_unitario: num(i.custo_unitario),
        valor_total: num(i.valor_total)
      }))
    })));
  } catch (error) {
    res.status(500).json({ error: error.message });
  } finally {
    client.release();
  }
});

app.post('/producoes', async (req, res) => {
  const { codigo, lotId, provider, date, items, obs } = req.body;
  if (!lotId) return res.status(400).json({ error: 'Lote é obrigatório.' });
  if (!Array.isArray(items) || !items.length) return res.status(400).json({ error: 'Informe os produtos produzidos.' });
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const loteRes = await client.query('select * from lotes where id=$1', [lotId]);
    if (!loteRes.rows.length) throw new Error('Lote não encontrado.');
    const lote = loteRes.rows[0];
    const totalQty = items.reduce((s, i) => s + num(i.qty), 0);
    if (totalQty <= 0) throw new Error('Quantidade total inválida.');
    const totalCost = num(lote.valor_total || 0);
    const prod = await client.query(
      `insert into producoes (codigo, lote_id, prestador, data_producao, quantidade_total, custo_total, observacoes)
       values ($1,$2,$3,$4,$5,$6,$7)
       returning *`,
      [codigo || null, lotId, provider || '', date || null, totalQty, totalCost, obs || null]
    );
    const producaoId = prod.rows[0].id;
    for (const item of items) {
      const itemQty = num(item.qty);
      const unitCost = totalQty ? Number((totalCost / totalQty).toFixed(6)) : 0;
      const itemTotal = Number((unitCost * itemQty).toFixed(2));
      await client.query(
        `insert into producao_itens (producao_id, produto_id, quantidade_kg, custo_unitario, valor_total)
         values ($1,$2,$3,$4,$5)`,
        [producaoId, item.productId, itemQty, unitCost, itemTotal]
      );
      await client.query(
        `insert into movimentacoes_estoque (produto_id, tipo, origem, origem_id, quantidade_kg, valor_unitario, data_movimento)
         values ($1,$2,$3,$4,$5,$6,$7)`,
        [item.productId, 'entrada', 'produção', producaoId, itemQty, unitCost, date || null]
      );
    }
    await client.query('update lotes set status=$1 where id=$2', ['encerrado', lotId]);
    await client.query('COMMIT');
    res.status(201).json(prod.rows[0]);
  } catch (error) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: error.message });
  } finally {
    client.release();
  }
});

app.delete('/producoes/:id', async (req, res) => {
  const id = Number(req.params.id);
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const prod = await client.query('select * from producoes where id=$1', [id]);
    if (!prod.rows.length) throw new Error('Produção não encontrada.');
    await client.query('delete from movimentacoes_estoque where origem=$1 and origem_id=$2', ['produção', id]);
    await client.query('delete from producao_itens where producao_id=$1', [id]);
    await client.query('update lotes set status=$1 where id=$2', ['disponível', prod.rows[0].lote_id]);
    await client.query('delete from producoes where id=$1', [id]);
    await client.query('COMMIT');
    res.json({ ok: true });
  } catch (error) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: error.message });
  } finally {
    client.release();
  }
});

app.get('/estoque-movimentos', async (_req, res) => {
  try {
    const result = await pool.query('select * from movimentacoes_estoque order by data_movimento desc, id desc');
    res.json(result.rows.map(m => ({
      id: m.id,
      produto_id: m.produto_id,
      tipo: m.tipo,
      origem: m.origem,
      origem_id: m.origem_id,
      quantidade_kg: num(m.quantidade_kg),
      valor_unitario: num(m.valor_unitario),
      data_movimento: m.data_movimento
    })));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});



const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Servidor rodando na porta ${PORT}`);
});
