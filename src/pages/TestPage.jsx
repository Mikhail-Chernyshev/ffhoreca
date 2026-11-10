import React from 'react';
import { fetchTransactions } from './Test/api';
import { useState, useEffect } from 'react';
import MerchantAutocomplete from './Test/MerchantAutocomplete';
function formatDate(iso) {
  return new Date(iso).toLocaleDateString('en-US', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}
function formatMoney(minorUnits, currency, locale) {
  const formatter = new Intl.NumberFormat(locale, {
    style: 'currency',
    currency,
  });
  const digits = formatter.resolvedOptions().maximumFractionDigits;
  return formatter.format(minorUnits / 10 ** digits);
}
function TestPage() {
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [reloadKey, setReloadKey] = useState(0);
  const [search, setSearch] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [status, setStatus] = useState('all');

  useEffect(() => {
    const controller = new AbortController();
    async function load() {
      setLoading(true);
      setError(null);
      await fetchTransactions({ search, status, page }, controller.signal)
        .then((data) => {
          setTransactions(data.items);
          setTotal(data.total);
          // console.log(data);
        })
        .catch((e) => {
          if (e.name === 'AbortError') return;
          setError(e.message);
        })
        .finally(() => {
          if (!controller.signal.aborted) setLoading(false);
        });
    }
    load();
    return () => controller.abort();
  }, [page, reloadKey, search, status]);

  function retry() {
    setReloadKey((k) => k + 1);
  }

  function renderContent() {
    if (loading && transactions.length === 0) {
      return <p style={{ color: 'green', textAlign: 'center' }}>Loading...</p>;
    }
    if (error) {
      return (
        <>
          <p style={{ color: 'red' }}>{error}</p>
          <button onClick={retry}>Retry</button>
        </>
      );
    }
    if (transactions.length < 1) {
      return <p>No transactions</p>;
    } else {
      return (
        <table style={{ opacity: loading ? 0.5 : 1 }}>
          <thead>
            <tr>
              <th>Date</th>
              <th>Merchant</th>
              <th>Sum</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {transactions.map((tsx) => (
              <tr key={tsx.id}>
                <td style={{ textAlign: 'center', width: '25%' }}>
                  {formatDate(tsx.createdAt)}
                  {/* {new Date(tsx.createdAt).toLocaleDateString('en-US')} */}
                </td>
                <td style={{ textAlign: 'center', width: '25%' }}>
                  {tsx.merchant}
                </td>
                <td style={{ textAlign: 'center', width: '25%' }}>
                  {formatMoney(tsx.amountMinor, tsx.currency, 'en-US')}
                </td>
                <td style={{ textAlign: 'center', width: '25%' }}>
                  {tsx.status}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      );
    }
  }
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '12px',
        padding: '24px',
      }}
    >
      <h2 style={{ margin: '0 auto' }}>
        Transactions ({total ? total : '...'})
      </h2>
      <div style={{ display: 'flex', gap: '12px' }}>
        {/* <input
          placeholder='enter text'
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        /> */}
        <MerchantAutocomplete
          onSelect={(value) => {
            setSearch(value);
            setPage(1);
          }}
        />

        <select
          value={status}
          placeholder='Select status'
          onChange={(e) => {
            setStatus(e.target.value);
            setPage(1);
          }}
        >
          <option value='all'>All</option>
          <option value='pending'>Pending</option>
          <option value='completed'>Completed</option>
          <option value='failed'>Failed</option>
        </select>
      </div>
      {renderContent()}
      <div style={{ display: 'flex', gap: '12px' }}>
        <button
          onClick={() => {
            setPage((p) => p - 1);
          }}
          disabled={page < 2}
        >
          Prev
        </button>
        <p>
          Page {page} of {Math.max(1, Math.ceil(total / 10))}
        </p>
        <button
          onClick={() => {
            setPage((p) => p + 1);
          }}
          disabled={page >= Math.max(1, Math.ceil(total / 10))}
        >
          Next
        </button>
      </div>
    </div>
  );
}

export default TestPage;
