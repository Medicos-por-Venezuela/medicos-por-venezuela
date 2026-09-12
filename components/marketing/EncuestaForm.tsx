// Formulario de las encuestas de marketing (psicólogos, especialistas, médicos generales). Una sola
// implementación para las tres: lo que cambia —textos, opciones, qué se pregunta— viene de
// `encuestas.ts`.
//
// El médico llega desde un correo masivo con su correo en el enlace (`?email=`, lo inserta la
// herramienta de envío). Se muestra de solo lectura, como en el diseño. Si el enlace no lo trae —la
// dirección se abrió a mano, o la herramienta no sustituyó la variable—, el campo pasa a ser editable
// en vez de dejar un formulario imposible de enviar.
//
// Estilos con styled-jsx, igual que el home: la paleta oscura del diseño queda acotada a esta
// página y no toca globals.css. Todo el JSX va en un solo árbol a propósito: styled-jsx solo le pone
// su clase de scope a los elementos del componente que declara el <style jsx>.
import Image from 'next/image'
import { FormEvent, Fragment, useState } from 'react'
import { ApiError } from '../../lib/apiClient'
import { useMountEffect, usePrefersReducedMotion } from '../../lib/hooks'
import { submitSurveyResponse } from '../../lib/marketing'
import { DAYS, MOMENTS, OTHER, Survey, TIMEZONE_GROUPS, WEEKLY_HOURS } from './encuestas'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

// El correo que trae el enlace, o '' si no trae uno válido.
//
// `URLSearchParams` decodifica `+` como espacio, así que un correo con alias (`ana+mpv@gmail.com`)
// que la herramienta de envío no haya codificado llegaría como `ana mpv@gmail.com`. Un correo no
// puede contener espacios: se devuelven a `+`.
export function emailFromQuery(search: string): string {
  const email = (new URLSearchParams(search).get('email') ?? '').trim().replace(/ /g, '+')
  return EMAIL_RE.test(email) ? email : ''
}

type Group = 'email' | 'roles' | 'moments' | 'days' | 'weeklyHours' | 'timezone'

// Ids de cada bloque, en orden visual: el primero que falle es al que se lleva el scroll.
const GROUP_IDS: Record<Group, string> = {
  email: 'grp-correo',
  roles: 'grp-rol',
  moments: 'grp-momento',
  days: 'grp-dia',
  weeklyHours: 'grp-frecuencia',
  timezone: 'grp-tz'
}

function toggle(list: string[], code: string): string[] {
  return list.includes(code) ? list.filter((c) => c !== code) : [...list, code]
}

function sendErrorMessage(err: unknown): string {
  if (err instanceof ApiError) {
    if (err.status === 429) {
      return 'Recibimos muchos envíos seguidos desde tu conexión. Espera un minuto y vuelve a intentarlo.'
    }
    // El backend explica en español qué falta (p. ej. la disponibilidad): se muestra tal cual.
    if (err.status === 400 || err.status === 422) return err.message
  }
  return 'No pudimos guardar tu respuesta. Revisa tu conexión e inténtalo de nuevo.'
}

