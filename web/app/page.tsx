/*
 * API Performance Monitor - Frontend Dashboard
 * Copyright (C) 2024 Lahari Sandepudi
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as published
 * by the Free Software Foundation, either version 3 of the License, or
 *
 * For commercial licensing, contact: lahari@laharisandepudi.com
 */

"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { addURL, deleteURL, fetchChecks, fetchURLs, type CheckRow, type UrlRow } from "@/lib/api";

export default function Page() {
  const [urls, setUrls] = useState<UrlRow[]>([]);
  const [selected, setSelected] = useState<UrlRow | null>(null);
  const [checks, setChecks] = useState<CheckRow[]>([]);
  const [loadingChecks, setLoadingChecks] = useState(false);
  const [urlStatuses, setUrlStatuses] = useState<Record<number, CheckRow | null>>({});
  const [formUrl, setFormUrl] = useState("");
  const [formExpected, setFormExpected] = useState(200);
  const [formSlowMs, setFormSlowMs] = useState(1500);
  
  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  // load URLs initially and every 20s
  useEffect(() => {
    let alive = true;
    const load = async () => {
      try {
        const data = await fetchURLs();
        if (!alive) return;
        setUrls(data);
        if (!selected && data.length > 0) {
          setSelected(data[0]);
        }
      } catch (error) {
        console.error('Failed to fetch URLs:', error);
      }
    };
    load();
    const id = setInterval(load, 20000);
    return () => { alive = false; clearInterval(id); };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // load checks for selected URL every 10s
  useEffect(() => {
    if (!selected) return;
    let alive = true;
    const loadChecks = async () => {
      try {
        setLoadingChecks(true);
        const data = await fetchChecks(selected.id, 50);
        if (!alive) return;
        setChecks(data);
      } finally {
        setLoadingChecks(false);
      }
    };
    loadChecks();
    const id = setInterval(loadChecks, 10000);
    return () => { alive = false; clearInterval(id); };
  }, [selected]);

  // Reset pagination when selected URL changes
  useEffect(() => {
    setCurrentPage(1);
  }, [selected]);

  // Fetch latest status for all URLs
  const fetchAllUrlStatuses = useCallback(async (urlList: UrlRow[]) => {
    try {
      const statusPromises = urlList.map(async (url) => {
        try {
          const latestChecks = await fetchChecks(url.id, 1);
          return { urlId: url.id, status: latestChecks[0] || null };
        } catch (error) {
          console.error(`Failed to fetch status for URL ${url.id}:`, error);
          return { urlId: url.id, status: null };
        }
      });
      
      const results = await Promise.all(statusPromises);
      const statusMap: Record<number, CheckRow | null> = {};
      results.forEach(({ urlId, status }) => {
        statusMap[urlId] = status;
      });
      
      // Only update if there are actual changes
      setUrlStatuses(prev => {
        const hasChanges = Object.keys(statusMap).some(urlId => {
          const prevStatus = prev[parseInt(urlId)];
          const newStatus = statusMap[parseInt(urlId)];
          return JSON.stringify(prevStatus) !== JSON.stringify(newStatus);
        });
        
        return hasChanges ? statusMap : prev;
      });
    } catch (error) {
      console.error('Failed to fetch URL statuses:', error);
    }
  }, []);

  // Update URL statuses every 10s
  useEffect(() => {
    if (urls.length === 0) return;
    
    // Initial fetch
    fetchAllUrlStatuses(urls);
    
    const id = setInterval(() => {
      fetchAllUrlStatuses(urls);
    }, 10000);
    return () => clearInterval(id);
  }, [urls, fetchAllUrlStatuses]);

  // Pagination calculations
  const totalItems = checks.length;
  const totalPages = Math.ceil(totalItems / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const paginatedChecks = checks.slice(startIndex, endIndex);

  const latest = checks[0];
  const statusBadge = useMemo(() => {
    if (!latest) return <span className="px-2 py-1 rounded bg-gray-200">unknown</span>;
    if (latest.ok && (latest.latency_ms ?? 0) <= (selected?.threshold_slow_ms ?? 999999)) {
      return <span className="px-2 py-1 rounded bg-green-200 text-green-900">OK</span>;
    }
    if (latest.ok) {
      return <span className="px-2 py-1 rounded bg-yellow-200 text-yellow-900">SLOW</span>;
    }
    return <span className="px-2 py-1 rounded bg-red-200 text-red-900">DOWN</span>;
  }, [latest, selected]);

  // Generate status badge for individual URLs
  const getUrlStatusBadge = (url: UrlRow) => {
    const urlStatus = urlStatuses[url.id];
    if (!urlStatus) {
      return <span style={unknownBadgeStyle}>—</span>;
    }
    
    if (urlStatus.ok && (urlStatus.latency_ms ?? 0) <= url.threshold_slow_ms) {
      return <span style={okBadgeStyle}>OK</span>;
    }
    if (urlStatus.ok) {
      return <span style={slowBadgeStyle}>SLOW</span>;
    }
    return <span style={downBadgeStyle}>DOWN</span>;
  };

  const onAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formUrl) return;
    await addURL({ url: formUrl, expected_status: formExpected, slow_ms: formSlowMs });
    setFormUrl("");
    // reload URLs after add
    const data = await fetchURLs();
    setUrls(data);
    const added = data.find(u => u.url === formUrl);
    if (added) setSelected(added);
  };

  const onDelete = async (id: number) => {
    if (!confirm("Are you sure you want to delete this URL?")) return;
    await deleteURL(id);
    // reload URLs after delete
    const data = await fetchURLs();
    setUrls(data);
    // if deleted URL was selected, clear selection or select first available
    if (selected?.id === id) {
      setSelected(data.length > 0 ? data[0] : null);
    }
  };


  return (
    <div style={containerStyle}>
      {/* Header */}
      <header style={headerStyle}>
        <div style={headerContentStyle}>
          <div>
            <h1 style={titleStyle}>API Monitor</h1>
            <p style={subtitleStyle}>Monitor your websites and APIs with real-time alerts</p>
          </div>
          <div style={statsStyle}>
            <div style={statStyle}>
              <span style={statNumberStyle}>{urls.length}</span>
              <span style={statLabelStyle}>URLs</span>
            </div>
            <div style={statStyle}>
              <span style={statNumberStyle}>{urls.filter(() => latest && latest.ok).length}</span>
              <span style={statLabelStyle}>Online</span>
            </div>
          </div>
        </div>
      </header>

      <main style={mainStyle}>
        {/* Add URL Form */}
        <section style={sectionStyle}>
          <h2 style={sectionTitleStyle}>Add URL to Monitor</h2>
          <form onSubmit={onAdd} style={formStyle}>
            <div style={inputGroupStyle}>
              <label style={labelStyle} htmlFor="url-input">
                Website URL *
              </label>
              <input 
                id="url-input"
                value={formUrl} 
                onChange={e => setFormUrl(e.target.value)} 
                placeholder="https://example.com" 
                style={inputStyle}
                required
              />
            </div>
            <div style={inputGroupStyle}>
              <label style={labelStyle} htmlFor="status-input">
                Expected Status
              </label>
              <input 
                id="status-input"
                type="number" 
                value={formExpected} 
                onChange={e => setFormExpected(parseInt(e.target.value || "200"))} 
                style={smallInputStyle}
                placeholder="200"
                title="HTTP status code you expect (usually 200)"
              />
            </div>
            <div style={inputGroupStyle}>
              <label style={labelStyle} htmlFor="threshold-input">
                Slow Threshold (ms)
              </label>
              <input 
                id="threshold-input"
                type="number" 
                value={formSlowMs} 
                onChange={e => setFormSlowMs(parseInt(e.target.value || "1500"))} 
                style={smallInputStyle}
                placeholder="1500"
                title="Response time above this will trigger slow alerts"
              />
            </div>
            <div style={buttonGroupStyle}>
              <button type="submit" style={buttonStyle}>
                Add Monitor
              </button>
            </div>
          </form>
        </section>

        {/* URLs List */}
        <section style={sectionStyle}>
          <h2 style={sectionTitleStyle}>Monitored URLs</h2>
          {urls.length === 0 ? (
            <div style={emptyStyle}>
              <p>No URLs being monitored yet. Add one above to get started.</p>
            </div>
          ) : (
            <div style={urlsListStyle}>
              {urls.map(u => (
                <div 
                  key={u.id} 
                  style={{
                    ...urlItemStyle,
                    ...(selected?.id === u.id ? urlItemSelectedStyle : {})
                  }}
                  onClick={() => setSelected(u)}
                >
                  <div style={urlInfoStyle}>
                    <div style={urlStyle}>{u.url}</div>
                    <div style={urlMetaStyle}>
                      Expected: {u.expected_status} • Threshold: {u.threshold_slow_ms}ms
                    </div>
                  </div>
                  <div style={urlActionsStyle}>
                      <div style={statusGroupStyle}>
                        <span style={statusLabelStyle}>Status:</span>
                        {getUrlStatusBadge(u)}
                      </div>
                    <button
                      onClick={(e) => { e.stopPropagation(); onDelete(u.id); }}
                      style={deleteButtonStyle}
                      title="Delete this URL"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Performance Details */}
        {selected && (
          <section style={sectionStyle}>
            <h2 style={sectionTitleStyle}>Performance Details</h2>
            <div style={urlDetailStyle}>
              <strong>{selected.url}</strong>
              <span style={urlDetailMetaStyle}>
                Added {new Date(selected.created_at).toLocaleDateString()}
              </span>
            </div>
            
            {loadingChecks ? (
              <div style={loadingStyle}>
                <div style={spinnerStyle}></div>
                <span>Loading...</span>
              </div>
            ) : checks.length === 0 ? (
              <div style={emptyStyle}>
                <p>No performance data yet. Data will appear after the first check.</p>
              </div>
            ) : (
              <>
                <div style={tableContainerStyle}>
                  <table style={tableStyle}>
                    <thead>
                      <tr>
                        <th style={thStyle}>Time</th>
                        <th style={thStyle}>Status</th>
                        <th style={thStyle}>Latency</th>
                        <th style={thStyle}>Result</th>
                        <th style={thStyle}>Error</th>
                      </tr>
                    </thead>
                    <tbody>
                      {paginatedChecks.map(c => (
                        <tr key={c.id} style={trStyle}>
                          <td style={tdStyle}>
                            {new Date(c.checked_at).toLocaleString()}
                          </td>
                          <td style={tdStyle}>
                            <span style={getStatusStyle(c.status_code)}>
                              {c.status_code ?? "—"}
                            </span>
                          </td>
                          <td style={tdStyle}>
                            <span style={getLatencyStyle(c.latency_ms, selected.threshold_slow_ms)}>
                              {c.latency_ms ? `${c.latency_ms}ms` : "—"}
                            </span>
                          </td>
                          <td style={tdStyle}>
                            <span style={getResultStyle(c.ok)}>
                              {c.ok ? "OK" : "Failed"}
                            </span>
                          </td>
                          <td style={tdStyle}>
                            {c.error ?? ""}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Pagination Controls */}
                {totalPages > 1 && (
                  <div style={paginationContainerStyle}>
                    <div style={paginationInfoStyle}>
                      Showing {startIndex + 1}-{Math.min(endIndex, totalItems)} of {totalItems} checks
                    </div>
                    
                    <div style={paginationControlsStyle}>
                      <button
                        onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                        disabled={currentPage === 1}
                        style={{
                          ...paginationButtonStyle,
                          ...(currentPage === 1 ? paginationButtonDisabledStyle : {})
                        }}
                      >
                        Previous
                      </button>
                      
                      <div style={pageNumbersStyle}>
                        {Array.from({ length: totalPages }, (_, i) => i + 1)
                          .filter(page => {
                            // Show first page, last page, current page, and pages around current
                            return page === 1 || 
                                   page === totalPages || 
                                   Math.abs(page - currentPage) <= 1;
                          })
                          .map((page, index, filteredPages) => {
                            const prevPage = filteredPages[index - 1];
                            const showEllipsis = prevPage && page - prevPage > 1;
                            
                            return (
                              <div key={page} style={{ display: 'flex', alignItems: 'center' }}>
                                {showEllipsis && <span style={ellipsisStyle}>...</span>}
                                <button
                                  onClick={() => setCurrentPage(page)}
                                  style={{
                                    ...pageNumberButtonStyle,
                                    ...(page === currentPage ? pageNumberActiveStyle : {})
                                  }}
                                >
                                  {page}
                                </button>
                              </div>
                            );
                          })}
                      </div>
                      
                      <button
                        onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                        disabled={currentPage === totalPages}
                        style={{
                          ...paginationButtonStyle,
                          ...(currentPage === totalPages ? paginationButtonDisabledStyle : {})
                        }}
                      >
                        Next
                      </button>
                    </div>
                  </div>
                )}
              </>
            )}
          </section>
        )}
      </main>
      
      {/* Footer */}
      <footer style={footerStyle}>
        <div style={footerContentStyle}>
          <div style={footerTextStyle}>
            <p style={footerMainTextStyle}>
              Built with ❤️ by{' '}
              <a 
                href="https://laharisandepudi.com" 
                target="_blank" 
                rel="noopener noreferrer"
                style={footerLinkStyle}
              >
                Lahari Sandepudi
              </a>
            </p>
            <p style={footerSubTextStyle}>
              Reliable monitoring solutions for modern web applications
            </p>
            <p style={footerThanksStyle}>
               Special thanks to{' '}
              <a 
                href="https://futureaiit.com" 
                target="_blank" 
                rel="noopener noreferrer"
                style={footerThanksLinkStyle}
              >
                Futureaiit
              </a>
              {' '}for providing the resources and infrastructure that made this project possible ✨
            </p>
          </div>
          <div style={footerMetaStyle}>
            <span style={footerVersionStyle}>v1.0</span>
          </div>
        </div>
      </footer>
    </div>
  );
}

// Helper functions for styling
const getStatusStyle = (code?: number | null): React.CSSProperties => {
  if (!code) return { color: '#64748b' };
  if (code >= 200 && code < 300) return { color: '#10b981', fontWeight: 500 };
  if (code >= 400) return { color: '#ef4444', fontWeight: 500 };
  return { color: '#f59e0b', fontWeight: 500 };
};

const getLatencyStyle = (latency?: number | null, threshold?: number): React.CSSProperties => {
  if (!latency) return { color: '#64748b' };
  const isSlow = threshold && latency > threshold;
  return { 
    color: isSlow ? '#f59e0b' : '#10b981',
    fontWeight: 500
  };
};

const getResultStyle = (ok: boolean): React.CSSProperties => ({
  color: ok ? '#10b981' : '#ef4444',
  fontWeight: 500
});

// Clean, minimal styles
const containerStyle: React.CSSProperties = {
  minHeight: '100vh',
  backgroundColor: '#f8fafc',
};

const headerStyle: React.CSSProperties = {
  backgroundColor: 'white',
  borderBottomWidth: '1px',
  borderBottomStyle: 'solid',
  borderBottomColor: '#e2e8f0',
  padding: '1.5rem 0',
};

const headerContentStyle: React.CSSProperties = {
  maxWidth: '1200px',
  margin: '0 auto',
  padding: '0 1.5rem',
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
};

const titleStyle: React.CSSProperties = {
  fontSize: '1.875rem',
  fontWeight: 700,
  color: '#0f172a',
  margin: 0,
};

const subtitleStyle: React.CSSProperties = {
  fontSize: '1rem',
  color: '#64748b',
  margin: '0.25rem 0 0 0',
};

const statsStyle: React.CSSProperties = {
  display: 'flex',
  gap: '2rem',
};

const statStyle: React.CSSProperties = {
  textAlign: 'center',
};

const statNumberStyle: React.CSSProperties = {
  fontSize: '1.5rem',
  fontWeight: 600,
  color: '#0f172a',
  display: 'block',
};

const statLabelStyle: React.CSSProperties = {
  fontSize: '0.875rem',
  color: '#64748b',
};

const mainStyle: React.CSSProperties = {
  maxWidth: '1200px',
  margin: '0 auto',
  padding: '2rem 1.5rem',
};

const sectionStyle: React.CSSProperties = {
  backgroundColor: 'white',
  borderRadius: '0.5rem',
  borderWidth: '1px',
  borderStyle: 'solid',
  borderColor: '#e2e8f0',
  padding: '1.5rem',
  marginBottom: '2rem',
};

const sectionTitleStyle: React.CSSProperties = {
  fontSize: '1.25rem',
  fontWeight: 600,
  color: '#0f172a',
  marginBottom: '1rem',
};

const formStyle: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: '2fr 1fr 1fr auto',
  gap: '1rem',
  alignItems: 'end',
};

const inputStyle: React.CSSProperties = {
  padding: '0.75rem',
  borderWidth: '1px',
  borderStyle: 'solid',
  borderColor: '#d1d5db',
  borderRadius: '0.375rem',
  fontSize: '0.875rem',
  outline: 'none',
};

const smallInputStyle: React.CSSProperties = {
  ...inputStyle,
  width: '100%',
};

const inputGroupStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: '0.5rem',
};

const labelStyle: React.CSSProperties = {
  fontSize: '0.875rem',
  fontWeight: 500,
  color: '#374151',
  marginBottom: '0.25rem',
};

const buttonGroupStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'flex-end',
};

const buttonStyle: React.CSSProperties = {
  backgroundColor: '#3b82f6',
  color: 'white',
  border: 'none',
  borderRadius: '0.375rem',
  padding: '0.75rem 1.5rem',
  fontSize: '0.875rem',
  fontWeight: 500,
  cursor: 'pointer',
};

const emptyStyle: React.CSSProperties = {
  textAlign: 'center',
  padding: '3rem 1rem',
  color: '#64748b',
};

const urlsListStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: '0.5rem',
};

const urlItemStyle: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  padding: '1rem',
  borderWidth: '1px',
  borderStyle: 'solid',
  borderColor: '#e2e8f0',
  borderRadius: '0.375rem',
  cursor: 'pointer',
  transition: 'all 0.2s',
};

const urlItemSelectedStyle: React.CSSProperties = {
  borderColor: '#3b82f6',
  backgroundColor: '#eff6ff',
};

const urlInfoStyle: React.CSSProperties = {
  flex: 1,
};

const urlStyle: React.CSSProperties = {
  fontWeight: 500,
  color: '#0f172a',
  marginBottom: '0.25rem',
};

const urlMetaStyle: React.CSSProperties = {
  fontSize: '0.875rem',
  color: '#64748b',
};

const urlActionsStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '0.75rem',
};

const statusGroupStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '0.5rem',
};

