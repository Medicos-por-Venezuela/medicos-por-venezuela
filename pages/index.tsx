import Head from 'next/head'
import { useRouter } from 'next/router'
import { useEffect, useRef, useState } from 'react'

/* ---------- Inline SVG icons ---------- */

function LogoIcon() {
  return (
    <svg viewBox="0 0 48 48" width="40" height="40" aria-hidden="true">
      <path
        d="M24 3 7 9v13c0 11 7.4 18.6 17 23 9.6-4.4 17-12 17-23V9L24 3Z"
        fill="#1a3a6b"
        stroke="#F5C400"
        strokeWidth="2"
      />
      <path d="M24 16v14M17 23h14" stroke="#fff" strokeWidth="3.2" strokeLinecap="round" />
      <path
        d="M24 33.5c-3-2-6-4.2-6-7.4a3.1 3.1 0 0 1 6-1.1 3.1 3.1 0 0 1 6 1.1c0 3.2-3 5.4-6 7.4Z"
        fill="#F5C400"
      />
    </svg>
  )
}

function IconGlobe() {
  return (
    <svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="9" />
      <path d="M3 12h18M12 3c2.5 2.6 2.5 15.4 0 18M12 3c-2.5 2.6-2.5 15.4 0 18" />
    </svg>
  )
}
function IconUser() {
  return (
    <svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="8" r="4" />
      <path d="M4 21c0-4 3.6-7 8-7s8 3 8 7" />
    </svg>
  )
}
function IconClipboard() {
  return (
    <svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="6" y="4" width="12" height="17" rx="2" />
      <path d="M9 4a3 3 0 0 1 6 0M9 11h6M9 15h6" />
    </svg>
  )
}
function IconVideo() {
  return (
    <svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="6" width="13" height="12" rx="2" />
      <path d="M16 10.5 21 8v8l-5-2.5" />
    </svg>
  )
}
function IconDoctor() {
  return (
    <svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M6 4v5a6 6 0 0 0 12 0V4" />
      <path d="M6 4H4M18 4h2M18 14a4 4 0 0 1 4 4v2" />
      <circle cx="18" cy="11" r="2" />
    </svg>
  )
}
function IconCheck() {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
      <path d="m5 12 5 5L20 7" />
    </svg>
  )
}
function IconLock() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="5" y="11" width="14" height="10" rx="2" />
      <path d="M8 11V8a4 4 0 0 1 8 0v3" />
    </svg>
  )
}
function IconHeartbeat() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 12h4l2-5 3 9 2-4h7" />
    </svg>
  )
}
function IconBulb() {
  return (
    <svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 18h6M10 21h4" />
      <path d="M12 3a6 6 0 0 0-4 10.5c.8.8 1.3 1.6 1.5 2.5h5c.2-.9.7-1.7 1.5-2.5A6 6 0 0 0 12 3Z" />
    </svg>
  )
}

/* ---------- Scroll-reveal hook ---------- */

function useReveal<T extends HTMLElement>() {
  const ref = useRef<T>(null)
  const [shown, setShown] = useState(false)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    if (typeof IntersectionObserver === 'undefined') {
      setShown(true)
      return
    }
    const obs = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) {
            setShown(true)
            obs.unobserve(e.target)
          }
        })
      },
      { threshold: 0.15 }
    )
    obs.observe(el)
    return () => obs.disconnect()
  }, [])
  return { ref, className: `reveal${shown ? ' is-visible' : ''}` }
}

/* ---------- Data ---------- */

const STEPS = [
  {
    icon: <IconGlobe />,
    title: 'Entra a la plataforma',
    text: 'Ingresa a www.medicosporvenezuela.org',
  },
  {
    icon: <IconUser />,
    title: 'Haz clic en “Soy paciente”',
    text: 'Selecciona la opción para personas que necesitan hablar con un médico o psicólogo.',
  },
  {
    icon: <IconClipboard />,
    title: 'Completa tus datos',
    text: 'Llena tu información para solicitar apoyo.',
  },
  {
    icon: <IconVideo />,
    title: 'Únete a la teleconsulta',
    text: 'Cuando aparezca la opción, haz clic en “Unirse a la teleconsulta”.',
  },
  {
    icon: <IconDoctor />,
    title: 'Recibe atención médica y psicológica',
    text: 'Un médico o psicólogo te orientará de forma gratuita.',
  },
]

