import { useEffect, useState } from "react"
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

const TEMP_LIMIT = 90
const VIB_LIMIT = 10

// ----------------------
// Helpers
// ----------------------

const rand = (min: number, max: number) =>
  Math.round(min + Math.random() * (max - min))

const sample = <T,>(arr: T[]): T =>
  arr[Math.floor(Math.random() * arr.length)]

// ----------------------
// Base simulador
// ----------------------

const MACHINE_TYPES = [
  { type: "Perforadora jumbo", baseTemp: 65, baseVib: 5, baseLoad: 70 },
  { type: "Cinta transportadora", baseTemp: 45, baseVib: 3, baseLoad: 60 },
  { type: "Ventilador principal", baseTemp: 55, baseVib: 2, baseLoad: 50 },
  { type: "Bomba de agua", baseTemp: 50, baseVib: 4, baseLoad: 65 },
]

const LOCATIONS = [
  "Nivel -200 m",
  "Nivel -350 m",
  "Galería principal",
  "Zona de chancado",
  "Rampa de acceso",
]

const CHANNELS: ChannelType[] = ["Mesh"]

// ----------------------
// Simulación
// ----------------------

function generateMachines(count: number): Machine[] {
  const now = new Date()

  return Array.from({ length: count }, (_, i) => {
    const base = sample(MACHINE_TYPES)
    const temperature = base.baseTemp + rand(-5, 15)
    const vibration = base.baseVib + rand(-2, 5)
    const load = base.baseLoad + rand(-20, 25)

    let status: MachineStatus = "ok"
    if (temperature > 80 || load > 95 || vibration > 10) status = "critical"
    else if (temperature > 70 || load > 85 || vibration > 7) status = "warning"
    if (Math.random() < 0.05) status = "offline"

    const lastUpdateDate = new Date(now.getTime() - rand(0, 120) * 1000)

    return {
      id: `MACH-${String(i + 1).padStart(3, "0")}`,
      name: `${base.type} #${i + 1}`,
      type: base.type,
      location: sample(LOCATIONS),
      temperature,
      vibration,
      load,
      status,
      channel: sample(CHANNELS),
      lastUpdate: lastUpdateDate.toISOString().slice(0, 19).replace("T", " "),
    }
  })
}

function generateAlerts(machines: Machine[]): MachineAlert[] {
  const alerts: MachineAlert[] = []
  let id = 1
  const nowStr = new Date().toISOString().slice(0, 19).replace("T", " ")

  machines.forEach((m) => {
    if (m.temperature > 80)
      alerts.push({
        id: id++,
        machineId: m.id,
        severity: "high",
        description: "Temperatura muy elevada en la máquina",
        timestamp: nowStr,
      })
    else if (m.temperature > 70)
      alerts.push({
        id: id++,
        machineId: m.id,
        severity: "medium",
        description: "Temperatura sobre nivel recomendado",
        timestamp: nowStr,
      })

    if (m.vibration > 10)
      alerts.push({
        id: id++,
        machineId: m.id,
        severity: "high",
        description: "Vibración estructural severa detectada",
        timestamp: nowStr,
      })
    else if (m.vibration > 7)
      alerts.push({
        id: id++,
        machineId: m.id,
        severity: "medium",
        description: "Vibración por sobre el umbral normal",
        timestamp: nowStr,
      })

    if (m.status === "offline")
      alerts.push({
        id: id++,
        machineId: m.id,
        severity: "high",
        description:
          "Máquina sin comunicación (posible falla de energía o enlace)",
        timestamp: nowStr,
      })
  })

  return alerts
}

// ----------------------
// UI principal
// ----------------------

