import express from "express";
import cors from "cors";
import axios from "axios";
import dotenv from "dotenv";
import { exec } from "child_process";
import fs from "fs";
import path from "path";
import os from "os";
import { fileURLToPath } from "url";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(cors());
app.use(express.json());

const GROQ_KEY = process.env.GROQ_API_KEY || null;
const MPV_PATH = process.env.MPV_PATH || null;

/* RUN COMMAND */
function runCmd(cmd) {
  return new Promise((resolve, reject) => {
    exec(cmd, { windowsHide: true }, (err, stdout) => {
      if (err) return reject(err);
      resolve(stdout);
    });
  });
}

/* NORMALIZE + FUZZY */
function normalizeName(s = "") {
  return s
    .toString()
    .replace(/[^a-z0-9]/gi, " ")
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
    .join(" ");
}

function fuzzy(candidate, target) {
  const cn = normalizeName(candidate);
  const tn = normalizeName(target);
  if (!tn) return false;
  if (cn.includes(tn)) return true;
  const twords = tn.split(" ");
  return twords.every((w) => cn.includes(w));
}

/* FIND SHORTCUTS */
function gatherShortcuts() {
  const arr = [];
  const paths = [
    path.join(process.env.PUBLIC || "C:\\Users\\Public", "Desktop"),
    path.join(os.homedir(), "Desktop"),
    path.join(process.env.APPDATA || "", "Microsoft\\Windows\\Start Menu\\Programs"),
    path.join(process.env.ProgramData || "C:\\ProgramData", "Microsoft\\Windows\\Start Menu\\Programs")
  ];
  for (const root of paths) {
    try {
      if (!fs.existsSync(root)) continue;
      const stack = [root];
      while (stack.length) {
        const cur = stack.pop();
        let items;
        try { items = fs.readdirSync(cur, { withFileTypes: true }); } catch { continue; }
        for (const f of items) {
          const full = path.join(cur, f.name);
          if (f.isDirectory()) stack.push(full);
          else if (/\.(lnk|url|exe|appref-ms)$/i.test(f.name)) arr.push({ path: full, name: f.name });
        }
      }
    } catch {}
  }
  return arr;
}

/* FIND EXE */
function findExeByName(name) {
  if (!name) return null;
  const key = normalizeName(name);

  const known = {
    notepad: "C:\\Windows\\System32\\notepad.exe",
    brave: "C:\\Program Files\\BraveSoftware\\Brave-Browser\\Application\\brave.exe",
    chrome: "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
    edge: "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
    vlc: "C:\\Program Files\\VideoLAN\\VLC\\vlc.exe",
    spotify: path.join(os.homedir(), "AppData/Roaming/Spotify/Spotify.exe"),
    discord: path.join(os.homedir(), "AppData/Local/Discord/Update.exe"),
    whatsapp: path.join(os.homedir(), "AppData/Local/WhatsApp/WhatsApp.exe"),
    vscode: path.join(os.homedir(), "AppData/Local/Programs/Microsoft VS Code/Code.exe")
  };
  if (known[key] && fs.existsSync(known[key])) return known[key];

  const shortcuts = gatherShortcuts();
  for (const s of shortcuts) {
    if (fuzzy(s.name.replace(/\..+$/, ""), key)) return s.path;
  }

  const roots = [
    "C:\\Program Files",
    "C:\\Program Files (x86)",
    path.join(os.homedir(), "AppData\\Local", "Programs")
  ];

  for (const r of roots) {
    try {
      const stack = [r];
      while (stack.length) {
        const cur = stack.pop();
        let items;
        try { items = fs.readdirSync(cur, { withFileTypes: true }); } catch { continue; }
        for (const f of items) {
          const full = path.join(cur, f.name);
          if (f.isDirectory()) stack.push(full);
          else if (f.isFile() && f.name.toLowerCase().endsWith(".exe")) {
            if (fuzzy(f.name, key)) return full;
          }
        }
      }
    } catch {}
  }
  return null;
}

/* YOUTUBE SEARCH */
async function ytSearchTopVideo(query) {
  try {
    const mod = await import("youtube-search").catch(() => null);
    const yt = mod?.default || mod;
    if (!yt) throw new Error("youtube-search missing");

    return await new Promise((resolve) => {
      yt(query, { maxResults: 1, type: "video" }, (err, results) => {
        if (!err && results?.length) {
          const id = results[0].id;
          // use watch URL with autoplay so browser will attempt to play
          return resolve(`https://www.youtube.com/watch?v=${id}&autoplay=1`);
        }
        resolve(`https://www.youtube.com/results?search_query=${encodeURIComponent(query)}`);
      });
    });
  } catch {
    return `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}`;
  }
}

