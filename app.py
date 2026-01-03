# app.py
from flask import Flask, request, jsonify, render_template
from database import db
from models import Device, Metric, Alert
from datetime import datetime, timedelta
import secrets
from dotenv import load_dotenv
import os
import google.generativeai as genai
from config import Config

load_dotenv()

GOOGLE_API_KEY = os.getenv("GOOGLE_API_KEY")
genai.configure(api_key=GOOGLE_API_KEY)


app = Flask(__name__)

app.config["SQLALCHEMY_DATABASE_URI"] = Config.DB_URI
app.config["SQLALCHEMY_ENGINE_OPTIONS"] = Config.ENGINE_OPTIONS
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False


db.init_app(app)

# ---------------- HOME ----------------
@app.route("/")
def home():
    return render_template("index.html")


# ---------------- DASHBOARD UI ----------------
@app.route("/dashboard")
def default_dashboard():
    return render_template("dashboard.html")


# ---------------- DEVICES API ----------------
@app.route("/api/devices")
def get_devices():
    devices = Device.query.all()
    return jsonify([
        {"id": d.id, "name": d.name, "status": d.status}
        for d in devices
    ])


# ---------------- REGISTER UI ----------------
@app.route("/register")
def register():
    return render_template("register.html")


# ---------------- REGISTER API ----------------
@app.route("/api/register", methods=["POST"])
def register_device():
    data = request.json
    name = data.get("name")

    if not name:
        return jsonify({"error": "Device name required"}), 400

    token = secrets.token_hex(8)

    device = Device(name=name, token=token)
    db.session.add(device)
    db.session.commit()

    return jsonify({
        "message": "Device registered successfully",
        "device_id": device.id,
        "token": token
    })


# ---------- OFFLINE CHECKER ----------
def check_offline_devices():
    timeout = datetime.utcnow() - timedelta(seconds=60)

    devices = Device.query.all()

    for d in devices:
        if d.last_seen and d.last_seen < timeout and d.status != "DOWN":
            d.status = "DOWN"

            alert = Alert(
                device_id=d.id,
                message=f"{d.name} is offline",
                severity="HIGH"
            )
            db.session.add(alert)

    db.session.commit()



from flask import Response

@app.route("/download-agent/<token>")
def download_agent(token):

    server_url = "http://127.0.0.1:5000"   # change if hosted online

    code = f"""
\"\"\" CLOUD MONITOR AUTO-INSTALLING AGENT \"\"\" 

import os, sys, time, platform, requests, psutil, subprocess
from datetime import datetime

API_URL = "{server_url}/api/metrics"
DEVICE_TOKEN = "{token}"
INTERVAL = 5


def get_metrics():
    try:
        cpu = psutil.cpu_percent(interval=None)
        mem = psutil.virtual_memory().percent
        disk = psutil.disk_usage("/").percent
        net1 = psutil.net_io_counters()
        time.sleep(1)
        net2 = psutil.net_io_counters()

        return {{
            "token": DEVICE_TOKEN,
            "cpu": cpu,
            "memory": mem,
            "disk": disk,
            "upload": round((net2.bytes_sent-net1.bytes_sent)/1024, 2),
            "download": round((net2.bytes_recv-net1.bytes_recv)/1024, 2),
            "uptime": int(time.time() - psutil.boot_time())
        }}
    except Exception as e:
        print("Metric error:", e)
        return None


def send_loop():
    while True:
        data = get_metrics()
        if data:
            try:
                requests.post(API_URL, json=data, timeout=5)
            except Exception as e:
                print("Network error:", e)
        time.sleep(INTERVAL)


# -------- SERVICE INSTALLATION -------- #

def install_windows():
    py = sys.executable
    script = os.path.abspath(__file__)

    cmd = [
        "schtasks",
        "/Create",
        "/SC", "ONSTART",
        "/TN", "CloudMonitorAgent",
        "/TR", f'\\\"{{py}}\\\" \\\"{{script}}\\\"',
        "/RL", "HIGHEST"
    ]

    subprocess.call(" ".join(cmd), shell=True)
    print("Installed as Windows startup task")


def install_linux():
    service = f\"\"\"[Unit]
Description=Cloud Monitor Agent
After=network.target

[Service]
ExecStart=/usr/bin/python3 {{os.path.abspath(__file__)}}
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
\"\"\"

    path = "/etc/systemd/system/cloud-agent.service"
    with open(path, "w") as f:
        f.write(service)

    os.system("systemctl daemon-reload")
    os.system("systemctl enable cloud-agent")
    os.system("systemctl start cloud-agent")
    print("Installed as systemd service")


def install_mac():
    plist = f\"\"\"<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN"
"http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key><string>com.cloud.agent</string>
  <key>ProgramArguments</key>
  <array>
    <string>{{sys.executable}}</string>
    <string>{{os.path.abspath(__file__)}}</string>
  </array>
  <key>RunAtLoad</key><true/>
  <key>KeepAlive</key><true/>
</dict>
</plist>\"\"\"

    path = os.path.expanduser("~/Library/LaunchAgents/com.cloud.agent.plist")
    with open(path, "w") as f:
        f.write(plist)

    os.system(f"launchctl load {{path}}")
    print("Installed as macOS launchd service")


def install_service():
    os_name = platform.system().lower()

    if "windows" in os_name:
        install_windows()
    elif "linux" in os_name:
        install_linux()
    elif "darwin" in os_name:
        install_mac()
    else:
        print("Unsupported OS — running foreground")
        send_loop()


if __name__ == "__main__":
    if "--install" in sys.argv:
        install_service()
    else:
        send_loop()
"""

    return Response(
        code,
        mimetype="text/x-python",
        headers={
            "Content-Disposition": "attachment; filename=agent.py"
        }
    )

