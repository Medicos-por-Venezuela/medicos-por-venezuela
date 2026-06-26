import dynamic from 'next/dynamic'
import Head from 'next/head'

const SalaInterna = dynamic(() => import('../components/SalaEsperaInterna'), { ssr: false })

export default function SalaEspera() {
  return (
    <>
      <Head><title>Sala de espera — Médicos por Venezuela</title></Head>
      <SalaInterna />
    </>
  )
}
