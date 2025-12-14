import json
import time
import asyncio
from typing import Dict, Any, List

import meshtastic
import meshtastic.serial_interface
from pubsub import pub

from fastapi import FastAPI, WebSocket
from fastapi.middleware.cors import CORSMiddleware

PORT = "COM3"

app = FastAPI()
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Estado en memoria
machines: Dict[str, Dict[str, Any]] = {}
alerts: List[Dict[str, Any]] = []
clients: List[WebSocket] = []

TEMP_LIMIT = 90
VIB_LIMIT = 10

# Event loop global para async tasks
loop = None


def now_str():
    return time.strftime("%Y-%m-%d %H:%M:%S")


def compute_status(m: Dict[str, Any]) -> str:
    if m.get("offline"):
        return "offline"
    t = m.get("temperature", 0)
    v = m.get("vibration", 0)
    load = m.get("load", 0)
    if t > 80 or load > 95 or v > 10:
        return "critical"
    if t > 70 or load > 85 or v > 7:
        return "warning"
    return "ok"


async def broadcast(payload: Dict[str, Any]):
    # Envía mensaje a todos los clientes conectados
    dead = []
    for ws in clients:
        try:
            await ws.send_text(json.dumps(payload))
        except Exception:
            dead.append(ws)

    # Limpia clientes
    for ws in dead:
        if ws in clients:
            clients.remove(ws)


def add_alert(machine_id: str, severity: str, description: str):
    alerts.append({
        "id": int(time.time() * 1000),
        "machineId": machine_id,
        "severity": severity,
        "description": description,
        "timestamp": now_str()
    })
    # Mantenemos máximo 200 alertas
    if len(alerts) > 200:
        del alerts[:-200]


def handle_payload(data: Dict[str, Any]):
    # Procesamos el payload del mensaje Meshtastic
    mid = data.get("machineId")
    if not mid:
        return

    # Obtenemos/creamos máquina
    m = machines.get(mid, {
        "id": mid,
        "name": mid,
        "type": data.get("type", "N/A"),
        "location": data.get("location", "N/A"),
        "temperature": 0,
        "vibration": 0,
        "load": 0,
        "status": "ok",
        "channel": "Mesh",
        "lastUpdate": now_str(),
    })

    # Manejamos eventos offline
    if data.get("event") == "offline":
        m["status"] = "offline"
        m["lastUpdate"] = now_str()
        machines[mid] = m
        add_alert(mid, "high", "Máquina sin comunicación (offline)")
        print(f"[OFFLINE] {mid}")
        return

    # Actualizamos métricas
    for k in ["temperature", "vibration", "load", "name", "type", "location"]:
        if k in data:
            m[k] = data[k]

    m["lastUpdate"] = now_str()
    m["status"] = compute_status(m)
    machines[mid] = m

    # Solo imprime si es que hay algún cambio crítico de status
    if m["status"] in ["critical", "warning"]:
        print(f"[{m['status'].upper()}] {mid} | T:{m['temperature']}°C V:{m['vibration']} L:{m['load']}%")

    # Generamos las alertas
    if m["temperature"] > 80:
        add_alert(mid, "high", "Temperatura muy elevada en la máquina")
    elif m["temperature"] > 70:
        add_alert(mid, "medium", "Temperatura sobre nivel recomendado")

    if m["vibration"] > 10:
        add_alert(mid, "high", "Vibración estructural severa detectada")
    elif m["vibration"] > 7:
        add_alert(mid, "medium", "Vibración por sobre el umbral normal")


# ---- Meshtastic receive callback ----
def on_receive(packet, interface):

    # Callback cuando llega un mensaje
    decoded = packet.get("decoded", {})
    text = decoded.get("text")

    if not text:
        return

    try:
        data = json.loads(text)
    except Exception:
        return

    # Procesamos el payload
    handle_payload(data)

    # Creamos el payload para broadcast
    payload = {
        "type": "update",
        "machines": list(machines.values()),
        "alerts": alerts[-50:],
    }

    # Enviamos a todos los clientes WS conectados
    if loop and clients:
        asyncio.run_coroutine_threadsafe(broadcast(payload), loop)


@app.on_event("startup")
async def startup():
    # Inicializamos Meshtastic al arrancar FastAPI
    global loop
    loop = asyncio.get_event_loop()

    print("Iniciando Meshtastic...")
    pub.subscribe(on_receive, "meshtastic.receive")

    try:
        meshtastic.serial_interface.SerialInterface(devPath=PORT)
        print(f"Conectado en {PORT}")
    except Exception as e:
        print(f"Error: {e}")


@app.websocket("/ws")
async def ws_endpoint(ws: WebSocket):
    # WebSocket endpoint para clientes frontend
    await ws.accept()
    clients.append(ws)

    print(f"Cliente conectado (total: {len(clients)})")

    # Enviamos snapshot inicial
    snapshot = {
        "type": "snapshot",
        "machines": list(machines.values()),
        "alerts": alerts[-50:],
    }
    await ws.send_text(json.dumps(snapshot))

    try:
        # Mantenemos conexión abierta
        while True:
            await ws.receive_text()
    except Exception:
        pass
    finally:
        if ws in clients:
            clients.remove(ws)
        print(f"Cliente desconectado (total: {len(clients)})")


#### uvicorn gateway:app --reload --port 8000 ####