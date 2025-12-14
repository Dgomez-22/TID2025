# Sistema de Monitoreo Industrial Minero basado en Mesh (Edge Computing)

Este repositorio contiene el desarrollo de un sistema de monitoreo industrial en tiempo real basado en una red Mesh, orientado a escenarios con conectividad limitada o inexistente, como entornos subterráneos o mineros.

El sistema integra nodos de comunicación Mesh, un backend local que actúa como gateway y motor de procesamiento, y una interfaz web para la visualización en tiempo real de variables operacionales y alertas.

---

## Arquitectura General

La solución sigue una arquitectura cliente-servidor orientada a eventos, operando completamente en red local:

    Nodo Mesh (sensores / simulación)
    ↓
    Gateway Mesh (USB / Serial)
    ↓
    Edge Backend (FastAPI + Python)
    ↓ WebSocket
    Frontend Web (React + TypeScript)


El diseño desacopla completamente la adquisición de datos de su visualización, permitiendo escalar o modificar cada capa de manera independiente.

---

## Edge Computing

El sistema utiliza un enfoque de edge computing, en el cual el procesamiento de los datos y las decisiones básicas se realizan directamente en el equipo local que actúa como estación base, cercano a los nodos de la red. Esto permite analizar la información en el mismo lugar donde se generan los datos, sin depender de servicios externos o conexión a internet.

El backend ejecuta la lógica de validación, clasificación de estados y generación de alertas directamente en el borde de la red, evitando la dependencia de servicios en la nube y reduciendo significativamente la latencia de respuesta. Este enfoque resulta especialmente adecuado para entornos mineros subterráneos, donde la conectividad a Internet es prácticamente inexistente.

---

## Backend (Python / FastAPI)

El backend actúa como **gateway y motor de procesamiento**, cumpliendo las siguientes funciones:

- Recepción de mensajes desde la red Mesh mediante puerto serial.
- Decodificación de mensajes en formato JSON.
- Gestión del estado de cada máquina en memoria.
- Evaluación de umbrales operacionales.
- Generación y almacenamiento de alertas.
- Distribución de datos en tiempo real vía WebSocket.

---

### Tecnologías utilizadas

- **Python 3.x**
- **FastAPI** (WebSockets y API async)
- **meshtastic** (comunicación con nodos Mesh)
- **pypubsub** (manejo de eventos asíncronos)
- **asyncio** (concurrencia)
- **uvicorn** (servidor ASGI)

---

### Variables monitoreadas

Cada mensaje puede incluir las siguientes métricas:

- Temperatura
- Vibración
- Carga
- Identificador de máquina

---

### Lógica de clasificación de estados

El backend clasifica automáticamente el estado operacional de cada máquina según umbrales predefinidos:

- **CRITICAL**: valores que exceden exageradamente el rango recomendado.
- **WARNING**: valores sobre el rango recomendado.
- **OK**: operación normal.
- **OFFLINE**: Sin comunicación o pérdida de comunicación.

Las alertas se almacenan en memoria con un historial breve para evitar consumo excesivo de recursos.

---

### Ejecución del backend (Inicializar primero)

Desde la carpeta `backend`:

```bash
pip install -r requirements.txt
uvicorn gateway:app --reload --port 8000
```

---

### Frontend (React + TypeScript)

La interfaz web permite la visualización en tiempo real del estado de la maquinaria conectada al sistema.

Características principales:

- Actualización automática vía WebSocket (sin polling).
- Indicadores visuales de estado por máquina.
- KPIs agregados (máquinas online, temperatura promedio, alertas críticas).
- Visualización gráfica de temperatura, vibración y carga.
- Tabla detallada de máquinas y alertas.
- Manejo de reconexión automática ante caídas de conexión.

Tecnologías utilizadas:

- React
- TypeScript
- Vite
- Tailwind CSS
- shadcn/ui
- WebSocket API

---

### Ejecución del frontend (Inicializar segundo)

Desde la carpeta del frontend:

```bash
npm install # Solo la primera vez
npm run dev
```

La aplicación se ejecuta en http://localhost:{puerto}, donde el puerto es indicado por la consola al iniciar el servidor de desarrollo.

---

### Comunicación y Protocolo de Datos

La comunicación entre nodos y backend utiliza mensajes en formato JSON.
Ejemplo de payload procesado por el sistema:

{
  "machineId": "MACH-001",
  "temperature": 68,
  "vibration": 4.5,
  "load": 90
}

El backend valida, normaliza y procesa estos mensajes antes de distribuirlos a los clientes web.

Consideraciones de Diseño:

- El sistema opera completamente offline, sin dependencia de Internet.
- El procesamiento centralizado en el edge reduce latencia y complejidad.
- La arquitectura orientada a eventos mejora la escalabilidad y eficiencia.
- El frontend se mantiene liviano, delegando la lógica crítica al backend.

---

### Estado del proyecto

Este proyecto corresponde a un prototipo funcional, validado mediante pruebas de envío de datos reales y simulados, enfocado en demostrar la viabilidad de una arquitectura de monitoreo industrial basada en redes Mesh y edge computing.

---

### Posibles Extensiones Futuras

- Persistencia de datos en base de datos local.
- Autenticación de clientes WebSocket.
- Integración de modelos de detección de anomalías.
- Despliegue en hardware dedicado (edge device).
- Visualización histórica y análisis temporal.

---
