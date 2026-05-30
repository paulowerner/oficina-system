// ==========================================
// UTILITIES
// ==========================================
const R$ = v => 'R$ ' + (parseFloat(v)||0).toFixed(2).replace('.',',').replace(/\B(?=(\d{3})+(?!\d))/g, '.');
const fDate = s => s ? new Date(s).toLocaleDateString('pt-BR') : '-';
const fDateTime = s => s ? new Date(s).toLocaleString('pt-BR') : '-';
const fNum = v => (parseFloat(v)||0).toFixed(2).replace('.',',');

const ORC_STATUS_MAP = {
  pendente:  { label: 'Pendente',  cls: 'status-aberta' },
  enviado:   { label: 'Enviado',   cls: 'status-em_andamento' },
  aprovado:  { label: 'Aprovado',  cls: 'status-concluida' },
  rejeitado: { label: 'Rejeitado', cls: 'status-cancelada' },
  cancelado: { label: 'Cancelado', cls: 'status-cancelada' },
};
function orcStatusBadge(s) { const m = ORC_STATUS_MAP[s]||{label:s,cls:''}; return `<span class="badge-status ${m.cls}">${m.label}</span>`; }

const STATUS_MAP = {
  aberta: { label: 'Aberta', cls: 'status-aberta' },
  em_andamento: { label: 'Em Andamento', cls: 'status-em_andamento' },
  aguardando_pecas: { label: 'Aguard. Peças', cls: 'status-aguardando_pecas' },
  concluida: { label: 'Concluída', cls: 'status-concluida' },
  cancelada: { label: 'Cancelada', cls: 'status-cancelada' },
};

function statusBadge(s) {
  const m = STATUS_MAP[s] || { label: s, cls: '' };
  return `<span class="badge-status ${m.cls}">${m.label}</span>`;
}

function showToast(msg, type = 'success') {
  const toast = document.getElementById('toast');
  const body = document.getElementById('toast-body');
  toast.className = `toast align-items-center text-white border-0 bg-${type === 'success' ? 'success' : type === 'danger' ? 'danger' : 'warning'}`;
  body.textContent = msg;
  bootstrap.Toast.getOrCreateInstance(toast, { delay: 3500 }).show();
}

function showLoading(show = true) {
  const c = document.getElementById('page-content');
  if (show) c.innerHTML = `<div class="d-flex justify-content-center align-items-center" style="height:300px"><div class="spinner-border text-warning"></div></div>`;
}

// ==========================================
// API CLIENT
// ==========================================
async function api(method, path, body) {
  const opts = { method, headers: { 'Content-Type': 'application/json' } };
  if (body) opts.body = JSON.stringify(body);
  const res = await fetch('/api' + path, opts);
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Erro na requisição');
  return data;
}
const GET = p => api('GET', p);
const POST = (p, b) => api('POST', p, b);
const PUT = (p, b) => api('PUT', p, b);
const DEL = p => api('DELETE', p);

// ==========================================
// MODAL HELPER
// ==========================================
let globalModal;
function openModal(title, bodyHtml, footerHtml, size = '') {
  if (!globalModal) globalModal = new bootstrap.Modal(document.getElementById('globalModal'));
  document.getElementById('globalModalTitle').textContent = title;
  document.getElementById('globalModalBody').innerHTML = bodyHtml;
  document.getElementById('globalModalFooter').innerHTML = footerHtml;
  const dlg = document.getElementById('globalModalDialog');
  dlg.className = `modal-dialog${size ? ' modal-' + size : ''}`;
  globalModal.show();
}
function closeModal() { globalModal && globalModal.hide(); }

// ==========================================
// NAVIGATION
// ==========================================
function navigate(page, extra = '') {
  location.hash = extra ? `${page}/${extra}` : page;
}

function updateNav(page) {
  document.querySelectorAll('#sidebar .nav-link').forEach(a => a.classList.toggle('active', a.dataset.page === page));
  document.querySelectorAll('#bottom-nav a').forEach(a => a.classList.toggle('active', a.dataset.page === page));
  const titles = { dashboard:'Dashboard', orcamentos:'Orçamentos', ordens:'Ordens de Serviço', clientes:'Clientes', veiculos:'Veículos', funcionarios:'Funcionários', produtos:'Produtos / Peças', servicos:'Serviços / Mão de Obra', comissoes:'Comissões', relatorios:'Relatórios', configuracoes:'Configurações', vendas:'Vendas Diretas' };
  const el = document.getElementById('topbar-title');
  if (el) el.textContent = titles[page] || page;
}

window.addEventListener('hashchange', handleRoute);
window.addEventListener('DOMContentLoaded', () => {
  handleRoute();
  // Desktop sidebar toggle
  document.getElementById('sidebarToggle').addEventListener('click', toggleSidebar);
  // Bottom nav active
  document.querySelectorAll('#bottom-nav a').forEach(a => {
    a.addEventListener('click', () => {
      document.querySelectorAll('#bottom-nav a').forEach(x => x.classList.remove('active'));
      a.classList.add('active');
      closeSidebar();
    });
  });
  // Register Service Worker for PWA
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/sw.js').catch(() => {});
  }
});

function toggleSidebar() {
  const sidebar = document.getElementById('sidebar');
  const overlay = document.getElementById('sidebarOverlay');
  const isMobile = window.innerWidth <= 768;
  if (isMobile) {
    sidebar.classList.toggle('show');
    overlay.classList.toggle('show');
  } else {
    sidebar.classList.toggle('collapsed');
    document.getElementById('main-content').classList.toggle('expanded');
  }
}

function closeSidebar() {
  document.getElementById('sidebar').classList.remove('show');
  document.getElementById('sidebarOverlay').classList.remove('show');
}

// FAB ação: nova OS rápida
function fabAction() {
  const page = location.hash.replace('#','').split('/')[0] || 'dashboard';
  if (page === 'orcamentos') openNovoOrcamentoModal();
  else openNovaOsRapidaModal();
}

function handleRoute() {
  const hash = location.hash.replace('#', '') || 'dashboard';
  const parts = hash.split('/');
  const page = parts[0];
  const param = parts[1];

  updateNav(page);

  const pages = { dashboard: showDashboard, clientes: showClientes, veiculos: showVeiculos, ordens: showOrdens, orcamentos: showOrcamentos, servicos: showServicos, produtos: showProdutos, funcionarios: showFuncionarios, comissoes: showComissoes, relatorios: showRelatorios, configuracoes: showConfiguracoes, vendas: showVendas };

  if (page === 'os' && param) {
    showOsDetalhe(param);
  } else if (page === 'orc' && param) {
    showOrcamentoDetalhe(param);
  } else if (pages[page]) {
    pages[page]();
  } else {
    showDashboard();
  }
}

// ==========================================
// DASHBOARD
// ==========================================
async function showDashboard() {
  showLoading();
  try {
    const { stats, os_recentes, estoque_baixo } = await GET('/dashboard');
    const statCards = [
      { label: 'OS Abertas', value: stats.os_abertas, icon: 'bi-clipboard', color: '#e3f2fd', icolor: '#1565c0' },
      { label: 'OS Hoje', value: stats.os_hoje, icon: 'bi-calendar-check', color: '#e8f5e9', icolor: '#2e7d32' },
      { label: 'Concluídas no Mês', value: stats.os_concluidas_mes, icon: 'bi-check-circle', color: '#f3e5f5', icolor: '#6a1b9a' },
      { label: 'Faturamento Mês', value: R$(stats.faturamento_mes), icon: 'bi-currency-dollar', color: '#fff8e1', icolor: '#f57f17' },
      { label: 'Comissões Pendentes', value: R$(stats.comissoes_pendentes), icon: 'bi-cash-coin', color: '#fff3e0', icolor: '#e65100' },
      { label: 'Estoque Baixo', value: stats.produtos_estoque_baixo, icon: 'bi-exclamation-triangle', color: '#ffebee', icolor: '#c62828' },
    ];

    document.getElementById('page-content').innerHTML = `
      <div class="page-header"><h4><i class="bi bi-speedometer2 me-2 text-warning"></i>Dashboard</h4>
        <button class="btn btn-accent btn-sm" onclick="navigate('ordens')"><i class="bi bi-plus-lg me-1"></i>Nova OS</button>
      </div>

      <div class="row g-3 mb-4">
        ${statCards.map(s => `
          <div class="col-6 col-lg-4 col-xl-2">
            <div class="stat-card">
              <div class="d-flex align-items-center gap-3 mb-2">
                <div class="stat-icon" style="background:${s.color}">
                  <i class="bi ${s.icon}" style="color:${s.icolor}"></i>
                </div>
              </div>
              <div class="stat-value">${s.value}</div>
              <div class="stat-label">${s.label}</div>
            </div>
          </div>
        `).join('')}
      </div>

      <div class="row g-3">
        <div class="col-lg-8">
          <div class="table-card">
            <div class="section-header">
              <div class="section-title"><i class="bi bi-clock-history"></i> Últimas Ordens de Serviço</div>
              <a href="#ordens" class="btn btn-sm btn-outline-secondary">Ver Todas</a>
            </div>
            ${os_recentes.length ? `
            <table class="table">
              <thead><tr><th>OS</th><th>Cliente</th><th>Veículo</th><th>Responsável</th><th>Status</th><th>Total</th></tr></thead>
              <tbody>
                ${os_recentes.map(os => `
                  <tr onclick="navigate('os','${os.id}')" style="cursor:pointer">
                    <td><strong class="text-warning">#${os.numero}</strong></td>
                    <td>${os.cliente_nome}</td>
                    <td>${os.placa} - ${os.marca||''} ${os.modelo||''}</td>
                    <td>${os.funcionario_nome||'-'}</td>
                    <td>${statusBadge(os.status)}</td>
                    <td><strong>${R$(os.total_geral)}</strong></td>
                  </tr>
                `).join('')}
              </tbody>
            </table>` : '<div class="empty-state"><i class="bi bi-clipboard"></i>Nenhuma OS cadastrada</div>'}
          </div>
        </div>
        <div class="col-lg-4">
          <div class="table-card">
            <div class="section-header">
              <div class="section-title"><i class="bi bi-exclamation-triangle text-danger"></i> Estoque Baixo</div>
              <a href="#produtos" class="btn btn-sm btn-outline-secondary">Ver Todos</a>
            </div>
            <div class="p-3">
              ${estoque_baixo.length ? estoque_baixo.map(p => `
                <div class="alert-estoque">
                  <i class="bi bi-box-seam text-danger"></i>
                  <div>
                    <div class="fw-semibold" style="font-size:.9rem">${p.nome}</div>
                    <small class="text-muted">Estoque: <strong class="text-danger">${fNum(p.estoque_atual)} ${p.unidade}</strong> / Mín: ${fNum(p.estoque_minimo)}</small>
                  </div>
                </div>
              `).join('') : '<div class="text-center text-muted py-3"><i class="bi bi-check-circle text-success d-block fs-3 mb-2"></i>Estoque OK!</div>'}
            </div>
          </div>
        </div>
      </div>
    `;
  } catch (e) { showToast(e.message, 'danger'); }
}

