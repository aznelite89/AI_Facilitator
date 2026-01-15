import React, { useMemo, useState } from "react";

const DEFAULT_USERS_INFO = `Users:
\nUser 1:
\nProfile ID: 6909b4426a1001046bb5d4a0
\nUser Name: Mark Brown
\nOrganization: Ganda Company
\nBio: Experienced technology leader and AI enthusiast passionate about driving innovation and fostering meaningful connections within organizations.
\nInterests: Technology, Artificial Intelligence, Innovation, Collaboration
\nConnection Preferences: Professional Networking, Mentorship Opportunities, AI Project Collaboration
\n
\nUser 2:
\nProfile ID: 6909b0456a1001046bb5d468
\nUser Name: Tom Scott
\nOrganization: Ganda Company
\nBio: Experienced technology leader and AI enthusiast passionate about driving innovation and fostering meaningful connections within organizations.
\nInterests: Technology, Artificial Intelligence, Innovation, Collaboration
\nConnection Preferences: Professional Networking, Mentorship Opportunities, AI Project Collaboration
`;

const DEFAULT_CONVO = `Mark Brown: Hello Tom!
Tom Scott: Hi Mark, how are you?
Mark Brown: I'm good! Thanks!
Mark Brown: I don't have any topic
`;

export default function App() {
  const [usersInfo, setUsersInfo] = useState(DEFAULT_USERS_INFO);
  const [conversation, setConversation] = useState(DEFAULT_CONVO);

  const [initResult, setInitResult] = useState(null);
  const [facResult, setFacResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  const prettyInit = useMemo(() => (initResult ? JSON.stringify(initResult, null, 2) : ""), [initResult]);
  const prettyFac = useMemo(() => (facResult ? JSON.stringify(facResult, null, 2) : ""), [facResult]);

  async function callInitiate() {
    setLoading(true);
    setErr("");
    setInitResult(null);
    try {
      const res = await fetch("/api/initiate-conversation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ users_info: usersInfo }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error ? JSON.stringify(json.error) : "Request failed");
      setInitResult(json);
    } catch (e) {
      setErr(String(e.message || e));
    } finally {
      setLoading(false);
    }
  }

  async function callFacilitate() {
    setLoading(true);
    setErr("");
    setFacResult(null);
    try {
      const res = await fetch("/api/facilitate-conversation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ users_info: usersInfo, conversation }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error ? JSON.stringify(json.error) : "Request failed");
      setFacResult(json);
    } catch (e) {
      setErr(String(e.message || e));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="page">
      <header className="header">
        <div>
          <h1>AI Facilitator API – Demo</h1>
          <p className="sub">
            Paste <code>users_info</code> and <code>conversation</code> as strings, then call the two endpoints.
          </p>
        </div>
        <div className="status">
          {loading ? <span className="pill">Loading…</span> : <span className="pill ok">Ready</span>}
        </div>
      </header>

      {err ? <div className="error">{err}</div> : null}

      <div className="grid">
        <section className="card">
          <h2>Input</h2>

          <label>users_info (string)</label>
          <textarea value={usersInfo} onChange={(e) => setUsersInfo(e.target.value)} rows={14} />

          <label>conversation (string)</label>
          <textarea value={conversation} onChange={(e) => setConversation(e.target.value)} rows={10} />

          <div className="actions">
            <button onClick={callInitiate} disabled={loading}>
              1) Initiate Conversation
            </button>
            <button onClick={callFacilitate} disabled={loading}>
              2) Facilitate (Intervention)
            </button>
          </div>

          <p className="hint">
            Dev mode uses Vite proxy: the browser calls <code>/api/*</code> and it forwards to Express at{" "}
            <code>http://localhost:3000</code>.
          </p>
        </section>

        <section className="card">
          <h2>Output</h2>

          <div className="outBlock">
            <div className="outTitle">Initiate response</div>
            <pre>{prettyInit || "—"}</pre>
          </div>

          <div className="outBlock">
            <div className="outTitle">Facilitate response</div>
            <pre>{prettyFac || "—"}</pre>
          </div>
        </section>
      </div>

      <footer className="footer">
        <span>
          Server: <code>server/</code> (Express) • Client: <code>client/</code> (Vite + React)
        </span>
      </footer>
    </div>
  );
}
