create table if not exists clientes (
  id serial primary key,
  codigo varchar(20) unique not null,
  nome varchar(150) not null,
  telefone varchar(30),
  cidade varchar(80),
  limite_credito numeric(12,2),
  observacoes text,
  criado_em timestamp default now()
);

create table if not exists fornecedores (
  id serial primary key,
  codigo varchar(20) unique not null,
  nome varchar(150) not null,
  telefone varchar(30),
  cidade varchar(80),
  tipo varchar(50),
  observacoes text,
  criado_em timestamp default now()
);

create table if not exists produtos (
  id serial primary key,
  codigo varchar(20) unique not null,
  nome varchar(150) not null,
  tipo varchar(30) not null default 'revenda',
  unidade varchar(10) not null default 'kg',
  criado_em timestamp default now()
);