// ==========================================
// CLIENTES
// ==========================================
async function showClientes(search = '') {
  showLoading();
  try {
    const clientes = await GET(`/clientes${search ? '?search=' + encodeURIComponent(search) : ''}`);
    document.getElementById('page-content').innerHTML = `
      <div class="page-header">
        <h4><i class="bi bi-people me-2 text-warning"></i>Clientes</h4>
        <button class="btn btn-accent" onclick="openClienteModal()"><i class="bi bi-plus-lg me-1"></i>Novo Cliente</button>
      </div>
      <div class="filters-bar">
        <div class="flex-grow-1">
          <input type="text" class="form-control" id="clienteSearch" placeholder="Buscar por nome, CPF/CNPJ, telefone..." value="${search}" onkeyup="if(event.key==='Enter')showClientes(this.value)">
        </div>
        <button class="btn btn-outline-secondary" onclick="showClientes(document.getElementById('clienteSearch').value)"><i class="bi bi-search"></i></button>
      </div>
      <div class="table-card">
        ${clientes.length ? `
        <table class="table">
          <thead><tr><th>Nome</th><th>CPF/CNPJ</th><th>Telefone</th><th>E-mail</th><th>Cidade</th><th>Ações</th></tr></thead>
          <tbody>
            ${clientes.map(c => `
              <tr>
                <td><strong>${c.nome}</strong></td>
                <td>${c.cpf_cnpj||'-'}</td>
                <td>${c.telefone||'-'}</td>
                <td>${c.email||'-'}</td>
                <td>${c.cidade||'-'}</td>
                <td>
                  <div class="btn-group btn-group-sm">
                    <button class="btn btn-outline-warning" onclick="openClienteModal(${c.id})" title="Editar"><i class="bi bi-pencil"></i></button>
                    <button class="btn btn-outline-primary" onclick="verVeiculosCliente(${c.id},'${c.nome.replace(/'/g,"\\'")}')"><i class="bi bi-car-front"></i></button>
                    <button class="btn btn-outline-danger" onclick="deleteCliente(${c.id},'${c.nome.replace(/'/g,"\\'")}')"><i class="bi bi-trash"></i></button>
                  </div>
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>` : '<div class="empty-state"><i class="bi bi-people"></i>Nenhum cliente encontrado</div>'}
      </div>
    `;
  } catch (e) { showToast(e.message, 'danger'); }
}

async function openClienteModal(id = null) {
  let c = {};
  if (id) { try { c = await GET(`/clientes/${id}`); } catch(e) { return showToast(e.message,'danger'); } }
  openModal(id ? 'Editar Cliente' : 'Novo Cliente', `
    <div class="row g-3">
      <div class="col-12"><label class="form-label">Nome *</label><input class="form-control" id="c_nome" value="${c.nome||''}" placeholder="Nome completo"></div>
      <div class="col-md-6"><label class="form-label">CPF / CNPJ</label><input class="form-control" id="c_cpf" value="${c.cpf_cnpj||''}" placeholder="000.000.000-00"></div>
      <div class="col-md-6"><label class="form-label">Telefone</label><input class="form-control" id="c_tel" value="${c.telefone||''}" placeholder="(00) 00000-0000"></div>
      <div class="col-md-6"><label class="form-label">E-mail</label><input class="form-control" id="c_email" value="${c.email||''}" placeholder="email@exemplo.com"></div>
      <div class="col-md-6"><label class="form-label">Cidade</label><input class="form-control" id="c_cidade" value="${c.cidade||''}" placeholder="Cidade"></div>
      <div class="col-12"><label class="form-label">Endereço</label><input class="form-control" id="c_end" value="${c.endereco||''}" placeholder="Rua, número, bairro..."></div>
      <div class="col-12"><label class="form-label">Observações</label><textarea class="form-control" id="c_obs" rows="2">${c.observacoes||''}</textarea></div>
    </div>
  `, `<button class="btn btn-secondary" data-bs-dismiss="modal">Cancelar</button>
      <button class="btn btn-accent" onclick="saveCliente(${id||''})"><i class="bi bi-check-lg me-1"></i>Salvar</button>`);
}

async function saveCliente(id) {
  const body = { nome: document.getElementById('c_nome').value.trim(), cpf_cnpj: document.getElementById('c_cpf').value, telefone: document.getElementById('c_tel').value, email: document.getElementById('c_email').value, cidade: document.getElementById('c_cidade').value, endereco: document.getElementById('c_end').value, observacoes: document.getElementById('c_obs').value };
  if (!body.nome) return showToast('Nome é obrigatório','warning');
  try {
    if (id) await PUT(`/clientes/${id}`, body); else await POST('/clientes', body);
    closeModal(); showToast('Cliente salvo!'); showClientes();
  } catch(e) { showToast(e.message,'danger'); }
}

async function deleteCliente(id, nome) {
  if (!confirm(`Desativar cliente "${nome}"?`)) return;
  try { await DEL(`/clientes/${id}`); showToast('Cliente removido!'); showClientes(); }
  catch(e) { showToast(e.message,'danger'); }
}

function verVeiculosCliente(id, nome) { navigate('veiculos'); setTimeout(()=>showVeiculos(id), 100); }

// ==========================================
// VEÍCULOS
// ==========================================
async function showVeiculos(clienteId = null, search = '') {
  showLoading();
  try {
    const clientes = await GET('/clientes');
    let url = '/veiculos?';
    if (clienteId) url += `cliente_id=${clienteId}&`;
    if (search) url += `search=${encodeURIComponent(search)}`;
    const veiculos = await GET(url);

    document.getElementById('page-content').innerHTML = `
      <div class="page-header">
        <h4><i class="bi bi-car-front me-2 text-warning"></i>Veículos</h4>
        <button class="btn btn-accent" onclick="openVeiculoModal()"><i class="bi bi-plus-lg me-1"></i>Novo Veículo</button>
      </div>
      <div class="filters-bar">
        <div class="flex-grow-1">
          <input type="text" class="form-control" id="veicSearch" placeholder="Placa, marca, modelo, cliente..." value="${search}" onkeyup="if(event.key==='Enter')showVeiculos(null,this.value)">
        </div>
        <select class="form-select" style="max-width:200px" id="veicClienteFilter" onchange="showVeiculos(this.value||null)">
          <option value="">Todos os clientes</option>
          ${clientes.map(c => `<option value="${c.id}" ${c.id==clienteId?'selected':''}>${c.nome}</option>`).join('')}
        </select>
        <button class="btn btn-outline-secondary" onclick="showVeiculos(document.getElementById('veicClienteFilter').value||null,document.getElementById('veicSearch').value)"><i class="bi bi-search"></i></button>
      </div>
      <div class="table-card">
        ${veiculos.length ? `
        <table class="table">
          <thead><tr><th>Placa</th><th>Marca/Modelo</th><th>Ano</th><th>Cor</th><th>KM Atual</th><th>Cliente</th><th>Ações</th></tr></thead>
          <tbody>
            ${veiculos.map(v => `
              <tr>
                <td><strong class="text-warning">${v.placa}</strong></td>
                <td>${v.marca||''} ${v.modelo||''}</td>
                <td>${v.ano||'-'}</td>
                <td>${v.cor||'-'}</td>
                <td>${v.km_atual ? v.km_atual.toLocaleString('pt-BR') + ' km' : '-'}</td>
                <td>${v.cliente_nome}</td>
                <td>
                  <div class="btn-group btn-group-sm">
                    <button class="btn btn-outline-warning" onclick="openVeiculoModal(${v.id})"><i class="bi bi-pencil"></i></button>
                    <button class="btn btn-outline-danger" onclick="deleteVeiculo(${v.id},'${v.placa}')"><i class="bi bi-trash"></i></button>
                  </div>
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>` : '<div class="empty-state"><i class="bi bi-car-front"></i>Nenhum veículo encontrado</div>'}
      </div>
    `;
  } catch (e) { showToast(e.message,'danger'); }
}

async function openVeiculoModal(id = null) {
  let v = {};
  const clientes = await GET('/clientes');
  if (id) { try { v = await GET(`/veiculos/${id}`); } catch(e) { return showToast(e.message,'danger'); } }
  openModal(id ? 'Editar Veículo' : 'Novo Veículo', `
    <div class="row g-3">
      <div class="col-12"><label class="form-label">Cliente *</label>
        <select class="form-select" id="v_cliente">
          <option value="">Selecione o cliente...</option>
          ${clientes.map(c => `<option value="${c.id}" ${c.id==v.cliente_id?'selected':''}>${c.nome}</option>`).join('')}
        </select>
      </div>
      <div class="col-md-6"><label class="form-label">Placa *</label><input class="form-control" id="v_placa" value="${v.placa||''}" placeholder="ABC1D23" style="text-transform:uppercase"></div>
      <div class="col-md-6"><label class="form-label">Marca</label><input class="form-control" id="v_marca" value="${v.marca||''}" placeholder="Ex: Volkswagen"></div>
      <div class="col-md-6"><label class="form-label">Modelo</label><input class="form-control" id="v_modelo" value="${v.modelo||''}" placeholder="Ex: Gol"></div>
      <div class="col-md-3"><label class="form-label">Ano</label><input type="number" class="form-control" id="v_ano" value="${v.ano||''}" placeholder="2020"></div>
      <div class="col-md-3"><label class="form-label">Cor</label><input class="form-control" id="v_cor" value="${v.cor||''}" placeholder="Branca"></div>
      <div class="col-md-6"><label class="form-label">KM Atual</label><input type="number" class="form-control" id="v_km" value="${v.km_atual||''}" placeholder="0"></div>
      <div class="col-12"><label class="form-label">Observações</label><textarea class="form-control" id="v_obs" rows="2">${v.observacoes||''}</textarea></div>
    </div>
  `, `<button class="btn btn-secondary" data-bs-dismiss="modal">Cancelar</button>
      <button class="btn btn-accent" onclick="saveVeiculo(${id||''})"><i class="bi bi-check-lg me-1"></i>Salvar</button>`);
}

async function saveVeiculo(id) {
  const body = { cliente_id: document.getElementById('v_cliente').value, placa: document.getElementById('v_placa').value.trim().toUpperCase(), marca: document.getElementById('v_marca').value, modelo: document.getElementById('v_modelo').value, ano: document.getElementById('v_ano').value, cor: document.getElementById('v_cor').value, km_atual: document.getElementById('v_km').value, observacoes: document.getElementById('v_obs').value };
  if (!body.cliente_id) return showToast('Selecione o cliente','warning');
  if (!body.placa) return showToast('Placa é obrigatória','warning');
  try {
    if (id) await PUT(`/veiculos/${id}`, body); else await POST('/veiculos', body);
    closeModal(); showToast('Veículo salvo!'); showVeiculos();
  } catch(e) { showToast(e.message,'danger'); }
}

async function deleteVeiculo(id, placa) {
  if (!confirm(`Desativar veículo ${placa}?`)) return;
  try { await DEL(`/veiculos/${id}`); showToast('Veículo removido!'); showVeiculos(); }
  catch(e) { showToast(e.message,'danger'); }
}

// ==========================================
// FUNCIONÁRIOS
// ==========================================
async function showFuncionarios() {
  showLoading();
  try {
    const funcs = await GET('/funcionarios');
    document.getElementById('page-content').innerHTML = `
      <div class="page-header">
        <h4><i class="bi bi-person-badge me-2 text-warning"></i>Funcionários</h4>
        <button class="btn btn-accent" onclick="openFuncModal()"><i class="bi bi-plus-lg me-1"></i>Novo Funcionário</button>
      </div>
      <div class="table-card">
        ${funcs.length ? `
        <table class="table">
          <thead><tr><th>Nome</th><th>Cargo</th><th>CPF</th><th>Telefone</th><th>Salário Base</th><th>Comissão</th><th>Ações</th></tr></thead>
          <tbody>
            ${funcs.map(f => `
              <tr>
                <td><strong>${f.nome}</strong></td>
                <td>${f.cargo||'-'}</td>
                <td>${f.cpf||'-'}</td>
                <td>${f.telefone||'-'}</td>
                <td>${R$(f.salario_base)}</td>
                <td><span class="comissao-badge">${f.comissao_percentual}%</span></td>
                <td>
                  <div class="btn-group btn-group-sm">
                    <button class="btn btn-outline-warning" onclick="openFuncModal(${f.id})"><i class="bi bi-pencil"></i></button>
                    <button class="btn btn-outline-info" onclick="verComissoesFunc(${f.id},'${f.nome.replace(/'/g,"\\'")}')"><i class="bi bi-cash-coin"></i></button>
                    <button class="btn btn-outline-danger" onclick="deleteFunc(${f.id},'${f.nome.replace(/'/g,"\\'")}')"><i class="bi bi-trash"></i></button>
                  </div>
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>` : '<div class="empty-state"><i class="bi bi-person-badge"></i>Nenhum funcionário cadastrado</div>'}
      </div>
    `;
  } catch(e) { showToast(e.message,'danger'); }
}

async function openFuncModal(id = null) {
  let f = {};
  if (id) { try { f = await GET(`/funcionarios/${id}`); } catch(e) { return showToast(e.message,'danger'); } }
  openModal(id ? 'Editar Funcionário' : 'Novo Funcionário', `
    <div class="row g-3">
      <div class="col-12"><label class="form-label">Nome *</label><input class="form-control" id="f_nome" value="${f.nome||''}" placeholder="Nome completo"></div>
      <div class="col-md-6"><label class="form-label">CPF</label><input class="form-control" id="f_cpf" value="${f.cpf||''}" placeholder="000.000.000-00"></div>
      <div class="col-md-6"><label class="form-label">Telefone</label><input class="form-control" id="f_tel" value="${f.telefone||''}" placeholder="(00) 00000-0000"></div>
      <div class="col-md-6"><label class="form-label">Cargo</label><input class="form-control" id="f_cargo" value="${f.cargo||''}" placeholder="Ex: Mecânico, Eletricista..."></div>
      <div class="col-md-3"><label class="form-label">Salário Base (R$)</label><input type="number" step="0.01" class="form-control" id="f_sal" value="${f.salario_base||0}"></div>
      <div class="col-md-3"><label class="form-label">Comissão (%)</label><input type="number" step="0.1" min="0" max="100" class="form-control" id="f_com" value="${f.comissao_percentual||0}" placeholder="10"></div>
    </div>
  `, `<button class="btn btn-secondary" data-bs-dismiss="modal">Cancelar</button>
      <button class="btn btn-accent" onclick="saveFunc(${id||''})"><i class="bi bi-check-lg me-1"></i>Salvar</button>`);
}

async function saveFunc(id) {
  const body = { nome: document.getElementById('f_nome').value.trim(), cpf: document.getElementById('f_cpf').value, telefone: document.getElementById('f_tel').value, cargo: document.getElementById('f_cargo').value, salario_base: parseFloat(document.getElementById('f_sal').value)||0, comissao_percentual: parseFloat(document.getElementById('f_com').value)||0 };
  if (!body.nome) return showToast('Nome é obrigatório','warning');
  try {
    if (id) await PUT(`/funcionarios/${id}`, body); else await POST('/funcionarios', body);
    closeModal(); showToast('Funcionário salvo!'); showFuncionarios();
  } catch(e) { showToast(e.message,'danger'); }
}

async function deleteFunc(id, nome) {
  if (!confirm(`Desativar funcionário "${nome}"?`)) return;
  try { await DEL(`/funcionarios/${id}`); showToast('Removido!'); showFuncionarios(); }
  catch(e) { showToast(e.message,'danger'); }
}

function verComissoesFunc(id, nome) { navigate('comissoes'); setTimeout(()=>showComissoes(id), 100); }

// ==========================================
// SERVIÇOS
// ==========================================
async function showServicos() {
  showLoading();
  try {
    const [servicos, cats] = await Promise.all([GET('/servicos'), GET('/categorias-servico')]);
    document.getElementById('page-content').innerHTML = `
      <div class="page-header">
        <h4><i class="bi bi-gear me-2 text-warning"></i>Serviços / Mão de Obra</h4>
        <div class="d-flex gap-2">
          <button class="btn btn-outline-secondary" onclick="openCatServModal()"><i class="bi bi-tags me-1"></i>Categorias</button>
          <button class="btn btn-accent" onclick="openServicoModal()"><i class="bi bi-plus-lg me-1"></i>Novo Serviço</button>
        </div>
      </div>
      <div class="table-card">
        ${servicos.length ? `
        <table class="table">
          <thead><tr><th>Nome</th><th>Categoria</th><th>Preço</th><th>Comissão</th><th>Ações</th></tr></thead>
          <tbody>
            ${servicos.map(s => `
              <tr>
                <td><strong>${s.nome}</strong>${s.descricao ? `<br><small class="text-muted">${s.descricao}</small>` : ''}</td>
                <td>${s.categoria_nome||'-'}</td>
                <td><strong class="text-success">${R$(s.preco)}</strong></td>
                <td><span class="comissao-badge">${s.comissao_percentual}%</span></td>
                <td>
                  <div class="btn-group btn-group-sm">
                    <button class="btn btn-outline-warning" onclick="openServicoModal(${s.id})"><i class="bi bi-pencil"></i></button>
                    <button class="btn btn-outline-danger" onclick="deleteServico(${s.id},'${s.nome.replace(/'/g,"\\'")}')"><i class="bi bi-trash"></i></button>
                  </div>
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>` : '<div class="empty-state"><i class="bi bi-gear"></i>Nenhum serviço cadastrado</div>'}
      </div>
    `;
  } catch(e) { showToast(e.message,'danger'); }
}

async function openServicoModal(id = null) {
  let s = {};
  const cats = await GET('/categorias-servico');
  if (id) { try { s = await GET(`/servicos/${id}`); } catch(e) { return showToast(e.message,'danger'); } }
  openModal(id ? 'Editar Serviço' : 'Novo Serviço', `
    <div class="row g-3">
      <div class="col-12"><label class="form-label">Nome *</label><input class="form-control" id="s_nome" value="${s.nome||''}" placeholder="Nome do serviço"></div>
      <div class="col-md-6"><label class="form-label">Categoria</label>
        <select class="form-select" id="s_cat">
          <option value="">Sem categoria</option>
          ${cats.map(c => `<option value="${c.id}" ${c.id==s.categoria_id?'selected':''}>${c.nome}</option>`).join('')}
        </select>
      </div>
      <div class="col-md-3"><label class="form-label">Preço (R$)</label><input type="number" step="0.01" min="0" class="form-control" id="s_preco" value="${s.preco||0}"></div>
      <div class="col-md-3"><label class="form-label">Comissão (%)</label><input type="number" step="0.1" min="0" max="100" class="form-control" id="s_com" value="${s.comissao_percentual||0}"></div>
      <div class="col-12"><label class="form-label">Descrição</label><textarea class="form-control" id="s_desc" rows="2">${s.descricao||''}</textarea></div>
    </div>
  `, `<button class="btn btn-secondary" data-bs-dismiss="modal">Cancelar</button>
      <button class="btn btn-accent" onclick="saveServico(${id||''})"><i class="bi bi-check-lg me-1"></i>Salvar</button>`);
}

async function saveServico(id) {
  const body = { nome: document.getElementById('s_nome').value.trim(), categoria_id: document.getElementById('s_cat').value||null, preco: parseFloat(document.getElementById('s_preco').value)||0, comissao_percentual: parseFloat(document.getElementById('s_com').value)||0, descricao: document.getElementById('s_desc').value };
  if (!body.nome) return showToast('Nome é obrigatório','warning');
  try {
    if (id) await PUT(`/servicos/${id}`, body); else await POST('/servicos', body);
    closeModal(); showToast('Serviço salvo!'); showServicos();
  } catch(e) { showToast(e.message,'danger'); }
}

async function deleteServico(id, nome) {
  if (!confirm(`Remover serviço "${nome}"?`)) return;
  try { await DEL(`/servicos/${id}`); showToast('Removido!'); showServicos(); }
  catch(e) { showToast(e.message,'danger'); }
}

async function openCatServModal() {
  const cats = await GET('/categorias-servico');
  openModal('Categorias de Serviço', `
    <div id="catServ_list">
      ${cats.map(c => `<div class="d-flex align-items-center gap-2 mb-2"><input class="form-control form-control-sm" value="${c.nome}" id="csn_${c.id}" onblur="saveCatServ(${c.id},this.value)"><button class="btn btn-sm btn-outline-danger" onclick="deleteCatServ(${c.id})"><i class="bi bi-trash"></i></button></div>`).join('')}
    </div>
    <div class="d-flex gap-2 mt-3"><input class="form-control form-control-sm" id="novaCatServ" placeholder="Nova categoria..." onkeyup="if(event.key==='Enter')addCatServ()"><button class="btn btn-sm btn-accent" onclick="addCatServ()"><i class="bi bi-plus-lg"></i></button></div>
  `, `<button class="btn btn-secondary" data-bs-dismiss="modal">Fechar</button>`);
}

async function addCatServ() {
  const nome = document.getElementById('novaCatServ').value.trim();
  if (!nome) return;
  try { await POST('/categorias-servico',{nome}); showToast('Categoria criada!'); openCatServModal(); }
  catch(e) { showToast(e.message,'danger'); }
}
async function saveCatServ(id,nome) {
  if (!nome.trim()) return;
  try { await PUT(`/categorias-servico/${id}`,{nome}); }
  catch(e) { showToast(e.message,'danger'); }
}
async function deleteCatServ(id) {
  try { await DEL(`/categorias-servico/${id}`); openCatServModal(); }
  catch(e) { showToast(e.message,'danger'); }
}

// ==========================================
// PRODUTOS
// ==========================================
async function showProdutos(filter = '') {
  showLoading();
  try {
    const [produtos, cats] = await Promise.all([GET(`/produtos${filter ? '?' + filter : ''}`), GET('/categorias-produto')]);
    document.getElementById('page-content').innerHTML = `
      <div class="page-header">
        <h4><i class="bi bi-box-seam me-2 text-warning"></i>Produtos / Estoque</h4>
        <div class="d-flex gap-2">
          <button class="btn btn-outline-secondary" onclick="openCatProdModal()"><i class="bi bi-tags me-1"></i>Categorias</button>
          <button class="btn btn-accent" onclick="openProdutoModal()"><i class="bi bi-plus-lg me-1"></i>Novo Produto</button>
        </div>
      </div>
      <div class="filters-bar">
        <div class="flex-grow-1"><input type="text" class="form-control" id="prodSearch" placeholder="Nome ou código..." onkeyup="if(event.key==='Enter')showProdutos('search='+this.value)"></div>
        <select class="form-select" style="max-width:200px" id="prodCat" onchange="showProdutos(this.value?'categoria_id='+this.value:'')">
          <option value="">Todas categorias</option>
          ${cats.map(c => `<option value="${c.id}">${c.nome}</option>`).join('')}
        </select>
        <button class="btn btn-outline-danger btn-sm" onclick="showProdutos('estoque_baixo=true')"><i class="bi bi-exclamation-triangle me-1"></i>Estoque Baixo</button>
      </div>
      <div class="table-card">
        ${produtos.length ? `
        <table class="table">
          <thead><tr><th>Código</th><th>Nome</th><th>Categoria</th><th>Custo</th><th>Venda</th><th>Estoque</th><th>Mínimo</th><th>Ações</th></tr></thead>
          <tbody>
            ${produtos.map(p => `
              <tr class="${p.estoque_atual <= p.estoque_minimo ? 'estoque-baixo' : ''}">
                <td><small class="text-muted">${p.codigo||'-'}</small></td>
                <td><strong>${p.nome}</strong></td>
                <td>${p.categoria_nome||'-'}</td>
                <td>${R$(p.preco_custo)}</td>
                <td><strong class="text-success">${R$(p.preco_venda)}</strong></td>
                <td>
                  <span class="${p.estoque_atual <= p.estoque_minimo ? 'text-danger fw-bold' : 'text-success fw-bold'}">
                    ${fNum(p.estoque_atual)} ${p.unidade}
                  </span>
                </td>
                <td>${fNum(p.estoque_minimo)} ${p.unidade}</td>
                <td>
                  <div class="btn-group btn-group-sm">
                    <button class="btn btn-outline-success" onclick="openEntradaEstoque(${p.id},'${p.nome.replace(/'/g,"\\'")}','${p.unidade}')" title="Entrada de Estoque"><i class="bi bi-plus-circle"></i></button>
                    <button class="btn btn-outline-warning" onclick="openProdutoModal(${p.id})"><i class="bi bi-pencil"></i></button>
                    <button class="btn btn-outline-danger" onclick="deleteProduto(${p.id},'${p.nome.replace(/'/g,"\\'")}')"><i class="bi bi-trash"></i></button>
                  </div>
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>` : '<div class="empty-state"><i class="bi bi-box-seam"></i>Nenhum produto encontrado</div>'}
      </div>
    `;
  } catch(e) { showToast(e.message,'danger'); }
}

async function openProdutoModal(id = null) {
  let p = {};
  const cats = await GET('/categorias-produto');
  if (id) { try { p = await GET(`/produtos/${id}`); } catch(e) { return showToast(e.message,'danger'); } }
  openModal(id ? 'Editar Produto' : 'Novo Produto', `
    <div class="row g-3">
      <div class="col-md-4"><label class="form-label">Código</label><input class="form-control" id="p_cod" value="${p.codigo||''}" placeholder="SKU001"></div>
      <div class="col-md-8"><label class="form-label">Nome *</label><input class="form-control" id="p_nome" value="${p.nome||''}" placeholder="Nome do produto"></div>
      <div class="col-md-6"><label class="form-label">Categoria</label>
        <select class="form-select" id="p_cat">
          <option value="">Sem categoria</option>
          ${cats.map(c => `<option value="${c.id}" ${c.id==p.categoria_id?'selected':''}>${c.nome}</option>`).join('')}
        </select>
      </div>
      <div class="col-md-3"><label class="form-label">Unidade</label>
        <select class="form-select" id="p_un">
          ${['UN','L','ML','KG','G','M','CM','JG','PC','CX','PR'].map(u => `<option ${u==p.unidade?'selected':''}>${u}</option>`).join('')}
        </select>
      </div>
      <div class="col-md-3"><label class="form-label">Estoque Mín.</label><input type="number" step="0.1" min="0" class="form-control" id="p_estMin" value="${p.estoque_minimo||0}"></div>
      <div class="col-md-4"><label class="form-label">Preço de Custo</label><input type="number" step="0.01" min="0" class="form-control" id="p_custo" value="${p.preco_custo||0}"></div>
      <div class="col-md-4"><label class="form-label">Preço de Venda</label><input type="number" step="0.01" min="0" class="form-control" id="p_venda" value="${p.preco_venda||0}"></div>
      ${!id ? `<div class="col-md-4"><label class="form-label">Estoque Inicial</label><input type="number" step="0.1" min="0" class="form-control" id="p_estInit" value="0"></div>` : ''}
      <div class="col-12"><label class="form-label">Descrição</label><textarea class="form-control" id="p_desc" rows="2">${p.descricao||''}</textarea></div>
    </div>
  `, `<button class="btn btn-secondary" data-bs-dismiss="modal">Cancelar</button>
      <button class="btn btn-accent" onclick="saveProduto(${id||''})"><i class="bi bi-check-lg me-1"></i>Salvar</button>`, 'lg');
}

async function saveProduto(id) {
  const body = { codigo: document.getElementById('p_cod').value, nome: document.getElementById('p_nome').value.trim(), categoria_id: document.getElementById('p_cat').value||null, unidade: document.getElementById('p_un').value, estoque_minimo: parseFloat(document.getElementById('p_estMin').value)||0, preco_custo: parseFloat(document.getElementById('p_custo').value)||0, preco_venda: parseFloat(document.getElementById('p_venda').value)||0, descricao: document.getElementById('p_desc').value };
  if (!id) body.estoque_atual = parseFloat(document.getElementById('p_estInit').value)||0;
  if (!body.nome) return showToast('Nome é obrigatório','warning');
  try {
    if (id) await PUT(`/produtos/${id}`, body); else await POST('/produtos', body);
    closeModal(); showToast('Produto salvo!'); showProdutos();
  } catch(e) { showToast(e.message,'danger'); }
}

async function openEntradaEstoque(id, nome, unidade) {
  openModal('Entrada de Estoque', `
    <p class="text-muted mb-3">Produto: <strong>${nome}</strong></p>
    <div class="row g-3">
      <div class="col-6"><label class="form-label">Quantidade (${unidade})</label><input type="number" step="0.1" min="0.1" class="form-control" id="ent_qty" value="1"></div>
      <div class="col-6"><label class="form-label">Motivo</label><input class="form-control" id="ent_mot" placeholder="Compra, devolução..." value="Compra"></div>
    </div>
  `, `<button class="btn btn-secondary" data-bs-dismiss="modal">Cancelar</button>
      <button class="btn btn-success" onclick="saveEntrada(${id})"><i class="bi bi-plus-circle me-1"></i>Confirmar Entrada</button>`);
}

async function saveEntrada(id) {
  const body = { quantidade: parseFloat(document.getElementById('ent_qty').value), motivo: document.getElementById('ent_mot').value };
  if (!body.quantidade || body.quantidade <= 0) return showToast('Quantidade inválida','warning');
  try { await POST(`/produtos/${id}/entrada`, body); closeModal(); showToast('Estoque atualizado!'); showProdutos(); }
  catch(e) { showToast(e.message,'danger'); }
}

async function deleteProduto(id, nome) {
  if (!confirm(`Desativar produto "${nome}"?`)) return;
  try { await DEL(`/produtos/${id}`); showToast('Removido!'); showProdutos(); }
  catch(e) { showToast(e.message,'danger'); }
}

async function openCatProdModal() {
  const cats = await GET('/categorias-produto');
  openModal('Categorias de Produto', `
    <div id="catProd_list">
      ${cats.map(c => `<div class="d-flex align-items-center gap-2 mb-2"><input class="form-control form-control-sm" value="${c.nome}" onblur="saveCatProd(${c.id},this.value)"><button class="btn btn-sm btn-outline-danger" onclick="deleteCatProd(${c.id})"><i class="bi bi-trash"></i></button></div>`).join('')}
    </div>
    <div class="d-flex gap-2 mt-3"><input class="form-control form-control-sm" id="novaCatProd" placeholder="Nova categoria..." onkeyup="if(event.key==='Enter')addCatProd()"><button class="btn btn-sm btn-accent" onclick="addCatProd()"><i class="bi bi-plus-lg"></i></button></div>
  `, `<button class="btn btn-secondary" data-bs-dismiss="modal">Fechar</button>`);
}
async function addCatProd() { const nome=document.getElementById('novaCatProd').value.trim(); if(!nome)return; try{await POST('/categorias-produto',{nome});showToast('Criada!');openCatProdModal();}catch(e){showToast(e.message,'danger');} }
async function saveCatProd(id,nome) { if(!nome.trim())return; try{await PUT(`/categorias-produto/${id}`,{nome});}catch(e){showToast(e.message,'danger');} }
async function deleteCatProd(id) { try{await DEL(`/categorias-produto/${id}`);openCatProdModal();}catch(e){showToast(e.message,'danger');} }

// ==========================================
// ORDENS DE SERVIÇO - LISTA
// ==========================================
async function showOrdens(filters = {}) {
  showLoading();
  try {
    const params = new URLSearchParams(filters).toString();
    const ordens = await GET(`/ordens${params ? '?' + params : ''}`);
    document.getElementById('page-content').innerHTML = `
      <div class="page-header">
        <h4><i class="bi bi-clipboard-check me-2 text-warning"></i>Ordens de Serviço</h4>
        <button class="btn btn-accent" onclick="openNovaOsModal()"><i class="bi bi-plus-lg me-1"></i>Nova OS</button>
      </div>
      <div class="filters-bar">
        <div class="flex-grow-1"><input type="text" class="form-control" id="osSearch" placeholder="Nº OS, cliente, placa..." onkeyup="if(event.key==='Enter')showOrdens({search:this.value})"></div>
        <select class="form-select" style="max-width:170px" id="osStatus" onchange="showOrdens({status:this.value})">
          <option value="">Todos os status</option>
          <option value="aberta">Aberta</option>
          <option value="em_andamento">Em Andamento</option>
          <option value="aguardando_pecas">Aguard. Peças</option>
          <option value="concluida">Concluída</option>
          <option value="cancelada">Cancelada</option>
        </select>
        <input type="date" class="form-control" style="max-width:155px" id="osDataIni" placeholder="De">
        <input type="date" class="form-control" style="max-width:155px" id="osDataFim" placeholder="Até">
        <button class="btn btn-outline-secondary" onclick="showOrdens({search:document.getElementById('osSearch').value,status:document.getElementById('osStatus').value,data_inicio:document.getElementById('osDataIni').value,data_fim:document.getElementById('osDataFim').value})"><i class="bi bi-funnel"></i></button>
      </div>
      <div class="table-card">
        ${ordens.length ? `
        <table class="table">
          <thead><tr><th>Nº OS</th><th>Cliente</th><th>Veículo</th><th>Responsável</th><th>Entrada</th><th>Previsão</th><th>Status</th><th>Total</th><th>Ações</th></tr></thead>
          <tbody>
            ${ordens.map(os => `
              <tr onclick="navigate('os','${os.id}')" style="cursor:pointer">
                <td><strong class="text-warning">#${os.numero}</strong></td>
                <td>${os.cliente_nome}</td>
                <td><strong>${os.placa}</strong> ${os.marca||''} ${os.modelo||''}</td>
                <td>${os.funcionario_nome||'-'}</td>
                <td>${fDate(os.data_entrada)}</td>
                <td>${os.data_previsao ? fDate(os.data_previsao) : '-'}</td>
                <td>${statusBadge(os.status)}</td>
                <td><strong>${R$(os.total_geral)}</strong></td>
                <td onclick="event.stopPropagation()">
                  <div class="btn-group btn-group-sm">
                    <button class="btn btn-outline-primary" onclick="navigate('os','${os.id}')"><i class="bi bi-eye"></i></button>
                    ${!['concluida','cancelada'].includes(os.status) ? `<button class="btn btn-outline-danger" onclick="cancelarOs(${os.id},'${os.numero}')"><i class="bi bi-x-circle"></i></button>` : ''}
                  </div>
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>` : '<div class="empty-state"><i class="bi bi-clipboard-check"></i>Nenhuma OS encontrada</div>'}
      </div>
    `;
  } catch(e) { showToast(e.message,'danger'); }
}

// Abre modal com toggle Rápida/Cadastrado
async function openNovaOsModal() { openNovaOsRapidaModal(); }

async function openNovaOsRapidaModal() {
  const funcs = await GET('/funcionarios');
  openModal('Nova Ordem de Serviço', `
    <!-- Toggle -->
    <div class="btn-group w-100 mb-3" role="group">
      <input type="radio" class="btn-check" name="os_modo" id="os_modo_rapido" value="rapido" checked onchange="toggleModoOs('rapido')">
      <label class="btn btn-outline-warning" for="os_modo_rapido"><i class="bi bi-lightning-charge me-1"></i>Entrada Rápida</label>
      <input type="radio" class="btn-check" name="os_modo" id="os_modo_cad" value="cadastrado" onchange="toggleModoOs('cadastrado')">
      <label class="btn btn-outline-secondary" for="os_modo_cad"><i class="bi bi-person-check me-1"></i>Cliente Cadastrado</label>
    </div>

    <!-- MODO RÁPIDO -->
    <div id="os_bloco_rapido">
      <div class="row g-3">
        <div class="col-md-6"><label class="form-label">Nome do Cliente *</label><input class="form-control" id="os_r_nome" placeholder="Nome completo"></div>
        <div class="col-md-6"><label class="form-label">Telefone / WhatsApp</label><input class="form-control" id="os_r_tel" placeholder="(00) 00000-0000" type="tel"></div>
        <div class="col-md-4"><label class="form-label">Placa</label><input class="form-control" id="os_r_placa" placeholder="ABC1D23" style="text-transform:uppercase" maxlength="8"></div>
        <div class="col-md-4"><label class="form-label">Marca / Modelo</label><input class="form-control" id="os_r_marca" placeholder="Ex: Gol, Uno, Civic..."></div>
        <div class="col-md-4"><label class="form-label">Cor</label><input class="form-control" id="os_r_cor" placeholder="Branca, Preta..."></div>
        <div class="col-md-4"><label class="form-label">KM Entrada</label><input type="number" class="form-control" id="os_r_km" placeholder="0"></div>
        <div class="col-md-4"><label class="form-label">Previsão</label><input type="date" class="form-control" id="os_r_prev"></div>
        <div class="col-md-4">
          <label class="form-label">Responsável</label>
          <select class="form-select" id="os_r_func">
            <option value="">Nenhum</option>
            ${funcs.map(f=>`<option value="${f.id}">${f.nome}</option>`).join('')}
          </select>
        </div>
        <div class="col-12"><label class="form-label">Problema Relatado</label><textarea class="form-control" id="os_r_prob" rows="3" placeholder="Descreva o problema..."></textarea></div>
      </div>
    </div>

    <!-- MODO CADASTRADO -->
    <div id="os_bloco_cad" style="display:none">
      <div class="row g-3">
        <div class="col-md-6">
          <label class="form-label">Cliente *</label>
          <select class="form-select" id="os_cliente" onchange="carregarVeiculosCliente(this.value)">
            <option value="">Selecione...</option>
          </select>
        </div>
        <div class="col-md-6">
          <label class="form-label">Veículo *</label>
          <select class="form-select" id="os_veiculo" disabled><option>Selecione o cliente</option></select>
        </div>
        <div class="col-md-6">
          <label class="form-label">Responsável</label>
          <select class="form-select" id="os_func_cad">
            <option value="">Nenhum</option>
            ${funcs.map(f=>`<option value="${f.id}">${f.nome}</option>`).join('')}
          </select>
        </div>
        <div class="col-md-3"><label class="form-label">KM</label><input type="number" class="form-control" id="os_km" placeholder="0"></div>
        <div class="col-md-3"><label class="form-label">Previsão</label><input type="date" class="form-control" id="os_prev"></div>
        <div class="col-12"><label class="form-label">Problema Relatado</label><textarea class="form-control" id="os_prob" rows="3" placeholder="Descreva o problema..."></textarea></div>
      </div>
    </div>
  `, `<button class="btn btn-secondary" data-bs-dismiss="modal">Cancelar</button>
      <button class="btn btn-accent" onclick="criarOs()"><i class="bi bi-check-lg me-1"></i>Criar OS</button>`, 'lg');

  // Carrega clientes para o modo cadastrado (lazy)
  GET('/clientes').then(clientes => {
    const sel = document.getElementById('os_cliente');
    if (sel) sel.innerHTML = '<option value="">Selecione...</option>' + clientes.map(c=>`<option value="${c.id}">${c.nome}</option>`).join('');
  });
}

function toggleModoOs(modo) {
  document.getElementById('os_bloco_rapido').style.display = modo === 'rapido' ? '' : 'none';
  document.getElementById('os_bloco_cad').style.display   = modo === 'cadastrado' ? '' : 'none';
}

async function carregarVeiculosCliente(clienteId) {
  const sel = document.getElementById('os_veiculo');
  if (!clienteId) { sel.innerHTML = '<option value="">Selecione o cliente primeiro</option>'; sel.disabled = true; return; }
  try {
    const veiculos = await GET(`/veiculos?cliente_id=${clienteId}`);
    sel.innerHTML = '<option value="">Selecione o veículo...</option>' + veiculos.map(v => `<option value="${v.id}">${v.placa} - ${v.marca||''} ${v.modelo||''}</option>`).join('');
    sel.disabled = false;
  } catch(e) { showToast(e.message,'danger'); }
}

async function criarOs() {
  const modo = document.querySelector('input[name="os_modo"]:checked')?.value || 'rapido';
  try {
    let os;
    if (modo === 'rapido') {
      const nome = document.getElementById('os_r_nome').value.trim();
      if (!nome) return showToast('Nome do cliente é obrigatório','warning');
      const marcaModelo = document.getElementById('os_r_marca').value.trim();
      os = await POST('/ordens/rapida', {
        nome_cliente: nome,
        telefone: document.getElementById('os_r_tel').value||null,
        placa: document.getElementById('os_r_placa').value||null,
        marca: marcaModelo.split(' ')[0]||null,
        modelo: marcaModelo.split(' ').slice(1).join(' ')||marcaModelo||null,
        cor: document.getElementById('os_r_cor').value||null,
        km_entrada: document.getElementById('os_r_km').value||null,
        data_previsao: document.getElementById('os_r_prev').value||null,
        funcionario_id: document.getElementById('os_r_func').value||null,
        descricao_problema: document.getElementById('os_r_prob').value||null,
      });
    } else {
      const body = {
        cliente_id: document.getElementById('os_cliente').value,
        veiculo_id: document.getElementById('os_veiculo').value,
        funcionario_id: document.getElementById('os_func_cad').value||null,
        km_entrada: document.getElementById('os_km').value||null,
        data_previsao: document.getElementById('os_prev').value||null,
        descricao_problema: document.getElementById('os_prob').value,
      };
      if (!body.cliente_id) return showToast('Selecione o cliente','warning');
      if (!body.veiculo_id) return showToast('Selecione o veículo','warning');
      os = await POST('/ordens', body);
    }
    closeModal(); showToast(`OS #${os.numero} criada!`); navigate('os', os.id);
  } catch(e) { showToast(e.message,'danger'); }
}

async function cancelarOs(id, numero) {
  if (!confirm(`Cancelar OS #${numero}?`)) return;
  try { await POST(`/ordens/${id}/cancelar`); showToast('OS cancelada!'); showOrdens(); }
  catch(e) { showToast(e.message,'danger'); }
}

// ==========================================
// OS - DETALHE
// ==========================================
async function showOsDetalhe(id) {
  updateNav('ordens');
  showLoading();
  try {
    const os = await GET(`/ordens/${id}`);
    const finalizada = ['concluida','cancelada'].includes(os.status);
    const [funcs, servicos_cat, produtos_cat] = await Promise.all([GET('/funcionarios'), GET('/servicos'), GET('/produtos')]);

    document.getElementById('page-content').innerHTML = `
      <div class="page-header">
        <div class="d-flex align-items-center gap-3">
          <button class="btn btn-sm btn-outline-secondary" onclick="showOrdens()"><i class="bi bi-arrow-left"></i></button>
          <h4 class="mb-0"><i class="bi bi-clipboard-check me-2 text-warning"></i>OS #${os.numero}</h4>
          ${statusBadge(os.status)}
        </div>
        <div class="d-flex gap-2 flex-wrap">
          <button class="btn btn-outline-secondary btn-sm" onclick="imprimirOs(${id})"><i class="bi bi-printer me-1"></i>Imprimir</button>
          <button class="btn btn-success btn-sm" onclick="compartilharWhatsApp(${id})" style="background:#25d366;border-color:#25d366"><i class="bi bi-whatsapp me-1"></i>WhatsApp</button>
          ${!finalizada ? `
            ${os.status === 'aberta' ? `<button class="btn btn-warning btn-sm text-white" onclick="mudarStatusOs(${id},'em_andamento')"><i class="bi bi-play-circle me-1"></i>Iniciar</button>` : ''}
            ${os.status === 'em_andamento' ? `<button class="btn btn-purple btn-sm" onclick="mudarStatusOs(${id},'aguardando_pecas')" style="background:#6a1b9a;color:#fff;border:none"><i class="bi bi-hourglass me-1"></i>Aguard. Peças</button>` : ''}
            ${os.status !== 'aberta' ? `<button class="btn btn-outline-secondary btn-sm" onclick="mudarStatusOs(${id},'aberta')"><i class="bi bi-arrow-counterclockwise me-1"></i>Reabrir</button>` : ''}
            <button class="btn btn-success btn-sm" onclick="fecharOsModal(${id})"><i class="bi bi-check-circle me-1"></i>Fechar OS</button>
            <button class="btn btn-danger btn-sm" onclick="cancelarOsDetalhe(${id},'${os.numero}')"><i class="bi bi-x-circle me-1"></i>Cancelar</button>
          ` : ''}
        </div>
      </div>

      <!-- OS Header -->
      <div class="os-header-card mb-3">
        <div class="row g-3">
          <div class="col-md-3">
            <div class="os-info-label">Cliente</div>
            <div class="os-info-value">${os.cliente_nome}</div>
            <div style="font-size:.85rem;color:rgba(255,255,255,.6)">${os.cliente_telefone||''}</div>
          </div>
          <div class="col-md-3">
            <div class="os-info-label">Veículo</div>
            <div class="os-info-value">${os.placa} — ${os.marca||''} ${os.modelo||''} ${os.ano||''}</div>
            <div style="font-size:.85rem;color:rgba(255,255,255,.6)">${os.cor||''}</div>
          </div>
          <div class="col-md-2">
            <div class="os-info-label">KM Entrada</div>
            <div class="os-info-value">${os.km_entrada ? os.km_entrada.toLocaleString('pt-BR') + ' km' : '-'}</div>
            ${os.km_saida ? `<div class="os-info-label mt-1">KM Saída</div><div class="os-info-value">${os.km_saida.toLocaleString('pt-BR')} km</div>` : ''}
          </div>
          <div class="col-md-2">
            <div class="os-info-label">Responsável</div>
            <div class="os-info-value">${os.funcionario_nome||'-'}</div>
            <div class="os-info-label mt-1">Previsão</div>
            <div class="os-info-value">${os.data_previsao ? fDate(os.data_previsao) : '-'}</div>
          </div>
          <div class="col-md-2">
            <div class="os-info-label">Entrada</div>
            <div class="os-info-value">${fDate(os.data_entrada)}</div>
            ${os.data_conclusao ? `<div class="os-info-label mt-1">Conclusão</div><div class="os-info-value">${fDate(os.data_conclusao)}</div>` : ''}
          </div>
        </div>
        ${os.descricao_problema ? `<div class="mt-3 pt-3 border-top border-secondary"><div class="os-info-label">Problema Relatado</div><div class="os-info-value">${os.descricao_problema}</div></div>` : ''}
      </div>

      <div class="row g-3">
        <div class="col-lg-8">
          <!-- Serviços -->
          <div class="table-card mb-3">
            <div class="section-header">
              <div class="section-title"><i class="bi bi-gear"></i> Serviços / Mão de Obra</div>
              ${!finalizada ? `<button class="btn btn-sm btn-accent" onclick="openAddServicoModal(${id})"><i class="bi bi-plus-lg me-1"></i>Adicionar</button>` : ''}
            </div>
            ${os.servicos.length ? `
            <table class="table table-sm">
              <thead><tr><th>Descrição</th><th>Responsável</th><th>Comissão</th><th>Valor</th>${!finalizada ? '<th></th>' : ''}</tr></thead>
              <tbody>
                ${os.servicos.map(s => `
                  <tr>
                    <td>${s.descricao}</td>
                    <td>${s.funcionario_nome||'-'}</td>
                    <td>${s.comissao_percentual}%${s.comissao_valor > 0 ? ` = ${R$(s.comissao_valor)}` : ''}</td>
                    <td><strong>${R$(s.preco)}</strong></td>
                    ${!finalizada ? `<td><button class="btn btn-sm btn-outline-danger" onclick="removeServico(${id},${s.id})"><i class="bi bi-trash"></i></button></td>` : ''}
                  </tr>
                `).join('')}
              </tbody>
            </table>` : '<div class="empty-state" style="padding:1.5rem"><i class="bi bi-gear d-block mb-2" style="font-size:1.5rem"></i>Nenhum serviço</div>'}
          </div>

          <!-- Produtos -->
          <div class="table-card">
            <div class="section-header">
              <div class="section-title"><i class="bi bi-box-seam"></i> Produtos / Peças</div>
              ${!finalizada ? `<button class="btn btn-sm btn-accent" onclick="openAddProdutoModal(${id})"><i class="bi bi-plus-lg me-1"></i>Adicionar</button>` : ''}
            </div>
            ${os.produtos.length ? `
            <table class="table table-sm">
              <thead><tr><th>Descrição</th><th>Qtd</th><th>Unit.</th><th>Total</th>${!finalizada ? '<th></th>' : ''}</tr></thead>
              <tbody>
                ${os.produtos.map(p => `
                  <tr>
                    <td>${p.descricao}</td>
                    <td>${fNum(p.quantidade)} ${p.produto_unidade||''}</td>
                    <td>${R$(p.preco_unitario)}</td>
                    <td><strong>${R$(p.total)}</strong></td>
                    ${!finalizada ? `<td><button class="btn btn-sm btn-outline-danger" onclick="removeProduto(${id},${p.id})"><i class="bi bi-trash"></i></button></td>` : ''}
                  </tr>
                `).join('')}
              </tbody>
            </table>` : '<div class="empty-state" style="padding:1.5rem"><i class="bi bi-box-seam d-block mb-2" style="font-size:1.5rem"></i>Nenhuma peça</div>'}
          </div>

          <!-- Fotos do Veículo -->
          <div class="table-card">
            <div class="section-header">
              <div class="section-title"><i class="bi bi-camera"></i> Fotos do Veículo</div>
            </div>
            <div class="foto-grid" id="foto-grid-${id}">
              ${(JSON.parse(os.fotos||'[]')).map(url=>`
                <div class="foto-item" onclick="verFoto('${url}')">
                  <img src="${url}" alt="Foto">
                  ${!finalizada ? `<button class="foto-del" onclick="event.stopPropagation();deletarFoto(${id},'${url}')"><i class="bi bi-x"></i></button>` : ''}
                </div>
              `).join('')}
              ${!finalizada ? `
              <label class="foto-add-btn" title="Tirar foto ou selecionar">
                <i class="bi bi-camera-fill"></i>
                <span>Foto</span>
                <input type="file" accept="image/*" capture="environment" style="display:none" onchange="uploadFoto(${id},this)">
              </label>` : ''}
            </div>
          </div>
        </div>

        <!-- Totais -->
        <div class="col-lg-4">
          <div class="totals-card mb-3">
            <div class="fw-bold mb-3" style="color:#495057"><i class="bi bi-receipt me-2"></i>Resumo Financeiro</div>
            <div class="total-row"><span class="text-muted">Serviços</span><span>${R$(os.total_servicos)}</span></div>
            <div class="total-row"><span class="text-muted">Produtos</span><span>${R$(os.total_produtos)}</span></div>
            <div class="total-row"><span class="text-muted">Desconto</span><span class="text-danger">- ${R$(os.desconto)}</span></div>
            <div class="total-row"><span>TOTAL GERAL</span><span>${R$(os.total_geral)}</span></div>
            <div class="mt-3 pt-2 border-top">
              <div class="d-flex justify-content-between align-items-center">
                <span class="text-muted" style="font-size:.85rem">Pagamento</span>
                <span class="${os.pago ? 'text-success' : 'text-danger'} fw-bold">${os.pago ? '✅ PAGO' : '⏳ PENDENTE'}</span>
              </div>
              ${os.forma_pagamento ? `<div class="text-muted" style="font-size:.85rem">Forma: ${os.forma_pagamento}</div>` : ''}
            </div>
          </div>

          ${!finalizada ? `
          <div class="totals-card">
            <div class="fw-bold mb-3" style="color:#495057"><i class="bi bi-pencil me-2"></i>Ajustes</div>
            <div class="mb-2"><label class="form-label mb-1">Desconto (R$)</label>
              <input type="number" step="0.01" min="0" class="form-control form-control-sm" id="os_desconto" value="${os.desconto||0}" onchange="atualizarDesconto(${id},this.value)">
            </div>
          </div>` : ''}

          ${os.servicos.filter(s=>s.comissao_percentual>0).length ? `
          <div class="totals-card mt-3">
            <div class="fw-bold mb-3" style="color:#495057"><i class="bi bi-cash-coin me-2 text-warning"></i>Comissões</div>
            ${os.servicos.filter(s=>s.comissao_percentual>0).map(s => `
              <div class="d-flex justify-content-between align-items-center mb-2">
                <div>
                  <div style="font-size:.85rem;font-weight:600">${s.funcionario_nome||'N/A'}</div>
                  <div style="font-size:.78rem;color:#6c757d">${s.descricao}</div>
                </div>
                <span class="comissao-badge">${s.comissao_percentual}% = ${R$(s.preco * s.comissao_percentual / 100)}</span>
              </div>
            `).join('')}
          </div>` : ''}
        </div>
      </div>
    `;
  } catch(e) { showToast(e.message,'danger'); }
}

async function mudarStatusOs(id, status) {
  try { await PUT(`/ordens/${id}/status`, { status }); showOsDetalhe(id); showToast('Status atualizado!'); }
  catch(e) { showToast(e.message,'danger'); }
}

async function atualizarDesconto(id, desconto) {
  try {
    const os = await GET(`/ordens/${id}`);
    await PUT(`/ordens/${id}`, { ...os, desconto: parseFloat(desconto)||0 });
    showOsDetalhe(id);
  } catch(e) { showToast(e.message,'danger'); }
}

async function cancelarOsDetalhe(id, numero) {
  if (!confirm(`Cancelar OS #${numero}?`)) return;
  try { await POST(`/ordens/${id}/cancelar`); showToast('OS cancelada!'); showOsDetalhe(id); }
  catch(e) { showToast(e.message,'danger'); }
}

async function fecharOsModal(id) {
  const os = await GET(`/ordens/${id}`);
  openModal('Fechar Ordem de Serviço', `
    <!-- Resumo dos valores -->
    <div class="p-3 mb-3 rounded" style="background:#f8f9fa;border:1px solid #e9ecef">
      <div class="d-flex justify-content-between mb-1">
        <span class="text-muted">Serviços</span><span>${R$(os.total_servicos)}</span>
      </div>
      <div class="d-flex justify-content-between mb-1">
        <span class="text-muted">Peças</span><span>${R$(os.total_produtos)}</span>
      </div>
      <div class="d-flex justify-content-between mb-2 pb-2" style="border-bottom:1px dashed #dee2e6">
        <span class="text-muted">Subtotal</span><span><strong>${R$(os.total_servicos + os.total_produtos)}</strong></span>
      </div>
      <div class="d-flex justify-content-between align-items-center mb-1">
        <span class="text-danger">Desconto</span>
        <span class="text-danger fw-bold" id="fech_desconto_display">- ${R$(os.desconto||0)}</span>
      </div>
      <div class="d-flex justify-content-between" style="font-size:1.2rem">
        <span class="fw-bold">TOTAL</span>
        <span class="fw-bold text-warning" id="fech_total_display">${R$(os.total_geral)}</span>
      </div>
    </div>

    <div class="row g-3">
      <!-- Desconto -->
      <div class="col-12">
        <label class="form-label fw-semibold">Desconto</label>
        <div class="input-group">
          <select class="form-select" id="fech_desc_tipo" style="max-width:110px" onchange="calcularDescontoFech(${os.total_servicos + os.total_produtos}, ${os.total_geral})">
            <option value="valor">R$ Valor</option>
            <option value="percent">% Percent.</option>
          </select>
          <input type="number" step="0.01" min="0" class="form-control" id="fech_desc_input" value="${os.desconto||0}" placeholder="0" oninput="calcularDescontoFech(${os.total_servicos + os.total_produtos}, ${os.total_geral})">
        </div>
      </div>

      <!-- Forma de pagamento com botões visuais -->
      <div class="col-12">
        <label class="form-label fw-semibold">Forma de Pagamento *</label>
        <div class="d-flex flex-wrap gap-2" id="fech_pgto_btns">
          ${[
            {v:'Pix',            icon:'bi-qr-code',       color:'#00a884'},
            {v:'Dinheiro',       icon:'bi-cash-stack',    color:'#2ecc71'},
            {v:'Cartão Débito',  icon:'bi-credit-card',   color:'#3498db'},
            {v:'Cartão Crédito', icon:'bi-credit-card-2-front', color:'#9b59b6'},
            {v:'Transferência',  icon:'bi-bank',          color:'#e67e22'},
            {v:'A Prazo',        icon:'bi-calendar-check',color:'#e74c3c'},
          ].map(p=>`
            <button type="button" class="btn pgto-btn" data-valor="${p.v}"
              style="border:2px solid #dee2e6;background:#fff;padding:.5rem .85rem;border-radius:10px;font-size:.82rem;display:flex;flex-direction:column;align-items:center;gap:3px;min-width:80px"
              onclick="selecionarPgto('${p.v}')">
              <i class="bi ${p.icon}" style="font-size:1.2rem;color:${p.color}"></i>
              <span>${p.v}</span>
            </button>
          `).join('')}
        </div>
        <input type="hidden" id="fech_pgto" value="">
      </div>

      <!-- KM saída -->
      <div class="col-md-6">
        <label class="form-label">KM de Saída</label>
        <input type="number" class="form-control" id="fech_km" placeholder="0" value="${os.km_entrada||''}">
      </div>

      <!-- Pago? -->
      <div class="col-md-6 d-flex align-items-end">
        <div class="form-check form-switch">
          <input class="form-check-input" type="checkbox" role="switch" id="fech_pago" style="width:2.5em;height:1.3em" checked>
          <label class="form-check-label fw-semibold ms-2 text-success" for="fech_pago">Pagamento recebido</label>
        </div>
      </div>

      <!-- Observação financeira -->
      <div class="col-12">
        <label class="form-label">Observação do Pagamento</label>
        <input class="form-control" id="fech_obs_pgto" placeholder="Ex: Pago 50% agora, restante em 30 dias...">
      </div>
    </div>
  `, `<button class="btn btn-secondary" data-bs-dismiss="modal">Cancelar</button>
      <button class="btn btn-success btn-lg" onclick="fecharOs(${id})"><i class="bi bi-check-circle me-1"></i>Fechar e Gerar Comissões</button>`, 'lg');
}

function selecionarPgto(valor) {
  document.getElementById('fech_pgto').value = valor;
  document.querySelectorAll('.pgto-btn').forEach(b => {
    const sel = b.dataset.valor === valor;
    b.style.borderColor   = sel ? '#f39c12' : '#dee2e6';
    b.style.background    = sel ? '#fff8e1' : '#fff';
    b.style.fontWeight    = sel ? '700' : '400';
  });
}

function calcularDescontoFech(subtotal, totalAtual) {
  const tipo  = document.getElementById('fech_desc_tipo').value;
  const input = parseFloat(document.getElementById('fech_desc_input').value)||0;
  const desc  = tipo === 'percent' ? subtotal * (input / 100) : input;
  const total = Math.max(0, subtotal - desc);
  document.getElementById('fech_desconto_display').textContent = `- ${R$(desc)}`;
  document.getElementById('fech_total_display').textContent    = R$(total);
}

async function fecharOs(id) {
  const tipo     = document.getElementById('fech_desc_tipo').value;
  const input    = parseFloat(document.getElementById('fech_desc_input').value)||0;
  const pgto     = document.getElementById('fech_pgto').value;
  const os       = await GET(`/ordens/${id}`);
  const subtotal = os.total_servicos + os.total_produtos;
  const desconto = tipo === 'percent' ? subtotal * (input / 100) : input;

  if (!pgto) return showToast('Selecione a forma de pagamento','warning');

  const body = {
    km_saida:        document.getElementById('fech_km').value||null,
    forma_pagamento: pgto,
    pago:            document.getElementById('fech_pago').checked,
  };

  // Atualiza desconto antes de fechar
  await PUT(`/ordens/${id}`, { ...os, desconto: Math.max(0, desconto) });

  try {
    await POST(`/ordens/${id}/fechar`, body);
    closeModal();
    showToast('OS fechada com sucesso!');
    showOsDetalhe(id);
  } catch(e) { showToast(e.message,'danger'); }
}

// ==================== FOTOS ====================
async function uploadFoto(osId, input) {
  const file = input.files[0];
  if (!file) return;
  const formData = new FormData();
  formData.append('foto', file);
  try {
    const res = await fetch(`/api/ordens/${osId}/fotos`, { method: 'POST', body: formData });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);
    // Atualiza a grid sem recarregar a página inteira
    const grid = document.getElementById(`foto-grid-${osId}`);
    if (grid) {
      const div = document.createElement('div');
      div.className = 'foto-item';
      div.innerHTML = `<img src="${data.url}" alt="Foto"><button class="foto-del" onclick="event.stopPropagation();deletarFoto(${osId},'${data.url}')"><i class="bi bi-x"></i></button>`;
      div.onclick = () => verFoto(data.url);
      grid.insertBefore(div, grid.lastElementChild);
    }
    showToast('Foto adicionada!');
  } catch(e) { showToast(e.message,'danger'); }
  input.value = '';
}

async function deletarFoto(osId, url) {
  if (!confirm('Remover esta foto?')) return;
  try {
    await api('DELETE', `/ordens/${osId}/fotos`, { url });
    showOsDetalhe(osId);
  } catch(e) { showToast(e.message,'danger'); }
}

function verFoto(url) {
  openModal('', `<img src="${url}" style="width:100%;border-radius:8px">`, `<button class="btn btn-secondary" data-bs-dismiss="modal">Fechar</button>`, 'lg');
}

// ==================== WHATSAPP ====================
async function compartilharWhatsApp(id) {
  try {
    const { texto, telefone } = await GET(`/ordens/${id}/whatsapp`);
    const encoded = encodeURIComponent(texto);
    const tel = telefone ? telefone.replace(/\D/g,'') : '';
    const url = tel ? `https://wa.me/55${tel}?text=${encoded}` : `https://wa.me/?text=${encoded}`;
    window.open(url, '_blank');
  } catch(e) { showToast(e.message,'danger'); }
}

async function openAddServicoModal(osId) {
  const [servicos, funcs] = await Promise.all([GET('/servicos'), GET('/funcionarios')]);
  openModal('Adicionar Serviço', `
    <div class="row g-3">
      <div class="col-12">
        <label class="form-label">Selecionar do Catálogo</label>
        <select class="form-select" id="as_cat" onchange="preencherServico(this.value)">
          <option value="">-- Selecione ou preencha manualmente --</option>
          ${servicos.map(s => `<option value="${s.id}" data-preco="${s.preco}" data-com="${s.comissao_percentual}" data-nome="${s.nome.replace(/"/g,'&quot;')}">${s.nome} — ${R$(s.preco)}</option>`).join('')}
        </select>
      </div>
      <div class="col-12"><label class="form-label">Descrição *</label><input class="form-control" id="as_desc" placeholder="Descreva o serviço..."></div>
      <div class="col-md-6">
        <label class="form-label">Responsável</label>
        <select class="form-select" id="as_func" onchange="preencherComissaoFunc(this.value)">
          <option value="">Nenhum</option>
          ${funcs.map(f => `<option value="${f.id}" data-com="${f.comissao_percentual}">${f.nome}</option>`).join('')}
        </select>
      </div>
      <div class="col-md-3"><label class="form-label">Valor (R$)</label><input type="number" step="0.01" min="0" class="form-control" id="as_preco" value="0"></div>
      <div class="col-md-3"><label class="form-label">Comissão (%)</label><input type="number" step="0.1" min="0" max="100" class="form-control" id="as_com" value="0"></div>
    </div>
  `, `<button class="btn btn-secondary" data-bs-dismiss="modal">Cancelar</button>
      <button class="btn btn-accent" onclick="addServico(${osId})"><i class="bi bi-plus-lg me-1"></i>Adicionar</button>`);
}

function preencherServico(servicoId) {
  const sel = document.getElementById('as_cat');
  const opt = sel.options[sel.selectedIndex];
  if (!servicoId) return;
  document.getElementById('as_desc').value = opt.dataset.nome;
  document.getElementById('as_preco').value = opt.dataset.preco;
  document.getElementById('as_com').value = opt.dataset.com;
}

function preencherComissaoFunc(funcId) {
  if (!funcId) return;
  const sel = document.getElementById('as_func');
  const opt = sel.options[sel.selectedIndex];
  if (!document.getElementById('as_com').value || document.getElementById('as_com').value == '0') {
    document.getElementById('as_com').value = opt.dataset.com;
  }
}

async function addServico(osId) {
  const body = { servico_id: document.getElementById('as_cat').value||null, funcionario_id: document.getElementById('as_func').value||null, descricao: document.getElementById('as_desc').value.trim(), preco: parseFloat(document.getElementById('as_preco').value)||0, comissao_percentual: parseFloat(document.getElementById('as_com').value)||0 };
  if (!body.descricao) return showToast('Descrição é obrigatória','warning');
  try { await POST(`/ordens/${osId}/servicos`, body); closeModal(); showToast('Serviço adicionado!'); showOsDetalhe(osId); }
  catch(e) { showToast(e.message,'danger'); }
}

async function removeServico(osId, itemId) {
  if (!confirm('Remover este serviço?')) return;
  try { await DEL(`/ordens/${osId}/servicos/${itemId}`); showToast('Removido!'); showOsDetalhe(osId); }
  catch(e) { showToast(e.message,'danger'); }
}

async function openAddProdutoModal(osId) {
  const produtos = await GET('/produtos');
  openModal('Adicionar Produto / Peça', `
    <div class="row g-3">
      <div class="col-12">
        <label class="form-label">Selecionar do Estoque</label>
        <select class="form-select" id="ap_cat" onchange="preencherProduto(this.value)">
          <option value="">-- Selecione ou preencha manualmente --</option>
          ${produtos.map(p => `<option value="${p.id}" data-preco="${p.preco_venda}" data-nome="${p.nome.replace(/"/g,'&quot;')}" data-est="${p.estoque_atual}" data-un="${p.unidade}">${p.nome} — Est: ${fNum(p.estoque_atual)} ${p.unidade} — ${R$(p.preco_venda)}</option>`).join('')}
        </select>
      </div>
      <div class="col-12"><label class="form-label">Descrição *</label><input class="form-control" id="ap_desc" placeholder="Nome da peça ou produto..."></div>
      <div class="col-md-4"><label class="form-label">Quantidade</label><input type="number" step="0.01" min="0.01" class="form-control" id="ap_qty" value="1" oninput="calcTotalProd()"></div>
      <div class="col-md-4"><label class="form-label">Preço Unitário (R$)</label><input type="number" step="0.01" min="0" class="form-control" id="ap_preco" value="0" oninput="calcTotalProd()"></div>
      <div class="col-md-4"><label class="form-label">Total</label><input class="form-control bg-light fw-bold" id="ap_total" readonly value="R$ 0,00"></div>
    </div>
  `, `<button class="btn btn-secondary" data-bs-dismiss="modal">Cancelar</button>
      <button class="btn btn-accent" onclick="addProduto(${osId})"><i class="bi bi-plus-lg me-1"></i>Adicionar</button>`);
}

function preencherProduto(prodId) {
  const sel = document.getElementById('ap_cat');
  const opt = sel.options[sel.selectedIndex];
  if (!prodId) return;
  document.getElementById('ap_desc').value = opt.dataset.nome;
  document.getElementById('ap_preco').value = opt.dataset.preco;
  calcTotalProd();
}

function calcTotalProd() {
  const qty = parseFloat(document.getElementById('ap_qty').value)||0;
  const preco = parseFloat(document.getElementById('ap_preco').value)||0;
  document.getElementById('ap_total').value = R$(qty * preco);
}

async function addProduto(osId) {
  const body = { produto_id: document.getElementById('ap_cat').value||null, descricao: document.getElementById('ap_desc').value.trim(), quantidade: parseFloat(document.getElementById('ap_qty').value)||1, preco_unitario: parseFloat(document.getElementById('ap_preco').value)||0 };
  if (!body.descricao) return showToast('Descrição é obrigatória','warning');
  try { await POST(`/ordens/${osId}/produtos`, body); closeModal(); showToast('Produto adicionado!'); showOsDetalhe(osId); }
  catch(e) { showToast(e.message,'danger'); }
}

async function removeProduto(osId, itemId) {
  if (!confirm('Remover este produto?')) return;
  try { await DEL(`/ordens/${osId}/produtos/${itemId}`); showToast('Removido!'); showOsDetalhe(osId); }
  catch(e) { showToast(e.message,'danger'); }
}

async function imprimirOs(id) {
  try {
    const os = await GET(`/ordens/${id}`);
    const win = window.open('', '_blank');
    win.document.write(`<!DOCTYPE html><html><head><meta charset="UTF-8"><title>OS #${os.numero}</title><style>
      body{font-family:Arial,sans-serif;margin:20px;font-size:13px;color:#000}
      h1{font-size:18px;margin:0} h2{font-size:14px;margin:5px 0}
      table{width:100%;border-collapse:collapse;margin:10px 0}
      th,td{border:1px solid #ddd;padding:6px 8px;text-align:left}
      th{background:#f5f5f5;font-weight:bold}
      .header{display:flex;justify-content:space-between;border-bottom:2px solid #000;padding-bottom:10px;margin-bottom:15px}
      .info-grid{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin:10px 0;background:#f9f9f9;padding:10px;border:1px solid #ddd}
      .info-item label{font-weight:bold;display:block;font-size:11px;color:#666}
      .totals{margin-left:auto;width:300px}
      .total-row{display:flex;justify-content:space-between;padding:4px 0;border-bottom:1px solid #eee}
      .total-final{font-size:16px;font-weight:bold;color:#e65100}
      .assinatura{margin-top:40px;display:flex;justify-content:space-between}
      .ass-line{border-top:1px solid #000;width:200px;text-align:center;padding-top:5px;font-size:11px}
      @media print{body{margin:0}}
    </style></head><body>
    <div class="header">
      <div><h1>ORDEM DE SERVIÇO</h1><h2>#${os.numero}</h2></div>
      <div style="text-align:right"><strong>Data:</strong> ${fDate(os.data_entrada)}<br><strong>Status:</strong> ${STATUS_MAP[os.status]?.label||os.status}</div>
    </div>
    <div class="info-grid">
      <div class="info-item"><label>CLIENTE</label>${os.cliente_nome}</div>
      <div class="info-item"><label>TELEFONE</label>${os.cliente_telefone||'-'}</div>
      <div class="info-item"><label>VEÍCULO</label>${os.placa} — ${os.marca||''} ${os.modelo||''} ${os.ano||''}</div>
      <div class="info-item"><label>KM ENTRADA</label>${os.km_entrada ? os.km_entrada.toLocaleString('pt-BR') + ' km' : '-'}</div>
      <div class="info-item"><label>RESPONSÁVEL</label>${os.funcionario_nome||'-'}</div>
      <div class="info-item"><label>PREVISÃO</label>${os.data_previsao ? fDate(os.data_previsao) : '-'}</div>
    </div>
    ${os.descricao_problema ? `<div style="background:#fff3e0;border:1px solid #ffe0b2;padding:8px;margin:10px 0"><strong>Problema Relatado:</strong> ${os.descricao_problema}</div>` : ''}
    <h2 style="margin-top:15px">SERVIÇOS / MÃO DE OBRA</h2>
    <table><thead><tr><th>Descrição</th><th>Responsável</th><th>Valor</th></tr></thead><tbody>
      ${os.servicos.length ? os.servicos.map(s => `<tr><td>${s.descricao}</td><td>${s.funcionario_nome||'-'}</td><td style="text-align:right">${R$(s.preco)}</td></tr>`).join('') : '<tr><td colspan="3" style="text-align:center;color:#999">Nenhum serviço</td></tr>'}
    </tbody></table>
    <h2 style="margin-top:15px">PRODUTOS / PEÇAS</h2>
    <table><thead><tr><th>Descrição</th><th style="text-align:right">Qtd</th><th style="text-align:right">Unit.</th><th style="text-align:right">Total</th></tr></thead><tbody>
      ${os.produtos.length ? os.produtos.map(p => `<tr><td>${p.descricao}</td><td style="text-align:right">${fNum(p.quantidade)}</td><td style="text-align:right">${R$(p.preco_unitario)}</td><td style="text-align:right">${R$(p.total)}</td></tr>`).join('') : '<tr><td colspan="4" style="text-align:center;color:#999">Nenhum produto</td></tr>'}
    </tbody></table>
    <div class="totals" style="margin-top:10px">
      <div class="total-row"><span>Serviços:</span><span>${R$(os.total_servicos)}</span></div>
      <div class="total-row"><span>Produtos:</span><span>${R$(os.total_produtos)}</span></div>
      <div class="total-row"><span>Desconto:</span><span>- ${R$(os.desconto)}</span></div>
      <div class="total-row total-final"><span>TOTAL GERAL:</span><span>${R$(os.total_geral)}</span></div>
    </div>
    ${os.observacoes ? `<div style="margin-top:15px;padding:8px;border:1px solid #ddd"><strong>Observações:</strong> ${os.observacoes}</div>` : ''}
    <div class="assinatura">
      <div class="ass-line">Assinatura do Cliente</div>
      <div class="ass-line">Responsável Técnico</div>
    </div>
    </body></html>`);
    win.document.close();
    setTimeout(() => win.print(), 500);
  } catch(e) { showToast(e.message,'danger'); }
}

// ==========================================
// COMISSÕES
// ==========================================
async function showComissoes(funcId = null) {
  showLoading();
  try {
    const funcs = await GET('/funcionarios');
    let url = '/comissoes?pago=false';
    if (funcId) url += `&funcionario_id=${funcId}`;
    const comissoes = await GET(url);

    const totalPendente = comissoes.reduce((s,c)=>s+c.valor,0);

    document.getElementById('page-content').innerHTML = `
      <div class="page-header">
        <h4><i class="bi bi-cash-coin me-2 text-warning"></i>Comissões</h4>
        <div class="d-flex gap-2">
          <div class="stat-card py-2 px-3" style="background:#fff3e0">
            <span class="text-muted" style="font-size:.8rem">Pendente Total</span>
            <div class="fw-bold text-warning" style="font-size:1.1rem">${R$(totalPendente)}</div>
          </div>
          ${comissoes.length ? `<button class="btn btn-success" onclick="pagarTodasSelecionadas()"><i class="bi bi-check-all me-1"></i>Pagar Selecionadas</button>` : ''}
        </div>
      </div>
      <div class="filters-bar">
        <select class="form-select" style="max-width:220px" id="comFuncFilter" onchange="showComissoes(this.value||null)">
          <option value="">Todos os funcionários</option>
          ${funcs.map(f => `<option value="${f.id}" ${f.id==funcId?'selected':''}>${f.nome}</option>`).join('')}
        </select>
        <div class="form-check align-self-center ms-2">
          <input class="form-check-input" type="checkbox" id="comPagas" onchange="showComissoesComFiltro()">
          <label class="form-check-label">Mostrar pagas também</label>
        </div>
      </div>
      <div class="table-card">
        ${comissoes.length ? `
        <table class="table">
          <thead>
            <tr>
              <th><input type="checkbox" id="checkAll" onchange="toggleAllChecks(this)"></th>
              <th>Funcionário</th><th>OS</th><th>Serviço</th><th>Valor Serviço</th><th>Comissão</th><th>Data</th><th>Ações</th>
            </tr>
          </thead>
          <tbody>
            ${comissoes.map(c => `
              <tr>
                <td><input type="checkbox" class="com-check" value="${c.id}"></td>
                <td><strong>${c.funcionario_nome}</strong><br><small class="text-muted">${c.funcionario_cargo||''}</small></td>
                <td><a href="#os/${c.os_id}" class="text-warning fw-bold">#${c.os_numero}</a></td>
                <td style="max-width:200px">${c.servico_descricao}</td>
                <td>${R$(c.servico_preco)}</td>
                <td><span class="comissao-badge">${R$(c.valor)}</span></td>
                <td>${fDate(c.created_at)}</td>
                <td>
                  <button class="btn btn-sm btn-success" onclick="pagarComissao(${c.id})">
                    <i class="bi bi-check-circle me-1"></i>Pagar
                  </button>
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>` : '<div class="empty-state"><i class="bi bi-cash-coin"></i>Nenhuma comissão pendente</div>'}
      </div>
    `;
  } catch(e) { showToast(e.message,'danger'); }
}

async function showComissoesComFiltro() {
  const pago = document.getElementById('comPagas').checked;
  const funcId = document.getElementById('comFuncFilter').value;
  let url = `/comissoes?${pago ? '' : 'pago=false'}${funcId ? '&funcionario_id='+funcId : ''}`;
  try {
    const comissoes = await GET(url);
    // Re-render table body only for simplicity
    showComissoes(funcId||null);
  } catch(e) { showToast(e.message,'danger'); }
}

function toggleAllChecks(master) {
  document.querySelectorAll('.com-check').forEach(cb => cb.checked = master.checked);
}

async function pagarComissao(id) {
  try { await PUT(`/comissoes/${id}/pagar`); showToast('Comissão paga!'); showComissoes(); }
  catch(e) { showToast(e.message,'danger'); }
}

async function pagarTodasSelecionadas() {
  const ids = [...document.querySelectorAll('.com-check:checked')].map(cb => parseInt(cb.value));
  if (!ids.length) return showToast('Selecione pelo menos uma comissão','warning');
  if (!confirm(`Marcar ${ids.length} comissão(ões) como paga(s)?`)) return;
  try { await PUT('/comissoes/pagar-lote', { ids }); showToast(`${ids.length} comissão(ões) paga(s)!`); showComissoes(); }
  catch(e) { showToast(e.message,'danger'); }
}

// ==========================================
// RELATÓRIOS
// ==========================================
async function showRelatorios() {
  const hoje = new Date().toISOString().split('T')[0];
  const primeiroDia = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0];
  const funcs = await GET('/funcionarios');

  document.getElementById('page-content').innerHTML = `
    <div class="page-header"><h4><i class="bi bi-bar-chart me-2 text-warning"></i>Relatórios</h4></div>
    <ul class="nav nav-tabs mb-4" id="relTabs">
      <li class="nav-item"><button class="nav-link active" onclick="switchRelTab('faturamento',this)">Faturamento</button></li>
      <li class="nav-item"><button class="nav-link" onclick="switchRelTab('comissoes',this)">Comissões</button></li>
      <li class="nav-item"><button class="nav-link" onclick="switchRelTab('estoque',this)">Estoque</button></li>
    </ul>

    <div id="rel-faturamento">
      <div class="filters-bar">
        <div><label class="form-label mb-1">Data Início</label><input type="date" class="form-control" id="rel_di" value="${primeiroDia}"></div>
        <div><label class="form-label mb-1">Data Fim</label><input type="date" class="form-control" id="rel_df" value="${hoje}"></div>
        <div class="align-self-end"><button class="btn btn-accent" onclick="gerarRelFaturamento()"><i class="bi bi-search me-1"></i>Gerar</button></div>
      </div>
      <div id="rel-fat-result"></div>
    </div>

    <div id="rel-comissoes" style="display:none">
      <div class="filters-bar">
        <div><label class="form-label mb-1">Data Início</label><input type="date" class="form-control" id="rel_com_di" value="${primeiroDia}"></div>
        <div><label class="form-label mb-1">Data Fim</label><input type="date" class="form-control" id="rel_com_df" value="${hoje}"></div>
        <div><label class="form-label mb-1">Funcionário</label>
          <select class="form-select" id="rel_com_func">
            <option value="">Todos</option>
            ${funcs.map(f=>`<option value="${f.id}">${f.nome}</option>`).join('')}
          </select>
        </div>
        <div class="align-self-end"><button class="btn btn-accent" onclick="gerarRelComissoes()"><i class="bi bi-search me-1"></i>Gerar</button></div>
      </div>
      <div id="rel-com-result"></div>
    </div>

    <div id="rel-estoque" style="display:none">
      <div class="d-flex justify-content-end mb-3">
        <button class="btn btn-accent" onclick="gerarRelEstoque()"><i class="bi bi-search me-1"></i>Gerar Relatório de Estoque</button>
      </div>
      <div id="rel-est-result"></div>
    </div>
  `;
}

function switchRelTab(tab, btn) {
  document.querySelectorAll('#relTabs .nav-link').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  ['faturamento','comissoes','estoque'].forEach(t => {
    const el = document.getElementById(`rel-${t}`);
    if (el) el.style.display = t === tab ? '' : 'none';
  });
}

async function gerarRelFaturamento() {
  const di = document.getElementById('rel_di').value;
  const df = document.getElementById('rel_df').value;
  if (!di || !df) return showToast('Selecione o período','warning');
  try {
    const { totais, por_dia, top_servicos, top_produtos, por_funcionario } = await GET(`/relatorios/faturamento?data_inicio=${di}&data_fim=${df}`);
    document.getElementById('rel-fat-result').innerHTML = `
      <div class="row g-3 mb-3">
        <div class="col-md-3"><div class="stat-card"><div class="stat-value">${totais.total_os}</div><div class="stat-label">OSs Concluídas</div></div></div>
        <div class="col-md-3"><div class="stat-card"><div class="stat-value text-success">${R$(totais.total_servicos)}</div><div class="stat-label">Total Serviços</div></div></div>
        <div class="col-md-3"><div class="stat-card"><div class="stat-value text-primary">${R$(totais.total_produtos)}</div><div class="stat-label">Total Produtos</div></div></div>
        <div class="col-md-3"><div class="stat-card"><div class="stat-value text-warning">${R$(totais.total_geral)}</div><div class="stat-label">Faturamento Total</div></div></div>
      </div>
      <div class="row g-3">
        <div class="col-md-6">
          <div class="table-card">
            <div class="section-header"><div class="section-title"><i class="bi bi-gear"></i> Top Serviços</div></div>
            <table class="table table-sm">
              <thead><tr><th>Serviço</th><th class="text-end">Qtd</th><th class="text-end">Total</th></tr></thead>
              <tbody>${top_servicos.map(s=>`<tr><td>${s.descricao}</td><td class="text-end">${s.qtd}</td><td class="text-end"><strong>${R$(s.total)}</strong></td></tr>`).join('')||'<tr><td colspan="3" class="text-center text-muted">Sem dados</td></tr>'}</tbody>
            </table>
          </div>
        </div>
        <div class="col-md-6">
          <div class="table-card">
            <div class="section-header"><div class="section-title"><i class="bi bi-box-seam"></i> Top Produtos</div></div>
            <table class="table table-sm">
              <thead><tr><th>Produto</th><th class="text-end">Qtd</th><th class="text-end">Total</th></tr></thead>
              <tbody>${top_produtos.map(p=>`<tr><td>${p.descricao}</td><td class="text-end">${fNum(p.qtd_total)}</td><td class="text-end"><strong>${R$(p.total)}</strong></td></tr>`).join('')||'<tr><td colspan="3" class="text-center text-muted">Sem dados</td></tr>'}</tbody>
            </table>
          </div>
        </div>
        <div class="col-12">
          <div class="table-card">
            <div class="section-header"><div class="section-title"><i class="bi bi-person-badge"></i> Por Funcionário</div></div>
            <table class="table table-sm">
              <thead><tr><th>Funcionário</th><th class="text-end">OSs</th><th class="text-end">Total Serviços</th><th class="text-end">Total Comissões</th></tr></thead>
              <tbody>${por_funcionario.map(f=>`<tr><td><strong>${f.nome}</strong></td><td class="text-end">${f.qtd_os}</td><td class="text-end">${R$(f.total_servicos)}</td><td class="text-end text-warning">${R$(f.total_comissoes)}</td></tr>`).join('')||'<tr><td colspan="4" class="text-center text-muted">Sem dados</td></tr>'}</tbody>
            </table>
          </div>
        </div>
      </div>
    `;
  } catch(e) { showToast(e.message,'danger'); }
}

async function gerarRelComissoes() {
  const di = document.getElementById('rel_com_di').value;
  const df = document.getElementById('rel_com_df').value;
  const fid = document.getElementById('rel_com_func').value;
  if (!di || !df) return showToast('Selecione o período','warning');
  try {
    const { resumo, detalhe } = await GET(`/relatorios/comissoes?data_inicio=${di}&data_fim=${df}${fid?'&funcionario_id='+fid:''}`);
    document.getElementById('rel-com-result').innerHTML = `
      <div class="table-card mb-3">
        <div class="section-header"><div class="section-title">Resumo por Funcionário</div></div>
        <table class="table">
          <thead><tr><th>Funcionário</th><th>Cargo</th><th class="text-end">Qtd Serviços</th><th class="text-end">Total</th><th class="text-end">Pago</th><th class="text-end text-danger">Pendente</th></tr></thead>
          <tbody>
            ${resumo.map(r=>`<tr><td><strong>${r.funcionario}</strong></td><td>${r.cargo||'-'}</td><td class="text-end">${r.qtd_servicos}</td><td class="text-end">${R$(r.total)}</td><td class="text-end text-success">${R$(r.total_pago)}</td><td class="text-end text-danger fw-bold">${R$(r.total_pendente)}</td></tr>`).join('')||'<tr><td colspan="6" class="text-center text-muted">Sem dados</td></tr>'}
          </tbody>
        </table>
      </div>
      ${detalhe.length ? `
      <div class="table-card">
        <div class="section-header"><div class="section-title">Detalhamento</div></div>
        <table class="table table-sm">
          <thead><tr><th>OS</th><th>Serviço</th><th class="text-end">Valor Serviço</th><th class="text-end">Comissão</th><th>Status</th><th>Data</th></tr></thead>
          <tbody>${detalhe.map(d=>`<tr><td><a href="#os/${d.os_id}" class="text-warning">#${d.os_numero}</a></td><td>${d.servico}</td><td class="text-end">${R$(d.preco_servico)}</td><td class="text-end"><strong>${R$(d.valor)}</strong></td><td><span class="badge ${d.pago?'bg-success':'bg-warning text-dark'}">${d.pago?'Pago':'Pendente'}</span></td><td>${fDate(d.created_at)}</td></tr>`).join('')}</tbody>
        </table>
      </div>` : ''}
    `;
  } catch(e) { showToast(e.message,'danger'); }
}

async function gerarRelEstoque() {
  try {
    const { produtos, totais } = await GET('/relatorios/estoque');
    document.getElementById('rel-est-result').innerHTML = `
      <div class="row g-3 mb-3">
        <div class="col-md-4"><div class="stat-card"><div class="stat-value">${produtos.length}</div><div class="stat-label">Total de Produtos</div></div></div>
        <div class="col-md-4"><div class="stat-card"><div class="stat-value text-muted">${R$(totais.valor_custo)}</div><div class="stat-label">Valor em Custo</div></div></div>
        <div class="col-md-4"><div class="stat-card"><div class="stat-value text-success">${R$(totais.valor_venda)}</div><div class="stat-label">Valor em Venda</div></div></div>
      </div>
      <div class="table-card">
        <table class="table table-sm">
          <thead><tr><th>Código</th><th>Produto</th><th>Categoria</th><th class="text-end">Estoque</th><th>Un.</th><th class="text-end">Custo</th><th class="text-end">Venda</th><th class="text-end">Valor Venda</th><th>Situação</th></tr></thead>
          <tbody>
            ${produtos.map(p=>`
              <tr class="${p.estoque_baixo?'estoque-baixo':''}">
                <td><small>${p.codigo||'-'}</small></td>
                <td>${p.nome}</td>
                <td>${p.categoria_nome||'-'}</td>
                <td class="text-end ${p.estoque_baixo?'text-danger fw-bold':''}">${fNum(p.estoque_atual)}</td>
                <td>${p.unidade}</td>
                <td class="text-end">${R$(p.preco_custo)}</td>
                <td class="text-end">${R$(p.preco_venda)}</td>
                <td class="text-end"><strong>${R$(p.valor_venda)}</strong></td>
                <td>${p.estoque_baixo?'<span class="badge bg-danger">Baixo</span>':'<span class="badge bg-success">OK</span>'}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    `;
  } catch(e) { showToast(e.message,'danger'); }
}

// ==========================================
// ORÇAMENTOS
// ==========================================
async function showOrcamentos(filters = {}) {
  showLoading();
  try {
    const params = new URLSearchParams(filters).toString();
    const orcamentos = await GET(`/orcamentos${params ? '?' + params : ''}`);
    document.getElementById('page-content').innerHTML = `
      <div class="page-header">
        <h4><i class="bi bi-file-earmark-text me-2 text-warning"></i>Orçamentos</h4>
        <button class="btn btn-accent" onclick="openNovoOrcamentoModal()"><i class="bi bi-plus-lg me-1"></i>Novo Orçamento</button>
      </div>
      <div class="filters-bar">
        <div class="flex-grow-1"><input type="text" class="form-control" id="orcSearch" placeholder="Nº, cliente, placa..." onkeyup="if(event.key==='Enter')showOrcamentos({search:this.value})"></div>
        <select class="form-select" style="max-width:160px" onchange="showOrcamentos({status:this.value})">
          <option value="">Todos</option>
          <option value="pendente">Pendente</option>
          <option value="enviado">Enviado</option>
          <option value="aprovado">Aprovado</option>
          <option value="rejeitado">Rejeitado</option>
        </select>
        <button class="btn btn-outline-secondary" onclick="showOrcamentos({search:document.getElementById('orcSearch').value})"><i class="bi bi-search"></i></button>
      </div>
      <div class="table-card">
        ${orcamentos.length ? `
        <table class="table">
          <thead><tr><th>Nº</th><th>Cliente</th><th>Veículo</th><th>Responsável</th><th>Validade</th><th>Total</th><th>Status</th><th>Ações</th></tr></thead>
          <tbody>
            ${orcamentos.map(o => `
              <tr onclick="navigate('orc','${o.id}')" style="cursor:pointer">
                <td><strong class="text-warning">${o.numero}</strong></td>
                <td>${o.cliente_nome||'-'}</td>
                <td>${o.placa ? `<strong>${o.placa}</strong> ${o.marca||''} ${o.modelo||''}` : '-'}</td>
                <td>${o.funcionario_nome||'-'}</td>
                <td>${o.validade ? fDate(o.validade) : '-'}</td>
                <td><strong>${R$(o.total_geral)}</strong></td>
                <td>${orcStatusBadge(o.status)}</td>
                <td onclick="event.stopPropagation()">
                  <div class="btn-group btn-group-sm">
                    <button class="btn btn-outline-primary" onclick="navigate('orc','${o.id}')"><i class="bi bi-eye"></i></button>
                    ${o.status==='pendente'||o.status==='enviado' ? `<button class="btn btn-outline-success" onclick="aprovarOrcamento(${o.id},'${o.numero}')"><i class="bi bi-check2-circle"></i></button>` : ''}
                    ${o.status!=='aprovado' ? `<button class="btn btn-outline-danger" onclick="cancelarOrcamento(${o.id},'${o.numero}')"><i class="bi bi-trash"></i></button>` : ''}
                  </div>
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>` : '<div class="empty-state"><i class="bi bi-file-earmark-text"></i>Nenhum orçamento encontrado</div>'}
      </div>
    `;
  } catch(e) { showToast(e.message,'danger'); }
}

async function openNovoOrcamentoModal() {
  const [clientes, funcs] = await Promise.all([GET('/clientes'), GET('/funcionarios')]);
  openModal('Novo Orçamento', `
    <!-- Toggle cadastrado / prospect -->
    <div class="mb-3">
      <div class="btn-group w-100" role="group">
        <input type="radio" class="btn-check" name="orc_tipo" id="orc_tipo_cadastrado" value="cadastrado" checked onchange="toggleTipoOrc('cadastrado')">
        <label class="btn btn-outline-primary" for="orc_tipo_cadastrado"><i class="bi bi-person-check me-1"></i>Cliente Cadastrado</label>
        <input type="radio" class="btn-check" name="orc_tipo" id="orc_tipo_prospect" value="prospect" onchange="toggleTipoOrc('prospect')">
        <label class="btn btn-outline-secondary" for="orc_tipo_prospect"><i class="bi bi-person-plus me-1"></i>Prospect (sem cadastro)</label>
      </div>
    </div>

    <!-- Campos cliente cadastrado -->
    <div id="orc_bloco_cadastrado" class="row g-3 mb-3">
      <div class="col-md-6">
        <label class="form-label">Cliente</label>
        <select class="form-select" id="orc_cliente" onchange="carregarVeiculosOrc(this.value)">
          <option value="">Selecione o cliente...</option>
          ${clientes.map(c=>`<option value="${c.id}">${c.nome}</option>`).join('')}
        </select>
      </div>
      <div class="col-md-6">
        <label class="form-label">Veículo</label>
        <select class="form-select" id="orc_veiculo" disabled>
          <option value="">Selecione o cliente primeiro</option>
        </select>
      </div>
    </div>

    <!-- Campos prospect -->
    <div id="orc_bloco_prospect" class="row g-3 mb-3" style="display:none">
      <div class="col-md-6"><label class="form-label">Nome</label><input class="form-control" id="orc_prospect_nome" placeholder="Nome do interessado"></div>
      <div class="col-md-6"><label class="form-label">Telefone</label><input class="form-control" id="orc_prospect_tel" placeholder="(00) 00000-0000"></div>
      <div class="col-md-6"><label class="form-label">E-mail</label><input class="form-control" id="orc_prospect_email" placeholder="email@exemplo.com"></div>
      <div class="col-md-6"><label class="form-label">Veículo (descrição)</label><input class="form-control" id="orc_prospect_veiculo" placeholder="Ex: Gol 2019 Prata"></div>
    </div>

    <div class="row g-3">
      <div class="col-md-6">
        <label class="form-label">Responsável</label>
        <select class="form-select" id="orc_func">
          <option value="">Nenhum</option>
          ${funcs.map(f=>`<option value="${f.id}">${f.nome} (${f.cargo||''})</option>`).join('')}
        </select>
      </div>
      <div class="col-md-6"><label class="form-label">Validade</label><input type="date" class="form-control" id="orc_val"></div>
      <div class="col-12"><label class="form-label">Problema / Solicitação</label><textarea class="form-control" id="orc_prob" rows="3" placeholder="Descreva o que o cliente precisa..."></textarea></div>
      <div class="col-12"><label class="form-label">Observações</label><textarea class="form-control" id="orc_obs" rows="2"></textarea></div>
    </div>
  `, `<button class="btn btn-secondary" data-bs-dismiss="modal">Cancelar</button>
      <button class="btn btn-accent" onclick="criarOrcamento()"><i class="bi bi-check-lg me-1"></i>Criar Orçamento</button>`, 'lg');
}

function toggleTipoOrc(tipo) {
  document.getElementById('orc_bloco_cadastrado').style.display = tipo === 'cadastrado' ? '' : 'none';
  document.getElementById('orc_bloco_prospect').style.display   = tipo === 'prospect'   ? '' : 'none';
}

async function carregarVeiculosOrc(clienteId) {
  const sel = document.getElementById('orc_veiculo');
  if (!clienteId) { sel.innerHTML = '<option value="">Selecione o cliente primeiro</option>'; sel.disabled = true; return; }
  try {
    const veiculos = await GET(`/veiculos?cliente_id=${clienteId}`);
    sel.innerHTML = '<option value="">Sem veículo</option>' + veiculos.map(v=>`<option value="${v.id}">${v.placa} - ${v.marca||''} ${v.modelo||''}</option>`).join('');
    sel.disabled = false;
  } catch(e) { showToast(e.message,'danger'); }
}

async function criarOrcamento() {
  const tipo = document.querySelector('input[name="orc_tipo"]:checked')?.value || 'cadastrado';
  const body = {
    funcionario_id: document.getElementById('orc_func').value||null,
    validade: document.getElementById('orc_val').value||null,
    descricao_problema: document.getElementById('orc_prob').value,
    observacoes: document.getElementById('orc_obs').value,
  };
  if (tipo === 'cadastrado') {
    body.cliente_id  = document.getElementById('orc_cliente').value||null;
    body.veiculo_id  = document.getElementById('orc_veiculo').value||null;
  } else {
    body.nome_prospect     = document.getElementById('orc_prospect_nome').value.trim()||null;
    body.telefone_prospect = document.getElementById('orc_prospect_tel').value||null;
    body.email_prospect    = document.getElementById('orc_prospect_email').value||null;
    body.veiculo_prospect  = document.getElementById('orc_prospect_veiculo').value||null;
  }
  try {
    const orc = await POST('/orcamentos', body);
    closeModal(); showToast(`Orçamento ${orc.numero} criado!`); navigate('orc', orc.id);
  } catch(e) { showToast(e.message,'danger'); }
}

async function showOrcamentoDetalhe(id) {
  updateNav('orcamentos');
  showLoading();
  try {
    const orc = await GET(`/orcamentos/${id}`);
    const editavel = !['aprovado','cancelado'].includes(orc.status);
    const [servicos_cat, produtos_cat] = await Promise.all([GET('/servicos'), GET('/produtos')]);

    document.getElementById('page-content').innerHTML = `
      <div class="page-header">
        <div class="d-flex align-items-center gap-3">
          <button class="btn btn-sm btn-outline-secondary" onclick="showOrcamentos()"><i class="bi bi-arrow-left"></i></button>
          <h4 class="mb-0"><i class="bi bi-file-earmark-text me-2 text-warning"></i>${orc.numero}</h4>
          ${orcStatusBadge(orc.status)}
        </div>
        <div class="d-flex gap-2 flex-wrap">
          <button class="btn btn-outline-secondary btn-sm" onclick="imprimirOrcamento(${id})"><i class="bi bi-printer me-1"></i>Imprimir</button>
          ${editavel ? `
            ${orc.status==='pendente' ? `<button class="btn btn-info btn-sm text-white" onclick="mudarStatusOrc(${id},'enviado')"><i class="bi bi-send me-1"></i>Marcar Enviado</button>` : ''}
            <button class="btn btn-outline-danger btn-sm" onclick="mudarStatusOrc(${id},'rejeitado')"><i class="bi bi-x-circle me-1"></i>Rejeitado</button>
            <button class="btn btn-success btn-sm" onclick="aprovarOrcamento(${id},'${orc.numero}')"><i class="bi bi-check2-circle me-1"></i>Aprovar → Gerar OS</button>
          ` : ''}
          ${orc.os_id ? `<button class="btn btn-warning btn-sm text-white" onclick="navigate('os','${orc.os_id}')"><i class="bi bi-clipboard-check me-1"></i>Ver OS Gerada</button>` : ''}
        </div>
      </div>

      <div class="os-header-card mb-3">
        <div class="row g-3">
          <div class="col-md-3">
            <div class="os-info-label">
              ${orc.cliente_id ? 'Cliente Cadastrado' : 'Prospect'}
              ${!orc.cliente_id && editavel ? `
                <button class="btn btn-sm ms-2" style="background:rgba(243,156,18,.25);color:#f39c12;border:1px solid rgba(243,156,18,.4);padding:1px 8px;font-size:.7rem;border-radius:12px" onclick="abrirConverterCliente(${id})">
                  <i class="bi bi-person-plus me-1"></i>Converter em cliente
                </button>` : ''}
            </div>
            <div class="os-info-value">${orc.display_nome}</div>
            <div style="font-size:.85rem;color:rgba(255,255,255,.6)">${orc.display_telefone||orc.email_prospect||''}</div>
          </div>
          <div class="col-md-3">
            <div class="os-info-label">Veículo</div>
            <div class="os-info-value">
              ${orc.placa ? `${orc.placa} — ${orc.marca||''} ${orc.modelo||''} ${orc.ano||''}` : (orc.veiculo_prospect || 'Não informado')}
            </div>
          </div>
          <div class="col-md-2">
            <div class="os-info-label">Responsável</div>
            <div class="os-info-value">${orc.funcionario_nome||'-'}</div>
          </div>
          <div class="col-md-2">
            <div class="os-info-label">Criado em</div>
            <div class="os-info-value">${fDate(orc.created_at)}</div>
            <div class="os-info-label mt-1">Validade</div>
            <div class="os-info-value">${orc.validade ? fDate(orc.validade) : '-'}</div>
          </div>
          <div class="col-md-2">
            <div class="os-info-label">Status</div>
            <div class="mt-1">${orcStatusBadge(orc.status)}</div>
          </div>
        </div>
        ${orc.descricao_problema ? `<div class="mt-3 pt-3 border-top border-secondary"><div class="os-info-label">Problema / Solicitação</div><div class="os-info-value">${orc.descricao_problema}</div></div>` : ''}
      </div>

      <div class="row g-3">
        <div class="col-lg-8">
          <div class="table-card mb-3">
            <div class="section-header">
              <div class="section-title"><i class="bi bi-gear"></i> Serviços / Mão de Obra</div>
              ${editavel ? `<button class="btn btn-sm btn-accent" onclick="openAddOrcServicoModal(${id})"><i class="bi bi-plus-lg me-1"></i>Adicionar</button>` : ''}
            </div>
            ${orc.servicos.length ? `
            <table class="table table-sm">
              <thead><tr><th>Descrição</th><th>Valor</th>${editavel ? '<th></th>' : ''}</tr></thead>
              <tbody>
                ${orc.servicos.map(s=>`
                  <tr>
                    <td>${s.descricao}</td>
                    <td><strong>${R$(s.preco)}</strong></td>
                    ${editavel ? `<td><button class="btn btn-sm btn-outline-danger" onclick="removeOrcServico(${id},${s.id})"><i class="bi bi-trash"></i></button></td>` : ''}
                  </tr>
                `).join('')}
              </tbody>
            </table>` : '<div class="empty-state" style="padding:1.5rem"><i class="bi bi-gear d-block mb-2" style="font-size:1.5rem"></i>Nenhum serviço</div>'}
          </div>

          <div class="table-card">
            <div class="section-header">
              <div class="section-title"><i class="bi bi-box-seam"></i> Produtos / Peças</div>
              ${editavel ? `<button class="btn btn-sm btn-accent" onclick="openAddOrcProdutoModal(${id})"><i class="bi bi-plus-lg me-1"></i>Adicionar</button>` : ''}
            </div>
            ${orc.produtos.length ? `
            <table class="table table-sm">
              <thead><tr><th>Descrição</th><th>Qtd</th><th>Unit.</th><th>Total</th>${editavel ? '<th></th>' : ''}</tr></thead>
              <tbody>
                ${orc.produtos.map(p=>`
                  <tr>
                    <td>${p.descricao}</td>
                    <td>${fNum(p.quantidade)} ${p.produto_unidade||''}</td>
                    <td>${R$(p.preco_unitario)}</td>
                    <td><strong>${R$(p.total)}</strong></td>
                    ${editavel ? `<td><button class="btn btn-sm btn-outline-danger" onclick="removeOrcProduto(${id},${p.id})"><i class="bi bi-trash"></i></button></td>` : ''}
                  </tr>
                `).join('')}
              </tbody>
            </table>` : '<div class="empty-state" style="padding:1.5rem"><i class="bi bi-box-seam d-block mb-2" style="font-size:1.5rem"></i>Nenhuma peça</div>'}
          </div>
        </div>

        <div class="col-lg-4">
          <div class="totals-card mb-3">
            <div class="fw-bold mb-3" style="color:#495057"><i class="bi bi-receipt me-2"></i>Resumo</div>
            <div class="total-row"><span class="text-muted">Serviços</span><span>${R$(orc.total_servicos)}</span></div>
            <div class="total-row"><span class="text-muted">Produtos</span><span>${R$(orc.total_produtos)}</span></div>
            <div class="total-row"><span class="text-muted">Desconto</span><span class="text-danger">- ${R$(orc.desconto)}</span></div>
            <div class="total-row"><span>TOTAL</span><span>${R$(orc.total_geral)}</span></div>
          </div>
          ${editavel ? `
          <div class="totals-card">
            <div class="fw-bold mb-3" style="color:#495057"><i class="bi bi-pencil me-2"></i>Desconto</div>
            <input type="number" step="0.01" min="0" class="form-control" id="orc_desconto" value="${orc.desconto||0}" onchange="atualizarDescontoOrc(${id},this.value)">
          </div>` : ''}
        </div>
      </div>
    `;
  } catch(e) { showToast(e.message,'danger'); }
}

async function mudarStatusOrc(id, status) {
  try { await PUT(`/orcamentos/${id}/status`,{status}); showOrcamentoDetalhe(id); showToast('Status atualizado!'); }
  catch(e) { showToast(e.message,'danger'); }
}

async function atualizarDescontoOrc(id, desconto) {
  try {
    const orc = await GET(`/orcamentos/${id}`);
    await PUT(`/orcamentos/${id}`, { ...orc, desconto: parseFloat(desconto)||0 });
    showOrcamentoDetalhe(id);
  } catch(e) { showToast(e.message,'danger'); }
}

async function aprovarOrcamento(id, numero) {
  // Verifica se tem cliente cadastrado antes de aprovar
  try {
    const orc = await GET(`/orcamentos/${id}`);
    if (!orc.cliente_id) {
      if (!confirm(`Este orçamento é de um prospect sem cadastro.\n\nAo aprovar, uma OS será gerada SEM cliente vinculado.\n\nDeseja converter em cliente antes? Clique Cancelar para converter.`)) {
        return abrirConverterCliente(id);
      }
    } else {
      if (!confirm(`Aprovar orçamento ${numero} e gerar OS automaticamente?`)) return;
    }
    const res = await POST(`/orcamentos/${id}/aprovar`);
    showToast(`OS #${res.os.numero} gerada com sucesso!`);
    navigate('os', res.os.id);
  } catch(e) { showToast(e.message,'danger'); }
}

async function abrirConverterCliente(orcId) {
  // Pré-carrega dados do prospect
  const orc = await GET(`/orcamentos/${orcId}`);
  openModal('Converter Prospect em Cliente', `
    <div class="alert alert-info py-2 mb-3">
      <i class="bi bi-info-circle me-2"></i>Preencha os dados para cadastrar o cliente. Após salvar, o orçamento ficará vinculado a ele.
    </div>
    <div class="row g-3">
      <div class="col-12"><label class="form-label">Nome *</label>
        <input class="form-control" id="conv_nome" value="${orc.nome_prospect||''}" placeholder="Nome completo">
      </div>
      <div class="col-md-6"><label class="form-label">CPF / CNPJ</label><input class="form-control" id="conv_cpf" placeholder="000.000.000-00"></div>
      <div class="col-md-6"><label class="form-label">Telefone</label>
        <input class="form-control" id="conv_tel" value="${orc.telefone_prospect||''}" placeholder="(00) 00000-0000">
      </div>
      <div class="col-md-6"><label class="form-label">E-mail</label>
        <input class="form-control" id="conv_email" value="${orc.email_prospect||''}" placeholder="email@exemplo.com">
      </div>
      <div class="col-md-6"><label class="form-label">Cidade</label><input class="form-control" id="conv_cidade" placeholder="Cidade"></div>
      <div class="col-12"><label class="form-label">Endereço</label><input class="form-control" id="conv_end" placeholder="Rua, número, bairro..."></div>
    </div>
    <hr>
    <div class="fw-semibold mb-2" style="font-size:.9rem"><i class="bi bi-car-front me-1 text-warning"></i>Veículo (opcional)</div>
    <div class="row g-3">
      <div class="col-md-4"><label class="form-label">Placa</label>
        <input class="form-control" id="conv_placa" value="${orc.veiculo_prospect&&orc.veiculo_prospect.length<=8 ? orc.veiculo_prospect : ''}" placeholder="ABC1D23" style="text-transform:uppercase">
      </div>
      <div class="col-md-4"><label class="form-label">Marca</label><input class="form-control" id="conv_marca" placeholder="Ex: Volkswagen"></div>
      <div class="col-md-4"><label class="form-label">Modelo</label>
        <input class="form-control" id="conv_modelo" value="${orc.veiculo_prospect&&orc.veiculo_prospect.length>8 ? orc.veiculo_prospect : ''}" placeholder="Ex: Gol">
      </div>
      <div class="col-md-4"><label class="form-label">Ano</label><input type="number" class="form-control" id="conv_ano" placeholder="2020"></div>
      <div class="col-md-4"><label class="form-label">Cor</label><input class="form-control" id="conv_cor" placeholder="Branca"></div>
    </div>
  `, `<button class="btn btn-secondary" data-bs-dismiss="modal">Cancelar</button>
      <button class="btn btn-success" onclick="confirmarConversao(${orcId})"><i class="bi bi-person-check me-1"></i>Cadastrar e Vincular</button>`, 'lg');
}

async function confirmarConversao(orcId) {
  const nome = document.getElementById('conv_nome').value.trim();
  if (!nome) return showToast('Nome é obrigatório','warning');
  const body = {
    nome,
    cpf_cnpj:  document.getElementById('conv_cpf').value,
    telefone:  document.getElementById('conv_tel').value,
    email:     document.getElementById('conv_email').value,
    cidade:    document.getElementById('conv_cidade').value,
    endereco:  document.getElementById('conv_end').value,
    placa:     document.getElementById('conv_placa').value.trim().toUpperCase()||null,
    marca:     document.getElementById('conv_marca').value,
    modelo:    document.getElementById('conv_modelo').value,
    ano:       document.getElementById('conv_ano').value||null,
    cor:       document.getElementById('conv_cor').value,
  };
  try {
    await POST(`/orcamentos/${orcId}/converter-cliente`, body);
    closeModal();
    showToast(`Cliente "${nome}" cadastrado e vinculado ao orçamento!`, 'success');
    showOrcamentoDetalhe(orcId);
  } catch(e) { showToast(e.message,'danger'); }
}

async function cancelarOrcamento(id, numero) {
  if (!confirm(`Cancelar orçamento ${numero}?`)) return;
  try { await DEL(`/orcamentos/${id}`); showToast('Cancelado!'); showOrcamentos(); }
  catch(e) { showToast(e.message,'danger'); }
}

async function openAddOrcServicoModal(orcId) {
  const servicos = await GET('/servicos');
  openModal('Adicionar Serviço ao Orçamento', `
    <div class="row g-3">
      <div class="col-12">
        <label class="form-label">Selecionar do Catálogo</label>
        <select class="form-select" id="oas_cat" onchange="preencherOrcServico(this.value)">
          <option value="">-- Selecione ou preencha manualmente --</option>
          ${servicos.map(s=>`<option value="${s.id}" data-preco="${s.preco}" data-nome="${s.nome.replace(/"/g,'&quot;')}">${s.nome} — ${R$(s.preco)}</option>`).join('')}
        </select>
      </div>
      <div class="col-12"><label class="form-label">Descrição *</label><input class="form-control" id="oas_desc" placeholder="Descreva o serviço..."></div>
      <div class="col-12"><label class="form-label">Valor (R$)</label><input type="number" step="0.01" min="0" class="form-control" id="oas_preco" value="0"></div>
    </div>
  `, `<button class="btn btn-secondary" data-bs-dismiss="modal">Cancelar</button>
      <button class="btn btn-accent" onclick="addOrcServico(${orcId})"><i class="bi bi-plus-lg me-1"></i>Adicionar</button>`);
}

function preencherOrcServico(id) {
  const sel = document.getElementById('oas_cat');
  const opt = sel.options[sel.selectedIndex];
  if (!id) return;
  document.getElementById('oas_desc').value = opt.dataset.nome;
  document.getElementById('oas_preco').value = opt.dataset.preco;
}

async function addOrcServico(orcId) {
  const body = { servico_id: document.getElementById('oas_cat').value||null, descricao: document.getElementById('oas_desc').value.trim(), preco: parseFloat(document.getElementById('oas_preco').value)||0 };
  if (!body.descricao) return showToast('Descrição obrigatória','warning');
  try { await POST(`/orcamentos/${orcId}/servicos`,body); closeModal(); showToast('Serviço adicionado!'); showOrcamentoDetalhe(orcId); }
  catch(e) { showToast(e.message,'danger'); }
}

async function removeOrcServico(orcId, itemId) {
  if (!confirm('Remover?')) return;
  try { await DEL(`/orcamentos/${orcId}/servicos/${itemId}`); showOrcamentoDetalhe(orcId); }
  catch(e) { showToast(e.message,'danger'); }
}

async function openAddOrcProdutoModal(orcId) {
  const produtos = await GET('/produtos');
  openModal('Adicionar Produto ao Orçamento', `
    <div class="row g-3">
      <div class="col-12">
        <label class="form-label">Selecionar do Estoque</label>
        <select class="form-select" id="oap_cat" onchange="preencherOrcProduto(this.value)">
          <option value="">-- Selecione ou preencha manualmente --</option>
          ${produtos.map(p=>`<option value="${p.id}" data-preco="${p.preco_venda}" data-nome="${p.nome.replace(/"/g,'&quot;')}">${p.nome} — ${R$(p.preco_venda)}</option>`).join('')}
        </select>
      </div>
      <div class="col-12"><label class="form-label">Descrição *</label><input class="form-control" id="oap_desc" placeholder="Nome da peça..."></div>
      <div class="col-md-4"><label class="form-label">Quantidade</label><input type="number" step="0.01" min="0.01" class="form-control" id="oap_qty" value="1" oninput="calcTotalOrcProd()"></div>
      <div class="col-md-4"><label class="form-label">Preço Unit. (R$)</label><input type="number" step="0.01" min="0" class="form-control" id="oap_preco" value="0" oninput="calcTotalOrcProd()"></div>
      <div class="col-md-4"><label class="form-label">Total</label><input class="form-control bg-light fw-bold" id="oap_total" readonly value="R$ 0,00"></div>
    </div>
  `, `<button class="btn btn-secondary" data-bs-dismiss="modal">Cancelar</button>
      <button class="btn btn-accent" onclick="addOrcProduto(${orcId})"><i class="bi bi-plus-lg me-1"></i>Adicionar</button>`);
}

function preencherOrcProduto(id) {
  const sel = document.getElementById('oap_cat');
  const opt = sel.options[sel.selectedIndex];
  if (!id) return;
  document.getElementById('oap_desc').value = opt.dataset.nome;
  document.getElementById('oap_preco').value = opt.dataset.preco;
  calcTotalOrcProd();
}

function calcTotalOrcProd() {
  const qty = parseFloat(document.getElementById('oap_qty').value)||0;
  const pr  = parseFloat(document.getElementById('oap_preco').value)||0;
  document.getElementById('oap_total').value = R$(qty * pr);
}

async function addOrcProduto(orcId) {
  const body = { produto_id: document.getElementById('oap_cat').value||null, descricao: document.getElementById('oap_desc').value.trim(), quantidade: parseFloat(document.getElementById('oap_qty').value)||1, preco_unitario: parseFloat(document.getElementById('oap_preco').value)||0 };
  if (!body.descricao) return showToast('Descrição obrigatória','warning');
  try { await POST(`/orcamentos/${orcId}/produtos`,body); closeModal(); showToast('Produto adicionado!'); showOrcamentoDetalhe(orcId); }
  catch(e) { showToast(e.message,'danger'); }
}

async function removeOrcProduto(orcId, itemId) {
  if (!confirm('Remover?')) return;
  try { await DEL(`/orcamentos/${orcId}/produtos/${itemId}`); showOrcamentoDetalhe(orcId); }
  catch(e) { showToast(e.message,'danger'); }
}

async function imprimirOrcamento(id) {
  try {
    const orc = await GET(`/orcamentos/${id}`);
    const win = window.open('','_blank');
    win.document.write(`<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Orçamento ${orc.numero}</title><style>
      body{font-family:Arial,sans-serif;margin:20px;font-size:13px}
      h1{font-size:18px;margin:0} h2{font-size:14px;margin:10px 0 5px}
      table{width:100%;border-collapse:collapse;margin:8px 0}
      th,td{border:1px solid #ddd;padding:6px 8px}
      th{background:#f5f5f5;font-weight:bold}
      .header{display:flex;justify-content:space-between;border-bottom:2px solid #000;padding-bottom:10px;margin-bottom:15px}
      .info-grid{display:grid;grid-template-columns:1fr 1fr;gap:8px;background:#f9f9f9;padding:10px;border:1px solid #ddd;margin-bottom:10px}
      .info-item label{font-weight:bold;font-size:11px;color:#666;display:block}
      .totals{margin-left:auto;width:280px;margin-top:10px}
      .total-row{display:flex;justify-content:space-between;padding:3px 0;border-bottom:1px solid #eee}
      .total-final{font-size:15px;font-weight:bold;color:#e65100}
      .validade{background:#fff8e1;border:1px solid #ffe082;padding:8px;margin-bottom:10px;border-radius:4px}
      .assinatura{margin-top:40px;display:flex;justify-content:space-between}
      .ass-line{border-top:1px solid #000;width:200px;text-align:center;padding-top:5px;font-size:11px}
      @media print{body{margin:0}}
    </style></head><body>
    <div class="header">
      <div><h1>ORÇAMENTO</h1><h2>${orc.numero}</h2></div>
      <div style="text-align:right"><strong>Data:</strong> ${fDate(orc.created_at)}<br><strong>Status:</strong> ${ORC_STATUS_MAP[orc.status]?.label||orc.status}</div>
    </div>
    <div class="info-grid">
      <div class="info-item"><label>CLIENTE</label>${orc.cliente_nome||'Não informado'}</div>
      <div class="info-item"><label>TELEFONE</label>${orc.cliente_telefone||'-'}</div>
      <div class="info-item"><label>VEÍCULO</label>${orc.placa ? `${orc.placa} — ${orc.marca||''} ${orc.modelo||''} ${orc.ano||''}` : '-'}</div>
      <div class="info-item"><label>RESPONSÁVEL</label>${orc.funcionario_nome||'-'}</div>
    </div>
    ${orc.validade ? `<div class="validade">⚠️ <strong>Validade do orçamento:</strong> ${fDate(orc.validade)}</div>` : ''}
    ${orc.descricao_problema ? `<div style="background:#f5f5f5;border:1px solid #ddd;padding:8px;margin-bottom:10px"><strong>Solicitação:</strong> ${orc.descricao_problema}</div>` : ''}
    <h2>SERVIÇOS / MÃO DE OBRA</h2>
    <table><thead><tr><th>Descrição</th><th style="text-align:right;width:120px">Valor</th></tr></thead><tbody>
      ${orc.servicos.length ? orc.servicos.map(s=>`<tr><td>${s.descricao}</td><td style="text-align:right">${R$(s.preco)}</td></tr>`).join('') : '<tr><td colspan="2" style="text-align:center;color:#999">Nenhum serviço</td></tr>'}
    </tbody></table>
    <h2>PRODUTOS / PEÇAS</h2>
    <table><thead><tr><th>Descrição</th><th style="text-align:right">Qtd</th><th style="text-align:right">Unit.</th><th style="text-align:right">Total</th></tr></thead><tbody>
      ${orc.produtos.length ? orc.produtos.map(p=>`<tr><td>${p.descricao}</td><td style="text-align:right">${fNum(p.quantidade)}</td><td style="text-align:right">${R$(p.preco_unitario)}</td><td style="text-align:right">${R$(p.total)}</td></tr>`).join('') : '<tr><td colspan="4" style="text-align:center;color:#999">Nenhum produto</td></tr>'}
    </tbody></table>
    <div class="totals">
      <div class="total-row"><span>Serviços:</span><span>${R$(orc.total_servicos)}</span></div>
      <div class="total-row"><span>Produtos:</span><span>${R$(orc.total_produtos)}</span></div>
      <div class="total-row"><span>Desconto:</span><span>- ${R$(orc.desconto)}</span></div>
      <div class="total-row total-final"><span>TOTAL:</span><span>${R$(orc.total_geral)}</span></div>
    </div>
    ${orc.observacoes ? `<div style="margin-top:15px;padding:8px;border:1px solid #ddd"><strong>Observações:</strong> ${orc.observacoes}</div>` : ''}
    <div class="assinatura">
      <div class="ass-line">Aprovação do Cliente</div>
      <div class="ass-line">Responsável Técnico</div>
    </div>
    </body></html>`);
    win.document.close();
    setTimeout(()=>win.print(), 500);
  } catch(e) { showToast(e.message,'danger'); }
}

// ==========================================
// CONFIGURAÇÕES DA OFICINA
// ==========================================
async function showConfiguracoes() {
  const cfg = await carregarConfig();
  document.getElementById('page-content').innerHTML = `
    <div class="page-header"><h4><i class="bi bi-gear-fill me-2 text-warning"></i>Configurações da Oficina</h4></div>
    <div class="row g-3">
      <div class="col-lg-6">
        <div class="table-card p-4">
          <h6 class="fw-bold mb-3"><i class="bi bi-building me-2 text-warning"></i>Dados da Oficina</h6>
          <div class="row g-3">
            <div class="col-12"><label class="form-label">Nome da Oficina</label><input class="form-control" id="cfg_nome" value="${cfg.nome||''}" placeholder="Ex: Oficina do João"></div>
            <div class="col-md-6"><label class="form-label">Telefone / WhatsApp</label><input class="form-control" id="cfg_tel" value="${cfg.telefone||''}" placeholder="(00) 00000-0000"></div>
            <div class="col-md-6"><label class="form-label">CNPJ / CPF</label><input class="form-control" id="cfg_cnpj" value="${cfg.cnpj||''}" placeholder="00.000.000/0001-00"></div>
            <div class="col-12"><label class="form-label">Endereço</label><input class="form-control" id="cfg_end" value="${cfg.endereco||''}" placeholder="Rua, número, bairro, cidade"></div>
            <div class="col-12"><label class="form-label">Mensagem de Rodapé (OS e Orçamentos)</label><textarea class="form-control" id="cfg_rodape" rows="2" placeholder="Ex: Garantia de 90 dias nos serviços.">${cfg.rodape||''}</textarea></div>
            <div class="col-12">
              <button class="btn btn-accent w-100" onclick="salvarConfig()"><i class="bi bi-check-lg me-1"></i>Salvar Configurações</button>
            </div>
          </div>
        </div>
      </div>
      <div class="col-lg-6">
        <div class="table-card p-4 mb-3">
          <h6 class="fw-bold mb-3"><i class="bi bi-phone me-2 text-warning"></i>Instalar como App</h6>
          <p class="text-muted" style="font-size:.9rem">No celular, abra o menu do navegador e toque em <strong>"Adicionar à Tela Inicial"</strong> para usar o Oficina Pro como um aplicativo.</p>
          <div class="d-flex gap-2">
            <div class="text-center p-3 border rounded flex-fill">
              <i class="bi bi-apple" style="font-size:2rem;color:#555"></i>
              <div style="font-size:.8rem;margin-top:.5rem">Safari → <strong>Compartilhar → Add to Home</strong></div>
            </div>
            <div class="text-center p-3 border rounded flex-fill">
              <i class="bi bi-android2" style="font-size:2rem;color:#3ddc84"></i>
              <div style="font-size:.8rem;margin-top:.5rem">Chrome → <strong>Menu → Adicionar à tela</strong></div>
            </div>
          </div>
        </div>
        <div class="table-card p-4">
          <h6 class="fw-bold mb-3"><i class="bi bi-whatsapp me-2" style="color:#25d366"></i>WhatsApp</h6>
          <p class="text-muted" style="font-size:.9rem">Ao fechar uma OS ou aprovar um orçamento, clique no botão <strong>WhatsApp</strong> para enviar o resumo diretamente para o cliente.</p>
          <div class="alert alert-success py-2 mb-0" style="font-size:.85rem"><i class="bi bi-check-circle me-1"></i>O número de WhatsApp do cliente é carregado automaticamente se cadastrado.</div>
        </div>
      </div>
    </div>
  `;
}

function carregarConfig() {
  try { return JSON.parse(localStorage.getItem('oficina_config') || '{}'); } catch { return {}; }
}

function salvarConfig() {
  const cfg = {
    nome:      document.getElementById('cfg_nome').value.trim(),
    telefone:  document.getElementById('cfg_tel').value.trim(),
    cnpj:      document.getElementById('cfg_cnpj').value.trim(),
    endereco:  document.getElementById('cfg_end').value.trim(),
    rodape:    document.getElementById('cfg_rodape').value.trim(),
  };
  localStorage.setItem('oficina_config', JSON.stringify(cfg));
  showToast('Configurações salvas!');
}

// ==========================================
// VENDAS DIRETAS (Venda de Peças sem OS)
// ==========================================
async function showVendas() {
  showLoading();
  try {
    const [produtos, clientes] = await Promise.all([GET('/produtos'), GET('/clientes')]);
    document.getElementById('page-content').innerHTML = `
      <div class="page-header">
        <h4><i class="bi bi-bag-check me-2 text-warning"></i>Venda Direta de Peças</h4>
      </div>
      <div class="row g-3">
        <div class="col-lg-8">
          <div class="table-card">
            <div class="section-header"><div class="section-title"><i class="bi bi-bag-plus"></i> Adicionar Produto</div></div>
            <div class="p-3">
              <div class="row g-2 align-items-end">
                <div class="col-md-5">
                  <label class="form-label">Produto</label>
                  <select class="form-select" id="vd_produto" onchange="selecionarProdutoVenda(this.value)">
                    <option value="">Selecione o produto...</option>
                    ${produtos.map(p=>`<option value="${p.id}" data-preco="${p.preco_venda}" data-nome="${p.nome.replace(/"/g,'&quot;')}" data-est="${p.estoque_atual}" data-un="${p.unidade}">${p.nome} — Est: ${fNum(p.estoque_atual)} ${p.unidade} — ${R$(p.preco_venda)}</option>`).join('')}
                  </select>
                </div>
                <div class="col-md-2"><label class="form-label">Qtd</label><input type="number" step="0.01" min="0.01" class="form-control" id="vd_qty" value="1" oninput="calcVenda()"></div>
                <div class="col-md-2"><label class="form-label">Unit.</label><input type="number" step="0.01" class="form-control" id="vd_preco" value="0" oninput="calcVenda()"></div>
                <div class="col-md-2"><label class="form-label">Total</label><input class="form-control bg-light fw-bold" id="vd_total" readonly value="R$ 0,00"></div>
                <div class="col-md-1"><label class="form-label">&nbsp;</label><button class="btn btn-accent w-100" onclick="adicionarItemVenda()"><i class="bi bi-plus-lg"></i></button></div>
              </div>
            </div>
            <div id="vd-itens-container">
              <div class="empty-state" style="padding:2rem"><i class="bi bi-bag"></i>Nenhum item adicionado</div>
            </div>
          </div>
        </div>
        <div class="col-lg-4">
          <div class="totals-card mb-3">
            <div class="fw-bold mb-3"><i class="bi bi-person me-2"></i>Cliente (opcional)</div>
            <select class="form-select mb-3" id="vd_cliente">
              <option value="">Venda avulsa</option>
              ${clientes.map(c=>`<option value="${c.id}">${c.nome}</option>`).join('')}
            </select>
            <div class="fw-bold mb-3"><i class="bi bi-receipt me-2"></i>Total da Venda</div>
            <div class="total-row"><span class="text-muted">Itens</span><span id="vd_total_display">R$ 0,00</span></div>
            <div class="total-row mt-2">
              <span class="text-muted">Desconto</span>
              <span><input type="number" step="0.01" min="0" class="form-control form-control-sm" id="vd_desconto" value="0" style="width:90px" oninput="calcVendaTotal()"></span>
            </div>
            <div class="total-row" style="font-size:1.1rem"><span>TOTAL</span><span class="text-warning fw-bold" id="vd_total_final">R$ 0,00</span></div>
          </div>
          <div class="totals-card">
            <div class="fw-bold mb-3"><i class="bi bi-cash-coin me-2"></i>Pagamento</div>
            <select class="form-select mb-3" id="vd_pgto">
              <option value="">Forma de pagamento...</option>
              <option>Dinheiro</option><option>Pix</option><option>Cartão de Crédito</option><option>Cartão de Débito</option>
            </select>
            <button class="btn btn-success w-100" onclick="finalizarVenda()"><i class="bi bi-check-circle me-1"></i>Finalizar Venda</button>
          </div>
        </div>
      </div>
    `;
    window._vendaItens = [];
  } catch(e) { showToast(e.message,'danger'); }
}

function selecionarProdutoVenda(id) {
  const sel = document.getElementById('vd_produto');
  const opt = sel.options[sel.selectedIndex];
  if (!id) return;
  document.getElementById('vd_preco').value = opt.dataset.preco;
  calcVenda();
}

function calcVenda() {
  const qty = parseFloat(document.getElementById('vd_qty').value)||0;
  const pr  = parseFloat(document.getElementById('vd_preco').value)||0;
  document.getElementById('vd_total').value = R$(qty*pr);
}

function adicionarItemVenda() {
  const sel = document.getElementById('vd_produto');
  const opt = sel.options[sel.selectedIndex];
  const id  = sel.value;
  if (!id) return showToast('Selecione um produto','warning');
  const qty   = parseFloat(document.getElementById('vd_qty').value)||1;
  const preco = parseFloat(document.getElementById('vd_preco').value)||0;
  if (!window._vendaItens) window._vendaItens = [];
  window._vendaItens.push({ produto_id: id, nome: opt.dataset.nome, quantidade: qty, preco_unitario: preco, total: qty*preco, unidade: opt.dataset.un });
  renderItensVenda();
  sel.value = ''; document.getElementById('vd_qty').value=1; document.getElementById('vd_preco').value=0; document.getElementById('vd_total').value='R$ 0,00';
}

function renderItensVenda() {
  const itens = window._vendaItens || [];
  const container = document.getElementById('vd-itens-container');
  if (!itens.length) { container.innerHTML = '<div class="empty-state" style="padding:2rem"><i class="bi bi-bag"></i>Nenhum item</div>'; calcVendaTotal(); return; }
  container.innerHTML = `<table class="table table-sm">
    <thead><tr><th>Produto</th><th>Qtd</th><th>Unit.</th><th>Total</th><th></th></tr></thead>
    <tbody>${itens.map((it,i)=>`<tr><td>${it.nome}</td><td>${fNum(it.quantidade)} ${it.unidade}</td><td>${R$(it.preco_unitario)}</td><td><strong>${R$(it.total)}</strong></td><td><button class="btn btn-sm btn-outline-danger" onclick="removerItemVenda(${i})"><i class="bi bi-trash"></i></button></td></tr>`).join('')}</tbody>
  </table>`;
  calcVendaTotal();
}

function removerItemVenda(i) { window._vendaItens.splice(i,1); renderItensVenda(); }

function calcVendaTotal() {
  const itens = window._vendaItens || [];
  const subtotal = itens.reduce((s,it)=>s+it.total,0);
  const desc = parseFloat(document.getElementById('vd_desconto')?.value)||0;
  const total = Math.max(0, subtotal-desc);
  const el1 = document.getElementById('vd_total_display');
  const el2 = document.getElementById('vd_total_final');
  if (el1) el1.textContent = R$(subtotal);
  if (el2) el2.textContent = R$(total);
}

async function finalizarVenda() {
  const itens = window._vendaItens || [];
  if (!itens.length) return showToast('Adicione ao menos um produto','warning');
  const pgto = document.getElementById('vd_pgto').value;
  if (!pgto) return showToast('Selecione a forma de pagamento','warning');
  const desc = parseFloat(document.getElementById('vd_desconto').value)||0;
  const clienteId = document.getElementById('vd_cliente').value||null;

  if (!confirm(`Finalizar venda de ${itens.length} item(ns)? ${R$(itens.reduce((s,it)=>s+it.total,0)-desc)}`)) return;

  try {
    // Baixa estoque de cada produto
    for (const it of itens) {
      await POST(`/produtos/${it.produto_id}/entrada`, { quantidade: -it.quantidade, motivo: `Venda direta — ${pgto}` });
    }
    showToast('Venda finalizada! Estoque atualizado.');
    window._vendaItens = [];
    showVendas();
  } catch(e) { showToast(e.message,'danger'); }
}
