// ===================== Helpers de Notificação =====================
function showError(msg) {
  const m = document.getElementById('mensagem');
  if (m) {
    m.className = 'erro';
    m.innerText = msg;
  }
  console.error('Erro:', msg);
}

function showSuccess(msg) {
  const m = document.getElementById('mensagem');
  if (m) {
    m.className = 'sucesso';
    m.innerText = msg;
  }
  console.log('Sucesso:', msg);
}

// ===================== JWT PARSE (para extrair cargo real) =====================
function parseJwt(token) {
  try {
    const base64 = token.split('.')[1]
      .replace(/-/g, '+')
      .replace(/_/g, '/');
    const json = decodeURIComponent(atob(base64).split('').map(c =>
      '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2)
    ).join(''));
    return JSON.parse(json);
  } catch (error) {
    console.error('Erro ao parsear JWT:', error);
    return null;
  }
}

// ======================================
// Ajuste aqui para o endereço da sua API
const API_BASE = ''; // Deixe vazio para usar URLs relativas (ex.: /api/login)
// ======================================

// ===================== LOGIN =====================
async function fazerLogin() {
  const username = document.getElementById('username')?.value?.trim();
  const password = document.getElementById('password')?.value;
  const cargo = document.getElementById('cargo')?.value;

  if (!username || !password) {
    return showError('Por favor, preencha username e senha.');
  }
  if (!cargo) {
    return showError('Por favor, selecione seu cargo.');
  }

  async function tentarLogin() {
    try {
      console.log('Tentando login com:', { username, cargo });
      const response = await fetch(`${API_BASE}/api/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password, cargo })
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Erro ${response.status}: ${errorText || 'Erro ao conectar ao servidor.'}`);
      }

      const data = await response.json();
      if (data.token) {
        const payload = parseJwt(data.token);
        if (!payload) {
          throw new Error('Token inválido.');
        }
        localStorage.setItem('token', data.token);
        localStorage.setItem('username', payload.sub); // 'sub' = identity
        localStorage.setItem('cargo', payload.cargo.toLowerCase()); // 'admin'|...
        localStorage.setItem('ultimoLogin', new Date().toLocaleString());
        showSuccess('Login realizado! Redirecionando...');
        setTimeout(() => {
          if (payload.cargo.toLowerCase() === 'admin') {
            window.location.href = 'admin.html';
          } else {
            window.location.href = 'recursos.html';
          }
        }, 1000);
      } else {
        showError(data.msg || 'Erro desconhecido ao fazer login.');
      }
    } catch (error) {
      showError(`Erro ao conectar ao servidor: ${error.message}. Tentando novamente...`);
      setTimeout(tentarLogin, 5000); // Tenta novamente após 5 segundos
    }
  }

  tentarLogin();
}

