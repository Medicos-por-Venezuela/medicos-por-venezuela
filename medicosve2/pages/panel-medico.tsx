import dynamic from 'next/dynamic'
import Head from 'next/head'

const PanelInterno = dynamic(() => import('../components/PanelMedicoInterno'), { ssr: false })

export default function PanelMedico() {
  return (
    <>
      <Head><title>Panel médico — Médicos por Venezuela</title></Head>
      <PanelInterno />
    </>
  )
}
