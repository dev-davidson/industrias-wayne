// Funções auxiliares de notificação
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

// ===================== LOGIN =====================
function fazerLogin() {
  const username = document.getElementById('username')?.value.trim();
  const password = document.getElementById('password')?.value;
  const cargo    = document.getElementById('cargo')?.value;

  if (!cargo) {
    return showError('Por favor, selecione seu cargo.');
  }

  fetch('/api/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password, cargo })
  })
  .then(res => res.json())
  .then(data => {
    if (data.token) {
      localStorage.setItem('token', data.token);
      localStorage.setItem('username', username.toLowerCase());
      localStorage.setItem('cargo',    cargo.toLowerCase());
      localStorage.setItem('ultimoLogin', new Date().toLocaleString());
      showSuccess('Login realizado! Redirecionando...');
      setTimeout(() => window.location.href = 'index.html', 1000);
    } else {
      showError(data.msg);
    }
  })
  .catch(() => {
    showError('Erro ao conectar ao servidor.');
  });
}

// ===================== DASHBOARD =====================
if (document.getElementById('conteudo')) {
  window.addEventListener('DOMContentLoaded', () => {
    const token = localStorage.getItem('token');
    if (!token) return window.location.href = 'login.html';

    const username = localStorage.getItem('username');
    const cargo    = localStorage.getItem('cargo');
    const lastLogin = localStorage.getItem('ultimoLogin');

    // Exibe usuário na top‑bar
    const spanUser = document.getElementById('usuario-logado');
    if (spanUser) spanUser.innerText = `Usuário: ${username}`;

    // Preenche boas‑vindas, cargo e último login
    document.getElementById('welcome-msg').innerText = `Bem‑vindo, ${username}!`;
    document.getElementById('cargo-info').innerText   = `Cargo: ${cargo}`;
    document.getElementById('last-login').innerText  = `Último login: ${lastLogin}`;

    // Chama a rota protegida do dashboard
    fetch('/api/dashboard', {
      headers: { 'Authorization': 'Bearer ' + token }
    })
      .catch(() => { /* ignore */ });

    // Estatísticas de usuários
    fetch('/api/usuarios', {
      headers: { 'Authorization': 'Bearer ' + token }
    })
      .then(res => res.json())
      .then(usuarios => {
        let admin = 0, gerente = 0, funcionario = 0;
        usuarios.forEach(u => {
          const c = u.cargo.toLowerCase();
          if (c.includes('admin')) admin++;
          else if (c.includes('gerente')) gerente++;
          else funcionario++;
        });
        document.getElementById('stats-admin').innerText       = admin;
        document.getElementById('stats-gerente').innerText     = gerente;
        document.getElementById('stats-funcionario').innerText = funcionario;
      })
      .catch(() => { /* ignore */ });

    // Resumo de recursos
    atualizarResumoRecursos();
  });
}

// ===================== LOGOUT =====================
function fazerLogout() {
  localStorage.clear();
  window.location.href = 'login.html';
}

// ===================== GESTÃO DE RECURSOS =====================
function salvarRecurso() {
  const nome      = document.getElementById('nome')?.value;
  const tipo      = document.getElementById('tipo')?.value;
  const descricao = document.getElementById('descricao')?.value;
  const token     = localStorage.getItem('token');

  fetch('/api/recursos', {
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
    .catch(() => showError('Erro ao conectar com o servidor'));
}

function carregarRecursos() {
  const token = localStorage.getItem('token');

  fetch('/api/recursos', {
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
      const lista = document.getElementById('lista-recursos');
      if (lista) lista.innerHTML = '<li class="alerta">Erro ao carregar recursos</li>';
    });
}

// ===================== RESUMO DE RECURSOS =====================
function atualizarResumoRecursos() {
  const token = localStorage.getItem('token');

  fetch('/api/recursos', {
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
      document.getElementById('seguranca-count').innerText    = seg;
      document.getElementById('veiculos-count').innerText     = veic;
      document.getElementById('equipamentos-count').innerText = eqp;
      document.getElementById('total-count').innerText        = recursos.length;
      carregarUltimosRecursos(recursos);
    })
    .catch(err => console.error('Erro ao buscar resumo:', err));
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

// ===================== ADMIN BUTTON & EDIT/DELETE =====================
window.addEventListener('DOMContentLoaded', () => {
  const cargo    = localStorage.getItem('cargo');
  const btnAdmin = document.getElementById('btn-admin');

  if (btnAdmin && cargo === 'administrador') {
    btnAdmin.style.display = 'inline-block';
  }

  if (document.getElementById('lista-recursos')) {
    carregarRecursos();
    carregarRecursosComBotoes();
  }
});

function carregarRecursosComBotoes() {
  const cargo = localStorage.getItem('cargo');
  if (cargo !== 'administrador') return;

  const token = localStorage.getItem('token');
  fetch('/api/recursos', {
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

// ===================== EDITAR RECURSO =====================
function editarRecurso(id) {
  const novoNome  = prompt("Digite o novo nome do recurso:");
  if (novoNome === null) return;
  const novoTipo  = prompt("Digite o novo tipo do recurso:");
  if (novoTipo === null) return;
  const novaDesc  = prompt("Digite a nova descrição do recurso:");
  if (novaDesc === null) return;

  const token = localStorage.getItem('token');
  fetch(`/api/recursos/${id}`, {
    method: 'PUT',
    headers: {
      'Content-Type':  'application/json',
      'Authorization': 'Bearer ' + token
    },
    body: JSON.stringify({ nome: novoNome, tipo: novoTipo, descricao: novaDesc })
  })
    .then(res => res.json())
    .then(data => {
      showSuccess(data.msg || "Recurso atualizado com sucesso!");
      carregarRecursosComBotoes();
      atualizarResumoRecursos();
    })
    .catch(() => showError("Erro ao atualizar recurso."));
}

// ===================== EXCLUIR RECURSO =====================
function excluirRecurso(id) {
  if (!confirm("Tem certeza que deseja excluir este recurso?")) return;

  const token = localStorage.getItem('token');
  fetch(`/api/recursos/${id}`, {
    method: 'DELETE',
    headers: { 'Authorization': 'Bearer ' + token }
  })
    .then(res => res.json())
    .then(data => {
      showSuccess(data.msg || "Recurso excluído com sucesso!");
      carregarRecursosComBotoes();
      atualizarResumoRecursos();
    })
    .catch(() => showError("Erro ao excluir recurso."));
}