export default function EncuestaForm({ survey }: { survey: Survey }) {
  const reducedMotion = usePrefersReducedMotion()

  // null = todavía no se leyó la URL (el HTML estático sale sin ella). Mientras tanto el campo se
  // pinta de solo lectura, como en el diseño, en vez de parpadear editable en la inmensa mayoría de
  // visitas, que sí traen el correo.
  const [emailFromLink, setEmailFromLink] = useState<boolean | null>(null)
  const [email, setEmail] = useState('')
  const [roles, setRoles] = useState<string[]>([])
  const [activeDetail, setActiveDetail] = useState('')
  const [otherDetail, setOtherDetail] = useState('')
  const [moments, setMoments] = useState<string[]>([])
  const [days, setDays] = useState<string[]>([])
  const [weeklyHours, setWeeklyHours] = useState('')
  const [availabilityNotes, setAvailabilityNotes] = useState('')
  const [timezone, setTimezone] = useState('')
  const [timezoneOther, setTimezoneOther] = useState('')
  const [notes, setNotes] = useState('')
  // Honeypot anti-bot: campo real (no type="hidden") que un humano nunca ve ni completa.
  const [website, setWebsite] = useState('')

  // Los errores se enseñan a partir del primer intento de envío y se recalculan en cada cambio: al
  // marcar la opción que faltaba, su aviso desaparece sin tener que volver a pulsar "Enviar".
  const [attempted, setAttempted] = useState(false)
  const [sending, setSending] = useState(false)
  const [sent, setSent] = useState(false)
  const [sendError, setSendError] = useState('')

  useMountEffect(() => {
    const fromLink = emailFromQuery(window.location.search)
    setEmail(fromLink)
    setEmailFromLink(fromLink !== '')
  })

  const asksAvailability =
    survey.availabilityRoles === null || roles.some((r) => survey.availabilityRoles.includes(r))

  const invalid: Group[] = []
  if (!EMAIL_RE.test(email.trim())) invalid.push('email')
  if (roles.length === 0) invalid.push('roles')
  if (asksAvailability) {
    if (moments.length === 0) invalid.push('moments')
    if (days.length === 0) invalid.push('days')
    if (!weeklyHours) invalid.push('weeklyHours')
  }
  if (survey.asksTimezone && !timezone) invalid.push('timezone')
  const shows = (group: Group) => attempted && invalid.includes(group)

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    if (sending || sent) return
    setAttempted(true)
    setSendError('')
    if (invalid.length > 0) {
      document
        .getElementById(GROUP_IDS[invalid[0]])
        ?.scrollIntoView({ behavior: reducedMotion ? 'auto' : 'smooth', block: 'center' })
      return
    }

    setSending(true)
    try {
      // Solo viaja lo que se preguntó: lo que el formulario oculta (la disponibilidad de quien solo
      // pide interconsultas, el texto de una "Otra" desmarcada) no se manda. El backend lo descarta
      // igualmente, pero así el payload dice lo mismo que la pantalla.
      await submitSurveyResponse(survey.slug, {
        email: email.trim(),
        roles,
        role_active_detail:
          survey.activeDetailRole && roles.includes(survey.activeDetailRole)
            ? activeDetail.trim() || null
            : null,
        role_other_detail: roles.includes(OTHER) ? otherDetail.trim() || null : null,
        moments: asksAvailability ? moments : [],
        days: asksAvailability ? days : [],
        weekly_hours: asksAvailability ? weeklyHours || null : null,
        availability_notes: asksAvailability ? availabilityNotes.trim() || null : null,
        timezone: survey.asksTimezone ? timezone || null : null,
        timezone_other:
          survey.asksTimezone && timezone === OTHER ? timezoneOther.trim() || null : null,
        notes: notes.trim() || null,
        website
      })
      setSent(true)
    } catch (err) {
      console.error(err)
      setSendError(sendErrorMessage(err))
    }
    setSending(false)
  }

  return (
    <div className="encuesta">
      <div className="stage">
        <div className="frame">
          <div className="sheet">
            <div className="flagbar" aria-hidden="true">
              <span className="y" />
              <span className="b" />
              <span className="r" />
            </div>
            <div className="masthead">
              <Image
                className="logo"
                src="/brand/logo-white.svg"
                alt="Médicos por Venezuela"
                width={104}
                height={40}
                unoptimized
              />
              <div className="divider" aria-hidden="true" />
              <div className="tagline">
                Conocimiento médico
                <br />
                al servicio de Venezuela
              </div>
            </div>

            <div className="wrap">
              <h1>Cuéntanos cómo quieres participar</h1>
              <p className="intro">{survey.intro}</p>

              <form onSubmit={onSubmit} noValidate>
                <div className={`field${shows('email') ? ' invalid' : ''}`} id={GROUP_IDS.email}>
                  <label htmlFor="correo">Tu correo</label>
                  <input
                    type="email"
                    id="correo"
                    name="email"
                    autoComplete="email"
                    value={email}
                    readOnly={emailFromLink !== false}
                    onChange={(e) => setEmail(e.target.value)}
                    aria-invalid={shows('email')}
                    aria-describedby={shows('email') ? 'err-correo' : undefined}
                  />
                  <p className="err" id="err-correo">
                    Escribe un correo válido.
                  </p>
                </div>

                <fieldset className={shows('roles') ? 'invalid' : undefined} id={GROUP_IDS.roles}>
                  <legend>
                    {survey.roleQuestion}
                    <span className="req">*</span>
                  </legend>
                  <p className="ayuda">Puedes marcar varias.</p>
                  {survey.roles.map((role) => {
                    const checked = roles.includes(role.code)
                    return (
                      <Fragment key={role.code}>
                        <label className={`opt${checked ? ' on' : ''}`}>
                          <input
                            type="checkbox"
                            name="rol"
                            value={role.code}
                            checked={checked}
                            onChange={() => setRoles((prev) => toggle(prev, role.code))}
                          />{' '}
                          {role.label}
                        </label>
                        {checked && role.code === survey.activeDetailRole && (
                          <div className="nested">
                            <input
                              type="text"
                              aria-label="Rol más activo: cuéntanos qué tienes en mente"
                              placeholder="Cuéntanos qué tienes en mente"
                              maxLength={500}
                              value={activeDetail}
                              onChange={(e) => setActiveDetail(e.target.value)}
                            />
                          </div>
                        )}
                        {checked && role.code === OTHER && (
                          <div className="nested">
                            <input
                              type="text"
                              aria-label="Otra forma: cuéntanos qué tienes en mente"
                              placeholder="Cuéntanos qué tienes en mente"
                              maxLength={500}
                              value={otherDetail}
                              onChange={(e) => setOtherDetail(e.target.value)}
                            />
                          </div>
                        )}
                      </Fragment>
                    )
                  })}
                  <p className="err">Selecciona al menos una opción.</p>
                </fieldset>

                {asksAvailability && (
                  // En médicos generales la disponibilidad es condicional y va en su propio bloque
                  // ("Tu disponibilidad"); en las otras dos se pregunta siempre, sin recuadro.
                  <div className={survey.availabilityRoles ? 'dispo-block' : undefined}>
                    {survey.availabilityRoles && <p className="lead">Tu disponibilidad</p>}

                    <fieldset
                      className={shows('moments') ? 'invalid' : undefined}
                      id={GROUP_IDS.moments}
                    >
                      <legend>
                        ¿En qué momento del día te resulta más fácil conectarte?
                        <span className="req">*</span>
                      </legend>
                      <p className="ayuda">{survey.momentHint}</p>
                      {MOMENTS.map((m) => {
                        const checked = moments.includes(m.code)
                        return (
                          <label key={m.code} className={`opt${checked ? ' on' : ''}`}>
                            <input
                              type="checkbox"
                              name="momento"
                              value={m.code}
                              checked={checked}
                              onChange={() => setMoments((prev) => toggle(prev, m.code))}
                            />{' '}
                            {m.label}
                          </label>
                        )
                      })}
                      <p className="err">Selecciona al menos una opción.</p>
                    </fieldset>

                    <fieldset className={shows('days') ? 'invalid' : undefined} id={GROUP_IDS.days}>
                      <legend>
                        ¿Qué días de la semana te quedan mejor?
                        <span className="req">*</span>
                      </legend>
                      <p className="ayuda">
                        Puedes marcar varios. Si es variable, cuéntanos más abajo, en el campo de
                        disponibilidad.
                      </p>
                      {DAYS.map((d) => {
                        const checked = days.includes(d.code)
                        return (
                          <label key={d.code} className={`opt${checked ? ' on' : ''}`}>
                            <input
                              type="checkbox"
                              name="dia"
                              value={d.code}
                              checked={checked}
                              onChange={() => setDays((prev) => toggle(prev, d.code))}
                            />{' '}
                            {d.label}
                          </label>
                        )
                      })}
                      <p className="err">Selecciona al menos una opción.</p>
                    </fieldset>

                    <fieldset
                      className={shows('weeklyHours') ? 'invalid' : undefined}
                      id={GROUP_IDS.weeklyHours}
                    >
                      <legend>
                        Disponibilidad: ¿cuántas horas a la semana podrías dedicar, aproximadamente?
                        <span className="req">*</span>
                      </legend>
                      <p className="ayuda">
                        Es un estimado para organizarnos, no una obligación fija.
                      </p>
                      {WEEKLY_HOURS.map((h) => {
                        const checked = weeklyHours === h.code
                        return (
                          <label key={h.code} className={`opt${checked ? ' on' : ''}`}>
                            <input
                              type="radio"
                              name="frecuencia"
                              value={h.code}
                              checked={checked}
                              onChange={() => setWeeklyHours(h.code)}
                            />{' '}
                            {h.label}
                          </label>
                        )
                      })}
                      <p className="err">Selecciona una opción.</p>
                    </fieldset>

                    <div className="field">
                      <label htmlFor="dispo-libre">
                        Si prefieres, descríbenos tu disponibilidad real con tus palabras{' '}
                        <span className="optional">Opcional</span>
                      </label>
                      <textarea
                        id="dispo-libre"
                        placeholder="Ej: martes y jueves en la noche, fines de semana variable."
                        maxLength={2000}
                        value={availabilityNotes}
                        onChange={(e) => setAvailabilityNotes(e.target.value)}
                      />
                    </div>
                  </div>
                )}

                {survey.asksTimezone && (
                  <div
                    className={`field${shows('timezone') ? ' invalid' : ''}`}
                    id={GROUP_IDS.timezone}
                  >
                    <label htmlFor="tz">
                      ¿Dónde estás?<span className="req">*</span>
                    </label>
                    <select
                      id="tz"
                      value={timezone}
                      onChange={(e) => setTimezone(e.target.value)}
                      aria-invalid={shows('timezone')}
                    >
                      <option value="" disabled>
                        Elige tu país o zona horaria
                      </option>
                      {TIMEZONE_GROUPS.map((group) => (
                        <optgroup key={group.label} label={group.label}>
                          {group.options.map((o) => (
                            <option key={o.code} value={o.code}>
                              {o.label}
                            </option>
                          ))}
                        </optgroup>
                      ))}
                    </select>
                    {timezone === OTHER && (
                      <div className="nested">
                        <input
                          type="text"
                          aria-label="Tu país o zona horaria"
                          placeholder="Cuéntanos cuál es tu país o zona horaria"
                          maxLength={200}
                          value={timezoneOther}
                          onChange={(e) => setTimezoneOther(e.target.value)}
                        />
                      </div>
                    )}
                    <p className="err">Elige tu país o zona horaria.</p>
                  </div>
                )}

                <div className="field">
                  <label htmlFor="notas">
                    ¿Algo más que debamos saber? <span className="optional">Opcional</span>
                  </label>
                  <textarea
                    id="notas"
                    placeholder="Por ejemplo: guardias rotativas, semanas alternas."
                    maxLength={2000}
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                  />
                </div>

                <input
                  type="text"
                  name="website"
                  className="trampa"
                  value={website}
                  onChange={(e) => setWebsite(e.target.value)}
                  tabIndex={-1}
                  autoComplete="off"
                  aria-hidden="true"
                />

                {attempted && invalid.length > 0 && (
                  <p className="submit-error" role="alert">
                    Por favor completa los campos marcados con * antes de enviar.
                  </p>
                )}
                {sendError && (
                  <p className="submit-error" role="alert">
                    {sendError}
                  </p>
                )}

                {!sent && (
                  <button type="submit" disabled={sending}>
                    {sending ? 'Enviando…' : 'Enviar mi respuesta'}
                  </button>
                )}
              </form>

              {sent && (
                <div className="done" role="status">
                  <p>{survey.thanks}</p>
                </div>
              )}

              <p className="foot">
                Tus datos son confidenciales y solo se usan para coordinar tu participación en
                Médicos por Venezuela.
              </p>

              <div className="footer-logo">
                <Image
                  className="logo-pie"
                  src="/brand/logo-white.svg"
                  alt=""
                  width={52}
                  height={20}
                  unoptimized
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* El fondo del body también, no solo el de la hoja: en móvil, el rebote del scroll dejaba
          ver el gris claro global por encima y por debajo de la página. `global` se retira al
          desmontar, así que no se queda pegado al navegar a otra ruta. */}
      <style jsx global>{`
        body {
          background: #0a1220;
        }
      `}</style>

      <style jsx>{`
        .encuesta {
          --ink: #e7ecf5;
          --ink-soft: #9fb0cb;
          --paper: #0a1220;
          --card-bg: #121b2e;
          --card-alt-bg: #101a2c;
          --accent: #5b93ff;
          --accent-soft: #1b2a47;
          --line: #233252;
          --danger: #ff8a80;
          --shadow: 0 2px 10px rgba(0, 0, 0, 0.3), 0 10px 28px rgba(0, 0, 0, 0.35);
          --flag-yellow: #ffcc00;
          --flag-blue: #0033a0;
          --flag-red: #cf142b;

          min-height: 100vh;
          background: var(--paper);
          color: var(--ink);
          /* Los controles nativos (flecha del select, su desplegable, la barra de scroll de los
             textarea) también en oscuro: sin esto Chrome abre un desplegable blanco. */
          color-scheme: dark;
          font-family:
            'Nunito Sans',
            ui-sans-serif,
            -apple-system,
            'Segoe UI',
            sans-serif;
          font-size: 16px;
          line-height: 1.6;
          -webkit-font-smoothing: antialiased;
        }
        .stage {
          padding: 40px 16px 64px;
          display: flex;
          justify-content: center;
        }
        .frame {
          width: 100%;
          max-width: 640px;
        }
        .sheet {
          background: var(--card-bg);
          border: 1px solid var(--line);
          border-radius: 14px;
          overflow: hidden;
          box-shadow: var(--shadow);
        }
        .flagbar {
          height: 5px;
          display: flex;
        }
        .flagbar span {
          flex: 1;
        }
        .flagbar .y {
          background: var(--flag-yellow);
        }
        .flagbar .b {
          background: var(--flag-blue);
        }
        .flagbar .r {
          background: var(--flag-red);
        }
        .masthead {
          position: relative;
          display: flex;
          align-items: center;
          gap: 16px;
          padding: 28px 36px 26px;
          background-color: #14213d;
          background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='54' height='54'%3E%3Cpath d='M27 6l4.9 10.4L43 18l-8 7.8 1.9 11.3L27 31.6l-9.9 5.5L19 25.8 11 18l11.1-1.6z' fill='%23FFFFFF' fill-opacity='0.05'/%3E%3C/svg%3E");
          background-repeat: repeat;
          background-size: 54px 54px;
        }
        .masthead::after {
          content: '';
          position: absolute;
          inset: 0;
          background: linear-gradient(180deg, transparent 55%, rgba(10, 16, 32, 0.28) 100%);
        }
        /* ':global()': next/image no recibe la clase de scope de styled-jsx (ver Navbar.tsx). */
        .masthead :global(.logo),
        .divider,
        .tagline {
          position: relative;
          z-index: 1;
        }
        .masthead :global(.logo) {
          display: block;
          height: 40px;
          width: auto;
        }
        .divider {
          width: 1px;
          height: 34px;
          background: rgba(255, 255, 255, 0.22);
          flex: none;
        }
        .tagline {
          font-size: 12.5px;
          font-weight: 800;
          letter-spacing: 0.04em;
          text-transform: uppercase;
          color: #afc2e8;
          line-height: 1.4;
          max-width: 22ch;
        }
        .wrap {
          padding: 36px 36px 44px;
        }
        h1 {
          font-weight: 900;
          font-size: clamp(24px, 4.5vw, 30px);
          line-height: 1.2;
          letter-spacing: -0.01em;
          margin: 0 0 12px;
          text-wrap: balance;
        }
        .intro {
          color: var(--ink-soft);
          font-size: 15.5px;
          max-width: 60ch;
          margin: 0 0 34px;
        }
        fieldset {
          border: 0;
          margin: 0 0 32px;
          padding: 0;
          min-width: 0;
        }
        legend {
          font-weight: 800;
          font-size: 15px;
          padding: 0;
          margin-bottom: 6px;
          color: var(--ink);
        }
        .ayuda {
          color: var(--ink-soft);
          font-size: 13.5px;
          margin: 0 0 14px;
        }
        .opt {
          display: flex;
          align-items: center;
          gap: 12px;
          border: 1px solid var(--line);
          border-radius: 8px;
          padding: 13px 16px;
          margin-bottom: 9px;
          cursor: pointer;
          background: var(--card-alt-bg);
          transition:
            border-color 0.15s,
            background-color 0.15s;
          font-size: 15px;
        }
        .opt:hover {
          border-color: #3a4e75;
        }
        .opt.on {
          border-color: var(--accent);
          background: var(--accent-soft);
        }
        .opt:has(input:focus-visible) {
          outline: 2px solid var(--accent);
          outline-offset: 2px;
        }
        input[type='checkbox'],
        input[type='radio'] {
          accent-color: var(--accent);
          width: 17px;
          height: 17px;
          margin: 0;
          padding: 0;
          flex: none;
        }
        .field label {
          display: block;
          font-weight: 800;
          font-size: 15px;
          margin-bottom: 6px;
          color: var(--ink);
        }
        input[type='email'],
        input[type='text'],
        textarea,
        select {
          width: 100%;
          font: inherit;
          color: var(--ink);
          background: var(--card-alt-bg);
          border: 1px solid var(--line);
          border-radius: 8px;
          padding: 12px 14px;
        }
        input:focus,
        textarea:focus,
        select:focus {
          outline: 2px solid var(--accent);
          outline-offset: 0;
          border-color: var(--accent);
        }
        input[readonly] {
          background: #0c1526;
          color: var(--ink-soft);
          cursor: default;
        }
        textarea {
          min-height: 96px;
          resize: vertical;
        }
        .field {
          margin-bottom: 32px;
        }
        .optional {
          font-weight: 400;
          color: var(--ink-soft);
          font-size: 13.5px;
        }
        .req {
          color: var(--danger);
          margin-left: 3px;
          font-weight: 800;
        }
        .err {
          display: none;
          color: var(--danger);
          font-size: 13.5px;
          margin: 8px 0 16px;
        }
        /* En un grupo de opciones el aviso va pegado a la última (que ya trae su margen). */
        fieldset .err {
          margin-top: -4px;
        }
        fieldset.invalid legend,
        .field.invalid > label {
          color: var(--danger);
        }
        fieldset.invalid .err,
        .field.invalid .err {
          display: block;
        }
        .field.invalid select,
        .field.invalid input {
          border-color: var(--danger);
        }
        .submit-error {
          background: #301418;
          border: 1px solid var(--danger);
          color: #ffc9c2;
          border-radius: 8px;
          padding: 14px 16px;
          margin: 0 0 18px;
          font-size: 14px;
          text-align: center;
        }
        .nested {
          margin: -2px 0 9px;
          padding: 5px 0 0;
        }
        .dispo-block {
          background: var(--card-alt-bg);
          border: 1px solid var(--line);
          border-radius: 10px;
          padding: 22px 22px 4px;
          margin: 0 0 32px;
        }
        .dispo-block .lead {
          font-size: 13px;
          font-weight: 800;
          letter-spacing: 0.03em;
          text-transform: uppercase;
          color: var(--ink-soft);
          margin: 0 0 18px;
        }
        .dispo-block fieldset:last-of-type {
          margin-bottom: 26px;
        }
        .trampa {
          position: absolute;
          left: -9999px;
          width: 1px;
          height: 1px;
          opacity: 0;
        }
        button {
          font: inherit;
          font-weight: 800;
          font-size: 15.5px;
          color: #fff;
          background: var(--accent);
          border: 0;
          border-radius: 8px;
          padding: 15px 28px;
          cursor: pointer;
          width: 100%;
          letter-spacing: 0.01em;
        }
        button:hover {
          background: #4a80e8;
        }
        button:disabled {
          opacity: 0.7;
          cursor: wait;
        }
        button:focus-visible {
          outline: 2px solid var(--ink);
          outline-offset: 2px;
        }
        .foot {
          margin-top: 22px;
          font-size: 13.5px;
          color: var(--ink-soft);
          text-align: center;
        }
        .done {
          border: 1px solid var(--accent);
          background: var(--accent-soft);
          border-radius: 8px;
          padding: 22px 24px;
          margin-top: 24px;
        }
        .done p {
          margin: 0;
          color: var(--ink);
        }
        .footer-logo {
          display: flex;
          justify-content: center;
          align-items: center;
          margin-top: 8px;
          padding-top: 22px;
          border-top: 1px solid var(--line);
        }
        .footer-logo :global(.logo-pie) {
          display: block;
          height: 20px;
          width: auto;
          opacity: 0.7;
        }
        @media (max-width: 520px) {
          .masthead {
            padding: 22px 22px 20px;
          }
          .wrap {
            padding: 28px 22px 34px;
          }
          h1 {
            font-size: 24px;
          }
        }
        @media (prefers-reduced-motion: reduce) {
          .opt {
            transition: none;
          }
        }
      `}</style>
    </div>
  )
}
