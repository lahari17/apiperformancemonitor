"use client";

import { useEffect, useMemo, useState } from "react";
import { addURL, fetchChecks, fetchURLs, type CheckRow, type UrlRow } from "@/lib/api";

export default function Page() {
  const [urls, setUrls] = useState<UrlRow[]>([]);
  const [selected, setSelected] = useState<UrlRow | null>(null);
  const [checks, setChecks] = useState<CheckRow[]>([]);
  const [loadingURLs, setLoadingURLs] = useState(true);
  const [loadingChecks, setLoadingChecks] = useState(false);
  const [formUrl, setFormUrl] = useState("");
  const [formExpected, setFormExpected] = useState(200);
  const [formSlowMs, setFormSlowMs] = useState(1500);

  // load URLs initially and every 20s
  useEffect(() => {
    let alive = true;
    const load = async () => {
      try {
        setLoadingURLs(true);
        const data = await fetchURLs();
        if (!alive) return;
        setUrls(data);
        if (!selected && data.length > 0) {
          setSelected(data[0]);
        }
      } finally {
        setLoadingURLs(false);
      }
    };
    load();
    const id = setInterval(load, 20000);
    return () => { alive = false; clearInterval(id); };
  }, [selected]);

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
  }, [selected?.id]);

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

  return (
    <main style={{ maxWidth: 1100, margin: "40px auto", padding: "0 16px", fontFamily: "ui-sans-serif, system-ui" }}>
      <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 12 }}>API Performance Monitor</h1>
      <p style={{ color: "#555", marginBottom: 20 }}>
        Backend: <code>{process.env.NEXT_PUBLIC_API_BASE}</code>
      </p>

      {/* Add URL */}
      <form onSubmit={onAdd} style={{ display: "grid", gridTemplateColumns: "1.6fr 0.5fr 0.5fr auto", gap: 8, alignItems: "center", marginBottom: 18 }}>
        <input value={formUrl} onChange={e => setFormUrl(e.target.value)} placeholder="https://example.com" style={inputStyle} />
        <input type="number" value={formExpected} onChange={e => setFormExpected(parseInt(e.target.value || "200"))} style={inputStyle} title="Expected HTTP status" />
        <input type="number" value={formSlowMs} onChange={e => setFormSlowMs(parseInt(e.target.value || "1500"))} style={inputStyle} title="Slow threshold (ms)" />
        <button style={btnStyle}>Add URL</button>
      </form>

      {/* URLs table */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr auto auto auto auto", gap: 8, padding: 8, background: "#fafafa", border: "1px solid #eee", borderRadius: 8 }}>
        <div style={{ fontWeight: 600 }}>URL</div>
        <div style={{ fontWeight: 600 }}>Expected</div>
        <div style={{ fontWeight: 600 }}>Slow (ms)</div>
        <div style={{ fontWeight: 600 }}>Created</div>
        <div style={{ fontWeight: 600, textAlign: "right" }}>Status</div>

        {loadingURLs ? (
          <div style={{ gridColumn: "1 / -1", color: "#777" }}>Loading URLs…</div>
        ) : (
          urls.map(u => (
            <FragmentRow
              key={u.id}
              u={u}
              selected={selected?.id === u.id}
              onClick={() => setSelected(u)}
              badge={selected?.id === u.id ? statusBadge : null}
            />
          ))
        )}
      </div>

      {/* Checks panel */}
      <div style={{ marginTop: 22 }}>
        <h2 style={{ fontSize: 18, fontWeight: 600, marginBottom: 10 }}>
          Recent checks {selected ? `for ${selected.url}` : ""}
        </h2>
        {loadingChecks && <div style={{ color: "#777" }}>Loading checks…</div>}
        {!loadingChecks && checks.length === 0 && <div style={{ color: "#777" }}>No checks yet.</div>}
        {!loadingChecks && checks.length > 0 && (
          <div style={{ overflowX: "auto", border: "1px solid #eee", borderRadius: 8 }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ background: "#fafafa" }}>
                  <th style={th}>Checked At</th>
                  <th style={th}>Status</th>
                  <th style={th}>Latency (ms)</th>
                  <th style={th}>OK</th>
                  <th style={th}>Error</th>
                </tr>
              </thead>
              <tbody>
                {checks.map(c => (
                  <tr key={c.id}>
                    <td style={td}>{new Date(c.checked_at).toLocaleString()}</td>
                    <td style={td}>{c.status_code ?? "-"}</td>
                    <td style={td}>{c.latency_ms ?? "-"}</td>
                    <td style={td}>{c.ok ? "✓" : "✗"}</td>
                    <td style={{ ...td, color: "#b00" }}>{c.error ?? ""}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </main>
  );
}

function FragmentRow({
  u, selected, onClick, badge,
}: { u: UrlRow; selected: boolean; onClick: () => void; badge: React.ReactNode | null }) {
  return (
    <>
      <div onClick={onClick} style={cellUrl(selected)}>{u.url}</div>
      <div onClick={onClick} style={td}>{u.expected_status}</div>
      <div onClick={onClick} style={td}>{u.threshold_slow_ms}</div>
      <div onClick={onClick} style={td}>{new Date(u.created_at).toLocaleString()}</div>
      <div onClick={onClick} style={{ ...td, textAlign: "right" }}>{badge}</div>
    </>
  );
}

const th: React.CSSProperties = { textAlign: "left", padding: "10px 12px", borderBottom: "1px solid #eee", fontWeight: 600 };
const td: React.CSSProperties = { padding: "10px 12px", borderBottom: "1px solid #f3f3f3", whiteSpace: "nowrap" };
const inputStyle: React.CSSProperties = { padding: "10px 12px", border: "1px solid #ddd", borderRadius: 8 };
const btnStyle: React.CSSProperties = { padding: "10px 14px", borderRadius: 8, background: "#111", color: "#fff", border: "none", cursor: "pointer" };
const cellUrl = (selected: boolean): React.CSSProperties => ({
  ...td,
  cursor: "pointer",
  color: selected ? "#111" : "#0366d6",
  fontWeight: selected ? 700 : 500,
});
