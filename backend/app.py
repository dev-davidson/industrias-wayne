import os
from flask import Flask, send_from_directory, request, jsonify
from flask_cors import CORS
from flask_jwt_extended import (
    JWTManager, create_access_token, jwt_required,
    get_jwt_identity, get_jwt
)
from werkzeug.security import generate_password_hash, check_password_hash
from functools import wraps

# Import relativo dentro do mesmo pacote
from models import db, Usuario, Recurso

# Configurações de caminho
HERE            = os.path.abspath(os.path.dirname(__file__))
FRONTEND_DIR    = os.path.join(HERE, '..', 'frontend')
FRONTEND_ASSETS = os.path.join(HERE, '..', 'frontend', 'assets')

# Adiciona logs para depuração
print(f"Diretório atual (HERE): {HERE}")
print(f"Diretório do frontend (FRONTEND_DIR): {FRONTEND_DIR}")
print(f"Diretório dos assets (FRONTEND_ASSETS): {FRONTEND_ASSETS}")

app = Flask(
    __name__,
    static_folder=FRONTEND_ASSETS,
    template_folder=FRONTEND_DIR
)
CORS(app, resources={r"/api/*": {"origins": "*"}})

# Configurações de banco e JWT
# Usa DATABASE_URL do Render (PostgreSQL) ou SQLite como fallback para testes locais
database_url = os.getenv('DATABASE_URL', 'sqlite:///' + os.path.join(HERE, 'recursos.db'))
if database_url.startswith('postgres://'):
    database_url = database_url.replace('postgres://', 'postgresql://', 1)
app.config['SQLALCHEMY_DATABASE_URI'] = database_url
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
app.config['JWT_SECRET_KEY'] = 'troque-para-uma-chave-secreta'

# Inicializa extensões
db.init_app(app)
jwt = JWTManager(app)

# Garante criação das tabelas e inicializa com um usuário padrão
with app.app_context():
    try:
        print(f"Tentando criar banco de dados em: {app.config['SQLALCHEMY_DATABASE_URI']}")
        db.create_all()
        # Verifica se já existe um usuário admin; se não, cria um
        if not Usuario.query.filter_by(username='admin').first():
            admin = Usuario(
                username='admin',
                password=generate_password_hash('admin123'),
                cargo='admin'
            )
            db.session.add(admin)
            db.session.commit()
            print("Usuário admin criado com sucesso.")
        else:
            print("Usuário admin já existe.")
    except Exception as e:
        print(f"Erro ao inicializar o banco de dados: {e}")
        raise

CARGO_MAP = {
    "funcionario":                 "funcionario",
    "funcionário":                 "funcionario",
    "gerente":                     "gerente",
    "administrador":               "admin",
    "administrador de segurança":  "admin",
    "admin":                       "admin"
}

# — Rota de Saúde (Health Check) —
@app.route('/api/health', methods=['GET'])
def health_check():
    return jsonify({"status": "Backend is running"}), 200

# — Serve o frontend estático —
@app.route('/', defaults={'path': 'index.html'})
@app.route('/<path:path>')
def serve_front(path):
    print(f"Servindo arquivo: {path}")
    if path.startswith('assets/'):
        return send_from_directory(app.static_folder, path[len('assets/'):])
    return send_from_directory(app.template_folder, path)

# — Decorator de permissão por cargo —
def role_required(allowed):
    def wrapper(fn):
        @wraps(fn)
        def decorator(*args, **kwargs):
            cargo = get_jwt().get("cargo", "").lower()
            lst = [allowed] if isinstance(allowed, str) else allowed
            lst = [c.lower() for c in lst]
            if cargo not in lst:
                return jsonify(msg="Permissão insuficiente."), 403
            return fn(*args, **kwargs)
        return decorator
    return wrapper

# — Rotas da API —

@app.route('/api/cadastro', methods=['POST'])
def cadastro():
    data = request.json or {}
    if not data.get('username') or not data.get('password'):
        return jsonify(msg="Preencha username e senha"), 400
    if Usuario.query.filter_by(username=data['username']).first():
        return jsonify(msg="Username já existe."), 400

    cargo_raw  = data.get('cargo', 'funcionario').strip().lower()
    cargo_norm = CARGO_MAP.get(cargo_raw, 'funcionario')

    novo = Usuario(
        username=data['username'],
        password=generate_password_hash(data['password']),
        cargo=cargo_norm
    )
    db.session.add(novo)
    db.session.commit()
    return jsonify(msg="Usuário criado com sucesso!"), 201

@app.route('/api/login', methods=['POST'])
def login():
    data = request.json or {}
    print(f"Recebendo requisição de login: {data}")
    user = Usuario.query.filter_by(username=data.get('username')).first()
    if not user or not check_password_hash(user.password, data.get('password')):
        return jsonify(msg="Usuário ou senha inválidos"), 401

    cargo_inf = data.get('cargo', '').strip().lower()
    if CARGO_MAP.get(cargo_inf) != CARGO_MAP.get(user.cargo.strip().lower()):
        return jsonify(msg="Cargo incorreto."), 403

    token = create_access_token(
        identity=user.username,
        additional_claims={"cargo": user.cargo}
    )
    print(f"Token gerado: {token}")
    return jsonify(token=token), 200

@app.route('/api/dashboard', methods=['GET'])
@jwt_required()
@role_required(["admin", "gerente", "funcionario"])
def dashboard():
    user  = get_jwt_identity()
    cargo = get_jwt().get("cargo", "")
    return jsonify(msg=f"Bem-vindo {user} ({cargo})!"), 200

@app.route('/api/usuarios', methods=['GET'])
@jwt_required()  # qualquer usuário logado
def listar_usuarios():
    return jsonify([
        {"id":u.id,"username":u.username,"cargo":u.cargo}
        for u in Usuario.query.all()
    ]), 200

@app.route('/api/recursos', methods=['GET'])
@jwt_required()
def get_recursos():
    return jsonify([r.to_dict() for r in Recurso.query.all()]), 200

@app.route('/api/recursos', methods=['POST'])
@jwt_required()
def create_recurso():
    data = request.json or {}
    r = Recurso(
        nome=data.get('nome'),
        tipo=data.get('tipo'),
        descricao=data.get('descricao')
    )
    db.session.add(r)
    db.session.commit()
    return jsonify(msg="Recurso criado!"), 201

@app.route('/api/recursos/<int:id>', methods=['PUT'])
@jwt_required()
@role_required("admin")
def update_recurso(id):
    data = request.json or {}
    r = Recurso.query.get_or_404(id)
    r.nome      = data.get('nome', r.nome)
    r.tipo      = data.get('tipo', r.tipo)
    r.descricao = data.get('descricao', r.descricao)
    db.session.commit()
    return jsonify(msg="Recurso atualizado!"), 200

@app.route('/api/recursos/<int:id>', methods=['DELETE'])
@jwt_required()
@role_required("admin")
def delete_recurso(id):
    r = Recurso.query.get_or_404(id)
    db.session.delete(r)
    db.session.commit()
    return jsonify(msg="Recurso deletado!"), 200

if __name__ == "__main__":
    port = int(os.getenv("PORT", 5000))
    print(f"Iniciando o servidor na porta {port}")
    app.run(host="0.0.0.0", port=port, debug=True)