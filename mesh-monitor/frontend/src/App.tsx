import { useEffect, useMemo, useRef, useState } from "react"
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card"

// ----------------------
// Tipos de datos
// ----------------------

type MachineStatus = "ok" | "warning" | "critical" | "offline"
type ChannelType = "Mesh"

type Machine = {
  id: string
  name: string
  type: string
  location: string
  temperature: number
  vibration: number
  load: number
  status: MachineStatus
  channel: ChannelType
  lastUpdate: string
}

type Severity = "low" | "medium" | "high"

type MachineAlert = {
  id: number
  machineId: string
  severity: Severity
  description: string
  timestamp: string
}

type WsPayload = {
  type: "snapshot" | "update"
  machines?: Machine[]
  alerts?: MachineAlert[]
}

type WsStatus = "connecting" | "connected" | "disconnected"

// ----------------------
// Constantes UI
// ----------------------

const TEMP_LIMIT = 90
const VIB_LIMIT = 10

// ----------------------
// Helpers
// ----------------------

const safeNumber = (v: unknown, fallback = 0) => {
  const n = typeof v === "number" ? v : Number(v)
  return Number.isFinite(n) ? n : fallback
}

const clamp = (n: number, min: number, max: number) => Math.max(min, Math.min(max, n))

const statusColor = (s: MachineStatus) => {
  if (s === "critical") return "#ef4444"
  if (s === "warning") return "#f97316"
  if (s === "offline") return "#a3a3a3"
  return "#22c55e"
}

const severityColor = (s: Severity) => {
  if (s === "high") return "#ef4444"
  if (s === "medium") return "#f97316"
  return "#22c55e"
}

// ----------------------
// App
// ----------------------