const statusLabelStyle: React.CSSProperties = {
  fontSize: '0.875rem',
  color: '#64748b',
  fontWeight: 500,
};

const unknownBadgeStyle: React.CSSProperties = {
  color: '#64748b',
  fontSize: '0.875rem',
};

// Individual URL status badge styles
const okBadgeStyle: React.CSSProperties = {
  fontSize: '0.75rem',
  fontWeight: 600,
  color: '#065f46',
  backgroundColor: '#d1fae5',
  padding: '0.25rem 0.5rem',
  borderRadius: '0.375rem',
};

const slowBadgeStyle: React.CSSProperties = {
  fontSize: '0.75rem',
  fontWeight: 600,
  color: '#92400e',
  backgroundColor: '#fef3c7',
  padding: '0.25rem 0.5rem',
  borderRadius: '0.375rem',
};

const downBadgeStyle: React.CSSProperties = {
  fontSize: '0.75rem',
  fontWeight: 600,
  color: '#991b1b',
  backgroundColor: '#fecaca',
  padding: '0.25rem 0.5rem',
  borderRadius: '0.375rem',
};

const deleteButtonStyle: React.CSSProperties = {
  backgroundColor: '#ef4444',
  color: 'white',
  border: 'none',
  borderRadius: '0.25rem',
  padding: '0.25rem 0.5rem',
  fontSize: '0.75rem',
  fontWeight: 500,
  cursor: 'pointer',
  transition: 'all 0.2s ease',
};