// ===================== DASHBOARD =====================
if (document.getElementById('conteudo')) {
  window.addEventListener('DOMContentLoaded', () => {
    const token = localStorage.getItem('token');
    if (!token) {
      console.warn('Nenhum token encontrado. Redirecionando para login.');
      return window.location.href = 'login.html';
    }

    const username = localStorage.getItem('username');
    const cargo = localStorage.getItem('cargo');
    const lastLogin = localStorage.getItem('ultimoLogin');

    // Top-bar
    const usuarioLogado = document.getElementById('usuario-logado');
    if (usuarioLogado) {
      usuarioLogado.innerText = `Usuário: ${username}`;
    }

    // Preenche Dashboard
    const welcomeMsg = document.getElementById('welcome-msg');
    const cargoInfo = document.getElementById('cargo-info');
    const lastLoginEl = document.getElementById('last-login');
    if (welcomeMsg) welcomeMsg.innerText = `Bem-vindo, ${username}!`;
    if (cargoInfo) cargoInfo.innerText = `Cargo: ${cargo}`;
    if (lastLoginEl) lastLoginEl.innerText = `Último login: ${lastLogin}`;

    // Valida token
    fetch(`${API_BASE}/api/dashboard`, {
      headers: { 'Authorization': 'Bearer ' + token }
    })
      .then(res => {
        if (!res.ok) {
          console.warn('Token inválido ou expirado. Redirecionando para login.');
          localStorage.clear();
          window.location.href = 'login.html';
        }
      })
      .catch(error => {
        console.error('Erro ao validar token:', error);
        localStorage.clear();
        window.location.href = 'login.html';
      });

    // Estatísticas de Usuários (TODOS VEEM)
    fetch(`${API_BASE}/api/usuarios`, {
      headers: { 'Authorization': 'Bearer ' + token }
    })
      .then(res => res.json())
      .then(usuarios => {
        let adm = 0, ger = 0, func = 0;
        usuarios.forEach(u => {
          const c = u.cargo.toLowerCase();
          if (c === 'admin') adm++;
          else if (c === 'gerente') ger++;
          else func++;
        });
        document.getElementById('stats-admin').innerText = adm;
        document.getElementById('stats-gerente').innerText = ger;
        document.getElementById('stats-funcionario').innerText = func;
      })
      .catch(error => {
        console.error('Erro ao carregar estatísticas de usuários:', error);
      });

    // Resumo recursos
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
  const nome = document.getElementById('nome')?.value?.trim();
  const tipo = document.getElementById('tipo')?.value?.trim();
  const descricao = document.getElementById('descricao')?.value?.trim();
  const token = localStorage.getItem('token');

  if (!nome || !tipo || !descricao) {
    return showError('Por favor, preencha todos os campos do recurso.');
  }

  fetch(`${API_BASE}/api/recursos`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
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
    .catch(error => {
      console.error('Erro ao salvar recurso:', error);
      showError('Erro ao conectar ao servidor.');
    });
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
    .catch(error => {
      console.error('Erro ao carregar recursos:', error);
      const lista = document.getElementById('lista-recursos');
      if (lista) {
        lista.innerHTML = '<li class="alerta">Erro ao carregar recursos</li>';
      }
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
      let seg = 0, veic = 0, eqp = 0;
      recursos.forEach(r => {
        const t = r.tipo.toLowerCase();
        if (t.includes('seguran')) seg++;
        else if (t.includes('ve')) veic++;
        else if (t.includes('equip')) eqp++;
      });
      const segurancaEl = document.getElementById('seguranca-count');
      const veiculosEl = document.getElementById('veiculos-count');
      const equipamentosEl = document.getElementById('equipamentos-count');
      const totalEl = document.getElementById('total-count');
      if (segurancaEl) segurancaEl.innerText = seg;
      if (veiculosEl) veiculosEl.innerText = veic;
      if (equipamentosEl) equipamentosEl.innerText = eqp;
      if (totalEl) totalEl.innerText = recursos.length;
      carregarUltimosRecursos(recursos);
    })
    .catch(error => {
      console.error('Erro ao carregar resumo de recursos:', error);
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
  const cargo = localStorage.getItem('cargo');
  const btnAdmin = document.getElementById('btn-admin');
  if (btnAdmin && cargo === 'admin') {
    btnAdmin.style.display = 'inline-block';
  }

  const path = window.location.pathname;
  if (path.endsWith('admin.html') && cargo === 'admin') {
    carregarRecursos();
    carregarRecursosComBotoes();
  } else if (document.getElementById('lista-recursos')) {
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
    })
    .catch(error => {
      console.error('Erro ao carregar recursos com botões:', error);
      const ul = document.getElementById('lista-recursos');
      if (ul) {
        ul.innerHTML = '<li class="alerta">Erro ao carregar recursos</li>';
      }
    });
}

// ===================== EDITAR & affair EXCLUIR =====================
function editarRecurso(id) {
  const novoNome = prompt("Novo nome:");
  if (!novoNome) return;
  const novoTipo = prompt("Novo tipo:");
  if (!novoTipo) return;
  const novaDesc = prompt("Nova descrição:");
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
    .catch(error => {
      console.error('Erro ao editar recurso:', error);
      showError('Erro ao atualizar recurso.');
    });
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
    .catch(error => {
      console.error('Erro ao excluir recurso:', error);
      showError('Erro ao excluir recurso.');
    });
}