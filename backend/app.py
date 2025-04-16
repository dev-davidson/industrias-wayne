import os
from flask import Flask, send_from_directory, request, jsonify
from flask_cors import CORS
from flask_jwt_extended import (
    JWTManager, create_access_token, jwt_required,
    get_jwt_identity, get_jwt
)
from werkzeug.security import generate_password_hash, check_password_hash
from functools import wraps

# IMPORT CORRIGIDO: agora aponta para backend.models
from backend.models import db, Usuario, Recurso

# Cria app, apontando static_folder e template_folder
app = Flask(
    __name__,
    static_folder=os.path.join(os.getcwd(), 'frontend', 'assets'),
    template_folder=os.path.join(os.getcwd(), 'frontend')
)
CORS(app)

# Configurações do banco e JWT
app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///database.db'
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
app.config['JWT_SECRET_KEY'] = 'sua-chave-segura'  # mude para algo seguro!

# Inicializa extensões
db.init_app(app)
jwt = JWTManager(app)

# Cria tabelas
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

# Serve front-end estático e HTML
@app.route('/', defaults={'path': 'index.html'})
@app.route('/<path:path>')
def serve_front(path):
    if path.startswith('assets/'):
        # /assets/css/... ou /assets/js/... ou /assets/img/...
        return send_from_directory(app.static_folder, path[len('assets/'):])
    else:
        # index.html, login.html, recursos.html, admin.html
        return send_from_directory(app.template_folder, path)

# --- ROTAS DA API, prefixadas em /api ---

@app.route('/api/cadastro', methods=['POST'])
def cadastro():
    data = request.json
    if Usuario.query.filter_by(username=data.get('username')).first():
        return jsonify({"msg": "Username já existe."}), 400
    novo = Usuario(
        username=data['username'],
        password=generate_password_hash(data['password']),
        cargo=data.get('cargo', 'funcionario')
    )
    db.session.add(novo)
    db.session.commit()
    return jsonify({"msg": "Usuário criado com sucesso!"}), 201

@app.route('/api/login', methods=['POST'])
def login():
    data = request.json
    user = Usuario.query.filter_by(username=data.get('username')).first()
    if user and check_password_hash(user.password, data.get('password')):
        cargo_inf = data.get('cargo','').strip().lower()
        if CARGO_MAP.get(cargo_inf) != CARGO_MAP.get(user.cargo.strip().lower()):
            return jsonify({"msg": "Cargo incorreto."}), 403
        token = create_access_token(
            identity=user.username,
            additional_claims={"cargo": user.cargo}
        )
        return jsonify({"token": token}), 200
    return jsonify({"msg": "Usuário ou senha inválidos"}), 401

def role_required(allowed):
    def wrapper(fn):
        @wraps(fn)
        def decorator(*args, **kwargs):
            cargo = get_jwt().get("cargo","").lower()
            allowed_list = [allowed] if isinstance(allowed, str) else allowed
            allowed_list = [c.lower() for c in allowed_list]
            if cargo not in allowed_list:
                return jsonify({"msg":"Permissão insuficiente."}),403
            return fn(*args, **kwargs)
        return decorator
    return wrapper

@app.route('/api/recursos', methods=['GET'])
@jwt_required()
def get_recursos():
    recursos = Recurso.query.all()
    return jsonify([r.to_dict() for r in recursos]), 200

@app.route('/api/recursos', methods=['POST'])
@jwt_required()
@role_required("admin")
def create_recurso():
    data = request.json
    novo = Recurso(nome=data.get('nome'), tipo=data.get('tipo'), descricao=data.get('descricao'))
    db.session.add(novo); db.session.commit()
    return jsonify({"msg":"Recurso criado!"}),201

@app.route('/api/recursos/<int:id>', methods=['PUT'])
@jwt_required()
@role_required("admin")
def update_recurso(id):
    data = request.json
    r = Recurso.query.get_or_404(id)
    r.nome, r.tipo, r.descricao = (
        data.get('nome', r.nome),
        data.get('tipo', r.tipo),
        data.get('descricao', r.descricao)
    )
    db.session.commit()
    return jsonify({"msg":"Recurso atualizado!"}),200

@app.route('/api/recursos/<int:id>', methods=['DELETE'])
@jwt_required()
@role_required("admin")
def delete_recurso(id):
    r = Recurso.query.get_or_404(id)
    db.session.delete(r); db.session.commit()
    return jsonify({"msg":"Recurso deletado!"}),200

@app.route('/api/usuarios', methods=['GET'])
@jwt_required()
@role_required("admin")
def listar_usuarios():
    users = Usuario.query.all()
    return jsonify([
        {"id":u.id,"username":u.username,"cargo":u.cargo} for u in users
    ]),200

@app.route('/api/dashboard', methods=['GET'])
@jwt_required()
@role_required(["admin","gerente","funcionario"])
def dashboard():
    user = get_jwt_identity()
    cargo = get_jwt().get("cargo","")
    return jsonify({"msg":f"Bem‑vindo {user} ({cargo}) ao dashboard"}),200

if __name__ == "__main__":
    app.run(debug=True)