function App() {
  const [machines, setMachines] = useState<Machine[]>([])
  const [alerts, setAlerts] = useState<MachineAlert[]>([])
  const [tick, setTick] = useState(0)

  useEffect(() => {
    const simulate = () => {
      const m = generateMachines(6)
      const a = generateAlerts(m)

      setMachines(m)
      setAlerts(a)
      setTick((t) => t + 1)
    }

    simulate()
    const interval = setInterval(simulate, 5000)
    return () => clearInterval(interval)
  }, [])

  const criticalCount = alerts.filter((a) => a.severity === "high").length
  const onlineMachines = machines.filter((m) => m.status !== "offline")

  const avgTemp =
    machines.length > 0
      ? Math.round(
          machines.reduce((acc, m) => acc + m.temperature, 0) /
            machines.length
        )
      : null

  return (
    <div className="min-h-screen bg-black text-[#f5f5f5] flex items-start justify-center py-8 px-4">
      <Card className="w-full max-w-[1600px] bg-[#141414] rounded-2xl shadow-[0_0_40px_rgba(0,0,0,0.45)] border-0">
        <CardHeader className="pb-4">
          <CardTitle className="text-2xl font-semibold">
            Panel de monitoreo de maquinaria (simulación)
          </CardTitle>
          <p className="text-xs text-[#a3a3a3] mt-1">
            Datos simulados sobre red Mesh subterránea — Tick: {tick}
          </p>
        </CardHeader>

        <CardContent className="space-y-6">
          {/* KPIs */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-sm">
            <div className="rounded-xl bg-[#202020] px-4 py-3">
              <span className="text-[#a3a3a3] text-xs uppercase">
                Máquinas online
              </span>
              <div className="text-2xl font-semibold">
                {onlineMachines.length}
              </div>
              <div className="text-[#808080] text-xs">
                Total simuladas: {machines.length}
              </div>
            </div>

            <div className="rounded-xl bg-[#202020] px-4 py-3">
              <span className="text-[#a3a3a3] text-xs uppercase">
                Temp. promedio
              </span>
              <div className="text-2xl font-semibold">
                {avgTemp !== null ? `${avgTemp} °C` : "--"}
              </div>
              <div className="text-[#808080] text-xs">Lecturas actuales</div>
            </div>

            <div className="rounded-xl bg-[#202020] px-4 py-3">
              <span className="text-[#a3a3a3] text-xs uppercase">
                Alertas críticas
              </span>
              <div className="text-2xl font-semibold">{criticalCount}</div>
              <div className="text-[#808080] text-xs">
                Temp / Vibration / Offline
              </div>
            </div>
          </div>

          {/* PANEL DE GRÁFICOS */}
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
            {/* Temperatura (compact compact+) */}
            <div className="rounded-2xl bg-[#202020] px-4 py-4 space-y-3">
              <span className="text-[12px] text-[#a3a3a3] uppercase tracking-wide">
                Temperatura por máquina (límite {TEMP_LIMIT} °C)
              </span>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {machines.map((m) => {
                  const pct = Math.min(
                    100,
                    Math.round((m.temperature / TEMP_LIMIT) * 100)
                  )
                  const color =
                    pct >= 100 ? "#ef4444" : pct >= 80 ? "#f97316" : "#22c55e"

                  return (
                    <div
                      key={m.id}
                      className="bg-[#181818] rounded-xl px-3 py-2 space-y-2"
                    >
                      <div className="flex justify-between text-[11px] leading-none">
                        <span className="font-mono">{m.id}</span>
                        <span>{m.temperature} °C</span>
                      </div>

                      {/* Barra más grande */}
                      <div className="w-full h-3 bg-[#333] rounded-full overflow-hidden mt-1">
                        <div
                          className="h-full rounded-full"
                          style={{ width: `${pct}%`, backgroundColor: color }}
                        />
                      </div>

                      <div className="flex justify-between text-[10px] text-[#808080]">
                        <span className="truncate">{m.name}</span>
                        <span>{pct}%</span>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>

            {/* Vibración (compact compact+) */}
            <div className="rounded-2xl bg-[#202020] px-4 py-4 space-y-3">
              <span className="text-[12px] text-[#a3a3a3] uppercase tracking-wide">
                Vibración por máquina (umbral {VIB_LIMIT} mm/s)
              </span>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {machines.map((m) => {
                  const pct = Math.min(
                    100,
                    Math.round((m.vibration / VIB_LIMIT) * 100)
                  )
                  const color =
                    pct >= 100 ? "#ef4444" : pct >= 80 ? "#f97316" : "#22c55e"

                  return (
                    <div
                      key={m.id}
                      className="bg-[#181818] rounded-xl px-3 py-2 space-y-2"
                    >
                      <div className="flex justify-between text-[11px] leading-none">
                        <span className="font-mono">{m.id}</span>
                        <span>{m.vibration} mm/s</span>
                      </div>

                      {/* Barra más grande */}
                      <div className="w-full h-3 bg-[#333] rounded-full overflow-hidden mt-1">
                        <div
                          className="h-full rounded-full"
                          style={{ width: `${pct}%`, backgroundColor: color }}
                        />
                      </div>

                      <div className="flex justify-between text-[10px] text-[#808080]">
                        <span className="truncate">{m.name}</span>
                        <span>{pct}%</span>
                      </div>
                    </div>
                  )
                })}
              </div>
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
                    <th className="px-3 py-2 text-left">Estado</th>
                    <th className="px-3 py-2 text-left">Canal</th>
                    <th className="px-3 py-2 text-left">Actualización</th>
                  </tr>
                </thead>
                <tbody>
                  {machines.map((m) => (
                    <tr
                      key={m.id}
                      className="border-t border-[#2b2b2b] hover:bg-[#252525]/80 transition"
                    >
                      <td className="px-3 py-2 font-mono text-[11px]">
                        {m.id}
                      </td>
                      <td className="px-3 py-2">{m.location}</td>
                      <td className="px-3 py-2">{m.temperature}°C</td>
                      <td className="px-3 py-2">{m.vibration}</td>
                      <td className="px-3 py-2 capitalize">{m.status}</td>
                      <td className="px-3 py-2">{m.channel}</td>
                      <td className="px-3 py-2">{m.lastUpdate}</td>
                    </tr>
                  ))}
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
                  {alerts.length === 0 && (
                    <tr>
                      <td
                        colSpan={4}
                        className="px-3 py-3 text-center text-[#9d9d9d]"
                      >
                        No hay alertas actuales.
                      </td>
                    </tr>
                  )}

                  {alerts.map((a) => (
                    <tr
                      key={a.id}
                      className="border-t border-[#2b2b2b] hover:bg-[#252525]/80 transition"
                    >
                      <td className="px-3 py-2 font-mono text-[11px]">
                        {a.machineId}
                      </td>
                      <td className="px-3 py-2">{a.severity}</td>
                      <td className="px-3 py-2">{a.description}</td>
                      <td className="px-3 py-2">{a.timestamp}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

export default App