const urlDetailStyle: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  marginBottom: '1.5rem',
  paddingBottom: '1rem',
  borderBottomWidth: '1px',
  borderBottomStyle: 'solid',
  borderBottomColor: '#e2e8f0',
};

const urlDetailMetaStyle: React.CSSProperties = {
  fontSize: '0.875rem',
  color: '#64748b',
};

const loadingStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: '0.75rem',
  padding: '2rem',
  color: '#64748b',
};

const spinnerStyle: React.CSSProperties = {
  width: '1rem',
  height: '1rem',
  border: '2px solid #e2e8f0',
  borderTop: '2px solid #3b82f6',
  borderRadius: '50%',
  animation: 'spin 1s linear infinite',
};

const tableContainerStyle: React.CSSProperties = {
  overflowX: 'auto',
  borderWidth: '1px',
  borderStyle: 'solid',
  borderColor: '#e2e8f0',
  borderRadius: '0.375rem',
};

const tableStyle: React.CSSProperties = {
  width: '100%',
  borderCollapse: 'collapse',
};

const thStyle: React.CSSProperties = {
  backgroundColor: '#f8fafc',
  padding: '0.75rem',
  textAlign: 'left',
  fontSize: '0.875rem',
  fontWeight: 500,
  color: '#374151',
  borderBottomWidth: '1px',
  borderBottomStyle: 'solid',
  borderBottomColor: '#e2e8f0',
};