# ---------------- DASHBOARD DATA API ----------------
@app.route("/api/dashboard/<int:device_id>")
def dashboard_api(device_id):

    # check if any device has gone offline
    check_offline_devices()

    device = Device.query.get(device_id)
    if not device:
        return jsonify({"error": "Device not found"}), 404

    metrics = (
        Metric.query
        .filter_by(device_id=device_id)
        .order_by(Metric.timestamp.desc())
        .limit(50)
        .all()
    )

    data = [
    {
        "cpu": m.cpu_usage,
        "memory": m.memory_usage,
        "disk": m.disk_usage,
        "processes": m.processes,
        "upload": m.upload,
        "download": m.download,
        "uptime": m.uptime,
        "temp": m.temp,
        "timestamp": m.timestamp.strftime("%H:%M:%S")
    }
    for m in reversed(metrics)
    ]

    alerts = (
        Alert.query.filter_by(device_id=device_id)
        .order_by(Alert.created_at.desc())
        .limit(10)
        .all()
    )

    alert_data = [
        {
            "message": a.message,
            "severity": a.severity,
            "time": a.created_at.strftime("%H:%M:%S")
        }
        for a in alerts
    ]

    return jsonify({
        "device": device.name,
        "status": device.status,
        "metrics": data,
        "alerts": alert_data
    })


# ---------------- METRIC INGEST API ----------------
@app.route("/api/metrics", methods=["POST"])
def receive_metrics():
    data = request.json

    token = data.get("token")

    device = Device.query.filter_by(token=token).first()
    if not device:
        return jsonify({"error": "Invalid device token"}), 401

    cpu = data.get("cpu")
    memory = data.get("memory")
    disk = data.get("disk")
    processes = data.get("processes")
    upload = data.get("upload")
    download = data.get("download")
    uptime = data.get("uptime")
    temp = data.get("temp")
    per_core = data.get("per_core")

    metric = Metric(
        device_id=device.id,
        cpu_usage=cpu,
        memory_usage=memory,
        disk_usage=disk,
        processes=processes,
        upload=upload,
        download=download,
        uptime=uptime,
        temp=temp,
        per_core=str(per_core) if per_core else None
    )

    db.session.add(metric)

    # mark device alive
    device.last_seen = datetime.utcnow()
    device.status = "UP"

    alerts = []

    if cpu and cpu > 90:
        alerts.append(("High CPU usage", "HIGH"))

    if memory and memory > 85:
        alerts.append(("High Memory usage", "MEDIUM"))

    if disk and disk > 80:
        alerts.append(("Disk almost full", "MEDIUM"))

    if temp and temp > 80:
        alerts.append(("High CPU temperature", "HIGH"))

    for msg, sev in alerts:
        db.session.add(Alert(device_id=device.id, message=msg, severity=sev))

    db.session.commit()

    return jsonify({"message": "Metrics recorded", "alerts": len(alerts)})


@app.route("/insights")
def insights_page():
    return render_template("insight.html")


