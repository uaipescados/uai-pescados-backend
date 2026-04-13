-- Estrutura consolidada do backend Uai Pescados
-- Pode ser usada manualmente no PostgreSQL.
-- O server.js também cria essas tabelas automaticamente ao subir.

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
  criado_em TIMESTAMP DEFAULT NOW(),
  antecipacao_id INTEGER REFERENCES antecipacoes(id),
  tipo_recebivel TEXT,
  data_recebimento DATE,
  data_baixa DATE,
  data_devolucao DATE,
  valor_recebido NUMERIC DEFAULT 0
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
  criado_em TIMESTAMP DEFAULT NOW(),
  antecipacao_id INTEGER REFERENCES antecipacoes(id),
  conta_receber_id INTEGER REFERENCES contas_receber(id),
  data_baixa DATE,
  data_devolucao DATE,
  observacoes TEXT
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

CREATE TABLE IF NOT EXISTS antecipacoes (
  id SERIAL PRIMARY KEY,
  codigo TEXT,
  data_lancamento DATE,
  tipo TEXT,
  instituicao TEXT,
  bordero TEXT,
  conta_id INTEGER,
  valor_bruto NUMERIC DEFAULT 0,
  valor_liquido NUMERIC DEFAULT 0,
  valor_taxa NUMERIC DEFAULT 0,
  observacoes TEXT,
  status TEXT DEFAULT 'efetivado',
  criado_em TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS antecipacao_itens (
  id SERIAL PRIMARY KEY,
  antecipacao_id INTEGER REFERENCES antecipacoes(id) ON DELETE CASCADE,
  conta_receber_id INTEGER REFERENCES contas_receber(id) ON DELETE CASCADE,
  cheque_id INTEGER REFERENCES cheques(id),
  valor NUMERIC DEFAULT 0,
  valor_bruto NUMERIC DEFAULT 0,
  valor_liquido NUMERIC DEFAULT 0,
  valor_taxa NUMERIC DEFAULT 0,
  status TEXT DEFAULT 'antecipado',
  criado_em TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS financeiro_historico (
  id SERIAL PRIMARY KEY,
  tipo_origem TEXT,
  origem_id INTEGER,
  acao TEXT,
  descricao TEXT,
  valor NUMERIC DEFAULT 0,
  data_evento TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_venda_itens_venda ON venda_itens(venda_id);
CREATE INDEX IF NOT EXISTS idx_pagamentos_venda_venda ON pagamentos_venda(venda_id);
CREATE INDEX IF NOT EXISTS idx_cheques_venda ON cheques(venda_id);
CREATE INDEX IF NOT EXISTS idx_receber_cliente ON contas_receber(cliente_id);
CREATE INDEX IF NOT EXISTS idx_receber_antecipacao ON contas_receber(antecipacao_id);
CREATE INDEX IF NOT EXISTS idx_cheques_antecipacao ON cheques(antecipacao_id);
CREATE INDEX IF NOT EXISTS idx_financeiro_data ON lancamentos_financeiros(data_lancamento);
CREATE INDEX IF NOT EXISTS idx_antecipacao_data ON antecipacoes(data_lancamento);
CREATE INDEX IF NOT EXISTS idx_antecipacao_itens_antecipacao ON antecipacao_itens(antecipacao_id);
CREATE INDEX IF NOT EXISTS idx_antecipacao_itens_receber ON antecipacao_itens(conta_receber_id);
CREATE INDEX IF NOT EXISTS idx_historico_origem ON financeiro_historico(tipo_origem, origem_id);
