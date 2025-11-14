// src/App.js
import React, { useCallback, useEffect, useRef, useState } from "react";
import axios from "axios";
import { motion, AnimatePresence } from "framer-motion";

// Backend base URL (edit in settings UI if you like)
const BACKEND = process.env.REACT_APP_BACKEND_URL || "http://localhost:3001";

// small WebAudio beep (no files)
function playBeep({ freq = 880, duration = 120, volume = 0.02 } = {}) {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = "sine";
    o.frequency.value = freq;
    g.gain.value = volume;
    o.connect(g);
    g.connect(ctx.destination);
    o.start();
    setTimeout(() => {
      o.stop();
      try { ctx.close(); } catch {}
    }, duration);
  } catch (e) {
    // ignore
  }
}

function speak(text) {
  if (!text) return;
  if (!("speechSynthesis" in window)) return;
  try {
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.rate = 1;
    u.pitch = 1;
    window.speechSynthesis.speak(u);
  } catch (e) {
    console.error("TTS error", e);
  }
}

function TypingDots({ visible = false }) {
  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 6 }}
          className="typing-dots"
        >
          <span className="dot" />
          <span className="dot" />
          <span className="dot" />
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export default function App() {
  const [messages, setMessages] = useState([]); // {who, text, ts}
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false); // assistant thinking
  const [listening, setListening] = useState(false);
  const [hotwordMode, setHotwordMode] = useState(false);
  const [useTTS, setUseTTS] = useState(true);
  const recognitionRef = useRef(null);
  const chatHistoryRef = useRef([]);

  // logs for debug
  const [logs, setLogs] = useState([]);

  const pushLog = useCallback((obj) => setLogs((s) => [{ ts: Date.now(), ...obj }, ...s].slice(0, 200)), []);
  const pushMessage = useCallback((who, text) => setMessages((m) => [...m, { who, text, ts: Date.now() }]), []);

  // init speech recognition (if available)
  useEffect(() => {
    const Speech = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!Speech) {
      recognitionRef.current = null;
      pushLog({ type: "speech_unavailable" });
      return;
    }
    const rec = new Speech();
    rec.lang = "en-US";
    rec.interimResults = false;
    rec.maxAlternatives = 1;
    recognitionRef.current = rec;
    return () => {
      try { rec.abort(); } catch {}
    };
  }, [pushLog]);

  // basic API wrapper
  const apiPost = useCallback(async (path, body) => {
    try {
      const r = await axios.post(BACKEND + path, body, { timeout: 20000 });
      return r.data;
    } catch (err) {
      pushLog({ type: "api_error", path, error: String(err) });
      return null;
    }
  }, [pushLog]);

  const classifyIntent = useCallback(async (text) => {
    const r = await apiPost("/api/intent", { text });
    return r || { mode: "chat" };
  }, [apiPost]);

  const callChat = useCallback(async (messagesArr) => {
    const r = await apiPost("/api/chat", { messages: messagesArr });
    return r?.reply ?? null;
  }, [apiPost]);

  const parseAction = useCallback(async (text) => {
    const r = await apiPost("/api/parseAction", { text });
    return r?.action ?? null;
  }, [apiPost]);

  const executeAction = useCallback(async (action) => {
    const r = await apiPost("/api/executeAction", { action });
    return r ?? null;
  }, [apiPost]);

  // main handler
  const handleUserText = useCallback(async (text) => {
    if (!text || !text.trim()) return;
    pushMessage("You", text);
    setInput("");
    // quick UX feedback
    playBeep({ freq: 880, duration: 60, volume: 0.02 });
    pushLog({ type: "user_input", text });

    // classify
    setLoading(true);
    const intent = await classifyIntent(text);
    pushLog({ type: "intent", text, intent });

    if (intent?.mode === "chat") {
      // chat flow
      chatHistoryRef.current.push({ role: "user", content: text });
      playBeep({ freq: 1200, duration: 40, volume: 0.01 }); // small ack
      const reply = await callChat(chatHistoryRef.current);
      setLoading(false);

      if (reply) {
        pushMessage("Astra", reply);
        chatHistoryRef.current.push({ role: "assistant", content: reply });
        playBeep({ freq: 600, duration: 140, volume: 0.02 }); // success beep
        if (useTTS) speak(reply);
      } else {
        pushMessage("Astra", "Sorry, I couldn't get an answer right now.");
        playBeep({ freq: 240, duration: 140, volume: 0.02 });
      }
      return;
    }

    // action mode
    const action = await parseAction(text);
    pushLog({ type: "parsed_action", action });
    if (!action) {
      setLoading(false);
      pushMessage("Astra", "I couldn't understand that command.");
      if (useTTS) speak("I couldn't understand that command.");
      return;
    }

    // show planned
    pushMessage("Astra (planned)", JSON.stringify(action));
    const result = await executeAction(action);
    setLoading(false);
    pushMessage("Astra (result)", JSON.stringify(result));
    if (result?.ok) {
      playBeep({ freq: 600, duration: 120, volume: 0.02 });
      if (useTTS) speak("Done.");
    } else {
      playBeep({ freq: 240, duration: 120, volume: 0.03 });
      if (useTTS) speak("I couldn't complete that.");
    }
  }, [classifyIntent, callChat, parseAction, executeAction, pushMessage, pushLog, useTTS]);

  // push-to-talk
  const startPushToTalk = useCallback(() => {
    const rec = recognitionRef.current;
    if (!rec) return alert("SpeechRecognition not supported in this browser (use Chrome).");
    setListening(true);
    playBeep({ freq: 1000, duration: 60, volume: 0.02 });
    rec.onresult = async (e) => {
      const txt = e.results[0][0].transcript;
      setListening(false);
      await handleUserText(txt);
    };
    rec.onerror = () => setListening(false);
    rec.onend = () => setListening(false);
    try { rec.start(); } catch (err) { setListening(false); pushLog({ type: "rec_start_error", err: String(err) }); }
  }, [handleUserText, pushLog]);

  // hotword (very simple)
  useEffect(() => {
    const rec = recognitionRef.current;
    if (!rec) return;
    if (!hotwordMode) { try { rec.abort(); } catch {} ; return; }

    let alive = true;
    const startLoop = () => {
      try {
        rec.onresult = (e) => {
          const txt = e.results[0][0].transcript.toLowerCase();
          pushLog({ type: "hotword_heard", text: txt });
          if (txt.includes("hey astra")) {
            playBeep({ freq: 1400, duration: 50, volume: 0.015 });
            // small pause then listen
            setTimeout(() => startPushToTalk(), 240);
          }
        };
        rec.onend = () => { if (hotwordMode && alive) { try { rec.start(); } catch {} } };
        rec.start();
      } catch {}
    };
    startLoop();
    return () => { alive = false; try { rec.abort(); } catch {} };
  }, [hotwordMode, startPushToTalk, pushLog]);

  // small helper UI for quick actions
  const quick = useCallback((t) => handleUserText(t), [handleUserText]);

  return (
    <div className="app-root">
      <main className="container">
        <header className="header">
          <div className="brand">
            <div className="orb">A</div>
            <div>
              <div className="title">Astra</div>
              <div className="subtitle">Speak. Ask. Command.</div>
            </div>
          </div>

          <div className="controls">
            <label className="switch">
              <input type="checkbox" checked={useTTS} onChange={() => setUseTTS((s) => !s)} />
              <span className="slider" />
            </label>
            <button className="btn small" onClick={() => setHotwordMode((s) => !s)}>{hotwordMode ? "Hotword ON" : "Hotword OFF"}</button>
            <button className="btn primary" onClick={() => startPushToTalk()}>{listening ? "Listening…" : "Mic"}</button>
          </div>
        </header>

        <section className="chat-area">
          <div className="messages">
            {messages.map((m, i) => (
              <motion.div key={i} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className={`message ${m.who === "You" ? "me" : "them"}`}>
                <div className="meta">{m.who} • <span className="ts">{new Date(m.ts).toLocaleTimeString()}</span></div>
                <div className="text">{m.text}</div>
              </motion.div>
            ))}

            {loading && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="message them">
                <div className="meta">Astra • <span className="ts">...</span></div>
                <div className="text">
                  <TypingDots visible={true} />
                </div>
              </motion.div>
            )}
          </div>

          <div className="composer">
            <input
              className="input"
              placeholder="Type a message or command (e.g. 'play kesariya', 'open chrome')"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && input.trim()) handleUserText(input.trim()); }}
            />
            <button className="btn primary" onClick={() => input.trim() && handleUserText(input.trim())}>Send</button>
          </div>
        </section>

        <aside className="sidebar">
          <div className="panel">
            <div className="panel-title">Quick</div>
            <div className="quick-grid">
              <button onClick={() => quick("play kesariya")} className="btn">Play song</button>
              <button onClick={() => quick("open chrome")} className="btn">Open Chrome</button>
              <button onClick={() => quick("set timer for 10 seconds")} className="btn">Timer 10s</button>
            </div>
          </div>

          <div className="panel">
            <div className="panel-title">Recent logs</div>
            <div className="logs">
              {logs.slice(0, 6).map((l, i) => (
                <div key={i} className="log">
                  <div className="log-ts">{new Date(l.ts).toLocaleTimeString()}</div>
                  <pre className="log-pre">{JSON.stringify(l, null, 1)}</pre>
                </div>
              ))}
              {logs.length === 0 && <div className="muted">No logs yet</div>}
            </div>
          </div>
        </aside>
      </main>

      {/* minimal CSS fallback (inlined here for copy ease) */}
      <style>{`
        :root{
          --bg:#071026; --card:#0b1622; --muted:#94a3b8; --accent:#22c1c3; --white:#EFF8FF;
        }
        .app-root{min-height:100vh;background:linear-gradient(180deg,#041021 0%, #061427 100%);color:var(--white);display:flex;align-items:center;justify-content:center;padding:28px;font-family:Inter,ui-sans-serif,system-ui,-apple-system,'Segoe UI',Roboto,'Helvetica Neue',Arial}
        .container{width:100%;max-width:1100px;display:grid;grid-template-columns:1fr 320px;gap:20px}
        .header{grid-column:1/-1;display:flex;align-items:center;justify-content:space-between;margin-bottom:6px}
        .brand{display:flex;align-items:center;gap:12px}
        .orb{width:56px;height:56px;border-radius:12px;background:linear-gradient(135deg,#2dd4bf,#0891b2);display:flex;align-items:center;justify-content:center;color:#001; font-weight:700;font-size:20px;box-shadow:0 8px 30px rgba(2,6,23,0.6)}
        .title{font-size:20px;font-weight:700}
        .subtitle{font-size:12px;color:var(--muted)}
        .controls{display:flex;gap:8px;align-items:center}
        .btn{background:transparent;border:1px solid rgba(255,255,255,0.06);padding:8px 12px;border-radius:8px;color:var(--white);cursor:pointer}
        .btn.primary{background:linear-gradient(90deg,#06b6d4,#0891b2);color:#001;border:none;box-shadow:0 6px 20px rgba(7,23,36,0.6)}
        .btn.small{padding:6px 9px;font-size:13px}
        .chat-area{background:linear-gradient(180deg, rgba(255,255,255,0.02), rgba(255,255,255,0.01));border-radius:12px;padding:16px;display:flex;flex-direction:column;gap:12px;min-height:520px}
        .messages{flex:1;overflow:auto;padding-right:6px;display:flex;flex-direction:column;gap:10px}
        .message{max-width:78%;padding:10px;border-radius:10px;backdrop-filter:blur(6px)}
        .message.them{background:rgba(255,255,255,0.03);align-self:flex-start}
        .message.me{background:linear-gradient(90deg,#06b6d4,#0891b2);color:#002;align-self:flex-end}
        .meta{font-size:11px;color:var(--muted);margin-bottom:6px}
        .text{font-size:15px;line-height:1.35}
        .composer{display:flex;gap:8px;align-items:center}
        .input{flex:1;padding:12px;border-radius:10px;border:1px solid rgba(255,255,255,0.04);background:transparent;color:var(--white);outline:none}
        .sidebar{display:flex;flex-direction:column;gap:12px}
        .panel{background:rgba(255,255,255,0.02);padding:12px;border-radius:10px}
        .panel-title{font-size:13px;color:var(--muted);margin-bottom:8px}
        .quick-grid{display:flex;flex-direction:column;gap:8px}
        .logs{display:flex;flex-direction:column;gap:10px;max-height:260px;overflow:auto}
        .log{background:rgba(255,255,255,0.02);padding:8px;border-radius:8px}
        .log-pre{font-size:12px;color:var(--muted);margin:0}
        .muted{color:var(--muted)}
        /* typing dots */
        .typing-dots{display:inline-flex;gap:6px;align-items:center}
        .typing-dots .dot{width:8px;height:8px;border-radius:50%;background:linear-gradient(90deg,#06b6d4,#0891b2);animation:dot 1s infinite ease-in-out}
        .typing-dots .dot:nth-child(2){animation-delay:0.12s}
        .typing-dots .dot:nth-child(3){animation-delay:0.24s}
        @keyframes dot{0%{transform:translateY(0);opacity:0.4}50%{transform:translateY(-6px);opacity:1}100%{transform:translateY(0);opacity:0.4}}
        /* responsive */
        @media (max-width: 880px){ .container{grid-template-columns:1fr; padding:10px} .sidebar{order:2} .header{flex-direction:column;align-items:flex-start;gap:10px} }
      `}</style>
    </div>
  );
}