@app.route("/api/insights", methods=["POST"])
def ai_insights():
    data = request.json
    device_name = data.get("device")
    minutes = int(data.get("minutes", 30))

    device = Device.query.filter_by(name=device_name).first()
    if not device:
        return jsonify({"error": "Device not found"}), 404

    since = datetime.utcnow() - timedelta(minutes=minutes)

    metrics = (
        Metric.query
        .filter(Metric.device_id == device.id, Metric.timestamp >= since)
        .order_by(Metric.timestamp.asc())
        .all()
    )

    if not metrics:
        return jsonify({"error": "No data for selected range"}), 404

    # ---------- aggregation ----------
    import statistics as stats

    cpu_vals      = [m.cpu_usage for m in metrics if m.cpu_usage is not None]
    mem_vals      = [m.memory_usage for m in metrics if m.memory_usage is not None]
    disk_vals     = [m.disk_usage for m in metrics if m.disk_usage is not None]
    upload_vals   = [m.upload for m in metrics if m.upload is not None]
    download_vals = [m.download for m in metrics if m.download is not None]
    temp_vals     = [m.temp for m in metrics if m.temp is not None]

    summary = {
        "points": len(metrics),

        "cpu": {
            "avg": round(stats.mean(cpu_vals), 2) if cpu_vals else None,
            "max": max(cpu_vals) if cpu_vals else None,
            "min": min(cpu_vals) if cpu_vals else None,
        },

        "memory": {
            "avg": round(stats.mean(mem_vals), 2) if mem_vals else None,
            "max": max(mem_vals) if mem_vals else None,
            "min": min(mem_vals) if mem_vals else None,
        },

        "disk": {
            "current": disk_vals[-1] if disk_vals else None
        },

        "network": {
            "avg_upload": round(stats.mean(upload_vals), 2) if upload_vals else None,
            "avg_download": round(stats.mean(download_vals), 2) if download_vals else None,
        },

        "temperature": {
            "avg": round(stats.mean(temp_vals), 2) if temp_vals else None,
            "max": max(temp_vals) if temp_vals else None,
        }
    }

    # ---------- small recent sample (context only) ----------
    recent = [
        {
            "time": m.timestamp.strftime("%H:%M"),
            "cpu": m.cpu_usage,
            "memory": m.memory_usage,
            "upload": m.upload,
            "download": m.download
        }
        for m in metrics[-10:]
    ]

    prompt = f"""
You are an expert SRE/DevOps performance engineer.

Analyze this server health data for **{device_name}**.
Time window: last {minutes} minutes.

SUMMARY (aggregated):
{summary}

RECENT TIMELINE (last 10 points):
{recent}

Write a concise analysis:

1) Overall health
2) CPU / memory / disk comments
3) Network behavior
4) Anomalies or spikes
5) Possible causes
6) Clear, practical action steps (bullet points)

Avoid repeating numbers unnecessarily. Explain *patterns*.
"""

    try:
        model = genai.GenerativeModel("gemini-2.5-flash")
        result = model.generate_content(prompt)

        return jsonify({"insight": result.text})

    except Exception as e:
        return jsonify({"error": str(e)}), 500




@app.route("/history")
def history_page():
    return render_template("history.html")


@app.route("/api/history")
def history_api():
    device_id = request.args.get("device_id", type=int)
    minutes   = request.args.get("minutes", default=60, type=int)

    if not device_id:
        return jsonify({"error": "device_id required"}), 400

    device = Device.query.get(device_id)
    if not device:
        return jsonify({"error": "Device not found"}), 404

    since = datetime.utcnow() - timedelta(minutes=minutes)

    metrics = (
        Metric.query
        .filter(Metric.device_id == device_id,
                Metric.timestamp >= since)
        .order_by(Metric.timestamp.asc())
        .all()
    )

    if not metrics:
        return jsonify({"error": "No data"}), 404

    data = [{
        "time": m.timestamp.strftime("%H:%M"),
        "cpu": m.cpu_usage,
        "memory": m.memory_usage,
        "disk": m.disk_usage,
        "upload": m.upload,
        "download": m.download,
        "processes": m.processes,
        "temp": m.temp,
        "uptime": m.uptime
    } for m in metrics]

    return jsonify({
        "device": device.name,
        "points": len(data),
        "metrics": data
    })


# ---------------- RUN APP ----------------
if __name__ == "__main__":
    with app.app_context():
        db.create_all()

    app.run(debug=True)
