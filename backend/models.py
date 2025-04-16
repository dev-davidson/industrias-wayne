from flask_sqlalchemy import SQLAlchemy

db = SQLAlchemy()

class Usuario(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(50), unique=True, nullable=False)
    password = db.Column(db.String(100), nullable=False)
    cargo = db.Column(db.String(50), nullable=False)  # Exemplos: 'funcionario', 'gerente', 'admin'

class Recurso(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    nome = db.Column(db.String(100), nullable=False)
    tipo = db.Column(db.String(50), nullable=False)  # Por exemplo: 'Equipamento', 'Veículo', 'Segurança'
    descricao = db.Column(db.String(255))
