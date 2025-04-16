from flask_cors import CORS
from flask import Flask, request, jsonify, send_from_directory
from flask_jwt_extended import (
    JWTManager, create_access_token, jwt_required,
    get_jwt_identity, get_jwt
)
from werkzeug.security import generate_password_hash, check_password_hash
from functools import wraps
import os

# Configurações de caminho
BASE_DIR = os.path.abspath(os.getcwd())
FRONTEND_DIR = os.path.join(BASE_DIR, 'frontend')
ASSETS_DIR = os.path.join(FRONTEND_DIR, 'assets')

# Inicializa o Flask apontando templates e estáticos
app = Flask(
    __name__,
    static_folder=ASSETS_DIR,
    template_folder=FRONTEND_DIR
)
CORS(app)  # Habilita CORS

# Configuração do banco SQLite
app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///database.db'
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False

# Configuração JWT
app.config['JWT_SECRET_KEY'] = 'sua-chave-segura'  # Altere para uma chave segura!

# Inicializa extensões
from models import db, Usuario, Recurso

db.init_app(app)
jwt = JWTManager(app)

# Cria as tabelas, se ainda não existirem
with app.app_context():
    db.create_all()

# Mapeamento de cargos
CARGO_MAP = {
    "funcionario": "funcionario",
    "funcionário": "funcionario",
    "gerente": "gerente",
    "administrador": "admin",
    "administrador de segurança": "admin",
    "admin": "admin"
}

# Serve arquivos estáticos e páginas HTML do frontend
@app.route('/', defaults={'path': 'index.html'})
@app.route('/<path:path>')
def serve_front(path):
    if path.startswith('assets/'):
        rel_path = path[len('assets/'):]
        return send_from_directory(app.static_folder, rel_path)
    return send_from_directory(app.template_folder, path)

# API endpoints abaixo (prefixados com /api para evitar conflito)

# Cadastro de usuários
@app.route('/api/cadastro', methods=['POST'])
def cadastro():
    data = request.json
    if Usuario.query.filter_by(username=data.get('username')).first():
        return jsonify({"msg": "Username já existe. Tente outro."}), 400
    novo_usuario = Usuario(
        username=data['username'],
        password=generate_password_hash(data['password']),
        cargo=data.get('cargo', 'funcionario')
    )
    db.session.add(novo_usuario)
    db.session.commit()
    return jsonify({"msg": "Usuário criado com sucesso!"}), 201

# Login
@app.route('/api/login', methods=['POST'])
def login():
    data = request.json
    usuario = Usuario.query.filter_by(username=data.get('username')).first()
    if usuario and check_password_hash(usuario.password, data.get('password')):
        cargo_inf = data.get('cargo', '').strip().lower()
        if CARGO_MAP.get(cargo_inf) != CARGO_MAP.get(usuario.cargo.strip().lower()):
            return jsonify({"msg": "Cargo incorreto."}), 403
        token = create_access_token(identity=usuario.username, additional_claims={"cargo": usuario.cargo})
        return jsonify({"token": token}), 200
    return jsonify({"msg": "Usuário ou senha inválidos"}), 401

# Decorator de autorização por cargo
def role_required(cargos_permitidos):
    def wrapper(fn):
        @wraps(fn)
        def decorator(*args, **kwargs):
            cargo_usuario = get_jwt().get("cargo", "").lower()
            allowed = ([cargos_permitidos.lower()] if isinstance(cargos_permitidos, str)
                       else [c.lower() for c in cargos_permitidos])
            if cargo_usuario not in allowed:
                return jsonify({"msg": "Acesso negado. Permissão insuficiente."}), 403
            return fn(*args, **kwargs)
        return decorator
    return wrapper

# Rota de dashboard
@app.route('/api/dashboard', methods=['GET'])
@jwt_required()
@role_required(["admin", "gerente", "funcionario"])
def dashboard():
    user = get_jwt_identity()
    cargo = get_jwt().get("cargo", "não definido")
    return jsonify({"msg": f"Bem-vindo ao dashboard, {user} ({cargo})!"}), 200

# Recursos CRUD
@app.route('/api/recursos', methods=['GET'])
@jwt_required()
def get_recursos():
    recursos = Recurso.query.all()
    return jsonify([{'id': r.id, 'nome': r.nome, 'tipo': r.tipo, 'descricao': r.descricao} for r in recursos]), 200

@app.route('/api/recursos', methods=['POST'])
@jwt_required()
@role_required('admin')
def create_recurso():
    data = request.json
    novo = Recurso(nome=data.get('nome'), tipo=data.get('tipo'), descricao=data.get('descricao'))
    db.session.add(novo)
    db.session.commit()
    return jsonify({'msg': 'Recurso criado com sucesso!'}), 201

@app.route('/api/recursos/<int:id>', methods=['PUT'])
@jwt_required()
@role_required('admin')
def update_recurso(id):
    data = request.json
    r = Recurso.query.get_or_404(id)
    r.nome = data.get('nome', r.nome)
    r.tipo = data.get('tipo', r.tipo)
    r.descricao = data.get('descricao', r.descricao)
    db.session.commit()
    return jsonify({'msg': 'Recurso atualizado com sucesso!'}), 200

@app.route('/api/recursos/<int:id>', methods=['DELETE'])
@jwt_required()
@role_required('admin')
def delete_recurso(id):
    r = Recurso.query.get_or_404(id)
    db.session.delete(r)
    db.session.commit()
    return jsonify({'msg': 'Recurso deletado com sucesso!'}), 200

# Listar usuários (apenas admin)
@app.route('/api/usuarios', methods=['GET'])
@jwt_required()
@role_required('admin')
def listar_usuarios():
    users = Usuario.query.all()
    return jsonify([{'id': u.id, 'username': u.username, 'cargo': u.cargo} for u in users]), 200

# Roda o app
if __name__ == '__main__':
    app.run(debug=True)
