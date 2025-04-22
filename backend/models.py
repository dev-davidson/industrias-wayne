from flask_sqlalchemy import SQLAlchemy

db = SQLAlchemy()

class Usuario(db.Model):
    id       = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(80), unique=True, nullable=False)
    password = db.Column(db.String(120), nullable=False)
    cargo    = db.Column(db.String(50), nullable=False, default='funcionario')

class Recurso(db.Model):
    id        = db.Column(db.Integer, primary_key=True)
    nome      = db.Column(db.String(100), nullable=False)
    tipo      = db.Column(db.String(50),  nullable=False)
    descricao = db.Column(db.Text)

    def to_dict(self):
        return {
            'id'       : self.id,
            'nome'     : self.nome,
            'tipo'     : self.tipo,
            'descricao': self.descricao
        }