const trStyle: React.CSSProperties = {
  borderBottomWidth: '1px',
  borderBottomStyle: 'solid',
  borderBottomColor: '#f1f5f9',
};

const tdStyle: React.CSSProperties = {
  padding: '0.75rem',
  fontSize: '0.875rem',
  color: '#374151',
};

// Footer styles
const footerStyle: React.CSSProperties = {
  backgroundColor: '#000000',
  borderTop: '1px solid #333333',
  marginTop: '4rem',
  padding: '2rem 0',
};

const footerContentStyle: React.CSSProperties = {
  maxWidth: '1200px',
  margin: '0 auto',
  padding: '0 1.5rem',
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
};

const footerTextStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: '0.5rem',
};

const footerMainTextStyle: React.CSSProperties = {
  fontSize: '1rem',
  color: '#ffffff',
  margin: 0,
};

const footerSubTextStyle: React.CSSProperties = {
  fontSize: '0.875rem',
  color: '#d1d5db',
  margin: 0,
};

const footerLinkStyle: React.CSSProperties = {
  color: '#60a5fa',
  textDecoration: 'none',
  fontWeight: 600,
  transition: 'color 0.2s ease',
};

const footerThanksStyle: React.CSSProperties = {
  fontSize: '0.75rem',
  color: '#9ca3af',
  margin: '0.75rem 0 0 0',
  fontStyle: 'italic',
};