const REASONS = [
  'Ayuda a evitar el colapso de los hospitales.',
  'Permite orientar a muchas personas sin salir de casa.',
  'Ayuda a priorizar la atención presencial para quienes están heridos o necesitan valoración física urgente.',
  'También ofrece apoyo con especialistas en salud mental.',
]

/* ---------- Page ---------- */

export default function Home() {
  const router = useRouter()
  const [menuOpen, setMenuOpen] = useState(false)

  const goPaciente = () => router.push('/registro-paciente')
  const goPacienteLogin = () => router.push('/mi-caso')
  const goMedico = () => router.push('/registro-medico')
  const goMedicoLogin = () => router.push('/login-medico')

  const stepsReveal = useReveal<HTMLDivElement>()
  const whyReveal = useReveal<HTMLDivElement>()
  const heroReveal = useReveal<HTMLDivElement>()

  return (
    <>
      <Head>
        <title>Médicos por Venezuela — Teleconsultas gratuitas</title>
        <meta
          name="description"
          content="Atención médica y psicológica gratuita por teleconsulta. Médicos por Venezuela conecta pacientes con médicos y psicólogos voluntarios."
        />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>

      <div className="lp">
        {/* ---------- Floating trust banner ---------- 
        <div className="float-banner" role="note" aria-label="Servicio confidencial y disponible 24/7">
          <span className="fb-item">
            <IconLock /> Confidencial
          </span>
          <span className="fb-divider" aria-hidden="true" />
          <span className="fb-item">
            <IconHeartbeat /> Disponible 24/7
          </span>
        </div>*/}

        {/* ---------- Header / Nav ---------- */}
        <header className="nav">
          <div className="nav-inner">
            <a href="#inicio" className="brand" onClick={() => setMenuOpen(false)}>
              <LogoIcon />
              <span className="brand-name">Médicos por Venezuela</span>
            </a>

            <button
              className="nav-toggle"
              aria-label="Abrir menú"
              aria-expanded={menuOpen}
              onClick={() => setMenuOpen((v) => !v)}
            >
              <span />
              <span />
              <span />
            </button>

            <nav className={`nav-links${menuOpen ? ' open' : ''}`} onClick={() => setMenuOpen(false)}>
              <a href="#inicio">Inicio</a>
              <a href="#como-funciona">Cómo funciona</a>
              <a href="#por-que">¿Por qué usarlo?</a>
              <a href="#contacto">Contacto</a>
              <button className="nav-login" onClick={goPacienteLogin}>
                Seguir mi caso
              </button>
              <div className="nav-cta">
                <button className="btn-pill btn-blue" onClick={goPaciente}>
                  Soy Paciente
                </button>
                <button className="btn-pill btn-gold-outline" onClick={goMedico}>
                  Soy Médico
                </button>
              </div>
            </nav>
          </div>
        </header>

        {/* ---------- Hero ---------- */}
        <section id="inicio" className="hero">
          <div ref={heroReveal.ref} className={`hero-inner ${heroReveal.className}`}>
            <span className="pill">Incluye atención médica y psicológica</span>
            <h1 className="hero-title">
              ¿Necesitas atención médica o psicológica <span className="gold">gratuita</span>?
            </h1>
            <p className="hero-sub">
              Paso a paso para solicitar una teleconsulta en Médicos por Venezuela.
            </p>

            <div className="hero-cards">
              <div className="hcard">
                <div className="hcard-icon hcard-icon--blue">
                  <IconUser />
                </div>
                <h2>Soy Paciente</h2>
                <p>Necesito hablar con un médico o psicólogo.</p>
                <button className="btn-pill btn-blue btn-block" onClick={goPaciente}>
                  Solicitar consulta →
                </button>
                <button className="hcard-login" onClick={goPacienteLogin}>
                  ¿Ya solicitaste? <strong>Inicia sesión</strong>
                </button>
              </div>

              <div className="hcard">
                <div className="hcard-icon hcard-icon--gold">
                  <IconDoctor />
                </div>
                <h2>Soy Médico</h2>
                <p>Quiero ofrecer mi ayuda voluntaria.</p>
                <button className="btn-pill btn-gold-outline btn-block" onClick={goMedico}>
                  Registrarme →
                </button>
                <button className="hcard-login" onClick={goMedicoLogin}>
                  ¿Ya eres voluntario? <strong>Inicia sesión</strong>
                </button>
              </div>
            </div>
          </div>
        </section>

        {/* ---------- How it works ---------- */}
        <section id="como-funciona" className="section">
          <div className="section-head">
            <h2 className="section-title">¿Cómo funciona?</h2>
            <p className="section-lead">Solicita tu teleconsulta en cinco pasos sencillos.</p>
          </div>

          <div ref={stepsReveal.ref} className={`timeline ${stepsReveal.className}`}>
            {STEPS.map((s, i) => (
              <div className="step" key={i} style={{ transitionDelay: `${i * 90}ms` }}>
                <div className="step-num">{i + 1}</div>
                <div className="step-icon">{s.icon}</div>
                <div className="step-body">
                  <h3>{s.title}</h3>
                  <p>{s.text}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* ---------- Trust highlights ---------- */}
        <section className="trust">
          <div className="trust-inner">
            <div className="trust-card">
              <div className="trust-icon trust-icon--lock">
                <IconLock />
              </div>
              <div className="trust-body">
                <h3>100% Confidencial</h3>
                <p>
                  Tu información y tu consulta son privadas y seguras. Solo el médico o
                  psicólogo que te atiende puede verlas.
                </p>
              </div>
            </div>

            <div className="trust-card">
              <div className="trust-icon trust-icon--clock">
                <IconHeartbeat />
              </div>
              <div className="trust-body">
                <h3>Disponible 24/7</h3>
                <p>
                  Solicita tu teleconsulta a cualquier hora, todos los días. Siempre hay
                  voluntarios listos para ayudarte.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* ---------- Why use it ---------- */}
        <section id="por-que" className="section">
          <div ref={whyReveal.ref} className={`why ${whyReveal.className}`}>
            <div className="why-head">
              <div className="why-bulb">
                <IconBulb />
              </div>
              <h2>¿Por qué usar esta opción?</h2>
            </div>
            <ul className="why-list">
              {REASONS.map((r, i) => (
                <li key={i} style={{ transitionDelay: `${i * 80}ms` }}>
                  <span className="why-check">
                    <IconCheck />
                  </span>
                  <span>{r}</span>
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* ---------- Footer ---------- */}
        <footer id="contacto" className="footer">
          <div className="footer-inner">
            <div className="footer-brand">
              <LogoIcon />
              <span>Médicos por Venezuela</span>
            </div>
            <p className="footer-text">
              Servicio gratuito para personas que necesitan orientación médica y psicológica.
            </p>
            <div className="footer-badges">
              <span className="fbadge">
                <IconLock /> Confidencial
              </span>
              <span className="fbadge">
                <IconHeartbeat /> Disponible 24/7
              </span>
            </div>
            <a className="footer-site" href="https://www.medicosporvenezuela.org">
              www.medicosporvenezuela.org
            </a>
          </div>
        </footer>
      </div>

      {/* ---------- Scoped styles ---------- */}
      <style jsx global>{`
        html {
          scroll-behavior: smooth;
        }
      `}</style>

      <style jsx>{`
        .lp {
          --blue: #1a3a6b;
          --blue-deep: #122a4f;
          --gold: #f5c400;
          --gray: #f3f5f9;
          --ink: #1f2937;
          --muted: #5b6675;
          color: var(--ink);
          background: #fff;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Inter, Arial, sans-serif;
        }

        /* Floating trust banner */
        .float-banner {
          position: fixed;
          bottom: 18px;
          right: 18px;
          z-index: 60;
          display: inline-flex;
          align-items: center;
          gap: 12px;
          background: var(--blue);
          color: #fff;
          border: 1px solid rgba(255, 255, 255, 0.18);
          border-radius: 999px;
          padding: 9px 16px;
          font-size: 13px;
          font-weight: 700;
          box-shadow: 0 10px 28px rgba(8, 22, 48, 0.32);
        }
        .fb-item {
          display: inline-flex;
          align-items: center;
          gap: 7px;
          white-space: nowrap;
        }
        .fb-item :global(svg) {
          color: var(--gold);
          width: 16px;
          height: 16px;
        }
        .fb-divider {
          width: 1px;
          height: 16px;
          background: rgba(255, 255, 255, 0.28);
        }

        /* Nav */
        .nav {
          position: sticky;
          top: 0;
          z-index: 50;
          background: rgba(255, 255, 255, 0.92);
          backdrop-filter: saturate(180%) blur(10px);
          border-bottom: 1px solid #e8ecf3;
        }
        .nav-inner {
          max-width: 1140px;
          margin: 0 auto;
          padding: 12px 20px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 16px;
        }
        .brand {
          display: flex;
          align-items: center;
          gap: 10px;
          font-weight: 800;
        }
        .brand-name {
          color: var(--blue);
          font-size: 17px;
          letter-spacing: -0.2px;
        }
        .nav-links {
          display: flex;
          align-items: center;
          gap: 22px;
        }
        .nav-links a {
          color: #33415a;
          font-size: 15px;
          font-weight: 600;
          transition: color 0.15s;
        }
        .nav-links a:hover {
          color: var(--blue);
        }
        .nav-cta {
          display: flex;
          gap: 10px;
        }
        .nav-login {
          background: none;
          border: none;
          color: var(--blue);
          font-size: 15px;
          font-weight: 700;
          cursor: pointer;
          padding: 6px 2px;
          transition: color 0.15s;
        }
        .nav-login:hover {
          color: var(--gold);
        }
        .nav-toggle {
          display: none;
          flex-direction: column;
          gap: 5px;
          background: none;
          border: none;
          padding: 6px;
        }
        .nav-toggle span {
          width: 24px;
          height: 2.5px;
          background: var(--blue);
          border-radius: 2px;
        }

        /* Buttons */
        .btn-pill {
          border-radius: 999px;
          padding: 10px 18px;
          font-size: 14px;
          font-weight: 700;
          border: 2px solid transparent;
          transition: transform 0.12s ease, box-shadow 0.15s ease, background 0.15s,
            color 0.15s;
          white-space: nowrap;
        }
        .btn-pill:hover {
          transform: translateY(-1px);
        }
        .btn-blue {
          background: var(--blue);
          color: #fff;
          box-shadow: 0 6px 16px rgba(26, 58, 107, 0.25);
        }
        .btn-blue:hover {
          background: var(--blue-deep);
        }
        .btn-gold-outline {
          background: #fff;
          color: var(--blue);
          border-color: var(--gold);
        }
        .btn-gold-outline:hover {
          background: var(--gold);
          color: var(--blue);
        }
        .btn-block {
          width: 100%;
          padding: 13px 18px;
          font-size: 15px;
        }

        /* Hero */
        .hero {
          background: radial-gradient(
              1200px 500px at 80% -10%,
              rgba(245, 196, 0, 0.18),
              transparent 60%
            ),
            linear-gradient(135deg, var(--blue) 0%, var(--blue-deep) 100%);
          color: #fff;
          padding: 64px 20px 76px;
        }
        .hero-inner {
          max-width: 1000px;
          margin: 0 auto;
          text-align: center;
        }
        .pill {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          background: rgba(255, 255, 255, 0.12);
          border: 1px solid rgba(255, 255, 255, 0.28);
          color: #fff;
          border-radius: 999px;
          padding: 7px 16px;
          font-size: 13px;
          font-weight: 600;
          margin-bottom: 20px;
        }
        .hero-title {
          font-size: clamp(28px, 5vw, 46px);
          line-height: 1.12;
          font-weight: 800;
          margin: 0 auto 14px;
          max-width: 760px;
          letter-spacing: -0.5px;
        }
        .gold {
          color: var(--gold);
        }
        .hero-sub {
          font-size: clamp(15px, 2.2vw, 18px);
          color: rgba(255, 255, 255, 0.85);
          max-width: 560px;
          margin: 0 auto 36px;
        }
        .hero-cards {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 20px;
          max-width: 720px;
          margin: 0 auto;
        }
        .hcard {
          background: #fff;
          color: var(--ink);
          border-radius: 20px;
          padding: 28px 24px;
          text-align: center;
          box-shadow: 0 20px 45px rgba(8, 22, 48, 0.28);
        }
        .hcard-icon {
          width: 60px;
          height: 60px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          margin: 0 auto 14px;
        }
        .hcard-icon--blue {
          background: #e8effb;
          color: var(--blue);
        }
        .hcard-icon--gold {
          background: #fff5d1;
          color: #b8870b;
        }
        .hcard h2 {
          font-size: 20px;
          font-weight: 800;
          margin: 0 0 8px;
        }
        .hcard p {
          font-size: 14px;
          color: var(--muted);
          margin: 0 0 20px;
          min-height: 40px;
        }
        .hcard-login {
          display: block;
          width: 100%;
          margin-top: 12px;
          background: none;
          border: none;
          color: var(--muted);
          font-size: 14px;
          cursor: pointer;
          transition: color 0.15s;
        }
        .hcard-login strong {
          color: var(--blue);
          text-decoration: underline;
          text-underline-offset: 2px;
        }
        .hcard-login:hover strong {
          color: var(--gold);
        }

        /* Trust highlights */
        .trust {
          max-width: 1000px;
          margin: 0 auto;
          padding: 56px 20px 0;
        }
        .trust-inner {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 20px;
        }
        .trust-card {
          display: flex;
          align-items: flex-start;
          gap: 18px;
          background: #fff;
          border: 1px solid #e8ecf3;
          border-left: 5px solid var(--gold);
          border-radius: 18px;
          padding: 24px 26px;
          box-shadow: 0 14px 34px rgba(8, 22, 48, 0.08);
        }
        .trust-icon {
          flex-shrink: 0;
          width: 54px;
          height: 54px;
          border-radius: 14px;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .trust-icon :global(svg) {
          width: 26px;
          height: 26px;
        }
        .trust-icon--lock {
          background: #e8effb;
          color: var(--blue);
        }
        .trust-icon--clock {
          background: #fff5d1;
          color: #b8870b;
        }
        .trust-body h3 {
          margin: 0 0 6px;
          font-size: 19px;
          font-weight: 800;
          color: var(--blue);
        }
        .trust-body p {
          margin: 0;
          font-size: 14.5px;
          line-height: 1.5;
          color: var(--muted);
        }

        /* Sections */
        .section {
          max-width: 1000px;
          margin: 0 auto;
          padding: 72px 20px;
        }
        .section-head {
          text-align: center;
          margin-bottom: 44px;
        }
        .section-title {
          font-size: clamp(24px, 4vw, 34px);
          font-weight: 800;
          color: var(--blue);
          margin: 0 0 10px;
          letter-spacing: -0.4px;
        }
        .section-lead {
          color: var(--muted);
          font-size: 16px;
          margin: 0;
        }

        /* Timeline */
        .timeline {
          position: relative;
          display: grid;
          gap: 18px;
        }
        .timeline::before {
          content: '';
          position: absolute;
          left: 27px;
          top: 10px;
          bottom: 10px;
          width: 2px;
          background: linear-gradient(var(--gold), #e8ecf3);
        }
        .step {
          position: relative;
          display: grid;
          grid-template-columns: 56px 56px 1fr;
          align-items: center;
          gap: 16px;
          background: var(--gray);
          border: 1px solid #e8ecf3;
          border-radius: 16px;
          padding: 18px 20px;
        }
        .step-num {
          width: 36px;
          height: 36px;
          border-radius: 50%;
          background: var(--blue);
          color: #fff;
          font-weight: 800;
          font-size: 16px;
          display: flex;
          align-items: center;
          justify-content: center;
          box-shadow: 0 0 0 5px var(--gray);
          z-index: 1;
        }
        .step-icon {
          width: 48px;
          height: 48px;
          border-radius: 14px;
          background: #fff;
          color: var(--blue);
          display: flex;
          align-items: center;
          justify-content: center;
          border: 1px solid #e3e8f1;
        }
        .step-body h3 {
          margin: 0 0 3px;
          font-size: 17px;
          font-weight: 700;
          color: var(--blue);
        }
        .step-body p {
          margin: 0;
          font-size: 14.5px;
          color: var(--muted);
        }

        /* Why */
        .why {
          background: linear-gradient(135deg, var(--blue) 0%, var(--blue-deep) 100%);
          color: #fff;
          border-radius: 24px;
          padding: 40px 36px;
          box-shadow: 0 24px 50px rgba(8, 22, 48, 0.22);
        }
        .why-head {
          display: flex;
          align-items: center;
          gap: 16px;
          margin-bottom: 24px;
        }
        .why-bulb {
          width: 54px;
          height: 54px;
          border-radius: 50%;
          background: var(--gold);
          color: var(--blue);
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
        }
        .why-head h2 {
          font-size: clamp(20px, 3.4vw, 28px);
          font-weight: 800;
          margin: 0;
        }
        .why-list {
          list-style: none;
          margin: 0;
          padding: 0;
          display: grid;
          gap: 16px;
        }
        .why-list li {
          display: flex;
          align-items: flex-start;
          gap: 14px;
          font-size: 15.5px;
          line-height: 1.5;
          color: rgba(255, 255, 255, 0.92);
        }
        .why-check {
          flex-shrink: 0;
          width: 28px;
          height: 28px;
          border-radius: 50%;
          background: var(--gold);
          color: var(--blue);
          display: flex;
          align-items: center;
          justify-content: center;
          margin-top: 1px;
        }

        /* Footer */
        .footer {
          background: var(--blue-deep);
          color: #fff;
          padding: 48px 20px;
        }
        .footer-inner {
          max-width: 900px;
          margin: 0 auto;
          text-align: center;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 16px;
        }
        .footer-brand {
          display: flex;
          align-items: center;
          gap: 10px;
          font-weight: 800;
          font-size: 17px;
        }
        .footer-text {
          color: rgba(255, 255, 255, 0.78);
          font-size: 15px;
          max-width: 520px;
          margin: 0;
        }
        .footer-badges {
          display: flex;
          gap: 12px;
          flex-wrap: wrap;
          justify-content: center;
        }
        .fbadge {
          display: inline-flex;
          align-items: center;
          gap: 7px;
          background: rgba(255, 255, 255, 0.1);
          border: 1px solid rgba(255, 255, 255, 0.2);
          border-radius: 999px;
          padding: 7px 15px;
          font-size: 13.5px;
          font-weight: 600;
        }
        .fbadge :global(svg) {
          color: var(--gold);
        }
        .footer-site {
          color: var(--gold);
          font-weight: 700;
          font-size: 14.5px;
        }

        /* Reveal animations */
        .reveal {
          opacity: 0;
          transform: translateY(24px);
          transition: opacity 0.6s ease, transform 0.6s ease;
        }
        .reveal.is-visible {
          opacity: 1;
          transform: none;
        }
        .timeline.reveal .step,
        .why.reveal .why-list li {
          opacity: 0;
          transform: translateY(18px);
          transition: opacity 0.55s ease, transform 0.55s ease;
        }
        .timeline.reveal.is-visible .step,
        .why.reveal.is-visible .why-list li {
          opacity: 1;
          transform: none;
        }

        @media (prefers-reduced-motion: reduce) {
          .reveal,
          .timeline.reveal .step,
          .why.reveal .why-list li {
            opacity: 1 !important;
            transform: none !important;
            transition: none !important;
          }
        }

        /* Responsive */
        @media (max-width: 620px) {
          .float-banner {
            left: 50%;
            right: auto;
            transform: translateX(-50%);
          }
          .trust-inner {
            grid-template-columns: 1fr;
          }
        }

        @media (max-width: 860px) {
          .nav-toggle {
            display: flex;
          }
          .nav-links {
            position: absolute;
            top: 100%;
            left: 0;
            right: 0;
            background: #fff;
            border-bottom: 1px solid #e8ecf3;
            flex-direction: column;
            align-items: stretch;
            gap: 4px;
            padding: 12px 20px 18px;
            box-shadow: 0 14px 30px rgba(8, 22, 48, 0.12);
            display: none;
          }
          .nav-links.open {
            display: flex;
          }
          .nav-links a {
            padding: 10px 4px;
            border-bottom: 1px solid #f0f3f8;
          }
          .nav-login {
            text-align: left;
            padding: 10px 4px;
            border-bottom: 1px solid #f0f3f8;
          }
          .nav-cta {
            margin-top: 10px;
            flex-direction: column;
          }
          .nav-cta .btn-pill {
            width: 100%;
            padding: 13px;
          }
        }

        @media (max-width: 620px) {
          .hero-cards {
            grid-template-columns: 1fr;
          }
          .hcard p {
            min-height: 0;
          }
          .step {
            grid-template-columns: 44px 1fr;
            gap: 12px;
          }
          .step-icon {
            display: none;
          }
          .timeline::before {
            left: 21px;
          }
          .why {
            padding: 32px 22px;
          }
        }
      `}</style>
    </>
  )
}
