# Guía de Configuración: Sistema de Telemedicina de Emergencia (Twilio + Jitsi Meet)

Este documento detalla los pasos técnicos y operativos necesarios para desplegar una plataforma ligera de conexión médico-paciente optimizada para situaciones de crisis e infraestructura inestable.

---

## 1. Arquitectura del Flujo de Comunicación

Para garantizar la máxima velocidad de entrega y el menor consumo de datos en zonas afectadas, el sistema operará bajo el siguiente flujo:

```
[Paciente en App/Web] ──(Ingresa celular)──> [Tu Servidor (Backend)]
                                                     │
                                           (Genera link Jitsi único)
                                                     │
                                                     ▼
[Paciente recibe SMS/WA] <──(Envía link)─── [Twilio API]
         │
  (Clic en Link)
         │
         ▼
[Sala Jitsi en Navegador] <───────────────> [Médico en Panel de Control]
```

---

## 2. Configuración en Twilio

### Paso A: Creación de la Cuenta y Consola

1. Regístrate en [Twilio](https://www.twilio.com/). En entornos de emergencia, puedes iniciar con la capa de prueba de inmediato.
2. En tu consola principal, localiza y guarda las credenciales maestras:
   - **Account SID**
   - **Auth Token**

### Paso B: Configuración del Canal de WhatsApp

Para desarrollo inmediato o contingencias donde no se dispone de una cuenta de Meta Business verificada, se utilizará el Sandbox. Para producción masiva, se migrará a la API oficial.

#### Opción Rápida: Twilio Sandbox para WhatsApp (Ideal para validación/salida rápida)

1. Ve a **Messaging > Try it Out > Send a WhatsApp Message**.
2. Conecta tu número de prueba enviando el código de activación (`join <palabra-clave>`) al número asignado por Twilio.
3. Configura el **Webhook** de entrada en la sección de configuración del Sandbox si necesitas procesar respuestas automáticas.

#### Opción Producción: Registro de WhatsApp Business API (Alineado con Meta)

1. En la consola de Twilio, ve a **Messaging > Senders > WhatsApp Senders**.
2. Vincula tu cuenta de **Meta Business Manager**.
3. **Creación de Plantillas (Utility Templates):** Meta prohíbe enviar enlaces abiertos en mensajes iniciados por la aplicación sin una plantilla pre-aprobada. Debes registrar una plantilla de "Utilidad" con la siguiente estructura exacta:
   > _"Hola, somos el equipo de asistencia médica. Haz clic en el siguiente enlace para conectarte con un médico voluntario ahora mismo: {{1}}"_

---

## 3. Implementación de Jitsi Meet (Sin Servidores)

Jitsi Meet no requiere configuración de servidores, creación de credenciales ni APIs del lado del proveedor para instancias públicas.

### Lógica de Generación de Enlaces

Para evitar colisiones entre salas de pacientes distintos, los enlaces deben ser dinámicos, impredecibles y únicos. No utilices incrementos secuenciales (ej. `sala1`, `sala2`).

- **Estructura base:** `https://meet.jit.si/`
- **Esquema de nombrado seguro:** `vamed-[UUIDv4]` o `vamed-[Timestamp]-[HashCorto]`
- **Ejemplo de URL final:** `https://meet.jit.si/vamed-7f9a2b8c-1e3d-4f56-a7b8-c9d0e1f2a3b4`

---

## 4. Estructura del Backend (Código de Integración)

A continuación se presenta la lógica core en **Python** para procesar la solicitud, generar la sala de emergencias y disparar el mensaje vía Twilio de forma atómica.

```python
import os
import uuid
from twilio.rest import Client

def enviar_enlace_emergencia(numero_paciente):
    # 1. Inicializar cliente de Twilio con variables de entorno
    account_sid = os.environ.get('TWILIO_ACCOUNT_SID')
    auth_token = os.environ.get('TWILIO_AUTH_TOKEN')
    numero_twilio_wa = os.environ.get('TWILIO_WHATSAPP_NUMBER') # Ej: 'whatsapp:+14155238886'

    client = Client(account_sid, auth_token)

    # 2. Generar identificador único para la videollamada Jitsi
    id_sala = str(uuid.uuid4())
    url_jitsi = f"https://meet.jit.si/vamed-{id_sala}"

    # 3. Formatear número del paciente (Debe incluir código de país, ej: 'whatsapp:+584120000000')
    if not numero_paciente.startswith('whatsapp:'):
        numero_paciente = f"whatsapp:{numero_paciente}"

    # 4. Disparar el mensaje a través de la API
    try:
        mensaje = client.messages.create(
            body=f"Hola, somos el equipo de asistencia médica. Haz clic en el siguiente enlace para conectarte con un médico voluntario ahora mismo: {url_jitsi}",
            from_=numero_twilio_wa,
            to=numero_paciente
        )
        return {"status": "success", "sid": mensaje.sid, "url_llamada": url_jitsi}
    except Exception as e:
        return {"status": "error", "message": str(e)}
```

---

## 5. Consideraciones Técnicas Críticas (Infraestructura Venezuela)

1. **Optimización del Navegador Móvil (WebRTC):** Cuando el paciente abra el enlace desde WhatsApp, el navegador móvil le presentará la opción de descargar la App o usar la versión web. Debes instruir en la interfaz previa del sistema que seleccionen **"Continuar en el navegador"** para omitir descargas de megabytes críticos en redes móviles congestionadas.
2. **Soporte de Respaldo por SMS:** En situaciones de desastre, las redes de datos (3G/4G/LTE) suelen colapsar antes que la red de voz y SMS tradicional. Modifica el flujo para que, si el envío por WhatsApp falla o si el usuario reporta conectividad deficiente, Twilio despache el enlace vía **SMS convencional**. Jitsi seguirá funcionando si el paciente logra captar un mínimo de ancho de banda.
3. **Manejo de Permisos:** El mayor punto de abandono de llamadas WebRTC es el rechazo accidental de los permisos de cámara y micrófono en el smartphone. Incluye un paso visual simple en tu aplicación web explicándole al paciente que debe pulsar "Permitir" al abrir el enlace.
