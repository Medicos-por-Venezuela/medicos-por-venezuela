// ESLint Flat Config (ESLint 9 + Next 16). Reemplaza al `.eslintrc.json` legacy: Next 16 removió
// `next lint` y su plugin usa flat config por defecto. Equivale a los antiguos
// extends ["next/core-web-vitals", "prettier"].
import next from 'eslint-config-next/core-web-vitals'
import prettier from 'eslint-config-prettier/flat'

export default [
  { ignores: ['.next/**', '.next-build/**', '.next-e2e/**', 'node_modules/**'] },
  ...next,
  prettier,
  {
    // Reglas NUEVAS del plugin react-hooks v6 que trae Next 16 (orientadas al React Compiler, que
    // NO habilitamos). No existían en eslint-config-next 14 y marcan patrones válidos del código
    // actual. Se degradan a warning para no bloquear el upgrade; abordar por separado (o arreglar
    // el código) si se adopta el React Compiler.
    rules: {
      'react-hooks/immutability': 'warn',
      'react-hooks/refs': 'warn',
      'react-hooks/set-state-in-effect': 'warn'
    }
  }
]
