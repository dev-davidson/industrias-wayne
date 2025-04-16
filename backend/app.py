from flask_cors import CORS
from models import db, Usuario, Recurso
from flask import Flask, request, jsonify
from flask_jwt_extended import (
    JWTManager, create_access_token, jwt_required,
    get_jwt_identity, get_jwt
)
from werkzeug.security import generate_password_hash, check_password_hash
from functools import wraps

app = Flask(__name__)
CORS(app)  # Habilita CORS

# Configuração do banco SQLite
app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///database.db'
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False

# Configuração JWT
app.config['JWT_SECRET_KEY'] = 'sua-chave-segura'  # Altere para uma chave segura!

# Inicializa as extensões
db.init_app(app)
jwt = JWTManager(app)

# Cria as tabelas, se ainda não existirem
with app.app_context():
    db.create_all()

# Dicionário de mapeamento de cargos para padronização
CARGO_MAP = {
    "funcionario": "funcionario",
    "funcionário": "funcionario",
    "gerente": "gerente",
    "administrador": "admin",
    "administrador de segurança": "admin",
    "admin": "admin"
}

@app.route('/')
def home():
    return "Backend Indústrias Wayne com JWT funcionando!"

# Rota para cadastro de usuários
@app.route('/cadastro', methods=['POST'])
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

# Rota para login (gera token JWT com campo 'cargo' incluso)
@app.route('/login', methods=['POST'])
def login():
    data = request.json
    usuario = Usuario.query.filter_by(username=data.get('username')).first()
    if usuario and check_password_hash(usuario.password, data.get('password')):
        # Normaliza o cargo informado
        cargo_informado = data.get('cargo', '').strip().lower()
        cargo_mapeado = CARGO_MAP.get(cargo_informado)
        print("Cargo informado:", cargo_informado)
        print("Cargo mapeado:", cargo_mapeado)
        print("Cargo armazenado:", usuario.cargo.strip().lower())
        print("Cargo armazenado mapeado:", CARGO_MAP.get(usuario.cargo.strip().lower()))
        if cargo_mapeado != CARGO_MAP.get(usuario.cargo.strip().lower()):
            return jsonify({"msg": "Cargo incorreto."}), 403
        additional_claims = {"cargo": usuario.cargo}
        token = create_access_token(identity=usuario.username, additional_claims=additional_claims)
        return jsonify({"token": token}), 200
    return jsonify({"msg": "Usuário ou senha inválidos"}), 401

# Decorator para autorização baseado em cargo
def role_required(cargos_permitidos):
    def wrapper(fn):
        @wraps(fn)
        def decorator(*args, **kwargs):
            jwt_data = get_jwt()
            cargo_usuario = jwt_data.get("cargo", "").lower()
            if isinstance(cargos_permitidos, str):
                cargos_permitidos_list = [cargos_permitidos.lower()]
            else:
                cargos_permitidos_list = [c.lower() for c in cargos_permitidos]
            if cargo_usuario not in cargos_permitidos_list:
                return jsonify({"msg": "Acesso negado. Permissão insuficiente."}), 403
            return fn(*args, **kwargs)
        return decorator
    return wrapper

# Rota protegida simples (acessível a qualquer usuário autenticado)
@app.route('/protegido', methods=['GET'])
@jwt_required()
def protegido():
    usuario_logado = get_jwt_identity()
    jwt_data = get_jwt()
    cargo = jwt_data.get("cargo", "não definido")
    return jsonify({"msg": f"Bem-vindo, {usuario_logado} ({cargo})! Esta rota está protegida."}), 200

# Nova rota de dashboard: acessível para admin, gerente e funcionario
@app.route('/dashboard', methods=['GET'])
@jwt_required()
@role_required(["admin", "gerente", "funcionario"])
def dashboard():
    usuario_logado = get_jwt_identity()
    jwt_data = get_jwt()
    cargo = jwt_data.get("cargo", "não definido")
    return jsonify({"msg": f"Bem-vindo ao dashboard, {usuario_logado} ({cargo})!"}), 200

# Endpoint para listar todos os recursos
@app.route('/recursos', methods=['GET'])
@jwt_required()
def get_recursos():
    recursos = Recurso.query.all()
    recursos_list = []
    for r in recursos:
        recursos_list.append({
            'id': r.id,
            'nome': r.nome,
            'tipo': r.tipo,
            'descricao': r.descricao
        })
    return jsonify(recursos_list), 200

# Endpoint para criar um novo recurso
@app.route('/recursos', methods=['POST'])
@jwt_required()
def create_recurso():
    data = request.json
    novo_recurso = Recurso(
        nome=data.get('nome'),
        tipo=data.get('tipo'),
        descricao=data.get('descricao')
    )
    db.session.add(novo_recurso)
    db.session.commit()
    return jsonify({'msg': 'Recurso criado com sucesso!'}), 201

# Endpoint para atualizar um recurso existente
@app.route('/recursos/<int:recurso_id>', methods=['PUT'])
@jwt_required()
def update_recurso(recurso_id):
    data = request.json
    recurso = Recurso.query.get_or_404(recurso_id)
    recurso.nome = data.get('nome', recurso.nome)
    recurso.tipo = data.get('tipo', recurso.tipo)
    recurso.descricao = data.get('descricao', recurso.descricao)
    db.session.commit()
    return jsonify({'msg': 'Recurso atualizado com sucesso!'}), 200

# Endpoint para deletar um recurso
@app.route('/recursos/<int:recurso_id>', methods=['DELETE'])
@jwt_required()
def delete_recurso(recurso_id):
    recurso = Recurso.query.get_or_404(recurso_id)
    db.session.delete(recurso)
    db.session.commit()
    return jsonify({'msg': 'Recurso deletado com sucesso!'}), 200

# Endpoint para listar todos os usuários
@app.route('/usuarios', methods=['GET'])
@jwt_required()
def listar_usuarios():
    usuarios = Usuario.query.all()
    usuarios_list = []
    for u in usuarios:
        usuarios_list.append({
            'id': u.id,
            'username': u.username,
            'cargo': u.cargo
        })
    return jsonify(usuarios_list), 200

# Exemplo de rota protegida apenas para administradores
@app.route('/admin', methods=['GET'])
@jwt_required()
@role_required("admin")
def admin_panel():
    return jsonify({"msg": "Bem-vindo ao painel de administração!"}), 200

if __name__ == "__main__":
    app.run(debug=True)