export default function App() {
  const [machines, setMachines] = useState<Machine[]>([])
  const [alerts, setAlerts] = useState<MachineAlert[]>([])
  const [tick, setTick] = useState(0)
  const [wsStatus, setWsStatus] = useState<WsStatus>("connecting")
  const [wsError, setWsError] = useState<string | null>(null)
  const [lastMsgAt, setLastMsgAt] = useState<string | null>(null)

  const wsRef = useRef<WebSocket | null>(null)
  const reconnectTimerRef = useRef<number | null>(null)

  useEffect(() => {
    const connect = () => {
      try {
        setWsStatus("connecting")
        setWsError(null)

        const ws = new WebSocket(`${window.location.protocol === 'https:' ? 'wss:' : 'ws:'}//${window.location.host}/ws`)
        wsRef.current = ws

        ws.onopen = () => {
          console.log("✅ WebSocket conectado")
          setWsStatus("connected")
          setWsError(null)
        }

        ws.onmessage = (event) => {
          const now = new Date().toISOString().slice(0, 19).replace("T", " ")
          setLastMsgAt(now)

          let payload: WsPayload | null = null
          try {
            payload = JSON.parse(event.data)
          } catch (err) {
            console.error("Error parsing mensaje WS:", err)
            return
          }

          if (!payload || typeof payload !== "object") return

          if (payload.type === "snapshot" || payload.type === "update") {
            const incomingMachines = Array.isArray(payload.machines) ? payload.machines : null
            const incomingAlerts = Array.isArray(payload.alerts) ? payload.alerts : null

            if (incomingMachines) {
              const cleaned = incomingMachines.map((m) => ({
                ...m,
                temperature: safeNumber(m.temperature),
                vibration: safeNumber(m.vibration),
                load: safeNumber(m.load),
                status: (m.status ?? "ok") as MachineStatus,
                channel: (m.channel ?? "Mesh") as ChannelType,
                lastUpdate: m.lastUpdate ?? "",
                name: m.name ?? m.id,
                type: m.type ?? "N/A",
                location: m.location ?? "N/A",
              }))

              cleaned.sort((a, b) => a.id.localeCompare(b.id))
              setMachines(cleaned)
            }

            if (incomingAlerts) {
              const cleanedA = incomingAlerts.map((a) => ({
                ...a,
                id: safeNumber(a.id) as number,
                severity: (a.severity ?? "low") as Severity,
                machineId: a.machineId ?? "",
                description: a.description ?? "",
                timestamp: a.timestamp ?? "",
              }))

              setAlerts(cleanedA)
            }

            setTick((t) => t + 1)
          }
        }

        ws.onerror = (err) => {
          console.error("❌ WebSocket error:", err)
          setWsError("Error de conexión WebSocket")
        }

        ws.onclose = () => {
          console.warn("🔌 WebSocket cerrado, reintentando en 2s...")
          setWsStatus("disconnected")
          wsRef.current = null

          if (reconnectTimerRef.current) {
            window.clearTimeout(reconnectTimerRef.current)
          }
          reconnectTimerRef.current = window.setTimeout(() => connect(), 2000)
        }
      } catch (e) {
        console.error("Error conectando WS:", e)
        setWsStatus("disconnected")
        setWsError(e instanceof Error ? e.message : "Error conectando WS")
        
        if (reconnectTimerRef.current) {
          window.clearTimeout(reconnectTimerRef.current)
        }
        reconnectTimerRef.current = window.setTimeout(() => connect(), 2000)
      }
    }

    connect()

    return () => {
      if (reconnectTimerRef.current) {
        window.clearTimeout(reconnectTimerRef.current)
      }
      if (wsRef.current) {
        wsRef.current.close()
      }
    }
  }, [])

  // KPIs
  const criticalCount = useMemo(
    () => alerts.filter((a) => a.severity === "high").length,
    [alerts]
  )

  const onlineMachines = useMemo(
    () => machines.filter((m) => m.status !== "offline"),
    [machines]
  )

  const avgTemp = useMemo(() => {
    if (machines.length === 0) return null
    const sum = machines.reduce((acc, m) => acc + safeNumber(m.temperature), 0)
    return Math.round(sum / machines.length)
  }, [machines])

  const wsBadge = useMemo(() => {
    if (wsStatus === "connected") return { label: "Conectado", color: "#22c55e" }
    if (wsStatus === "connecting") return { label: "Conectando", color: "#f97316" }
    return { label: "Desconectado", color: "#ef4444" }
  }, [wsStatus])

  const handleReconnect = () => {
    if (wsRef.current) {
      wsRef.current.close()
    }
    if (reconnectTimerRef.current) {
      window.clearTimeout(reconnectTimerRef.current)
      reconnectTimerRef.current = null
    }
  }

  return (
    <div className="min-h-screen bg-black text-[#f5f5f5] flex items-start justify-center py-8 px-4">
      <Card className="w-full max-w-[1600px] bg-[#141414] rounded-2xl shadow-[0_0_40px_rgba(0,0,0,0.45)] border-0">
        <CardHeader className="pb-4">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2">
            <div>
              <CardTitle className="text-2xl font-semibold">
                Panel de monitoreo de maquinaria (Meshtastic → WebSocket)
              </CardTitle>
              <p className="text-xs text-[#a3a3a3] mt-1">
                Red Mesh subterránea — Tick: {tick}
                {lastMsgAt ? ` — Último mensaje: ${lastMsgAt}` : ""}
              </p>
            </div>

            <div className="flex items-center gap-2">
              <div
                className="px-3 py-1 rounded-full text-xs"
                style={{ backgroundColor: "#202020", border: `1px solid ${wsBadge.color}` }}
              >
                <span style={{ color: wsBadge.color }}>●</span>{" "}
                <span className="text-[#d4d4d4]">{wsBadge.label}</span>
              </div>

              <button
                className="px-3 py-1 rounded-full text-xs bg-[#202020] border border-[#2b2b2b] hover:bg-[#252525] transition"
                onClick={handleReconnect}
              >
                Reintentar
              </button>
            </div>
          </div>

          {wsError && (
            <p className="text-xs mt-2" style={{ color: "#f97316" }}>
              {wsError}
            </p>
          )}
        </CardHeader>

        <CardContent className="space-y-6">
          {/* KPIs */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-sm">
            <div className="rounded-xl bg-[#202020] px-4 py-3">
              <span className="text-[#a3a3a3] text-xs uppercase">Máquinas online</span>
              <div className="text-2xl font-semibold">{onlineMachines.length}</div>
              <div className="text-[#808080] text-xs">Total: {machines.length}</div>
            </div>

            <div className="rounded-xl bg-[#202020] px-4 py-3">
              <span className="text-[#a3a3a3] text-xs uppercase">Temp. promedio</span>
              <div className="text-2xl font-semibold">
                {avgTemp !== null ? `${avgTemp} °C` : "--"}
              </div>
              <div className="text-[#808080] text-xs">Lecturas actuales</div>
            </div>

            <div className="rounded-xl bg-[#202020] px-4 py-3">
              <span className="text-[#a3a3a3] text-xs uppercase">Alertas críticas</span>
              <div className="text-2xl font-semibold">{criticalCount}</div>
              <div className="text-[#808080] text-xs">Temp / Vibración / Offline</div>
            </div>
          </div>

          {/* PANEL DE GRÁFICOS - 3 COLUMNAS */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {/* Temperatura */}
            <div className="rounded-2xl bg-[#202020] px-4 py-4 space-y-3">
              <span className="text-[12px] text-[#a3a3a3] uppercase tracking-wide">
                Temperatura por máquina (límite {TEMP_LIMIT} °C)
              </span>

              {machines.length === 0 ? (
                <div className="text-xs text-[#9d9d9d] py-6 text-center">
                  Sin datos aún. Esperando paquetes por WebSocket…
                </div>
              ) : (
                <div className="space-y-3">
                  {machines.map((m) => {
                    const pct = clamp(Math.round((m.temperature / TEMP_LIMIT) * 100), 0, 100)
                    const color = pct >= 100 ? "#ef4444" : pct >= 80 ? "#f97316" : "#22c55e"

                    return (
                      <div key={m.id} className="bg-[#181818] rounded-xl px-3 py-2 space-y-2">
                        <div className="flex justify-between text-[11px] leading-none">
                          <span className="font-mono">{m.id}</span>
                          <span>{m.temperature} °C</span>
                        </div>
                        <div className="w-full h-3 bg-[#333] rounded-full overflow-hidden mt-1">
                          <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: color }} />
                        </div>
                        <div className="flex justify-between text-[10px] text-[#808080]">
                          <span className="truncate">{m.name}</span>
                          <span>{pct}%</span>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>

            {/* Vibración */}
            <div className="rounded-2xl bg-[#202020] px-4 py-4 space-y-3">
              <span className="text-[12px] text-[#a3a3a3] uppercase tracking-wide">
                Vibración por máquina (umbral {VIB_LIMIT} mm/s)
              </span>

              {machines.length === 0 ? (
                <div className="text-xs text-[#9d9d9d] py-6 text-center">
                  Sin datos aún. Esperando paquetes por WebSocket…
                </div>
              ) : (
                <div className="space-y-3">
                  {machines.map((m) => {
                    const pct = clamp(Math.round((m.vibration / VIB_LIMIT) * 100), 0, 100)
                    const color = pct >= 100 ? "#ef4444" : pct >= 80 ? "#f97316" : "#22c55e"

                    return (
                      <div key={m.id} className="bg-[#181818] rounded-xl px-3 py-2 space-y-2">
                        <div className="flex justify-between text-[11px] leading-none">
                          <span className="font-mono">{m.id}</span>
                          <span>{m.vibration} mm/s</span>
                        </div>
                        <div className="w-full h-3 bg-[#333] rounded-full overflow-hidden mt-1">
                          <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: color }} />
                        </div>
                        <div className="flex justify-between text-[10px] text-[#808080]">
                          <span className="truncate">{m.name}</span>
                          <span>{pct}%</span>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>

            {/* Carga */}
            <div className="rounded-2xl bg-[#202020] px-4 py-4 space-y-3">
              <span className="text-[12px] text-[#a3a3a3] uppercase tracking-wide">
                Carga por máquina (límite 100%)
              </span>

              {machines.length === 0 ? (
                <div className="text-xs text-[#9d9d9d] py-6 text-center">
                  Sin datos aún. Esperando paquetes por WebSocket…
                </div>
              ) : (
                <div className="space-y-3">
                  {machines.map((m) => {
                    const pct = clamp(Math.round(m.load), 0, 100)
                    const color = pct >= 95 ? "#ef4444" : pct >= 85 ? "#f97316" : "#22c55e"

                    return (
                      <div key={m.id} className="bg-[#181818] rounded-xl px-3 py-2 space-y-2">
                        <div className="flex justify-between text-[11px] leading-none">
                          <span className="font-mono">{m.id}</span>
                          <span>{m.load}%</span>
                        </div>
                        <div className="w-full h-3 bg-[#333] rounded-full overflow-hidden mt-1">
                          <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: color }} />
                        </div>
                        <div className="flex justify-between text-[10px] text-[#808080]">
                          <span className="truncate">{m.name}</span>
                          <span>{pct}%</span>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Tablas lado a lado */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-4">
            {/* MAQUINARIA */}
            <div className="rounded-2xl bg-[#202020] overflow-y-auto max-h-[300px]">
              <table className="w-full text-xs md:text-sm">
                <thead className="bg-[#252525] text-[#d4d4d4] sticky top-0">
                  <tr>
                    <th className="px-3 py-2 text-left">Máquina</th>
                    <th className="px-3 py-2 text-left">Ubicación</th>
                    <th className="px-3 py-2 text-left">Temp</th>
                    <th className="px-3 py-2 text-left">Vibración</th>
                    <th className="px-3 py-2 text-left">Carga</th>
                    <th className="px-3 py-2 text-left">Estado</th>
                    <th className="px-3 py-2 text-left">Canal</th>
                    <th className="px-3 py-2 text-left">Actualización</th>
                  </tr>
                </thead>

                <tbody>
                  {machines.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="px-3 py-3 text-center text-[#9d9d9d]">
                        Sin máquinas aún.
                      </td>
                    </tr>
                  ) : (
                    machines.map((m) => (
                      <tr
                        key={m.id}
                        className="border-t border-[#2b2b2b] hover:bg-[#252525]/80 transition"
                      >
                        <td className="px-3 py-2 font-mono text-[11px]">{m.id}</td>
                        <td className="px-3 py-2">{m.location}</td>
                        <td className="px-3 py-2">{m.temperature}°C</td>
                        <td className="px-3 py-2">{m.vibration}</td>
                        <td className="px-3 py-2">{m.load}%</td>
                        <td className="px-3 py-2 capitalize">
                          <span
                            className="px-2 py-1 rounded-full text-[11px]"
                            style={{ backgroundColor: "#181818", color: statusColor(m.status) }}
                          >
                            {m.status}
                          </span>
                        </td>
                        <td className="px-3 py-2">{m.channel}</td>
                        <td className="px-3 py-2">{m.lastUpdate}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* ALERTAS */}
            <div className="rounded-2xl bg-[#202020] overflow-y-auto max-h-[300px]">
              <table className="w-full text-xs md:text-sm">
                <thead className="bg-[#252525] text-[#d4d4d4] sticky top-0">
                  <tr>
                    <th className="px-3 py-2 text-left">Máquina</th>
                    <th className="px-3 py-2 text-left">Severidad</th>
                    <th className="px-3 py-2 text-left">Descripción</th>
                    <th className="px-3 py-2 text-left">Fecha</th>
                  </tr>
                </thead>

                <tbody>
                  {alerts.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="px-3 py-3 text-center text-[#9d9d9d]">
                        No hay alertas actuales.
                      </td>
                    </tr>
                  ) : (
                    alerts.map((a) => (
                      <tr
                        key={a.id}
                        className="border-t border-[#2b2b2b] hover:bg-[#252525]/80 transition"
                      >
                        <td className="px-3 py-2 font-mono text-[11px]">{a.machineId}</td>
                        <td className="px-3 py-2">
                          <span
                            className="px-2 py-1 rounded-full text-[11px]"
                            style={{ backgroundColor: "#181818", color: severityColor(a.severity) }}
                          >
                            {a.severity}
                          </span>
                        </td>
                        <td className="px-3 py-2">{a.description}</td>
                        <td className="px-3 py-2">{a.timestamp}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}