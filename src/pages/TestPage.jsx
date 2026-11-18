import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import './TestPage.css';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const fakeFetch = (value, ms) => sleep(ms).then(() => value);

async function runWithLimit(tasks, limit) {
  let result = [];
  let count = 0;

  async function worker() {
    console.log(tasks);
    const i = count++;

    // try {
    result[i] = await tasks[i]();
    // } catch {}
    if (count < tasks.length - 1) {
      worker();
    }
  }

  for (let i = 0; i < limit; i++) {
    worker();
  }
  console.log(result);
  return result;
}

async function check() {
  const lines = [];

  // 1. Порядок
  const t1 = [300, 100, 200].map((ms, i) => () => fakeFetch(i, ms));
  const r1 = await runWithLimit(t1, 2);
  lines.push(`Порядок: ${JSON.stringify(r1)} (ждём [0,1,2])`);

  // // 2. Пул, а не пачки
  // const start = performance.now();
  // await runWithLimit(
  //   [500, 100, 100, 100, 100].map((ms) => () => sleep(ms)),
  //   2,
  // );
  // lines.push(
  //   `Время: ${Math.round(performance.now() - start)} мс (ждём ≈500, пачками будет ≈700)`,
  // );

  // // 3. Ошибка
  // try {
  //   await runWithLimit(
  //     [() => sleep(50), () => Promise.reject(new Error('boom'))],
  //     2,
  //   );
  //   lines.push('Ошибка: не упало ❌');
  // } catch (e) {
  //   lines.push(`Ошибка: ${e.message} (ждём boom)`);
  // }

  // // 4. Крайние случаи
  // lines.push(`Пустой: ${JSON.stringify(await runWithLimit([], 3))} (ждём [])`);

  return lines.join('\n');
}

export const TestPage = () => {
  const [out, setOut] = useState('');

  useEffect(() => {
    check()
      .then(setOut)
      .catch((e) => setOut('Упало: ' + e.message));
  }, []);

  return (
    <div className='test-page'>
      <div className='test-page__inner'>
        <Link to='/' className='test-page__back'>
          ← карта
        </Link>
        <h1 className='test-page__title'>TestPage</h1>
        <pre className='test-page__out'>{out || '—'}</pre>
      </div>
    </div>
  );
};