/* FALLBACK PARSER */
function fallbackParse(text) {
  const t = (text || "").toLowerCase();

  if (t.startsWith("play ")) return { action_id: "play_song", params: { query: text.slice(5).trim() } };
  if (t.startsWith("open ")) return { action_id: "open_any_app", params: { name: text.slice(5).trim() } };
  if (t.includes("youtube")) return { action_id: "open_website", params: { url: "https://youtube.com" } };

  if (t.startsWith("search ") || t.startsWith("google ")) {
    return { action_id: "search_web", params: { query: text.replace(/^(search|google)\s+/i, "") } };
  }

  return { action_id: "open_any_app", params: { name: text } };
}

/* LLM PARSER */
async function llmParse(text) {
  if (!GROQ_KEY) return fallbackParse(text);

  try {
    const body = {
      model: "llama-3.1-8b-instant",
      messages: [
        { role: "system", content: `Return ONLY JSON. Allowed: open_website, open_any_app, play_song, set_timer, set_alarm, system_brightness, system_shutdown, system_reboot, search_web, type_text.` },
        { role: "user", content: text }
      ],
      temperature: 0
    };

    const r = await axios.post("https://api.groq.com/openai/v1/chat/completions", body, {
      headers: { Authorization: `Bearer ${GROQ_KEY}`, "Content-Type": "application/json" }
    });

    const content = r.data.choices?.[0]?.message?.content || "";
    const m = content.match(/\{[\s\S]*?\}/);

    if (m) {
      try {
        const parsed = JSON.parse(m[0]);
        if (parsed.action_id) return parsed;
      } catch {}
    }

    return fallbackParse(text);
  } catch {
    return fallbackParse(text);
  }
}

/* INTENT CLASSIFIER */
async function classifyIntent(text) {
  if (!GROQ_KEY) return { mode: "chat" };

  try {
    const body = {
      model: "llama-3.1-8b-instant",
      messages: [
        { role: "system", content: `Return {"mode":"chat"} or {"mode":"action"} ONLY.` },
        { role: "user", content: text }
      ],
      temperature: 0
    };

    const r = await axios.post("https://api.groq.com/openai/v1/chat/completions", body, {
      headers: { Authorization: `Bearer ${GROQ_KEY}`, "Content-Type": "application/json" }
    });

    const content = r.data.choices?.[0]?.message?.content;
    const m = content?.match(/\{[\s\S]*?\}/);

    if (!m) return { mode: "chat" };

    try {
      const parsed = JSON.parse(m[0]);
      return parsed;
    } catch {
      return { mode: "chat" };
    }
  } catch {
    return { mode: "chat" };
  }
}

/* CHAT MODEL */
async function chatReply(messages) {
  if (!GROQ_KEY) return { reply: "Groq key missing." };

  try {
    const r = await axios.post(
      "https://api.groq.com/openai/v1/chat/completions",
      { model: "llama-3.1-8b-instant", messages, temperature: 0.2 },
      { headers: { Authorization: `Bearer ${GROQ_KEY}`, "Content-Type": "application/json" } }
    );

    return { reply: r.data.choices?.[0]?.message?.content || "" };
  } catch {
    return { reply: "Sorry, I couldn't get an answer right now." };
  }
}

/* ACTION EXECUTOR */
async function executeAction(action) {
  if (!action || !action.action_id) return { error: "invalid_action" };

  const aid = action.action_id;
  const params = action.params || {};

  try {
    if (aid === "open_website") {
      await runCmd(`start "" "${params.url}"`);
      return { ok: true };
    }

    if (aid === "play_song") {
      const url = await ytSearchTopVideo(params.query);
      await runCmd(`start "" "${url}"`);
      return { ok: true };
    }

    if (aid === "open_any_app") {
      const exe = findExeByName(params.name);
      if (exe) {
        await runCmd(`start "" "${exe}"`);
        return { ok: true };
      }
      return { error: "not_found" };
    }

    if (aid === "search_web") {
      const url = `https://www.google.com/search?q=${encodeURIComponent(params.query)}`;
      await runCmd(`start "" "${url}"`);
      return { ok: true };
    }

    return { error: "unknown_action" };
  } catch (e) {
    return { error: "execution_failed", details: String(e) };
  }
}

/* ROUTES */
app.post("/api/intent", async (req, res) => {
  const intent = await classifyIntent(req.body.text);
  res.json(intent);
});

app.post("/api/chat", async (req, res) => {
  const reply = await chatReply(req.body.messages);
  res.json(reply);
});

app.post("/api/parseAction", async (req, res) => {
  const parsed = await llmParse(req.body.text);
  res.json({ action: parsed });
});

app.post("/api/executeAction", async (req, res) => {
  const result = await executeAction(req.body.action);
  res.json(result);
});

/* START */
const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`Astra backend running on http://localhost:${PORT}`));
