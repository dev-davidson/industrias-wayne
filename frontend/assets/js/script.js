// ===================== Helpers de Notificação =====================
function showError(msg) {
  const m = document.getElementById('mensagem');
  m.className = 'erro';
  m.innerText = msg;
}

function showSuccess(msg) {
  const m = document.getElementById('mensagem');
  m.className = 'sucesso';
  m.innerText = msg;
}

// ===================== JWT PARSE (para extrair cargo real) =====================
function parseJwt(token) {
  const base64 = token.split('.')[1]
    .replace(/-/g, '+')
    .replace(/_/g, '/');
  const json   = decodeURIComponent(atob(base64).split('').map(c =>
    '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2)
  ).join(''));
  return JSON.parse(json);
}

// ======================================
// Ajuste aqui para o endereço da sua API
const API_BASE = 'http://127.0.0.1:5000';
// ======================================

// ===================== LOGIN =====================
function fazerLogin() {
  const username = document.getElementById('username')?.value.trim();
  const password = document.getElementById('password')?.value;
  const cargo    = document.getElementById('cargo')?.value;

  if (!cargo) {
    return showError('Por favor, selecione seu cargo.');
  }

  fetch(`${API_BASE}/api/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password, cargo })
  })
  .then(res => res.json())
  .then(data => {
    if (data.token) {
      // extrai cargo do token garantido pelo backend
      const payload = parseJwt(data.token);
      localStorage.setItem('token',      data.token);
      localStorage.setItem('username',   payload.sub);             // 'sub' = identity
      localStorage.setItem('cargo',      payload.cargo.toLowerCase()); // 'admin'|...
      localStorage.setItem('ultimoLogin', new Date().toLocaleString());
      showSuccess('Login realizado! Redirecionando...');
      setTimeout(() => window.location.href = 'index.html', 1000);
    } else {
      showError(data.msg);
    }
  })
  .catch(() => showError('Erro ao conectar ao servidor.'));
}

// ===================== DASHBOARD =====================
if (document.getElementById('conteudo')) {
  window.addEventListener('DOMContentLoaded', () => {
    const token = localStorage.getItem('token');
    if (!token) return window.location.href = 'login.html';

    const username  = localStorage.getItem('username');
    const cargo     = localStorage.getItem('cargo');
    const lastLogin = localStorage.getItem('ultimoLogin');

    // Top‑bar
    document.getElementById('usuario-logado').innerText = `Usuário: ${username}`;

    // Preenche Dashboard
    document.getElementById('welcome-msg').innerText = `Bem‑vindo, ${username}!`;
    document.getElementById('cargo-info').innerText   = `Cargo: ${cargo}`;
    document.getElementById('last-login').innerText  = `Último login: ${lastLogin}`;

    // valida token
    fetch(`${API_BASE}/api/dashboard`, {
      headers: { 'Authorization': 'Bearer ' + token }
    }).catch(() => {});

    // estatísticas usuáros (só admin vê)
    if (cargo === 'admin') {
      fetch(`${API_BASE}/api/usuarios`, {
        headers: { 'Authorization': 'Bearer ' + token }
      })
      .then(res => res.json())
      .then(usuarios => {
        let adm=0, ger=0, func=0;
        usuarios.forEach(u => {
          const c = u.cargo.toLowerCase();
          if (c==='admin')      adm++;
          else if (c==='gerente') ger++;
          else                    func++;
        });
        document.getElementById('stats-admin').innerText       = adm;
        document.getElementById('stats-gerente').innerText     = ger;
        document.getElementById('stats-funcionario').innerText = func;
      });
    }

    // resumo recursos
    atualizarResumoRecursos();
  });
}

// ===================== LOGOUT =====================
function fazerLogout() {
  localStorage.clear();
  window.location.href = 'login.html';
}

// ===================== CRIAR RECURSO =====================
function salvarRecurso() {
  const nome      = document.getElementById('nome')?.value;
  const tipo      = document.getElementById('tipo')?.value;
  const descricao = document.getElementById('descricao')?.value;
  const token     = localStorage.getItem('token');

  fetch(`${API_BASE}/api/recursos`, {
    method: 'POST',
    headers: {
      'Content-Type':  'application/json',
      'Authorization': 'Bearer ' + token
    },
    body: JSON.stringify({ nome, tipo, descricao })
  })
  .then(res => res.json())
  .then(data => {
    showSuccess(data.msg || 'Recurso adicionado com sucesso!');
    carregarRecursos();
    atualizarResumoRecursos();
  })
  .catch(() => showError('Erro ao conectar ao servidor'));
}

// ===================== LISTAR RECURSOS =====================
function carregarRecursos() {
  const token = localStorage.getItem('token');
  fetch(`${API_BASE}/api/recursos`, {
    headers: { 'Authorization': 'Bearer ' + token }
  })
  .then(res => res.json())
  .then(recursos => {
    const lista = document.getElementById('lista-recursos');
    if (!lista) return;
    lista.innerHTML = '';
    recursos.forEach(r => {
      const li = document.createElement('li');
      li.textContent = `${r.nome} — ${r.tipo} — ${r.descricao}`;
      lista.appendChild(li);
    });
  })
  .catch(() => {
    document.getElementById('lista-recursos').innerHTML =
      '<li class="alerta">Erro ao carregar recursos</li>';
  });
}

// ===================== RESUMO DE RECURSOS =====================
function atualizarResumoRecursos() {
  const token = localStorage.getItem('token');
  fetch(`${API_BASE}/api/recursos`, {
    headers: { 'Authorization': 'Bearer ' + token }
  })
  .then(res => res.json())
  .then(recursos => {
    let seg=0, veic=0, eqp=0;
    recursos.forEach(r => {
      const t = r.tipo.toLowerCase();
      if (t.includes('seguran')) seg++;
      else if (t.includes('ve')) veic++;
      else if (t.includes('equip')) eqp++;
    });
    document.getElementById('seguranca-count').innerText    = seg;
    document.getElementById('veiculos-count').innerText     = veic;
    document.getElementById('equipamentos-count').innerText = eqp;
    document.getElementById('total-count').innerText        = recursos.length;
    carregarUltimosRecursos(recursos);
  });
}

function carregarUltimosRecursos(recursos) {
  const ultimos = recursos.slice(-3).reverse();
  const ul = document.getElementById('lista-ultimos');
  if (!ul) return;
  ul.innerHTML = '';
  ultimos.forEach(r => {
    const li = document.createElement('li');
    li.textContent = `${r.nome} — ${r.tipo} — ${r.descricao}`;
    ul.appendChild(li);
  });
}

// ===================== ADMIN UI & EDIT/DELETE =====================
function initAdminUI() {
  const cargo    = localStorage.getItem('cargo');
  const btnAdmin = document.getElementById('btn-admin');
  if (btnAdmin && cargo === 'admin') {
    btnAdmin.style.display = 'inline-block';
  }

  // injetar botões só em admin.html e se for admin
  const path = window.location.pathname;
  if (path.endsWith('admin.html') && cargo === 'admin') {
    carregarRecursos();
    carregarRecursosComBotoes();
  } else if (document.getElementById('lista-recursos')) {
    // em recursos.html para não-admin
    carregarRecursos();
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initAdminUI);
} else {
  initAdminUI();
}

function carregarRecursosComBotoes() {
  const token = localStorage.getItem('token');
  fetch(`${API_BASE}/api/recursos`, {
    headers: { 'Authorization': 'Bearer ' + token }
  })
  .then(res => res.json())
  .then(recursos => {
    const ul = document.getElementById('lista-recursos');
    if (!ul) return;
    ul.innerHTML = '';
    recursos.forEach(r => {
      const li = document.createElement('li');
      li.textContent = `${r.nome} — ${r.tipo} — ${r.descricao}`;
      const btnE = document.createElement('button');
      btnE.innerText = 'Editar';
      btnE.onclick = () => editarRecurso(r.id);
      const btnX = document.createElement('button');
      btnX.innerText = 'Excluir';
      btnX.onclick = () => excluirRecurso(r.id);
      li.append(btnE, btnX);
      ul.appendChild(li);
    });
  });
}

// ===================== EDITAR & EXCLUIR =====================
function editarRecurso(id) {
  const novoNome  = prompt("Novo nome:");
  if (!novoNome) return;
  const novoTipo  = prompt("Novo tipo:");
  if (!novoTipo) return;
  const novaDesc  = prompt("Nova descrição:");
  if (!novaDesc) return;

  const token = localStorage.getItem('token');
  fetch(`${API_BASE}/api/recursos/${id}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer ' + token
    },
    body: JSON.stringify({ nome: novoNome, tipo: novoTipo, descricao: novaDesc })
  })
  .then(res => res.json())
  .then(data => {
    showSuccess(data.msg || 'Recurso atualizado!');
    carregarRecursosComBotoes();
    atualizarResumoRecursos();
  })
  .catch(() => showError('Erro ao atualizar recurso.'));
}

function excluirRecurso(id) {
  if (!confirm("Deseja realmente excluir?")) return;

  const token = localStorage.getItem('token');
  fetch(`${API_BASE}/api/recursos/${id}`, {
    method: 'DELETE',
    headers: { 'Authorization': 'Bearer ' + token }
  })
  .then(res => res.json())
  .then(data => {
    showSuccess(data.msg || 'Recurso excluído!');
    carregarRecursosComBotoes();
    atualizarResumoRecursos();
  })
  .catch(() => showError('Erro ao excluir recurso.'));
}
