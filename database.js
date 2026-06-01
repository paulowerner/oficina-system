const Database = require('better-sqlite3');
const path = require('path');
const crypto = require('crypto');

const db = new Database(path.join(__dirname, 'oficina.db'));
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

function initDatabase() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS clientes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nome TEXT NOT NULL,
      cpf_cnpj TEXT,
      telefone TEXT,
      email TEXT,
      endereco TEXT,
      cidade TEXT,
      observacoes TEXT,
      ativo INTEGER DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS veiculos (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      cliente_id INTEGER NOT NULL REFERENCES clientes(id),
      placa TEXT NOT NULL,
      marca TEXT,
      modelo TEXT,
      ano INTEGER,
      cor TEXT,
      km_atual INTEGER DEFAULT 0,
      observacoes TEXT,
      ativo INTEGER DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS categorias_servico (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nome TEXT NOT NULL,
      descricao TEXT,
      ativo INTEGER DEFAULT 1
    );

    CREATE TABLE IF NOT EXISTS servicos (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      categoria_id INTEGER REFERENCES categorias_servico(id),
      nome TEXT NOT NULL,
      descricao TEXT,
      preco REAL DEFAULT 0,
      comissao_percentual REAL DEFAULT 0,
      ativo INTEGER DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS categorias_produto (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nome TEXT NOT NULL,
      descricao TEXT,
      ativo INTEGER DEFAULT 1
    );

    CREATE TABLE IF NOT EXISTS produtos (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      categoria_id INTEGER REFERENCES categorias_produto(id),
      codigo TEXT,
      nome TEXT NOT NULL,
      descricao TEXT,
      preco_custo REAL DEFAULT 0,
      preco_venda REAL DEFAULT 0,
      estoque_atual REAL DEFAULT 0,
      estoque_minimo REAL DEFAULT 0,
      unidade TEXT DEFAULT 'UN',
      ativo INTEGER DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS funcionarios (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nome TEXT NOT NULL,
      cpf TEXT,
      telefone TEXT,
      cargo TEXT,
      comissao_percentual REAL DEFAULT 0,
      salario_base REAL DEFAULT 0,
      ativo INTEGER DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS ordens_servico (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      numero TEXT UNIQUE NOT NULL,
      cliente_id INTEGER NOT NULL REFERENCES clientes(id),
      veiculo_id INTEGER NOT NULL REFERENCES veiculos(id),
      funcionario_id INTEGER REFERENCES funcionarios(id),
      status TEXT DEFAULT 'aberta',
      km_entrada INTEGER,
      km_saida INTEGER,
      data_entrada DATETIME DEFAULT CURRENT_TIMESTAMP,
      data_previsao DATE,
      data_conclusao DATETIME,
      descricao_problema TEXT,
      observacoes TEXT,
      desconto REAL DEFAULT 0,
      total_servicos REAL DEFAULT 0,
      total_produtos REAL DEFAULT 0,
      total_geral REAL DEFAULT 0,
      forma_pagamento TEXT,
      pago INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS os_servicos (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      os_id INTEGER NOT NULL REFERENCES ordens_servico(id),
      servico_id INTEGER REFERENCES servicos(id),
      funcionario_id INTEGER REFERENCES funcionarios(id),
      descricao TEXT NOT NULL,
      preco REAL DEFAULT 0,
      comissao_percentual REAL DEFAULT 0,
      comissao_valor REAL DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS os_produtos (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      os_id INTEGER NOT NULL REFERENCES ordens_servico(id),
      produto_id INTEGER REFERENCES produtos(id),
      descricao TEXT NOT NULL,
      quantidade REAL DEFAULT 1,
      preco_unitario REAL DEFAULT 0,
      total REAL DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS comissoes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      funcionario_id INTEGER NOT NULL REFERENCES funcionarios(id),
      os_id INTEGER NOT NULL REFERENCES ordens_servico(id),
      os_servico_id INTEGER NOT NULL REFERENCES os_servicos(id),
      valor REAL DEFAULT 0,
      pago INTEGER DEFAULT 0,
      data_pagamento DATETIME,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS movimentos_estoque (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      produto_id INTEGER NOT NULL REFERENCES produtos(id),
      tipo TEXT NOT NULL,
      quantidade REAL NOT NULL,
      motivo TEXT,
      os_id INTEGER REFERENCES ordens_servico(id),
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS orcamentos (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      numero TEXT UNIQUE NOT NULL,
      cliente_id INTEGER REFERENCES clientes(id),
      veiculo_id INTEGER REFERENCES veiculos(id),
      funcionario_id INTEGER REFERENCES funcionarios(id),
      nome_prospect TEXT,
      telefone_prospect TEXT,
      email_prospect TEXT,
      veiculo_prospect TEXT,
      status TEXT DEFAULT 'pendente',
      validade DATE,
      descricao_problema TEXT,
      observacoes TEXT,
      desconto REAL DEFAULT 0,
      total_servicos REAL DEFAULT 0,
      total_produtos REAL DEFAULT 0,
      total_geral REAL DEFAULT 0,
      os_id INTEGER REFERENCES ordens_servico(id),
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS orcamento_servicos (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      orcamento_id INTEGER NOT NULL REFERENCES orcamentos(id),
      servico_id INTEGER REFERENCES servicos(id),
      descricao TEXT NOT NULL,
      preco REAL DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS orcamento_produtos (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      orcamento_id INTEGER NOT NULL REFERENCES orcamentos(id),
      produto_id INTEGER REFERENCES produtos(id),
      descricao TEXT NOT NULL,
      quantidade REAL DEFAULT 1,
      preco_unitario REAL DEFAULT 0,
      total REAL DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS usuarios (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      nome TEXT,
      ativo INTEGER DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // Migrations para banco existente
  const migrations = [
    'ALTER TABLE orcamentos ADD COLUMN nome_prospect TEXT',
    'ALTER TABLE orcamentos ADD COLUMN telefone_prospect TEXT',
    'ALTER TABLE orcamentos ADD COLUMN email_prospect TEXT',
    'ALTER TABLE orcamentos ADD COLUMN veiculo_prospect TEXT',
    "ALTER TABLE ordens_servico ADD COLUMN fotos TEXT DEFAULT '[]'",
    'ALTER TABLE ordens_servico ADD COLUMN veiculo_cor TEXT',
    'ALTER TABLE ordens_servico ADD COLUMN km_saida INTEGER',
  ];
  for (const sql of migrations) {
    try { db.exec(sql); } catch (_) {}
  }

  seedUsuarios();
  seedData();
}

function seedUsuarios() {
  const count = db.prepare('SELECT COUNT(*) as c FROM usuarios').get();
  if (count.c > 0) return;
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync('admin123', salt, 64).toString('hex');
  db.prepare('INSERT INTO usuarios (username, password_hash, nome) VALUES (?,?,?)').run('admin', `${salt}:${hash}`, 'Administrador');
}

function seedData() {
  const count = db.prepare('SELECT COUNT(*) as c FROM categorias_servico').get();
  if (count.c > 0) return;

  const catServicos = db.prepare('INSERT INTO categorias_servico (nome) VALUES (?)');
  ['Mecânica Geral', 'Elétrica Automotiva', 'Funilaria e Pintura', 'Suspensão e Freios', 'Motor e Câmbio', 'Ar Condicionado', 'Revisão e Preventiva'].forEach(n => catServicos.run(n));

  const catProdutos = db.prepare('INSERT INTO categorias_produto (nome) VALUES (?)');
  ['Lubrificantes e Óleos', 'Filtros', 'Freios', 'Elétrica', 'Suspensão', 'Motor', 'Pneus e Rodas', 'Acessórios'].forEach(n => catProdutos.run(n));

  const servico = db.prepare('INSERT INTO servicos (categoria_id, nome, preco, comissao_percentual) VALUES (?, ?, ?, ?)');
  servico.run(1, 'Troca de Óleo', 50, 10);
  servico.run(1, 'Revisão Geral', 200, 10);
  servico.run(2, 'Diagnóstico Elétrico', 80, 10);
  servico.run(2, 'Troca de Bateria', 60, 10);
  servico.run(3, 'Funilaria Parachoque', 300, 10);
  servico.run(4, 'Alinhamento e Balanceamento', 90, 10);
  servico.run(4, 'Troca de Pastilha de Freio', 120, 10);
  servico.run(5, 'Troca de Correia Dentada', 250, 10);
  servico.run(6, 'Recarga de Ar Condicionado', 180, 10);
  servico.run(7, 'Revisão 10.000 km', 150, 10);

  const produto = db.prepare('INSERT INTO produtos (categoria_id, codigo, nome, preco_custo, preco_venda, estoque_atual, estoque_minimo, unidade) VALUES (?, ?, ?, ?, ?, ?, ?, ?)');
  produto.run(1, 'OL001', 'Óleo Motor 5W30 Sintético 1L', 18, 35, 20, 5, 'L');
  produto.run(1, 'OL002', 'Óleo Motor 10W40 Semi-Sint 1L', 12, 25, 30, 5, 'L');
  produto.run(1, 'OL003', 'Óleo de Câmbio ATF 1L', 20, 40, 10, 3, 'L');
  produto.run(2, 'FI001', 'Filtro de Óleo Universal', 8, 18, 15, 5, 'UN');
  produto.run(2, 'FI002', 'Filtro de Ar Universal', 12, 25, 10, 3, 'UN');
  produto.run(2, 'FI003', 'Filtro de Combustível', 15, 30, 8, 3, 'UN');
  produto.run(3, 'FR001', 'Pastilha de Freio Dianteira (jogo)', 35, 70, 8, 2, 'JG');
  produto.run(3, 'FR002', 'Disco de Freio Dianteiro', 60, 120, 4, 2, 'UN');
  produto.run(4, 'EL001', 'Bateria 60Ah', 180, 320, 3, 1, 'UN');
  produto.run(5, 'SU001', 'Amortecedor Dianteiro', 120, 220, 4, 2, 'UN');

  const func = db.prepare('INSERT INTO funcionarios (nome, cargo, comissao_percentual, salario_base) VALUES (?, ?, ?, ?)');
  func.run('João Silva', 'Mecânico', 10, 1800);
  func.run('Pedro Santos', 'Eletricista', 10, 1800);
  func.run('Carlos Oliveira', 'Funileiro', 10, 1800);
}

initDatabase();

module.exports = db;