const footerThanksLinkStyle: React.CSSProperties = {
  color: '#fbbf24',
  textDecoration: 'none',
  fontWeight: 600,
  transition: 'color 0.2s ease',
};

const footerMetaStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
};

const footerVersionStyle: React.CSSProperties = {
  fontSize: '0.875rem',
  color: '#000000',
  backgroundColor: '#ffffff',
  padding: '0.25rem 0.5rem',
  borderRadius: '0.25rem',
  fontWeight: 500,
};

// Pagination styles
const paginationContainerStyle: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  marginTop: '1.5rem',
  padding: '1rem 0',
  borderTop: '1px solid #e2e8f0',
};

const paginationInfoStyle: React.CSSProperties = {
  fontSize: '0.875rem',
  color: '#64748b',
};

const paginationControlsStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '0.5rem',
};

const paginationButtonStyle: React.CSSProperties = {
  padding: '0.5rem 1rem',
  fontSize: '0.875rem',
  fontWeight: 500,
  color: '#374151',
  backgroundColor: '#ffffff',
  borderWidth: '1px',
  borderStyle: 'solid',
  borderColor: '#d1d5db',
  borderRadius: '0.375rem',
  cursor: 'pointer',
  transition: 'all 0.2s ease',
};

const paginationButtonDisabledStyle: React.CSSProperties = {
  color: '#9ca3af',
  backgroundColor: '#f9fafb',
  cursor: 'not-allowed',
};

const pageNumbersStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '0.25rem',
  margin: '0 1rem',
};

const pageNumberButtonStyle: React.CSSProperties = {
  padding: '0.5rem 0.75rem',
  fontSize: '0.875rem',
  fontWeight: 500,
  color: '#374151',
  backgroundColor: '#ffffff',
  borderWidth: '1px',
  borderStyle: 'solid',
  borderColor: '#d1d5db',
  borderRadius: '0.375rem',
  cursor: 'pointer',
  transition: 'all 0.2s ease',
  minWidth: '2.5rem',
  textAlign: 'center' as const,
};

const pageNumberActiveStyle: React.CSSProperties = {
  color: '#ffffff',
  backgroundColor: '#3b82f6',
  borderColor: '#3b82f6',
};

const ellipsisStyle: React.CSSProperties = {
  padding: '0.5rem',
  color: '#9ca3af',
  fontSize: '0.875rem',
};

