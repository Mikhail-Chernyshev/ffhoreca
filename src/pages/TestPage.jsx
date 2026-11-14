import { useState } from 'react'
import { Link } from 'react-router-dom'
import './TestPage.css'

export function TestPage() {
  const [out, setOut] = useState('')

  // пиши JS здесь

  return (
    <div className="test-page">
      <div className="test-page__inner">
        <Link to="/" className="test-page__back">
          ← карта
        </Link>
        <h1 className="test-page__title">TestPage</h1>
        <p className="test-page__hint">
          Код пиши в <code>src/pages/TestPage.jsx</code> внутри компонента.
          Чтобы увидеть результат на странице, вызови <code>setOut(...)</code>.
          Ещё можно смотреть консоль браузера.
        </p>
        <pre className="test-page__out">{out === '' ? '—' : String(out)}</pre>
      </div>
    </div>
  )
}
