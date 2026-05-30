const express = require('express');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const db = require('./database');

const app = express();
app.use(express.json({ limit: '50mb' }));
app.use(express.static(path.join(__dirname, 'public')));

// Upload de fotos
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = path.join(__dirname, 'public', 'uploads', `os_${req.params.id}`);
    fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    cb(null, `${Date.now()}_${Math.random().toString(36).slice(2)}.jpg`);
  },
});
const upload = multer({ storage, limits: { fileSize: 10 * 1024 * 1024 } });

function gerarNumeroOS() {
  const ano = new Date().getFullYear();
  const ultimo = db.prepare(`SELECT numero FROM ordens_servico WHERE numero LIKE ? ORDER BY id DESC LIMIT 1`).get(`${ano}-%`);
  if (!ultimo) return `${ano}-0001`;
  const seq = parseInt(ultimo.numero.split('-')[1]) + 1;
  return `${ano}-${String(seq).padStart(4, '0')}`;
}

function recalcularOS(osId) {
  const servicos = db.prepare('SELECT SUM(preco) as total FROM os_servicos WHERE os_id = ?').get(osId);
  const produtos = db.prepare('SELECT SUM(total) as total FROM os_produtos WHERE os_id = ?').get(osId);
  const os = db.prepare('SELECT desconto FROM ordens_servico WHERE id = ?').get(osId);
  const ts = servicos.total || 0;
  const tp = produtos.total || 0;
  const tg = ts + tp - (os.desconto || 0);
  db.prepare('UPDATE ordens_servico SET total_servicos=?, total_produtos=?, total_geral=? WHERE id=?').run(ts, tp, tg < 0 ? 0 : tg, osId);
}

