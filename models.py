# models.py
from datetime import datetime
from database import db

class Device(db.Model):
    __tablename__ = "devices"

    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), nullable=False)
    token = db.Column(db.String(100), unique=True, nullable=False)
    last_seen = db.Column(db.DateTime, default=datetime.utcnow)
    status = db.Column(db.String(20), default="UP")

    def __repr__(self):
        return f"<Device {self.name}>"

class Metric(db.Model):
    __tablename__ = "metrics"

    id = db.Column(db.Integer, primary_key=True)
    device_id = db.Column(db.Integer, db.ForeignKey("devices.id"))

    cpu_usage = db.Column(db.Float)
    memory_usage = db.Column(db.Float)
    disk_usage = db.Column(db.Float)

    # NEW METRICS
    processes = db.Column(db.Integer, nullable=True)
    top_processes = db.Column(db.Text, nullable=True)
    upload = db.Column(db.Float, nullable=True)
    download = db.Column(db.Float, nullable=True)
    uptime = db.Column(db.Integer, nullable=True)
    temp = db.Column(db.Float, nullable=True)
    connections = db.Column(db.Text,nullable=True)

    # store per-core values as JSON text
    per_core = db.Column(db.Text, nullable=True)

    timestamp = db.Column(db.DateTime, default=datetime.utcnow)


class Alert(db.Model):
    __tablename__ = "alerts"

    id = db.Column(db.Integer, primary_key=True)
    device_id = db.Column(db.Integer, db.ForeignKey("devices.id"))
    message = db.Column(db.String(255))
    severity = db.Column(db.String(20))
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
