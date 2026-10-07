// Utilidad de audio para notificaciones sonoras en la PWA y Web.
// Utiliza la Web Audio API nativa para generar tonos armónicos («chimes»)
// profesionales y limpios sin requerir la descarga de ficheros pesados ni depender
// de códecs externos. Cumple estrictamente con la política de Autoplay de los navegadores.

let audioCtx: AudioContext | null = null
let isUnlocked = false

/**
 * Obtiene o inicializa la instancia única de AudioContext del navegador.
 */
function getAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null
  if (!audioCtx) {
    const AudioCtxClass =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
    if (AudioCtxClass) {
      audioCtx = new AudioCtxClass()
    }
  }
  return audioCtx
}

/**
 * Desbloquea el AudioContext en el primer gesto del usuario (clic, toque o teclado)
 * para satisfacer la Autoplay Policy de Chrome, Safari, Firefox y Edge.
 */
export function unlockAudio(): void {
  if (typeof window === 'undefined' || isUnlocked) return
  const ctx = getAudioContext()
  if (!ctx) return

  if (ctx.state === 'suspended') {
    ctx
      .resume()
      .then(() => {
        isUnlocked = true
      })
      .catch(() => {})
  } else {
    isUnlocked = true
  }
}

// Auto-registrar listener de desbloqueo en la primera interacción
if (typeof window !== 'undefined') {
  const events = ['click', 'touchstart', 'keydown']
  const onFirstInteraction = () => {
    unlockAudio()
    events.forEach((ev) => window.removeEventListener(ev, onFirstInteraction))
  }
  events.forEach((ev) => window.addEventListener(ev, onFirstInteraction, { passive: true }))
}

export type SoundKind = 'message' | 'alert' | 'success'

/**
 * Reproduce un sonido de notificación sutil y no invasivo.
 * @param kind Tipo de sonido: 'message' (dos notas D5->A5), 'alert' (tríada mayor C5->E5->G5), o 'success'.
 */
export function playNotificationSound(kind: SoundKind = 'message'): void {
  if (typeof window === 'undefined') return
  try {
    const ctx = getAudioContext()
    if (!ctx) return

    if (ctx.state === 'suspended') {
      ctx.resume().catch(() => {})
    }

    const now = ctx.currentTime

    if (kind === 'message') {
      // Tono suave tipo mensajería: D5 (587.33 Hz) rápido hacia A5 (880.00 Hz)
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()

      osc.type = 'sine'
      osc.frequency.setValueAtTime(587.33, now)
      osc.frequency.setValueAtTime(880.0, now + 0.08)

      gain.gain.setValueAtTime(0.001, now)
      gain.gain.linearRampToValueAtTime(0.2, now + 0.02)
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.4)

      osc.connect(gain)
      gain.connect(ctx.destination)

      osc.start(now)
      osc.stop(now + 0.42)
    } else if (kind === 'alert') {
      // Tríada ascendente C5 (523Hz) -> E5 (659Hz) -> G5 (784Hz)
      const tones = [523.25, 659.25, 783.99]
      tones.forEach((freq, idx) => {
        const osc = ctx.createOscillator()
        const gain = ctx.createGain()
        const startTime = now + idx * 0.12

        osc.type = 'triangle'
        osc.frequency.setValueAtTime(freq, startTime)

        gain.gain.setValueAtTime(0.001, startTime)
        gain.gain.linearRampToValueAtTime(0.22, startTime + 0.02)
        gain.gain.exponentialRampToValueAtTime(0.0001, startTime + 0.35)

        osc.connect(gain)
        gain.connect(ctx.destination)

        osc.start(startTime)
        osc.stop(startTime + 0.38)
      })
    } else {
      // Success / confirmación
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()

      osc.type = 'sine'
      osc.frequency.setValueAtTime(659.25, now)
      osc.frequency.exponentialRampToValueAtTime(987.77, now + 0.12)

      gain.gain.setValueAtTime(0.001, now)
      gain.gain.linearRampToValueAtTime(0.18, now + 0.02)
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.45)

      osc.connect(gain)
      gain.connect(ctx.destination)

      osc.start(now)
      osc.stop(now + 0.48)
    }
  } catch (err) {
    // Si la política de autoplay o el sistema bloquea el audio, continúa en silencio sin romper la UI.
    console.debug('Aviso sonoro no disponible:', err)
  }
}