// ==================== DASHBOARD ====================
app.get('/api/dashboard', (req, res) => {
  try {
    const hoje = new Date().toISOString().split('T')[0];
    const mesInicio = hoje.substring(0, 7) + '-01';

    const stats = {
      os_abertas: db.prepare(`SELECT COUNT(*) as c FROM ordens_servico WHERE status IN ('aberta','em_andamento','aguardando_pecas')`).get().c,
      os_hoje: db.prepare(`SELECT COUNT(*) as c FROM ordens_servico WHERE date(data_entrada)=?`).get(hoje).c,
      os_concluidas_mes: db.prepare(`SELECT COUNT(*) as c FROM ordens_servico WHERE status='concluida' AND date(data_conclusao)>=?`).get(mesInicio).c,
      faturamento_mes: db.prepare(`SELECT COALESCE(SUM(total_geral),0) as v FROM ordens_servico WHERE status='concluida' AND date(data_conclusao)>=?`).get(mesInicio).v,
      comissoes_pendentes: db.prepare(`SELECT COALESCE(SUM(valor),0) as v FROM comissoes WHERE pago=0`).get().v,
      produtos_estoque_baixo: db.prepare(`SELECT COUNT(*) as c FROM produtos WHERE estoque_atual <= estoque_minimo AND ativo=1`).get().c,
    };

    const os_recentes = db.prepare(`
      SELECT os.*, c.nome as cliente_nome, v.placa, v.marca, v.modelo,
             f.nome as funcionario_nome
      FROM ordens_servico os
      JOIN clientes c ON os.cliente_id = c.id
      JOIN veiculos v ON os.veiculo_id = v.id
      LEFT JOIN funcionarios f ON os.funcionario_id = f.id
      ORDER BY os.created_at DESC LIMIT 8
    `).all();

    const estoque_baixo = db.prepare(`
      SELECT p.*, cp.nome as categoria_nome
      FROM produtos p
      LEFT JOIN categorias_produto cp ON p.categoria_id = cp.id
      WHERE p.estoque_atual <= p.estoque_minimo AND p.ativo=1
      LIMIT 5
    `).all();

    res.json({ stats, os_recentes, estoque_baixo });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ==================== CLIENTES ====================
app.get('/api/clientes', (req, res) => {
  const { search } = req.query;
  let query = 'SELECT * FROM clientes WHERE ativo=1';
  const params = [];
  if (search) {
    query += ' AND (nome LIKE ? OR cpf_cnpj LIKE ? OR telefone LIKE ?)';
    const s = `%${search}%`;
    params.push(s, s, s);
  }
  query += ' ORDER BY nome';
  try { res.json(db.prepare(query).all(...params)); }
  catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/api/clientes/:id', (req, res) => {
  try {
    const cliente = db.prepare('SELECT * FROM clientes WHERE id=?').get(req.params.id);
    if (!cliente) return res.status(404).json({ error: 'Cliente não encontrado' });
    const veiculos = db.prepare('SELECT * FROM veiculos WHERE cliente_id=? AND ativo=1 ORDER BY placa').all(req.params.id);
    const ordens = db.prepare(`
      SELECT os.*, v.placa, v.marca, v.modelo FROM ordens_servico os
      JOIN veiculos v ON os.veiculo_id=v.id
      WHERE os.cliente_id=? ORDER BY os.created_at DESC LIMIT 10
    `).all(req.params.id);
    res.json({ ...cliente, veiculos, ordens });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/clientes', (req, res) => {
  const { nome, cpf_cnpj, telefone, email, endereco, cidade, observacoes } = req.body;
  if (!nome) return res.status(400).json({ error: 'Nome é obrigatório' });
  try {
    const r = db.prepare('INSERT INTO clientes (nome,cpf_cnpj,telefone,email,endereco,cidade,observacoes) VALUES (?,?,?,?,?,?,?)').run(nome, cpf_cnpj, telefone, email, endereco, cidade, observacoes);
    res.status(201).json(db.prepare('SELECT * FROM clientes WHERE id=?').get(r.lastInsertRowid));
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.put('/api/clientes/:id', (req, res) => {
  const { nome, cpf_cnpj, telefone, email, endereco, cidade, observacoes } = req.body;
  try {
    db.prepare('UPDATE clientes SET nome=?,cpf_cnpj=?,telefone=?,email=?,endereco=?,cidade=?,observacoes=? WHERE id=?').run(nome, cpf_cnpj, telefone, email, endereco, cidade, observacoes, req.params.id);
    res.json(db.prepare('SELECT * FROM clientes WHERE id=?').get(req.params.id));
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.delete('/api/clientes/:id', (req, res) => {
  try {
    db.prepare('UPDATE clientes SET ativo=0 WHERE id=?').run(req.params.id);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ==================== VEÍCULOS ====================
app.get('/api/veiculos', (req, res) => {
  const { cliente_id, search } = req.query;
  let query = `SELECT v.*, c.nome as cliente_nome FROM veiculos v JOIN clientes c ON v.cliente_id=c.id WHERE v.ativo=1`;
  const params = [];
  if (cliente_id) { query += ' AND v.cliente_id=?'; params.push(cliente_id); }
  if (search) { query += ' AND (v.placa LIKE ? OR v.marca LIKE ? OR v.modelo LIKE ? OR c.nome LIKE ?)'; const s=`%${search}%`; params.push(s,s,s,s); }
  query += ' ORDER BY v.placa';
  try { res.json(db.prepare(query).all(...params)); }
  catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/api/veiculos/:id', (req, res) => {
  try {
    const v = db.prepare('SELECT v.*, c.nome as cliente_nome FROM veiculos v JOIN clientes c ON v.cliente_id=c.id WHERE v.id=?').get(req.params.id);
    if (!v) return res.status(404).json({ error: 'Veículo não encontrado' });
    const ordens = db.prepare(`
      SELECT os.*, c.nome as cliente_nome FROM ordens_servico os
      JOIN clientes c ON os.cliente_id=c.id
      WHERE os.veiculo_id=? ORDER BY os.created_at DESC LIMIT 10
    `).all(req.params.id);
    res.json({ ...v, ordens });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/veiculos', (req, res) => {
  const { cliente_id, placa, marca, modelo, ano, cor, km_atual, observacoes } = req.body;
  if (!cliente_id || !placa) return res.status(400).json({ error: 'Cliente e placa são obrigatórios' });
  try {
    const r = db.prepare('INSERT INTO veiculos (cliente_id,placa,marca,modelo,ano,cor,km_atual,observacoes) VALUES (?,?,?,?,?,?,?,?)').run(cliente_id, placa.toUpperCase(), marca, modelo, ano, cor, km_atual, observacoes);
    res.status(201).json(db.prepare('SELECT v.*, c.nome as cliente_nome FROM veiculos v JOIN clientes c ON v.cliente_id=c.id WHERE v.id=?').get(r.lastInsertRowid));
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.put('/api/veiculos/:id', (req, res) => {
  const { cliente_id, placa, marca, modelo, ano, cor, km_atual, observacoes } = req.body;
  try {
    db.prepare('UPDATE veiculos SET cliente_id=?,placa=?,marca=?,modelo=?,ano=?,cor=?,km_atual=?,observacoes=? WHERE id=?').run(cliente_id, placa?.toUpperCase(), marca, modelo, ano, cor, km_atual, observacoes, req.params.id);
    res.json(db.prepare('SELECT v.*, c.nome as cliente_nome FROM veiculos v JOIN clientes c ON v.cliente_id=c.id WHERE v.id=?').get(req.params.id));
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.delete('/api/veiculos/:id', (req, res) => {
  try {
    db.prepare('UPDATE veiculos SET ativo=0 WHERE id=?').run(req.params.id);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ==================== CATEGORIAS SERVIÇO ====================
app.get('/api/categorias-servico', (req, res) => {
  try { res.json(db.prepare('SELECT * FROM categorias_servico WHERE ativo=1 ORDER BY nome').all()); }
  catch (err) { res.status(500).json({ error: err.message }); }
});
app.post('/api/categorias-servico', (req, res) => {
  const { nome, descricao } = req.body;
  if (!nome) return res.status(400).json({ error: 'Nome é obrigatório' });
  try { const r = db.prepare('INSERT INTO categorias_servico (nome,descricao) VALUES (?,?)').run(nome, descricao); res.status(201).json(db.prepare('SELECT * FROM categorias_servico WHERE id=?').get(r.lastInsertRowid)); }
  catch (err) { res.status(500).json({ error: err.message }); }
});
app.put('/api/categorias-servico/:id', (req, res) => {
  const { nome, descricao } = req.body;
  try { db.prepare('UPDATE categorias_servico SET nome=?,descricao=? WHERE id=?').run(nome, descricao, req.params.id); res.json(db.prepare('SELECT * FROM categorias_servico WHERE id=?').get(req.params.id)); }
  catch (err) { res.status(500).json({ error: err.message }); }
});
app.delete('/api/categorias-servico/:id', (req, res) => {
  try { db.prepare('UPDATE categorias_servico SET ativo=0 WHERE id=?').run(req.params.id); res.json({ success: true }); }
  catch (err) { res.status(500).json({ error: err.message }); }
});

// ==================== SERVIÇOS ====================
app.get('/api/servicos', (req, res) => {
  const { search, categoria_id } = req.query;
  let query = `SELECT s.*, cs.nome as categoria_nome FROM servicos s LEFT JOIN categorias_servico cs ON s.categoria_id=cs.id WHERE s.ativo=1`;
  const params = [];
  if (categoria_id) { query += ' AND s.categoria_id=?'; params.push(categoria_id); }
  if (search) { query += ' AND s.nome LIKE ?'; params.push(`%${search}%`); }
  query += ' ORDER BY s.nome';
  try { res.json(db.prepare(query).all(...params)); }
  catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/api/servicos/:id', (req, res) => {
  try { res.json(db.prepare('SELECT s.*, cs.nome as categoria_nome FROM servicos s LEFT JOIN categorias_servico cs ON s.categoria_id=cs.id WHERE s.id=?').get(req.params.id)); }
  catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/servicos', (req, res) => {
  const { categoria_id, nome, descricao, preco, comissao_percentual } = req.body;
  if (!nome) return res.status(400).json({ error: 'Nome é obrigatório' });
  try {
    const r = db.prepare('INSERT INTO servicos (categoria_id,nome,descricao,preco,comissao_percentual) VALUES (?,?,?,?,?)').run(categoria_id, nome, descricao, preco || 0, comissao_percentual || 0);
    res.status(201).json(db.prepare('SELECT s.*, cs.nome as categoria_nome FROM servicos s LEFT JOIN categorias_servico cs ON s.categoria_id=cs.id WHERE s.id=?').get(r.lastInsertRowid));
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.put('/api/servicos/:id', (req, res) => {
  const { categoria_id, nome, descricao, preco, comissao_percentual, ativo } = req.body;
  try {
    db.prepare('UPDATE servicos SET categoria_id=?,nome=?,descricao=?,preco=?,comissao_percentual=?,ativo=? WHERE id=?').run(categoria_id, nome, descricao, preco, comissao_percentual, ativo ?? 1, req.params.id);
    res.json(db.prepare('SELECT s.*, cs.nome as categoria_nome FROM servicos s LEFT JOIN categorias_servico cs ON s.categoria_id=cs.id WHERE s.id=?').get(req.params.id));
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.delete('/api/servicos/:id', (req, res) => {
  try { db.prepare('UPDATE servicos SET ativo=0 WHERE id=?').run(req.params.id); res.json({ success: true }); }
  catch (err) { res.status(500).json({ error: err.message }); }
});

// ==================== CATEGORIAS PRODUTO ====================
app.get('/api/categorias-produto', (req, res) => {
  try { res.json(db.prepare('SELECT * FROM categorias_produto WHERE ativo=1 ORDER BY nome').all()); }
  catch (err) { res.status(500).json({ error: err.message }); }
});
app.post('/api/categorias-produto', (req, res) => {
  const { nome, descricao } = req.body;
  if (!nome) return res.status(400).json({ error: 'Nome é obrigatório' });
  try { const r = db.prepare('INSERT INTO categorias_produto (nome,descricao) VALUES (?,?)').run(nome, descricao); res.status(201).json(db.prepare('SELECT * FROM categorias_produto WHERE id=?').get(r.lastInsertRowid)); }
  catch (err) { res.status(500).json({ error: err.message }); }
});
app.put('/api/categorias-produto/:id', (req, res) => {
  const { nome, descricao } = req.body;
  try { db.prepare('UPDATE categorias_produto SET nome=?,descricao=? WHERE id=?').run(nome, descricao, req.params.id); res.json(db.prepare('SELECT * FROM categorias_produto WHERE id=?').get(req.params.id)); }
  catch (err) { res.status(500).json({ error: err.message }); }
});
app.delete('/api/categorias-produto/:id', (req, res) => {
  try { db.prepare('UPDATE categorias_produto SET ativo=0 WHERE id=?').run(req.params.id); res.json({ success: true }); }
  catch (err) { res.status(500).json({ error: err.message }); }
});

// ==================== PRODUTOS ====================
app.get('/api/produtos', (req, res) => {
  const { search, categoria_id, estoque_baixo } = req.query;
  let query = `SELECT p.*, cp.nome as categoria_nome FROM produtos p LEFT JOIN categorias_produto cp ON p.categoria_id=cp.id WHERE p.ativo=1`;
  const params = [];
  if (categoria_id) { query += ' AND p.categoria_id=?'; params.push(categoria_id); }
  if (search) { query += ' AND (p.nome LIKE ? OR p.codigo LIKE ?)'; const s=`%${search}%`; params.push(s,s); }
  if (estoque_baixo === 'true') { query += ' AND p.estoque_atual <= p.estoque_minimo'; }
  query += ' ORDER BY p.nome';
  try { res.json(db.prepare(query).all(...params)); }
  catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/api/produtos/:id', (req, res) => {
  try { res.json(db.prepare('SELECT p.*, cp.nome as categoria_nome FROM produtos p LEFT JOIN categorias_produto cp ON p.categoria_id=cp.id WHERE p.id=?').get(req.params.id)); }
  catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/produtos', (req, res) => {
  const { categoria_id, codigo, nome, descricao, preco_custo, preco_venda, estoque_atual, estoque_minimo, unidade } = req.body;
  if (!nome) return res.status(400).json({ error: 'Nome é obrigatório' });
  try {
    const r = db.prepare('INSERT INTO produtos (categoria_id,codigo,nome,descricao,preco_custo,preco_venda,estoque_atual,estoque_minimo,unidade) VALUES (?,?,?,?,?,?,?,?,?)').run(categoria_id, codigo, nome, descricao, preco_custo || 0, preco_venda || 0, estoque_atual || 0, estoque_minimo || 0, unidade || 'UN');
    if ((estoque_atual || 0) > 0) {
      db.prepare('INSERT INTO movimentos_estoque (produto_id,tipo,quantidade,motivo) VALUES (?,?,?,?)').run(r.lastInsertRowid, 'entrada', estoque_atual, 'Estoque inicial');
    }
    res.status(201).json(db.prepare('SELECT p.*, cp.nome as categoria_nome FROM produtos p LEFT JOIN categorias_produto cp ON p.categoria_id=cp.id WHERE p.id=?').get(r.lastInsertRowid));
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.put('/api/produtos/:id', (req, res) => {
  const { categoria_id, codigo, nome, descricao, preco_custo, preco_venda, estoque_minimo, unidade, ativo } = req.body;
  try {
    db.prepare('UPDATE produtos SET categoria_id=?,codigo=?,nome=?,descricao=?,preco_custo=?,preco_venda=?,estoque_minimo=?,unidade=?,ativo=? WHERE id=?').run(categoria_id, codigo, nome, descricao, preco_custo, preco_venda, estoque_minimo, unidade, ativo ?? 1, req.params.id);
    res.json(db.prepare('SELECT p.*, cp.nome as categoria_nome FROM produtos p LEFT JOIN categorias_produto cp ON p.categoria_id=cp.id WHERE p.id=?').get(req.params.id));
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.delete('/api/produtos/:id', (req, res) => {
  try { db.prepare('UPDATE produtos SET ativo=0 WHERE id=?').run(req.params.id); res.json({ success: true }); }
  catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/produtos/:id/entrada', (req, res) => {
  const { quantidade, motivo } = req.body;
  if (!quantidade || quantidade <= 0) return res.status(400).json({ error: 'Quantidade inválida' });
  try {
    db.prepare('UPDATE produtos SET estoque_atual=estoque_atual+? WHERE id=?').run(quantidade, req.params.id);
    db.prepare('INSERT INTO movimentos_estoque (produto_id,tipo,quantidade,motivo) VALUES (?,?,?,?)').run(req.params.id, 'entrada', quantidade, motivo || 'Entrada manual');
    res.json(db.prepare('SELECT * FROM produtos WHERE id=?').get(req.params.id));
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ==================== FUNCIONÁRIOS ====================
app.get('/api/funcionarios', (req, res) => {
  const { search } = req.query;
  let query = 'SELECT * FROM funcionarios WHERE ativo=1';
  const params = [];
  if (search) { query += ' AND (nome LIKE ? OR cargo LIKE ?)'; const s=`%${search}%`; params.push(s,s); }
  query += ' ORDER BY nome';
  try { res.json(db.prepare(query).all(...params)); }
  catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/api/funcionarios/:id', (req, res) => {
  try {
    const f = db.prepare('SELECT * FROM funcionarios WHERE id=?').get(req.params.id);
    if (!f) return res.status(404).json({ error: 'Funcionário não encontrado' });
    const comissoes = db.prepare(`
      SELECT c.*, os.numero as os_numero, os.data_conclusao,
             oss.descricao as servico_descricao
      FROM comissoes c
      JOIN ordens_servico os ON c.os_id=os.id
      JOIN os_servicos oss ON c.os_servico_id=oss.id
      WHERE c.funcionario_id=? ORDER BY c.created_at DESC LIMIT 20
    `).all(req.params.id);
    res.json({ ...f, comissoes });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/funcionarios', (req, res) => {
  const { nome, cpf, telefone, cargo, comissao_percentual, salario_base } = req.body;
  if (!nome) return res.status(400).json({ error: 'Nome é obrigatório' });
  try {
    const r = db.prepare('INSERT INTO funcionarios (nome,cpf,telefone,cargo,comissao_percentual,salario_base) VALUES (?,?,?,?,?,?)').run(nome, cpf, telefone, cargo, comissao_percentual || 0, salario_base || 0);
    res.status(201).json(db.prepare('SELECT * FROM funcionarios WHERE id=?').get(r.lastInsertRowid));
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.put('/api/funcionarios/:id', (req, res) => {
  const { nome, cpf, telefone, cargo, comissao_percentual, salario_base, ativo } = req.body;
  try {
    db.prepare('UPDATE funcionarios SET nome=?,cpf=?,telefone=?,cargo=?,comissao_percentual=?,salario_base=?,ativo=? WHERE id=?').run(nome, cpf, telefone, cargo, comissao_percentual, salario_base, ativo ?? 1, req.params.id);
    res.json(db.prepare('SELECT * FROM funcionarios WHERE id=?').get(req.params.id));
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.delete('/api/funcionarios/:id', (req, res) => {
  try { db.prepare('UPDATE funcionarios SET ativo=0 WHERE id=?').run(req.params.id); res.json({ success: true }); }
  catch (err) { res.status(500).json({ error: err.message }); }
});

// ==================== ORDENS DE SERVIÇO ====================

// Entrada rápida: cria cliente + veículo + OS em uma chamada
app.post('/api/ordens/rapida', (req, res) => {
  const { nome_cliente, telefone, marca, modelo, placa, cor, km_entrada,
          ano, funcionario_id, data_previsao, descricao_problema, observacoes } = req.body;
  if (!nome_cliente) return res.status(400).json({ error: 'Nome do cliente é obrigatório' });
  try {
    // Cria ou localiza cliente pelo nome+telefone
    let cliente = telefone
      ? db.prepare('SELECT * FROM clientes WHERE telefone=? AND ativo=1 LIMIT 1').get(telefone)
      : null;
    if (!cliente) {
      const cR = db.prepare('INSERT INTO clientes (nome,telefone) VALUES (?,?)').run(nome_cliente, telefone||null);
      cliente = db.prepare('SELECT * FROM clientes WHERE id=?').get(cR.lastInsertRowid);
    } else {
      // Atualiza nome se mudou
      db.prepare('UPDATE clientes SET nome=? WHERE id=?').run(nome_cliente, cliente.id);
    }

    // Cria veículo
    const placaFmt = placa ? placa.toUpperCase().replace(/\s/g,'') : null;
    let veiculo = placaFmt
      ? db.prepare('SELECT * FROM veiculos WHERE placa=? AND ativo=1 LIMIT 1').get(placaFmt)
      : null;
    if (!veiculo) {
      const vR = db.prepare('INSERT INTO veiculos (cliente_id,placa,marca,modelo,ano,cor,km_atual) VALUES (?,?,?,?,?,?,?)').run(
        cliente.id, placaFmt||`SEM-${Date.now()}`, marca||null, modelo||null, ano||null, cor||null, km_entrada||0
      );
      veiculo = db.prepare('SELECT * FROM veiculos WHERE id=?').get(vR.lastInsertRowid);
    } else {
      // Vincula ao cliente se necessário e atualiza cor
      db.prepare('UPDATE veiculos SET cliente_id=?,cor=COALESCE(?,cor),marca=COALESCE(?,marca),modelo=COALESCE(?,modelo) WHERE id=?').run(cliente.id, cor||null, marca||null, modelo||null, veiculo.id);
    }

    const numero = gerarNumeroOS();
    const r = db.prepare(`INSERT INTO ordens_servico
      (numero,cliente_id,veiculo_id,funcionario_id,km_entrada,data_previsao,descricao_problema,observacoes,veiculo_cor)
      VALUES (?,?,?,?,?,?,?,?,?)
    `).run(numero, cliente.id, veiculo.id, funcionario_id||null, km_entrada||null, data_previsao||null, descricao_problema||null, observacoes||null, cor||null);

    const os = db.prepare(`
      SELECT os.*, c.nome as cliente_nome, c.telefone as cliente_telefone,
             v.placa, v.marca, v.modelo, v.cor, f.nome as funcionario_nome
      FROM ordens_servico os
      JOIN clientes c ON os.cliente_id=c.id
      JOIN veiculos v ON os.veiculo_id=v.id
      LEFT JOIN funcionarios f ON os.funcionario_id=f.id
      WHERE os.id=?`).get(r.lastInsertRowid);
    res.status(201).json(os);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/api/ordens', (req, res) => {
  const { status, search, data_inicio, data_fim, cliente_id } = req.query;
  let query = `
    SELECT os.*, c.nome as cliente_nome, v.placa, v.marca, v.modelo,
           f.nome as funcionario_nome
    FROM ordens_servico os
    JOIN clientes c ON os.cliente_id=c.id
    JOIN veiculos v ON os.veiculo_id=v.id
    LEFT JOIN funcionarios f ON os.funcionario_id=f.id
    WHERE 1=1
  `;
  const params = [];
  if (status) { query += ' AND os.status=?'; params.push(status); }
  if (cliente_id) { query += ' AND os.cliente_id=?'; params.push(cliente_id); }
  if (search) { query += ' AND (os.numero LIKE ? OR c.nome LIKE ? OR v.placa LIKE ?)'; const s=`%${search}%`; params.push(s,s,s); }
  if (data_inicio) { query += ' AND date(os.data_entrada)>=?'; params.push(data_inicio); }
  if (data_fim) { query += ' AND date(os.data_entrada)<=?'; params.push(data_fim); }
  query += ' ORDER BY os.created_at DESC';
  try { res.json(db.prepare(query).all(...params)); }
  catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/api/ordens/:id', (req, res) => {
  try {
    const os = db.prepare(`
      SELECT os.*, c.nome as cliente_nome, c.telefone as cliente_telefone,
             v.placa, v.marca, v.modelo, v.ano, v.cor,
             f.nome as funcionario_nome
      FROM ordens_servico os
      JOIN clientes c ON os.cliente_id=c.id
      JOIN veiculos v ON os.veiculo_id=v.id
      LEFT JOIN funcionarios f ON os.funcionario_id=f.id
      WHERE os.id=?
    `).get(req.params.id);
    if (!os) return res.status(404).json({ error: 'OS não encontrada' });

    const servicos = db.prepare(`
      SELECT oss.*, s.nome as servico_nome, f.nome as funcionario_nome
      FROM os_servicos oss
      LEFT JOIN servicos s ON oss.servico_id=s.id
      LEFT JOIN funcionarios f ON oss.funcionario_id=f.id
      WHERE oss.os_id=? ORDER BY oss.id
    `).all(req.params.id);

    const produtos = db.prepare(`
      SELECT osp.*, p.codigo as produto_codigo, p.unidade as produto_unidade
      FROM os_produtos osp
      LEFT JOIN produtos p ON osp.produto_id=p.id
      WHERE osp.os_id=? ORDER BY osp.id
    `).all(req.params.id);

    res.json({ ...os, servicos, produtos });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/ordens', (req, res) => {
  const { cliente_id, veiculo_id, funcionario_id, km_entrada, data_previsao, descricao_problema, observacoes } = req.body;
  if (!cliente_id || !veiculo_id) return res.status(400).json({ error: 'Cliente e veículo são obrigatórios' });
  try {
    const numero = gerarNumeroOS();
    const r = db.prepare('INSERT INTO ordens_servico (numero,cliente_id,veiculo_id,funcionario_id,km_entrada,data_previsao,descricao_problema,observacoes) VALUES (?,?,?,?,?,?,?,?)').run(numero, cliente_id, veiculo_id, funcionario_id, km_entrada, data_previsao, descricao_problema, observacoes);
    res.status(201).json(db.prepare(`
      SELECT os.*, c.nome as cliente_nome, v.placa, v.marca, v.modelo, f.nome as funcionario_nome
      FROM ordens_servico os JOIN clientes c ON os.cliente_id=c.id JOIN veiculos v ON os.veiculo_id=v.id
      LEFT JOIN funcionarios f ON os.funcionario_id=f.id WHERE os.id=?
    `).get(r.lastInsertRowid));
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.put('/api/ordens/:id', (req, res) => {
  const { funcionario_id, km_entrada, data_previsao, descricao_problema, observacoes, desconto, forma_pagamento, pago } = req.body;
  try {
    db.prepare('UPDATE ordens_servico SET funcionario_id=?,km_entrada=?,data_previsao=?,descricao_problema=?,observacoes=?,desconto=?,forma_pagamento=?,pago=? WHERE id=?').run(funcionario_id, km_entrada, data_previsao, descricao_problema, observacoes, desconto || 0, forma_pagamento, pago ? 1 : 0, req.params.id);
    recalcularOS(req.params.id);
    res.json(db.prepare('SELECT * FROM ordens_servico WHERE id=?').get(req.params.id));
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.put('/api/ordens/:id/status', (req, res) => {
  const { status } = req.body;
  const validos = ['aberta', 'em_andamento', 'aguardando_pecas'];
  if (!validos.includes(status)) return res.status(400).json({ error: 'Status inválido' });
  try {
    const os = db.prepare('SELECT * FROM ordens_servico WHERE id=?').get(req.params.id);
    if (!os) return res.status(404).json({ error: 'OS não encontrada' });
    if (['concluida', 'cancelada'].includes(os.status)) return res.status(400).json({ error: 'OS já finalizada' });
    db.prepare('UPDATE ordens_servico SET status=? WHERE id=?').run(status, req.params.id);
    res.json(db.prepare('SELECT * FROM ordens_servico WHERE id=?').get(req.params.id));
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/ordens/:id/fechar', (req, res) => {
  const { km_saida, forma_pagamento, pago } = req.body;
  try {
    const os = db.prepare('SELECT * FROM ordens_servico WHERE id=?').get(req.params.id);
    if (!os) return res.status(404).json({ error: 'OS não encontrada' });
    if (['concluida', 'cancelada'].includes(os.status)) return res.status(400).json({ error: 'OS já finalizada' });

    recalcularOS(os.id);
    const osAtualizada = db.prepare('SELECT * FROM ordens_servico WHERE id=?').get(os.id);

    db.prepare('UPDATE ordens_servico SET status=?,data_conclusao=?,km_saida=?,forma_pagamento=?,pago=?,total_servicos=?,total_produtos=?,total_geral=? WHERE id=?').run(
      'concluida', new Date().toISOString(), km_saida, forma_pagamento, pago ? 1 : 0,
      osAtualizada.total_servicos, osAtualizada.total_produtos, osAtualizada.total_geral, os.id
    );

    const servicos = db.prepare('SELECT * FROM os_servicos WHERE os_id=?').all(os.id);
    for (const s of servicos) {
      if (s.funcionario_id && s.comissao_percentual > 0) {
        const valor = s.preco * (s.comissao_percentual / 100);
        db.prepare('UPDATE os_servicos SET comissao_valor=? WHERE id=?').run(valor, s.id);
        db.prepare('INSERT INTO comissoes (funcionario_id,os_id,os_servico_id,valor) VALUES (?,?,?,?)').run(s.funcionario_id, os.id, s.id, valor);
      }
    }

    const produtos = db.prepare('SELECT * FROM os_produtos WHERE os_id=?').all(os.id);
    for (const p of produtos) {
      if (p.produto_id) {
        db.prepare('UPDATE produtos SET estoque_atual=MAX(0,estoque_atual-?) WHERE id=?').run(p.quantidade, p.produto_id);
        db.prepare('INSERT INTO movimentos_estoque (produto_id,tipo,quantidade,motivo,os_id) VALUES (?,?,?,?,?)').run(p.produto_id, 'saida', p.quantidade, `OS ${os.numero}`, os.id);
      }
    }

    res.json(db.prepare('SELECT * FROM ordens_servico WHERE id=?').get(os.id));
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/ordens/:id/cancelar', (req, res) => {
  try {
    const os = db.prepare('SELECT * FROM ordens_servico WHERE id=?').get(req.params.id);
    if (!os) return res.status(404).json({ error: 'OS não encontrada' });
    if (os.status === 'concluida') return res.status(400).json({ error: 'OS já concluída, não pode cancelar' });
    db.prepare('UPDATE ordens_servico SET status=? WHERE id=?').run('cancelada', req.params.id);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ==================== OS FOTOS ====================
app.post('/api/ordens/:id/fotos', upload.single('foto'), (req, res) => {
  try {
    const os = db.prepare('SELECT * FROM ordens_servico WHERE id=?').get(req.params.id);
    if (!os) return res.status(404).json({ error: 'OS não encontrada' });
    const fotos = JSON.parse(os.fotos || '[]');
    const url = `/uploads/os_${req.params.id}/${req.file.filename}`;
    fotos.push(url);
    db.prepare('UPDATE ordens_servico SET fotos=? WHERE id=?').run(JSON.stringify(fotos), req.params.id);
    res.json({ url, fotos });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.delete('/api/ordens/:id/fotos', (req, res) => {
  const { url } = req.body;
  try {
    const os = db.prepare('SELECT * FROM ordens_servico WHERE id=?').get(req.params.id);
    if (!os) return res.status(404).json({ error: 'OS não encontrada' });
    let fotos = JSON.parse(os.fotos || '[]');
    fotos = fotos.filter(f => f !== url);
    db.prepare('UPDATE ordens_servico SET fotos=? WHERE id=?').run(JSON.stringify(fotos), req.params.id);
    // Remove arquivo do disco
    try { fs.unlinkSync(path.join(__dirname, 'public', url)); } catch (_) {}
    res.json({ fotos });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Gera texto formatado para WhatsApp
app.get('/api/ordens/:id/whatsapp', (req, res) => {
  try {
    const os = db.prepare(`
      SELECT os.*, c.nome as cliente_nome, c.telefone as cliente_telefone,
             v.placa, v.marca, v.modelo, v.ano, v.cor
      FROM ordens_servico os
      JOIN clientes c ON os.cliente_id=c.id
      JOIN veiculos v ON os.veiculo_id=v.id
      WHERE os.id=?`).get(req.params.id);
    if (!os) return res.status(404).json({ error: 'OS não encontrada' });

    const servicos = db.prepare('SELECT * FROM os_servicos WHERE os_id=?').all(req.params.id);
    const produtos  = db.prepare('SELECT * FROM os_produtos WHERE os_id=?').all(req.params.id);

    const fmt = v => 'R$ ' + (parseFloat(v)||0).toFixed(2).replace('.',',');

    let txt = `🔧 *ORDEM DE SERVIÇO #${os.numero}*\n`;
    txt += `📅 ${new Date(os.data_entrada).toLocaleDateString('pt-BR')}\n\n`;
    txt += `👤 *Cliente:* ${os.cliente_nome}\n`;
    if (os.cliente_telefone) txt += `📞 ${os.cliente_telefone}\n`;
    txt += `\n🚗 *Veículo:* ${os.placa} — ${os.marca||''} ${os.modelo||''} ${os.ano||''}\n`;
    if (os.veiculo_cor || os.cor) txt += `🎨 Cor: ${os.veiculo_cor || os.cor}\n`;
    if (os.km_entrada) txt += `📊 KM: ${parseInt(os.km_entrada).toLocaleString('pt-BR')}\n`;

    if (servicos.length) {
      txt += `\n🔩 *SERVIÇOS:*\n`;
      servicos.forEach(s => { txt += `• ${s.descricao}: ${fmt(s.preco)}\n`; });
    }
    if (produtos.length) {
      txt += `\n📦 *PEÇAS:*\n`;
      produtos.forEach(p => { txt += `• ${p.descricao} (${parseFloat(p.quantidade).toFixed(1).replace('.',',')} un): ${fmt(p.total)}\n`; });
    }

    txt += `\n━━━━━━━━━━━━━━\n`;
    if (os.desconto > 0) {
      txt += `Serviços: ${fmt(os.total_servicos)}\n`;
      txt += `Peças: ${fmt(os.total_produtos)}\n`;
      txt += `Desconto: -${fmt(os.desconto)}\n`;
    }
    txt += `💰 *TOTAL: ${fmt(os.total_geral)}*\n`;
    if (os.forma_pagamento) txt += `💳 Pagamento: ${os.forma_pagamento}\n`;
    if (os.data_previsao) txt += `\n⏰ *Previsão de entrega:* ${new Date(os.data_previsao+'T12:00:00').toLocaleDateString('pt-BR')}\n`;
    txt += `\nObrigado pela confiança! 🙏`;

    res.json({ texto: txt, telefone: os.cliente_telefone });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ==================== OS SERVIÇOS ====================
app.post('/api/ordens/:id/servicos', (req, res) => {
  const { servico_id, funcionario_id, descricao, preco, comissao_percentual } = req.body;
  if (!descricao) return res.status(400).json({ error: 'Descrição é obrigatória' });
  try {
    const os = db.prepare('SELECT * FROM ordens_servico WHERE id=?').get(req.params.id);
    if (!os || ['concluida', 'cancelada'].includes(os.status)) return res.status(400).json({ error: 'OS não pode ser editada' });

    let fid = funcionario_id;
    let comissao = comissao_percentual || 0;

    if (fid && !comissao_percentual && servico_id) {
      const serv = db.prepare('SELECT comissao_percentual FROM servicos WHERE id=?').get(servico_id);
      if (serv) comissao = serv.comissao_percentual;
    }
    if (fid && !comissao) {
      const func = db.prepare('SELECT comissao_percentual FROM funcionarios WHERE id=?').get(fid);
      if (func) comissao = func.comissao_percentual;
    }

    const r = db.prepare('INSERT INTO os_servicos (os_id,servico_id,funcionario_id,descricao,preco,comissao_percentual) VALUES (?,?,?,?,?,?)').run(req.params.id, servico_id, fid, descricao, preco || 0, comissao);
    recalcularOS(req.params.id);
    res.status(201).json(db.prepare(`
      SELECT oss.*, s.nome as servico_nome, f.nome as funcionario_nome
      FROM os_servicos oss LEFT JOIN servicos s ON oss.servico_id=s.id
      LEFT JOIN funcionarios f ON oss.funcionario_id=f.id WHERE oss.id=?
    `).get(r.lastInsertRowid));
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.put('/api/ordens/:id/servicos/:itemId', (req, res) => {
  const { funcionario_id, descricao, preco, comissao_percentual } = req.body;
  try {
    db.prepare('UPDATE os_servicos SET funcionario_id=?,descricao=?,preco=?,comissao_percentual=? WHERE id=? AND os_id=?').run(funcionario_id, descricao, preco, comissao_percentual, req.params.itemId, req.params.id);
    recalcularOS(req.params.id);
    res.json(db.prepare('SELECT * FROM os_servicos WHERE id=?').get(req.params.itemId));
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.delete('/api/ordens/:id/servicos/:itemId', (req, res) => {
  try {
    db.prepare('DELETE FROM os_servicos WHERE id=? AND os_id=?').run(req.params.itemId, req.params.id);
    recalcularOS(req.params.id);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ==================== OS PRODUTOS ====================
app.post('/api/ordens/:id/produtos', (req, res) => {
  const { produto_id, descricao, quantidade, preco_unitario } = req.body;
  if (!descricao) return res.status(400).json({ error: 'Descrição é obrigatória' });
  try {
    const os = db.prepare('SELECT * FROM ordens_servico WHERE id=?').get(req.params.id);
    if (!os || ['concluida', 'cancelada'].includes(os.status)) return res.status(400).json({ error: 'OS não pode ser editada' });
    const qty = quantidade || 1;
    const price = preco_unitario || 0;
    const total = qty * price;
    const r = db.prepare('INSERT INTO os_produtos (os_id,produto_id,descricao,quantidade,preco_unitario,total) VALUES (?,?,?,?,?,?)').run(req.params.id, produto_id, descricao, qty, price, total);
    recalcularOS(req.params.id);
    res.status(201).json(db.prepare(`
      SELECT osp.*, p.codigo as produto_codigo, p.unidade as produto_unidade
      FROM os_produtos osp LEFT JOIN produtos p ON osp.produto_id=p.id WHERE osp.id=?
    `).get(r.lastInsertRowid));
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.put('/api/ordens/:id/produtos/:itemId', (req, res) => {
  const { descricao, quantidade, preco_unitario } = req.body;
  try {
    const total = (quantidade || 1) * (preco_unitario || 0);
    db.prepare('UPDATE os_produtos SET descricao=?,quantidade=?,preco_unitario=?,total=? WHERE id=? AND os_id=?').run(descricao, quantidade, preco_unitario, total, req.params.itemId, req.params.id);
    recalcularOS(req.params.id);
    res.json(db.prepare('SELECT * FROM os_produtos WHERE id=?').get(req.params.itemId));
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.delete('/api/ordens/:id/produtos/:itemId', (req, res) => {
  try {
    db.prepare('DELETE FROM os_produtos WHERE id=? AND os_id=?').run(req.params.itemId, req.params.id);
    recalcularOS(req.params.id);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ==================== COMISSÕES ====================
app.get('/api/comissoes', (req, res) => {
  const { funcionario_id, pago, data_inicio, data_fim } = req.query;
  let query = `
    SELECT c.*, f.nome as funcionario_nome, f.cargo as funcionario_cargo,
           os.numero as os_numero, oss.descricao as servico_descricao, oss.preco as servico_preco
    FROM comissoes c
    JOIN funcionarios f ON c.funcionario_id=f.id
    JOIN ordens_servico os ON c.os_id=os.id
    JOIN os_servicos oss ON c.os_servico_id=oss.id
    WHERE 1=1
  `;
  const params = [];
  if (funcionario_id) { query += ' AND c.funcionario_id=?'; params.push(funcionario_id); }
  if (pago !== undefined) { query += ' AND c.pago=?'; params.push(pago === 'true' ? 1 : 0); }
  if (data_inicio) { query += ' AND date(c.created_at)>=?'; params.push(data_inicio); }
  if (data_fim) { query += ' AND date(c.created_at)<=?'; params.push(data_fim); }
  query += ' ORDER BY c.created_at DESC';
  try { res.json(db.prepare(query).all(...params)); }
  catch (err) { res.status(500).json({ error: err.message }); }
});

app.put('/api/comissoes/:id/pagar', (req, res) => {
  try {
    db.prepare('UPDATE comissoes SET pago=1, data_pagamento=? WHERE id=?').run(new Date().toISOString(), req.params.id);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.put('/api/comissoes/pagar-lote', (req, res) => {
  const { ids } = req.body;
  if (!ids || !ids.length) return res.status(400).json({ error: 'IDs necessários' });
  try {
    const stmt = db.prepare('UPDATE comissoes SET pago=1, data_pagamento=? WHERE id=?');
    const now = new Date().toISOString();
    for (const id of ids) stmt.run(now, id);
    res.json({ success: true, count: ids.length });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ==================== RELATÓRIOS ====================
app.get('/api/relatorios/faturamento', (req, res) => {
  const { data_inicio, data_fim } = req.query;
  if (!data_inicio || !data_fim) return res.status(400).json({ error: 'Período obrigatório' });
  try {
    const totais = db.prepare(`
      SELECT COUNT(*) as total_os, COALESCE(SUM(total_servicos),0) as total_servicos,
             COALESCE(SUM(total_produtos),0) as total_produtos, COALESCE(SUM(desconto),0) as total_desconto,
             COALESCE(SUM(total_geral),0) as total_geral
      FROM ordens_servico WHERE status='concluida' AND date(data_conclusao) BETWEEN ? AND ?
    `).get(data_inicio, data_fim);

    const por_dia = db.prepare(`
      SELECT date(data_conclusao) as dia, COUNT(*) as qtd, COALESCE(SUM(total_geral),0) as total
      FROM ordens_servico WHERE status='concluida' AND date(data_conclusao) BETWEEN ? AND ?
      GROUP BY date(data_conclusao) ORDER BY dia
    `).all(data_inicio, data_fim);

    const top_servicos = db.prepare(`
      SELECT oss.descricao, COUNT(*) as qtd, COALESCE(SUM(oss.preco),0) as total
      FROM os_servicos oss JOIN ordens_servico os ON oss.os_id=os.id
      WHERE os.status='concluida' AND date(os.data_conclusao) BETWEEN ? AND ?
      GROUP BY oss.descricao ORDER BY total DESC LIMIT 10
    `).all(data_inicio, data_fim);

    const top_produtos = db.prepare(`
      SELECT osp.descricao, COALESCE(SUM(osp.quantidade),0) as qtd_total, COALESCE(SUM(osp.total),0) as total
      FROM os_produtos osp JOIN ordens_servico os ON osp.os_id=os.id
      WHERE os.status='concluida' AND date(os.data_conclusao) BETWEEN ? AND ?
      GROUP BY osp.descricao ORDER BY total DESC LIMIT 10
    `).all(data_inicio, data_fim);

    const por_funcionario = db.prepare(`
      SELECT f.nome, COUNT(DISTINCT os.id) as qtd_os, COALESCE(SUM(oss.preco),0) as total_servicos,
             COALESCE(SUM(c.valor),0) as total_comissoes
      FROM funcionarios f
      LEFT JOIN os_servicos oss ON oss.funcionario_id=f.id
      LEFT JOIN ordens_servico os ON oss.os_id=os.id AND os.status='concluida' AND date(os.data_conclusao) BETWEEN ? AND ?
      LEFT JOIN comissoes c ON c.os_servico_id=oss.id
      WHERE f.ativo=1 GROUP BY f.id ORDER BY total_servicos DESC
    `).all(data_inicio, data_fim);

    res.json({ totais, por_dia, top_servicos, top_produtos, por_funcionario });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/api/relatorios/comissoes', (req, res) => {
  const { data_inicio, data_fim, funcionario_id } = req.query;
  if (!data_inicio || !data_fim) return res.status(400).json({ error: 'Período obrigatório' });
  try {
    let query = `
      SELECT f.nome as funcionario, f.cargo,
             COUNT(*) as qtd_servicos,
             COALESCE(SUM(c.valor),0) as total,
             COALESCE(SUM(CASE WHEN c.pago=1 THEN c.valor ELSE 0 END),0) as total_pago,
             COALESCE(SUM(CASE WHEN c.pago=0 THEN c.valor ELSE 0 END),0) as total_pendente
      FROM comissoes c JOIN funcionarios f ON c.funcionario_id=f.id
      WHERE date(c.created_at) BETWEEN ? AND ?
    `;
    const params = [data_inicio, data_fim];
    if (funcionario_id) { query += ' AND c.funcionario_id=?'; params.push(funcionario_id); }
    query += ' GROUP BY c.funcionario_id ORDER BY total DESC';
    const resumo = db.prepare(query).all(...params);

    let detalhe = [];
    if (funcionario_id) {
      detalhe = db.prepare(`
        SELECT c.*, os.numero as os_numero, oss.descricao as servico, oss.preco as preco_servico
        FROM comissoes c JOIN ordens_servico os ON c.os_id=os.id JOIN os_servicos oss ON c.os_servico_id=oss.id
        WHERE c.funcionario_id=? AND date(c.created_at) BETWEEN ? AND ?
        ORDER BY c.created_at DESC
      `).all(funcionario_id, data_inicio, data_fim);
    }

    res.json({ resumo, detalhe });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/api/relatorios/estoque', (req, res) => {
  try {
    const produtos = db.prepare(`
      SELECT p.*, cp.nome as categoria_nome,
             (p.estoque_atual * p.preco_custo) as valor_custo,
             (p.estoque_atual * p.preco_venda) as valor_venda,
             CASE WHEN p.estoque_atual <= p.estoque_minimo THEN 1 ELSE 0 END as estoque_baixo
      FROM produtos p LEFT JOIN categorias_produto cp ON p.categoria_id=cp.id
      WHERE p.ativo=1 ORDER BY p.nome
    `).all();
    const totais = { valor_custo: produtos.reduce((s,p)=>s+p.valor_custo,0), valor_venda: produtos.reduce((s,p)=>s+p.valor_venda,0), com_estoque_baixo: produtos.filter(p=>p.estoque_baixo).length };
    res.json({ produtos, totais });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/api/relatorios/movimentos', (req, res) => {
  const { produto_id, data_inicio, data_fim } = req.query;
  let query = `
    SELECT m.*, p.nome as produto_nome, p.codigo as produto_codigo, p.unidade as produto_unidade
    FROM movimentos_estoque m JOIN produtos p ON m.produto_id=p.id WHERE 1=1
  `;
  const params = [];
  if (produto_id) { query += ' AND m.produto_id=?'; params.push(produto_id); }
  if (data_inicio) { query += ' AND date(m.created_at)>=?'; params.push(data_inicio); }
  if (data_fim) { query += ' AND date(m.created_at)<=?'; params.push(data_fim); }
  query += ' ORDER BY m.created_at DESC LIMIT 200';
  try { res.json(db.prepare(query).all(...params)); }
  catch (err) { res.status(500).json({ error: err.message }); }
});

// ==================== ORÇAMENTOS ====================
function gerarNumeroOrcamento() {
  const ano = new Date().getFullYear();
  const ultimo = db.prepare(`SELECT numero FROM orcamentos WHERE numero LIKE ? ORDER BY id DESC LIMIT 1`).get(`ORC-${ano}-%`);
  if (!ultimo) return `ORC-${ano}-0001`;
  const seq = parseInt(ultimo.numero.split('-')[2]) + 1;
  return `ORC-${ano}-${String(seq).padStart(4, '0')}`;
}

function recalcularOrcamento(orcId) {
  const servicos = db.prepare('SELECT SUM(preco) as t FROM orcamento_servicos WHERE orcamento_id=?').get(orcId);
  const produtos  = db.prepare('SELECT SUM(total) as t FROM orcamento_produtos WHERE orcamento_id=?').get(orcId);
  const orc = db.prepare('SELECT desconto FROM orcamentos WHERE id=?').get(orcId);
  const ts = servicos.t || 0, tp = produtos.t || 0;
  const tg = Math.max(0, ts + tp - (orc.desconto || 0));
  db.prepare('UPDATE orcamentos SET total_servicos=?,total_produtos=?,total_geral=? WHERE id=?').run(ts, tp, tg, orcId);
}

app.get('/api/orcamentos', (req, res) => {
  const { status, search } = req.query;
  let q = `
    SELECT o.*,
           c.nome as cliente_nome,
           v.placa, v.marca, v.modelo,
           f.nome as funcionario_nome,
           COALESCE(c.nome, o.nome_prospect, 'Sem identificação') as display_nome
    FROM orcamentos o
    LEFT JOIN clientes c ON o.cliente_id=c.id
    LEFT JOIN veiculos v ON o.veiculo_id=v.id
    LEFT JOIN funcionarios f ON o.funcionario_id=f.id WHERE 1=1`;
  const params = [];
  if (status) { q += ' AND o.status=?'; params.push(status); }
  if (search) {
    q += ' AND (o.numero LIKE ? OR c.nome LIKE ? OR o.nome_prospect LIKE ? OR v.placa LIKE ? OR o.veiculo_prospect LIKE ?)';
    const s = `%${search}%`;
    params.push(s, s, s, s, s);
  }
  q += ' ORDER BY o.created_at DESC';
  try { res.json(db.prepare(q).all(...params)); }
  catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/api/orcamentos/:id', (req, res) => {
  try {
    const orc = db.prepare(`
      SELECT o.*,
             c.nome as cliente_nome, c.telefone as cliente_telefone,
             c.cpf_cnpj as cliente_cpf, c.email as cliente_email,
             v.placa, v.marca, v.modelo, v.ano, v.cor,
             f.nome as funcionario_nome,
             COALESCE(c.nome, o.nome_prospect, 'Sem identificação') as display_nome,
             COALESCE(c.telefone, o.telefone_prospect) as display_telefone
      FROM orcamentos o
      LEFT JOIN clientes c ON o.cliente_id=c.id
      LEFT JOIN veiculos v ON o.veiculo_id=v.id
      LEFT JOIN funcionarios f ON o.funcionario_id=f.id
      WHERE o.id=?`).get(req.params.id);
    if (!orc) return res.status(404).json({ error: 'Orçamento não encontrado' });
    const servicos = db.prepare(`SELECT os.*, s.nome as servico_nome FROM orcamento_servicos os LEFT JOIN servicos s ON os.servico_id=s.id WHERE os.orcamento_id=? ORDER BY os.id`).all(req.params.id);
    const produtos  = db.prepare(`SELECT op.*, p.codigo as produto_codigo, p.unidade as produto_unidade FROM orcamento_produtos op LEFT JOIN produtos p ON op.produto_id=p.id WHERE op.orcamento_id=? ORDER BY op.id`).all(req.params.id);
    res.json({ ...orc, servicos, produtos });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/orcamentos', (req, res) => {
  const { cliente_id, veiculo_id, funcionario_id, validade, descricao_problema, observacoes,
          nome_prospect, telefone_prospect, email_prospect, veiculo_prospect } = req.body;
  try {
    const numero = gerarNumeroOrcamento();
    const r = db.prepare(`
      INSERT INTO orcamentos
        (numero,cliente_id,veiculo_id,funcionario_id,validade,descricao_problema,observacoes,
         nome_prospect,telefone_prospect,email_prospect,veiculo_prospect)
      VALUES (?,?,?,?,?,?,?,?,?,?,?)
    `).run(numero, cliente_id||null, veiculo_id||null, funcionario_id||null,
           validade||null, descricao_problema, observacoes,
           nome_prospect||null, telefone_prospect||null, email_prospect||null, veiculo_prospect||null);
    res.status(201).json(db.prepare('SELECT * FROM orcamentos WHERE id=?').get(r.lastInsertRowid));
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.put('/api/orcamentos/:id', (req, res) => {
  const { cliente_id, veiculo_id, funcionario_id, validade, descricao_problema, observacoes,
          desconto, status, nome_prospect, telefone_prospect, email_prospect, veiculo_prospect } = req.body;
  try {
    db.prepare(`
      UPDATE orcamentos SET
        cliente_id=?,veiculo_id=?,funcionario_id=?,validade=?,descricao_problema=?,
        observacoes=?,desconto=?,status=?,
        nome_prospect=?,telefone_prospect=?,email_prospect=?,veiculo_prospect=?
      WHERE id=?
    `).run(cliente_id||null, veiculo_id||null, funcionario_id||null, validade||null,
           descricao_problema, observacoes, desconto||0, status||'pendente',
           nome_prospect||null, telefone_prospect||null, email_prospect||null, veiculo_prospect||null,
           req.params.id);
    recalcularOrcamento(req.params.id);
    res.json(db.prepare('SELECT * FROM orcamentos WHERE id=?').get(req.params.id));
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Converte prospect em cliente cadastrado
app.post('/api/orcamentos/:id/converter-cliente', (req, res) => {
  const { nome, cpf_cnpj, telefone, email, endereco, cidade, observacoes,
          placa, marca, modelo, ano, cor } = req.body;
  if (!nome) return res.status(400).json({ error: 'Nome é obrigatório' });
  try {
    const orc = db.prepare('SELECT * FROM orcamentos WHERE id=?').get(req.params.id);
    if (!orc) return res.status(404).json({ error: 'Orçamento não encontrado' });
    if (orc.cliente_id) return res.status(400).json({ error: 'Orçamento já possui cliente cadastrado' });

    // Cria o cliente
    const cR = db.prepare('INSERT INTO clientes (nome,cpf_cnpj,telefone,email,endereco,cidade,observacoes) VALUES (?,?,?,?,?,?,?)').run(nome, cpf_cnpj, telefone, email, endereco, cidade, observacoes);
    const clienteId = cR.lastInsertRowid;

    // Cria veículo se informado
    let veiculoId = null;
    if (placa) {
      const vR = db.prepare('INSERT INTO veiculos (cliente_id,placa,marca,modelo,ano,cor) VALUES (?,?,?,?,?,?)').run(clienteId, placa.toUpperCase(), marca, modelo, ano, cor);
      veiculoId = vR.lastInsertRowid;
    }

    // Vincula o cliente ao orçamento
    db.prepare('UPDATE orcamentos SET cliente_id=?,veiculo_id=?,nome_prospect=NULL,telefone_prospect=NULL WHERE id=?').run(clienteId, veiculoId||orc.veiculo_id, orc.id);

    const cliente = db.prepare('SELECT * FROM clientes WHERE id=?').get(clienteId);
    const veiculo = veiculoId ? db.prepare('SELECT * FROM veiculos WHERE id=?').get(veiculoId) : null;
    res.json({ success: true, cliente, veiculo });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/orcamentos/:id/servicos', (req, res) => {
  const { servico_id, descricao, preco } = req.body;
  if (!descricao) return res.status(400).json({ error: 'Descrição obrigatória' });
  try {
    const r = db.prepare('INSERT INTO orcamento_servicos (orcamento_id,servico_id,descricao,preco) VALUES (?,?,?,?)').run(req.params.id, servico_id||null, descricao, preco||0);
    recalcularOrcamento(req.params.id);
    res.status(201).json(db.prepare('SELECT os.*, s.nome as servico_nome FROM orcamento_servicos os LEFT JOIN servicos s ON os.servico_id=s.id WHERE os.id=?').get(r.lastInsertRowid));
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.delete('/api/orcamentos/:id/servicos/:itemId', (req, res) => {
  try { db.prepare('DELETE FROM orcamento_servicos WHERE id=? AND orcamento_id=?').run(req.params.itemId, req.params.id); recalcularOrcamento(req.params.id); res.json({ success: true }); }
  catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/orcamentos/:id/produtos', (req, res) => {
  const { produto_id, descricao, quantidade, preco_unitario } = req.body;
  if (!descricao) return res.status(400).json({ error: 'Descrição obrigatória' });
  try {
    const qty = quantidade||1, price = preco_unitario||0;
    const r = db.prepare('INSERT INTO orcamento_produtos (orcamento_id,produto_id,descricao,quantidade,preco_unitario,total) VALUES (?,?,?,?,?,?)').run(req.params.id, produto_id||null, descricao, qty, price, qty*price);
    recalcularOrcamento(req.params.id);
    res.status(201).json(db.prepare('SELECT op.*, p.unidade as produto_unidade FROM orcamento_produtos op LEFT JOIN produtos p ON op.produto_id=p.id WHERE op.id=?').get(r.lastInsertRowid));
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.delete('/api/orcamentos/:id/produtos/:itemId', (req, res) => {
  try { db.prepare('DELETE FROM orcamento_produtos WHERE id=? AND orcamento_id=?').run(req.params.itemId, req.params.id); recalcularOrcamento(req.params.id); res.json({ success: true }); }
  catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/orcamentos/:id/aprovar', (req, res) => {
  try {
    const orc = db.prepare('SELECT * FROM orcamentos WHERE id=?').get(req.params.id);
    if (!orc) return res.status(404).json({ error: 'Orçamento não encontrado' });
    if (orc.status === 'aprovado') return res.status(400).json({ error: 'Já aprovado' });

    recalcularOrcamento(orc.id);
    const orcAtual = db.prepare('SELECT * FROM orcamentos WHERE id=?').get(orc.id);

    // Gera OS automaticamente
    const numero = gerarNumeroOS();
    const osR = db.prepare('INSERT INTO ordens_servico (numero,cliente_id,veiculo_id,funcionario_id,descricao_problema,observacoes,desconto) VALUES (?,?,?,?,?,?,?)').run(numero, orc.cliente_id, orc.veiculo_id, orc.funcionario_id, orc.descricao_problema, orc.observacoes, orc.desconto||0);
    const osId = osR.lastInsertRowid;

    // Copia serviços
    const servicos = db.prepare('SELECT * FROM orcamento_servicos WHERE orcamento_id=?').all(orc.id);
    for (const s of servicos) {
      db.prepare('INSERT INTO os_servicos (os_id,servico_id,funcionario_id,descricao,preco,comissao_percentual) VALUES (?,?,?,?,?,?)').run(osId, s.servico_id, orc.funcionario_id, s.descricao, s.preco, 0);
    }

    // Copia produtos
    const produtos = db.prepare('SELECT * FROM orcamento_produtos WHERE orcamento_id=?').all(orc.id);
    for (const p of produtos) {
      db.prepare('INSERT INTO os_produtos (os_id,produto_id,descricao,quantidade,preco_unitario,total) VALUES (?,?,?,?,?,?)').run(osId, p.produto_id, p.descricao, p.quantidade, p.preco_unitario, p.total);
    }

    recalcularOS(osId);
    db.prepare('UPDATE orcamentos SET status=?,os_id=? WHERE id=?').run('aprovado', osId, orc.id);

    const os = db.prepare('SELECT * FROM ordens_servico WHERE id=?').get(osId);
    res.json({ success: true, os });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.put('/api/orcamentos/:id/status', (req, res) => {
  const { status } = req.body;
  if (!['pendente','enviado','rejeitado'].includes(status)) return res.status(400).json({ error: 'Status inválido' });
  try {
    db.prepare('UPDATE orcamentos SET status=? WHERE id=?').run(status, req.params.id);
    res.json(db.prepare('SELECT * FROM orcamentos WHERE id=?').get(req.params.id));
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.delete('/api/orcamentos/:id', (req, res) => {
  try { db.prepare('UPDATE orcamentos SET status=? WHERE id=?').run('cancelado', req.params.id); res.json({ success: true }); }
  catch (err) { res.status(500).json({ error: err.message }); }
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`Oficina System rodando em http://localhost:${PORT}`));
