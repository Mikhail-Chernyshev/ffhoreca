import React from 'react';
import { useState, useEffect } from 'react';
import { searchMerchants } from './api';
export default function MerchantAutocomplete({ onSelect }) {
  const [searchQuery, setSearchQuery] = useState('');
  const [search, setSearch] = useState('');
  const [merchants, setMerchants] = useState([]);
  const [error, setError] = useState(null);
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);

  useEffect(() => {
    const controller = new AbortController();
    async function load() {
      setLoading(true);
      setError(null);
      await searchMerchants(search, controller.signal)
        .then((data) => {
          setMerchants(data);
          setActiveIndex(-1);
        })
        .catch((e) => {
          if (e.name === 'AbortError') return;
          setError(e.message);
        })
        .finally(() => {
          if (!controller.signal.aborted) setLoading(false);
        });
    }
    if (!(search.trim() === '')) load();
    return () => controller.abort();
  }, [search]);

  useEffect(() => {
    if (searchQuery === '') {
      setIsOpen(false);
      onSelect('');
    }
    const timer = setTimeout(() => {
      setSearch(searchQuery);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);
  function renderContent() {
    if (loading) {
      return <li style={{ color: 'green' }}>Loading...</li>;
    }
    if (error) {
      return <li style={{ color: 'red' }}>{error}</li>;
    }
    if (merchants.length === 0) {
      return <li style={{}}>No results</li>;
    } else {
      return (
        <>
          {merchants.map((mer, index) => (
            <li
              key={mer}
              onClick={() => selectItem(mer)}
              style={{
                cursor: 'pointer',
                backgroundColor: activeIndex === index ? 'blue' : '',
              }}
            >
              {mer}
            </li>
          ))}
        </>
      );
    }
  }
  function selectItem(name) {
    setSearchQuery(name);
    setActiveIndex(-1);
    setIsOpen(false);
    onSelect(name);
  }
  function handleKeyDown(e) {
    // console.log(e);
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIndex((i) => Math.min(i + 1, merchants.length - 1));
    }

    if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex((i) => Math.max(i - 1, 0));
    }
    if (e.key === 'Enter') {
      if (activeIndex >= 0 && !loading) {
        selectItem(merchants[activeIndex]);
      } else {
        setIsOpen(false);
        setActiveIndex(-1);
        onSelect(searchQuery);
      }
    }
    if (e.key === 'Escape') {
      setActiveIndex(-1);
      setIsOpen(false);
    }
  }

  const delay = (ms) => new Promise((r) => setTimeout(r, ms));

  // сколько раз подряд падает загрузка каждого стема
  const failPlan = { drums: 0, bass: 2, vocals: 5, synth: 1 };
  const tries = {};
  let active = 0;

  function makeUpload(name, ms) {
    return () => {
      tries[name] = (tries[name] || 0) + 1;
      active++;
      console.log(`start ${name} try ${tries[name]} (active: ${active})`);
      return delay(ms).then(() => {
        active--;
        if (tries[name] <= failPlan[name])
          throw new Error(`${name} failed #${tries[name]}`);
        return `${name}.wav`;
      });
    };
  }

  const uploads = [
    makeUpload('drums', 200),
    makeUpload('bass', 100),
    makeUpload('vocals', 100),
    makeUpload('synth', 150),
  ];

  async function retry(fn, attempts) {
    let lastError;
    for (let i = 0; i < attempts; i++) {
      try {
        const result = await fn();
        return result;
      } catch (e) {
        lastError = e;
        if (i < attempts - 1) {
          await delay(300);
        }
      }
    }
    throw lastError;
  }

  function runWithLimit(tasks, limit) {
    const results = new Array(tasks.length);
    let nextIndex = 0;

    async function worker() {
      while (nextIndex < tasks.length) {
        const i = nextIndex;
        nextIndex++;
        try {
          results[i] = { status: 'fulfilled', value: await tasks[i]() };
        } catch (e) {
          results[i] = { status: 'rejected', reason: e };
        }
      }
    }
    const workers = [];

    for (let k = 0; k < limit; k++) {
      workers.push(worker());
    }

    return Promise.all(workers).then((data) => {
      return results;
    });
  }

  function uploadAll(tasks) {
    const newArray = tasks.map((e) => {
      return () => {
        return retry(e, 3);
      };
    });
    return runWithLimit(newArray, 2);
  }

  uploadAll(uploads).then((report) =>
    console.log(JSON.stringify(report, null, 2)),
  );
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
      <input
        placeholder='enter text'
        value={searchQuery}
        onChange={(e) => {
          setIsOpen(true);
          setSearchQuery(e.target.value);
        }}
        onKeyDown={handleKeyDown}
      />
      {isOpen && (
        <ul
          style={{
            position: 'absolute',
            backgroundColor: 'lightgray',
            margin: '24px 0 0 0 ',
          }}
        >
          {renderContent()}
        </ul>
      )}
    </div>
  );
}
