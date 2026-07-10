import express from "express";
import path from "path";
import fs from "fs";
import { execSync, exec } from "child_process";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI } from "@google/genai";
import dotenv from "dotenv";
import crypto from "crypto";

dotenv.config();

const app = express();
const PORT = 3000;

// Enable robust CORS and handle browser OPTIONS preflight requests
app.use((req, res, next) => {
  const origin = req.headers.origin;
  if (origin) {
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Access-Control-Allow-Credentials", "true");
  } else {
    res.setHeader("Access-Control-Allow-Origin", "*");
  }
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization, x-app-request-signature");
  
  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }
  next();
});

const isVercel = !!process.env.VERCEL;
const DB_FILE = isVercel ? "/tmp/db.json" : path.join(process.cwd(), "db.json");

if (isVercel && !fs.existsSync("/tmp/db.json")) {
  try {
    const bundledDbPath = path.join(process.cwd(), "db.json");
    if (fs.existsSync(bundledDbPath)) {
      fs.copyFileSync(bundledDbPath, "/tmp/db.json");
      console.log("Initialized writeable DB in Vercel /tmp/db.json from bundled db.json");
    } else {
      fs.writeFileSync("/tmp/db.json", JSON.stringify({ users: [], claimedNumbers: [] }, null, 2));
      console.log("Created empty writeable DB in Vercel /tmp/db.json");
    }
  } catch (err) {
    console.error("Vercel DB initialization error:", err);
  }
}

// Middleware to parse JSON
app.use(express.json());

let dbCache: any = null;
let lastDbLoadTime = 0;
const DB_CACHE_TTL = 3000; // 3 seconds cache TTL to avoid redundant fetches on rapid requests

async function loadDbFromStore() {
  const now = Date.now();
  if (dbCache && (now - lastDbLoadTime < DB_CACHE_TTL)) {
    return dbCache;
  }

  if (process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN) {
    try {
      const url = `${process.env.KV_REST_API_URL}/get/teamzero_db`;
      const res = await fetch(url, {
        headers: {
          Authorization: `Bearer ${process.env.KV_REST_API_TOKEN}`
        }
      });
      if (res.ok) {
        const data = await res.json();
        if (data && data.result) {
          dbCache = JSON.parse(data.result);
          lastDbLoadTime = Date.now();
          try {
            fs.writeFileSync(DB_FILE, data.result, "utf8");
          } catch {}
          return dbCache;
        }
      }
    } catch (err) {
      console.error("[DB Store] Vercel KV Load failed:", err);
    }
  }

  try {
    if (fs.existsSync(DB_FILE)) {
      const data = fs.readFileSync(DB_FILE, "utf-8");
      dbCache = JSON.parse(data);
    } else {
      dbCache = { users: [], claimedNumbers: [], manualNumbers: [], manualSms: [] };
    }
    lastDbLoadTime = Date.now();
  } catch (err) {
    console.error("[DB Store] Local Load failed, resetting:", err);
    dbCache = { users: [], claimedNumbers: [], manualNumbers: [], manualSms: [] };
    lastDbLoadTime = Date.now();
  }

  return dbCache;
}

async function saveDbToStore() {
  if (!dbCache) return;

  if (!dbCache.users) dbCache.users = [];
  if (!dbCache.claimedNumbers) dbCache.claimedNumbers = [];
  if (!dbCache.manualNumbers) dbCache.manualNumbers = [];
  if (!dbCache.manualSms) dbCache.manualSms = [];

  const dbStr = JSON.stringify(dbCache, null, 2);

  try {
    fs.writeFileSync(DB_FILE, dbStr, "utf8");
  } catch (err) {
    console.error("[DB Store] Local save failed:", err);
  }

  if (process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN) {
    try {
      const url = process.env.KV_REST_API_URL;
      const res = await fetch(url, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${process.env.KV_REST_API_TOKEN}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify(["SET", "teamzero_db", dbStr])
      });
      if (!res.ok) {
        console.error("[DB Store] Vercel KV save failed status:", res.status);
      }
    } catch (err) {
      console.error("[DB Store] Vercel KV Save failed:", err);
    }
  }
}

// Middleware to pre-load database from store
app.use(async (req, res, next) => {
  if (req.path.startsWith("/api/")) {
    await loadDbFromStore();
  }
  next();
});

// Secure API check to protect endpoints from scraping and unauthorized access
app.use((req, res, next) => {
  if (req.path.startsWith("/api/")) {
    if (
      req.path === "/api/cron/poll" || 
      req.path === "/api/admin/system-status" ||
      req.path === "/api/users/login" ||
      req.path === "/api/users/register"
    ) {
      return next();
    }
    // Exclude basic endpoints that don't need signature (or allow if correct headers)
    const sig = req.headers["x-app-request-signature"];
    if (sig !== "IPRN-SMS-PANEL-SECURE-2026") {
      return res.status(403).json({
        success: false,
        error: "Access Denied. Secure API Protection Active. HTML/API download blocked."
      });
    }
  }
  next();
});

// Initialize Database structure
if (!fs.existsSync(DB_FILE)) {
  fs.writeFileSync(
    DB_FILE,
    JSON.stringify({ users: [], claimedNumbers: [] }, null, 2)
  );
} else {
  // Check if current DB format needs migration
  try {
    const raw = fs.readFileSync(DB_FILE, "utf-8");
    const json = JSON.parse(raw);
    let changed = false;
    if (!json.users) {
      const oldConfig = json.botConfig || {};
      const oldSubs = json.subscribers || [];
      json.users = [
        {
          id: "default_user",
          username: "TeamZeroAdmin",
          email: "admin@teamzero.com",
          password: "admin",
          botConfig: {
            token: oldConfig.token || "",
            groupId: oldConfig.groupId || "",
            ownerChatId: "583921",
            botLink: oldConfig.botLink || "https://t.me/teamzerotrace",
            otpGroupUrl: oldConfig.otpGroupUrl || "https://whatsapp.com/channel/0029Vb7CHRO96H4QS1ynKI1J",
            status: oldConfig.token ? "active" : "offline"
          },
          subscribers: oldSubs
        }
      ];
      changed = true;
    }
    if (!json.claimedNumbers) {
      json.claimedNumbers = [];
      changed = true;
    }
    if (changed) {
      fs.writeFileSync(DB_FILE, JSON.stringify(json, null, 2));
    }
  } catch (err) {
    console.error("Migration error, resetting DB:", err);
    fs.writeFileSync(
      DB_FILE,
      JSON.stringify({ users: [], claimedNumbers: [] }, null, 2)
    );
  }
}

// Database Helpers
function readDb() {
  if (!dbCache) {
    try {
      if (fs.existsSync(DB_FILE)) {
        const data = fs.readFileSync(DB_FILE, "utf-8");
        dbCache = JSON.parse(data);
      }
    } catch {}
    if (!dbCache) {
      dbCache = { users: [], claimedNumbers: [], manualNumbers: [], manualSms: [] };
    }
  }
  if (!dbCache.users) dbCache.users = [];
  if (!dbCache.claimedNumbers) dbCache.claimedNumbers = [];
  if (!dbCache.manualNumbers) dbCache.manualNumbers = [];
  if (!dbCache.manualSms) dbCache.manualSms = [];
  return dbCache;
}

function writeDb(data: any) {
  dbCache = data;
  if (!dbCache.users) dbCache.users = [];
  if (!dbCache.claimedNumbers) dbCache.claimedNumbers = [];
  if (!dbCache.manualNumbers) dbCache.manualNumbers = [];
  if (!dbCache.manualSms) dbCache.manualSms = [];
  
  try {
    fs.writeFileSync(DB_FILE, JSON.stringify(dbCache, null, 2), "utf8");
  } catch {}

  saveDbToStore().catch((err) => {
    console.error("[DB Store] Async Save failed:", err);
  });
}

function claimNumberInDb(number: string) {
  const db = readDb();
  const clean = number.replace(/[\s\-\+]/g, "");
  
  if (!db.claimedNumbers.includes(clean)) {
    db.claimedNumbers.push(clean);
  }
  if (db.manualNumbers) {
    db.manualNumbers = db.manualNumbers.filter((n: any) => {
      const cleanN = n.number.replace(/[\s\-\+]/g, "");
      return cleanN !== clean;
    });
  }
  writeDb(db);
}

// Aggregation APIs list
interface ApiEndpoint {
  label: string;
  numbers: string;
  sms: string;
  fallbackNumbers?: string[];
  fallbackSms?: string[];
}

const API_ENDPOINTS: ApiEndpoint[] = [
  // Core (pichli APIs)
  { label: "Konekta", numbers: "https://konekta-api-52.silenthost.pro/api/numbers", sms: "https://konekta-api-52.silenthost.pro/api/sms" },
  { label: "NP",      numbers: "https://np-api-56.silenthost.pro/api/numbers",      sms: "https://np-api-56.silenthost.pro/api/sms" },
  { label: "HADI",    numbers: "https://hadi-sms-53.silenthost.pro/api/numbers",    sms: "https://hadi-sms-53.silenthost.pro/api/sms" },

  // New User APIs (1-29) with fallback candidates
  { label: "MIS [1]", numbers: "https://mis-panel-production.up.railway.app/api/just_numbers", sms: "https://mis-panel-production.up.railway.app/api/just_sms", fallbackNumbers: ["https://mis-panel-production.up.railway.app/api/numbers", "https://mis-panel-production.up.railway.app/api/ju"], fallbackSms: ["https://mis-panel-production.up.railway.app/api/sms", "https://mis-panel-production.up.railway.app/api/ju"] },
  { label: "NP_Prod [2]", numbers: "http://number-panel-production.up.railway.app/api/just_numbers", sms: "http://number-panel-production.up.railway.app/api/just_sms", fallbackNumbers: ["http://number-panel-production.up.railway.app/api/numbers"], fallbackSms: ["http://number-panel-production.up.railway.app/api/sms"] },
  { label: "Arslan [3]", numbers: "https://arslan-sms-panel-26c7a6f5777d.herokuapp.com/api/just_numbers", sms: "https://arslan-sms-panel-26c7a6f5777d.herokuapp.com/api/just_sms", fallbackNumbers: ["https://arslan-sms-panel-26c7a6f5777d.herokuapp.com/api/numbers"], fallbackSms: ["https://arslan-sms-panel-26c7a6f5777d.herokuapp.com/api/sms"] },
  { label: "Kami [4]", numbers: "http://kami-api-production-40eb.up.railway.app/api/just_numbers", sms: "http://kami-api-production-40eb.up.railway.app/api/just_sms" },
  { label: "Kami [5]", numbers: "http://kami-api-production-40eb.up.railway.app/api/just_numbers", sms: "http://kami-api-production-40eb.up.railway.app/api/just_sms" },
  { label: "Kami_KK [6]", numbers: "http://kami-api1-production.up.railway.app/api/kk?type=numbers", sms: "http://kami-api1-production.up.railway.app/api/kk?type=sms", fallbackNumbers: ["http://kami-api1-production.up.railway.app/api/kk"], fallbackSms: ["http://kami-api1-production.up.railway.app/api/kk"] },
  { label: "Kami_HS [7]", numbers: "http://kami-api1-production.up.railway.app/api/hs?type=numbers", sms: "http://kami-api1-production.up.railway.app/api/hs?type=sms", fallbackNumbers: ["http://kami-api1-production.up.railway.app/api/hs"], fallbackSms: ["http://kami-api1-production.up.railway.app/api/hs"] },
  { label: "Kami_MSI [8]", numbers: "http://kami-api1-production.up.railway.app/api/msi?type=numbers", sms: "http://kami-api1-production.up.railway.app/api/msi?type=sms", fallbackNumbers: ["http://kami-api1-production.up.railway.app/api/msi"], fallbackSms: ["http://kami-api1-production.up.railway.app/api/msi"] },
  { label: "Kami_ROX [9]", numbers: "http://kami-api1-production.up.railway.app/api/rox?type=numbers", sms: "http://kami-api1-production.up.railway.app/api/rox?type=sms", fallbackNumbers: ["http://kami-api1-production.up.railway.app/api/rox"], fallbackSms: ["http://kami-api1-production.up.railway.app/api/rox"] },
  { label: "Kami_CH [10]", numbers: "http://kami-api1-production.up.railway.app/api/ch?type=numbers", sms: "http://kami-api1-production.up.railway.app/api/ch?type=sms", fallbackNumbers: ["http://kami-api1-production.up.railway.app/api/ch"], fallbackSms: ["http://kami-api1-production.up.railway.app/api/ch"] },
  { label: "Kami_TS [11]", numbers: "http://kami-api1-production.up.railway.app/api/ts?type=numbers", sms: "http://kami-api1-production.up.railway.app/api/ts?type=sms", fallbackNumbers: ["http://kami-api1-production.up.railway.app/api/ts"], fallbackSms: ["http://kami-api1-production.up.railway.app/api/ts"] },
  { label: "Kami_IVS [12]", numbers: "http://kami-api1-production.up.railway.app/api/ivs?type=numbers", sms: "http://kami-api1-production.up.railway.app/api/ivs?type=sms", fallbackNumbers: ["http://kami-api1-production.up.railway.app/api/ivs"], fallbackSms: ["http://kami-api1-production.up.railway.app/api/ivs"] },
  { label: "Kami_GOA [13]", numbers: "http://kami-api1-production.up.railway.app/api/goa?type=numbers", sms: "http://kami-api1-production.up.railway.app/api/goa?type=sms", fallbackNumbers: ["http://kami-api1-production.up.railway.app/api/goa"], fallbackSms: ["http://kami-api1-production.up.railway.app/api/goa"] },
  { label: "Kami_MAI [14]", numbers: "http://kami-api1-production.up.railway.app/api/mai?type=numbers", sms: "http://kami-api1-production.up.railway.app/api/mai?type=sms", fallbackNumbers: ["http://kami-api1-production.up.railway.app/api/mai"], fallbackSms: ["http://kami-api1-production.up.railway.app/api/mai"] },
  { label: "NP_Prod [15]", numbers: "https://number-panel-production.up.railway.app/api/just_numbers", sms: "https://number-panel-production.up.railway.app/api/just_sms" },
  { label: "MIS_0ed1 [16]", numbers: "https://mis-panel-production-0ed1.up.railway.app/api/just_numbers", sms: "https://mis-panel-production-0ed1.up.railway.app/api/just_sms" },
  { label: "NP_2c7c [17]", numbers: "https://number-panel-production-2c7c.up.railway.app/api/just_numbers", sms: "https://number-panel-production-2c7c.up.railway.app/api/just_sms" },
  { label: "NP_2c7c [18]", numbers: "https://number-panel-production-2c7c.up.railway.app/api/just_numbers", sms: "https://number-panel-production-2c7c.up.railway.app/api/just_sms" },
  { label: "MIS_0ed1 [19]", numbers: "https://mis-panel-production-0ed1.up.railway.app/api/just_numbers", sms: "https://mis-panel-production-0ed1.up.railway.app/api/just_sms" },
  { label: "Time_Panel [20]", numbers: "https://time-panel-production-95f3.up.railway.app/api/just_numbers", sms: "https://time-panel-production-95f3.up.railway.app/api/just_sms" },
  { label: "MIS_Ju [21]", numbers: "https://mis-panel-production.up.railway.app/api/Just_numbers", sms: "https://mis-panel-production.up.railway.app/api/Just_sms", fallbackNumbers: ["https://mis-panel-production.up.railway.app/api/ju"], fallbackSms: ["https://mis-panel-production.up.railway.app/api/ju"] },
  { label: "N_NP [22]", numbers: "http://n-number-panel-production.up.railway.app/api/just_numbers", sms: "http://n-number-panel-production.up.railway.app/api/just_sms" },
  { label: "MIS_Ju [23]", numbers: "https://mis-panel-production.up.railway.app/api/just_numbers", sms: "https://mis-panel-production.up.railway.app/api/just_sms", fallbackNumbers: ["https://mis-panel-production.up.railway.app/api/ju"], fallbackSms: ["https://mis-panel-production.up.railway.app/api/ju"] },
  { label: "NP_Prod [24]", numbers: "https://number-panel-production.up.railway.app/api/just_numbers", sms: "https://number-panel-production.up.railway.app/api/just_sms" },
  { label: "NP_Prod [25]", numbers: "https://number-panel-production.up.railway.app/api/just_numbers", sms: "https://number-panel-production.up.railway.app/api/just_sms" },
  { label: "MIS_Gi [26]", numbers: "https://mis-panel-production.up.railway.app/api/give_numbers", sms: "https://mis-panel-production.up.railway.app/api/give_sms", fallbackNumbers: ["https://mis-panel-production.up.railway.app/api/gi", "https://mis-panel-production.up.railway.app/api/git"], fallbackSms: ["https://mis-panel-production.up.railway.app/api/gi", "https://mis-panel-production.up.railway.app/api/git"] },
  { label: "MIS_Gi [27]", numbers: "https://mis-panel-production.up.railway.app/api/give_numbers", sms: "https://mis-panel-production.up.railway.app/api/give_sms", fallbackNumbers: ["https://mis-panel-production.up.railway.app/api/gi", "https://mis-panel-production.up.railway.app/api/git"], fallbackSms: ["https://mis-panel-production.up.railway.app/api/gi", "https://mis-panel-production.up.railway.app/api/git"] },
  { label: "Hadi_90b2 [28]", numbers: "https://hadibhai-production-90b2.up.railway.app/api/just_numbers", sms: "https://hadibhai-production-90b2.up.railway.app/api/just_sms" },
  { label: "Hadi_90b2 [29]", numbers: "https://hadibhai-production-90b2.up.railway.app/api/just_numbers", sms: "https://hadibhai-production-90b2.up.railway.app/api/just_sms" }
];

// Background API telemetry states
export const backgroundApiStats: { [key: string]: { success: number; fail: number; lastStatus: string; lastError: string; lastSuccessTime: string; url: string } } = {};

// Initialize backgroundApiStats
for (const api of API_ENDPOINTS) {
  backgroundApiStats[api.label] = {
    success: 0,
    fail: 0,
    lastStatus: "Pending",
    lastError: "",
    lastSuccessTime: "",
    url: api.sms
  };
}
backgroundApiStats["iVasms"] = {
  success: 0,
  fail: 0,
  lastStatus: "Pending",
  lastError: "",
  lastSuccessTime: "",
  url: "Portal session-based extraction"
};

// Memory Caches
let cachedNumbers: any[] = [];
let cachedSms: any[] = [];
export let targetApiSmsHistory: any[] = [];
const perSourceSmsCache: { [source: string]: any[] } = {};
const perSourceNumbersCache: { [source: string]: any[] } = {};
let lastNumbersFetchTime = 0;
let lastSmsFetchTime = 0;
const CACHE_TTL = 5000;

// ============================================================
//  REAL WHATSAPP INTEGRATION ENGINE (BAILEYS)
// ============================================================
let baileysLoaded = false;
let makeWASocket: any;
let useMultiFileAuthState: any;
let DisconnectReason: any;
let pino: any;

async function loadBaileys() {
  if (baileysLoaded) return;
  try {
    pino = (await import("pino")).default;
    const baileys = await import("@whiskeysockets/baileys");
    makeWASocket = baileys.default || baileys;
    useMultiFileAuthState = baileys.useMultiFileAuthState;
    DisconnectReason = baileys.DisconnectReason;
    baileysLoaded = true;
    console.log("Baileys loaded successfully!");
  } catch (err) {
    console.error("Failed to load Baileys:", err);
  }
}

let whatsappSocket: any = null;
let whatsappStatus: "offline" | "connecting" | "active" = "offline";
let lastPairingCode: string = "";
let pairingPhoneNumber: string = "";

async function initWhatsApp() {
  await loadBaileys();
  if (!baileysLoaded) return;

  const authDir = path.join(process.cwd(), "whatsapp_auth");
  const logger = pino({ level: "silent" });

  try {
    const { state, saveCreds } = await useMultiFileAuthState(authDir);

    whatsappSocket = makeWASocket({
      auth: state,
      printQRInTerminal: false,
      logger,
      browser: ["Team Zero Bot", "Chrome", "1.0.0"],
      syncFullHistory: false
    });

    whatsappStatus = "connecting";

    whatsappSocket.ev.on("creds.update", saveCreds);

    whatsappSocket.ev.on("connection.update", (update: any) => {
      const { connection, lastDisconnect } = update;
      if (connection === "close") {
        const statusCode = lastDisconnect?.error?.output?.statusCode;
        const shouldReconnect = statusCode !== DisconnectReason.loggedOut;
        console.log(`WhatsApp connection closed (statusCode: ${statusCode}). Reconnecting:`, shouldReconnect);
        whatsappStatus = "offline";
        if (shouldReconnect) {
          setTimeout(initWhatsApp, 5000);
        } else {
          // Clear credentials folder if logged out
          try {
            if (fs.existsSync(authDir)) {
              fs.rmSync(authDir, { recursive: true, force: true });
            }
          } catch {}
          
          const db = readDb();
          let changed = false;
          db.users.forEach((user: any) => {
            if (user.botConfig) {
              user.botConfig.whatsappStatus = "offline";
              changed = true;
            }
          });
          if (changed) writeDb(db);
        }
      } else if (connection === "open") {
        console.log("WhatsApp connection is now ACTIVE!");
        whatsappStatus = "active";
        
        // Save the active status back to db.json for any active user configurations
        const db = readDb();
        let changed = false;
        db.users.forEach((user: any) => {
          if (user.botConfig && user.botConfig.whatsappPhone) {
            user.botConfig.whatsappStatus = "active";
            user.botConfig.whatsappEnabled = true;
            changed = true;
          }
        });
        if (changed) writeDb(db);
      }
    });
  } catch (err) {
    console.error("Error in initWhatsApp:", err);
    whatsappStatus = "offline";
  }
}

async function requestWhatsAppPairingCode(phoneNumber: string): Promise<string> {
  await loadBaileys();
  if (!baileysLoaded) throw new Error("WhatsApp module not loaded");

  pairingPhoneNumber = phoneNumber.replace(/[^0-9]/g, "");
  if (!pairingPhoneNumber) {
    throw new Error("Invalid phone number");
  }

  // Clear previous session/auth directory to allow a fresh login
  const authDir = path.join(process.cwd(), "whatsapp_auth");
  try {
    if (fs.existsSync(authDir)) {
      fs.rmSync(authDir, { recursive: true, force: true });
    }
  } catch (e) {
    console.error("Error clearing old auth dir:", e);
  }

  const logger = pino({ level: "silent" });
  const { state, saveCreds } = await useMultiFileAuthState(authDir);

  whatsappSocket = makeWASocket({
    auth: state,
    printQRInTerminal: false,
    logger,
    browser: ["Team Zero Bot", "Chrome", "1.0.0"],
    syncFullHistory: false
  });

  whatsappStatus = "connecting";

  whatsappSocket.ev.on("creds.update", saveCreds);

  whatsappSocket.ev.on("connection.update", (update: any) => {
    const { connection, lastDisconnect } = update;
    if (connection === "close") {
      const statusCode = lastDisconnect?.error?.output?.statusCode;
      const shouldReconnect = statusCode !== DisconnectReason.loggedOut;
      console.log("WhatsApp pairing socket closed. Reconnecting:", shouldReconnect);
      whatsappStatus = "offline";
    } else if (connection === "open") {
      console.log("WhatsApp paired successfully and now ACTIVE!");
      whatsappStatus = "active";
      
      const db = readDb();
      let changed = false;
      db.users.forEach((user: any) => {
        if (user.botConfig && user.botConfig.whatsappPhone && user.botConfig.whatsappPhone.replace(/[^0-9]/g, "") === pairingPhoneNumber) {
          user.botConfig.whatsappStatus = "active";
          user.botConfig.whatsappEnabled = true;
          changed = true;
        }
      });
      if (changed) writeDb(db);
    }
  });

  // Wait 3 seconds for socket to initialize, then request pairing code
  await new Promise(resolve => setTimeout(resolve, 3000));
  
  console.log("Requesting pairing code for:", pairingPhoneNumber);
  const code = await whatsappSocket.requestPairingCode(pairingPhoneNumber);
  lastPairingCode = code;
  return code;
}

async function sendRealWhatsAppMessage(jid: string, text: string) {
  if (whatsappSocket && whatsappStatus === "active") {
    try {
      let formattedJid = jid.trim();
      if (!formattedJid.includes("@")) {
        // If it's a number, format as a user JID, otherwise it could be a group JID format
        if (/^\d+$/.test(formattedJid)) {
          formattedJid = `${formattedJid}@s.whatsapp.net`;
        } else {
          // Default to newsletter if it contains @newsletter suffix or is a standard group ID format
          if (formattedJid.includes("newsletter") || formattedJid.includes("-") || formattedJid.length > 15) {
            formattedJid = `${formattedJid}@g.us`;
          } else {
            formattedJid = `${formattedJid}@s.whatsapp.net`;
          }
        }
      }
      // If it ends with @newsletter, Baileys has @newsletter suffix
      if (jid.includes("@newsletter")) {
        formattedJid = jid;
      }
      await whatsappSocket.sendMessage(formattedJid, { text });
      console.log(`Real WhatsApp message sent to ${formattedJid}: ${text.substring(0, 50)}`);
      return true;
    } catch (err) {
      console.error(`Failed to send real WhatsApp message to ${jid}:`, err);
    }
  }
  return false;
}

// Auto-start WhatsApp connection if active session folder exists on server boot
const authFolder = path.join(process.cwd(), "whatsapp_auth");
if (fs.existsSync(path.join(authFolder, "creds.json"))) {
  console.log("WhatsApp active credentials folder found. Connecting...");
  initWhatsApp().catch(e => console.error("Error auto-starting WhatsApp connection:", e));
}


function getCountryFromNumber(num: string): string {
  const clean = num.replace(/[^0-9]/g, "");
  if (!clean) return "Indonesia";

  // 3-digit prefixes
  const prefix3 = clean.substring(0, 3);
  if (prefix3 === "233") return "Ghana";
  if (prefix3 === "249") return "Sudan";
  if (prefix3 === "221") return "Senegal";
  if (prefix3 === "260") return "Zambia";
  if (prefix3 === "241") return "Gabon";
  if (prefix3 === "258") return "Mozambique";
  if (prefix3 === "962") return "Jordan";
  if (prefix3 === "213") return "Algeria";
  if (prefix3 === "263") return "Zimbabwe";
  if (prefix3 === "855") return "Cambodia";
  if (prefix3 === "880") return "Bangladesh";
  if (prefix3 === "964") return "Iraq";
  if (prefix3 === "966") return "Saudi Arabia";
  if (prefix3 === "971") return "UAE";
  if (prefix3 === "212") return "Morocco";
  if (prefix3 === "234") return "Nigeria";
  if (prefix3 === "254") return "Kenya";
  if (prefix3 === "351") return "Portugal";
  if (prefix3 === "353") return "Ireland";
  if (prefix3 === "380") return "Ukraine";
  if (prefix3 === "961") return "Lebanon";
  if (prefix3 === "963") return "Syria";
  if (prefix3 === "965") return "Kuwait";
  if (prefix3 === "967") return "Yemen";
  if (prefix3 === "968") return "Oman";
  if (prefix3 === "972") return "Israel";
  if (prefix3 === "974") return "Qatar";
  if (prefix3 === "994") return "Azerbaijan";
  if (prefix3 === "124") return "Barbados";

  // 2-digit prefixes
  const prefix2 = clean.substring(0, 2);
  if (prefix2 === "62") return "Indonesia";
  if (prefix2 === "20") return "Egypt";
  if (prefix2 === "33") return "France";
  if (prefix2 === "58") return "Venezuela";
  if (prefix2 === "92") return "Pakistan";
  if (prefix2 === "91") return "India";
  if (prefix2 === "44") return "UK";
  if (prefix2 === "55") return "Brazil";
  if (prefix2 === "54") return "Argentina";
  if (prefix2 === "57") return "Colombia";
  if (prefix2 === "52") return "Mexico";
  if (prefix2 === "49") return "Germany";
  if (prefix2 === "34") return "Spain";
  if (prefix2 === "39") return "Italy";
  if (prefix2 === "81") return "Japan";
  if (prefix2 === "86") return "China";
  if (prefix2 === "82") return "South Korea";
  if (prefix2 === "27") return "South Africa";
  if (prefix2 === "61") return "Australia";
  if (prefix2 === "64") return "New Zealand";
  if (prefix2 === "84") return "Vietnam";
  if (prefix2 === "63") return "Philippines";
  if (prefix2 === "90") return "Turkey";
  if (prefix2 === "98") return "Iran";
  if (prefix2 === "93") return "Afghanistan";
  if (prefix2 === "95") return "Myanmar";

  // 1-digit prefixes
  const prefix1 = clean.substring(0, 1);
  if (prefix1 === "1") return "USA";
  if (prefix1 === "7") return "Russia";

  // default country
  return "Indonesia";
}

function getCountryFlag(country: string): string {
  const map: { [key: string]: string } = {
    Venezuela: "🇻🇪", Pakistan: "🇵🇰", India: "🇮🇳", USA: "🇺🇸", Canada: "🇨🇦",
    UK: "🇬🇧", Brazil: "🇧🇷", Argentina: "🇦🇷", Colombia: "🇨🇴", Mexico: "🇲🇽",
    France: "🇫🇷", Germany: "🇩🇪", Spain: "🇪🇸", Italy: "🇮🇹", Russia: "🇷🇺",
    Japan: "🇯🇵", China: "🇨🇳", "South Korea": "🇰🇷", "Saudi Arabia": "🇸🇦",
    UAE: "🇦🇪", Egypt: "🇪🇬", Nigeria: "🇳🇬", "South Africa": "🇿🇦",
    Australia: "🇦🇺", "New Zealand": "🇳🇿", Indonesia: "🇲🇨", Ghana: "🇬🇭",
    Sudan: "🇸🇩", Senegal: "🇸🇳", Zambia: "🇿🇲", Gabon: "🇬🇦", Cambodia: "🇰🇭",
    Barbados: "🇧🇧", Mozambique: "🇲🇿", Jordan: "🇯🇴", Algeria: "🇩🇿",
    Zimbabwe: "🇿🇼", Bangladesh: "🇧🇩", Iraq: "🇮🇶", Morocco: "🇲🇦", Kenya: "🇰🇪",
    Portugal: "🇵🇹", Ireland: "🇮🇪", Ukraine: "🇺🇦", Lebanon: "🇱🇧", Syria: "🇸🇾",
    Kuwait: "🇰🇼", Yemen: "🇾🇪", Oman: "🇴🇲", Israel: "🇮🇱", Qatar: "🇶🇦",
    Azerbaijan: "🇦🇿"
  };
  return map[country] || "🇲🇨"; // Fallback to Indonesia flag so it is never a plain earth or missing flag
}

function detectServiceFromMessageAndSender(sender: string, message: string): string {
  const cleanSender = String(sender || "").toLowerCase();
  const cleanMsg = String(message || "").toLowerCase();

  if (cleanSender.includes("telegram") || cleanMsg.includes("telegram") || cleanMsg.includes("tg code") || cleanMsg.includes("t.me")) {
    return "Telegram";
  }
  if (cleanSender.includes("rednote") || cleanSender.includes("xiaohongshu") || cleanMsg.includes("rednote") || cleanMsg.includes("xiaohongshu") || cleanMsg.includes("xhs")) {
    return "Rednote";
  }
  if (cleanSender.includes("imo") || cleanMsg.includes("imo")) {
    return "Imo";
  }
  if (cleanSender.includes("whatsapp") || cleanMsg.includes("whatsapp") || cleanMsg.includes("wa code")) {
    return "WhatsApp";
  }
  
  if (sender && sender !== "Unknown" && sender.trim() !== "") {
    return sender.trim();
  }
  return "Other Service";
}

function execPromise(cmd: string, options: any = {}): Promise<string> {
  return new Promise((resolve, reject) => {
    exec(cmd, options, (error, stdout, stderr) => {
      if (error) {
        resolve(String(stdout || ""));
      } else {
        resolve(String(stdout));
      }
    });
  });
}

let proxyList: string[] = [];
let currentProxyIndex = 0;
let lastProxyFetchTime = 0;

async function refreshProxyList() {
  const now = Date.now();
  if (proxyList.length > 0 && now - lastProxyFetchTime < 10 * 60 * 1000) {
    return;
  }
  try {
    console.log("[ProxyPool] Fetching fresh proxy list from multiple sources...");
    const userAgent = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";
    
    // Fetch from Proxyscrape HTTP & SOCKS5 & SOCKS4
    const httpUrl = "https://api.proxyscrape.com/v2/?request=displayproxies&protocol=http&timeout=3000&country=all&ssl=yes&anonymity=all";
    const httpText = await execPromise(`curl -s -4 -m 8 -A "${userAgent}" "${httpUrl}"`);
    const httpFetched = httpText.split("\n").map(p => p.trim()).filter(p => p.length > 0 && p.includes(":")).map(p => `http://${p}`);

    const socks5Url = "https://api.proxyscrape.com/v2/?request=displayproxies&protocol=socks5&timeout=3000&country=all&anonymity=all";
    const socks5Text = await execPromise(`curl -s -4 -m 8 -A "${userAgent}" "${socks5Url}"`);
    const socks5Fetched = socks5Text.split("\n").map(p => p.trim()).filter(p => p.length > 0 && p.includes(":")).map(p => `socks5h://${p}`);

    const socks4Url = "https://api.proxyscrape.com/v2/?request=displayproxies&protocol=socks4&timeout=3000&country=all&anonymity=all";
    const socks4Text = await execPromise(`curl -s -4 -m 8 -A "${userAgent}" "${socks4Url}"`);
    const socks4Fetched = socks4Text.split("\n").map(p => p.trim()).filter(p => p.length > 0 && p.includes(":")).map(p => `socks4a://${p}`);

    // Fetch from GitHub SOCKS-List (SOCKS5 & HTTP & SOCKS4)
    const ghSocks5Text = await execPromise(`curl -s -4 -m 8 -A "${userAgent}" "https://raw.githubusercontent.com/TheSpeedX/SOCKS-List/master/socks5.txt"`);
    const ghSocks5Fetched = ghSocks5Text.split("\n").map(p => p.trim()).filter(p => p.length > 0 && p.includes(":")).map(p => `socks5h://${p}`);

    const ghSocks4Text = await execPromise(`curl -s -4 -m 8 -A "${userAgent}" "https://raw.githubusercontent.com/TheSpeedX/SOCKS-List/master/socks4.txt"`);
    const ghSocks4Fetched = ghSocks4Text.split("\n").map(p => p.trim()).filter(p => p.length > 0 && p.includes(":")).map(p => `socks4a://${p}`);

    const ghHttpText = await execPromise(`curl -s -4 -m 8 -A "${userAgent}" "https://raw.githubusercontent.com/TheSpeedX/SOCKS-List/master/http.txt"`);
    const ghHttpFetched = ghHttpText.split("\n").map(p => p.trim()).filter(p => p.length > 0 && p.includes(":")).map(p => `http://${p}`);

    // Additional highly updated GitHub proxy lists
    const monosansS5Text = await execPromise(`curl -s -4 -m 8 -A "${userAgent}" "https://raw.githubusercontent.com/monosans/proxy-list/main/proxies/socks5.txt"`);
    const monosansS5Fetched = monosansS5Text.split("\n").map(p => p.trim()).filter(p => p.length > 0 && p.includes(":")).map(p => `socks5h://${p}`);

    const monosansS4Text = await execPromise(`curl -s -4 -m 8 -A "${userAgent}" "https://raw.githubusercontent.com/monosans/proxy-list/main/proxies/socks4.txt"`);
    const monosansS4Fetched = monosansS4Text.split("\n").map(p => p.trim()).filter(p => p.length > 0 && p.includes(":")).map(p => `socks4a://${p}`);

    const monosansHttpText = await execPromise(`curl -s -4 -m 8 -A "${userAgent}" "https://raw.githubusercontent.com/monosans/proxy-list/main/proxies/http.txt"`);
    const monosansHttpFetched = monosansHttpText.split("\n").map(p => p.trim()).filter(p => p.length > 0 && p.includes(":")).map(p => `http://${p}`);

    const fetched = [
      ...socks5Fetched, ...httpFetched, ...socks4Fetched,
      ...ghSocks5Fetched, ...ghSocks4Fetched, ...ghHttpFetched,
      ...monosansS5Fetched, ...monosansS4Fetched, ...monosansHttpFetched
    ];
    if (fetched.length > 0) {
      // De-duplicate
      proxyList = Array.from(new Set(fetched));
      
      // Shuffle the proxies to spread load and bypass localized blocking/ratelimiting
      proxyList.sort(() => Math.random() - 0.5);

      currentProxyIndex = 0;
      lastProxyFetchTime = now;
      console.log(`[ProxyPool] Loaded ${proxyList.length} unique proxies across SOCKS5, SOCKS4, and HTTP protocols.`);
    } else {
      lastProxyFetchTime = now - 5 * 60 * 1000;
    }
  } catch (err: any) {
    console.error("[ProxyPool] Error fetching proxy list:", err.message);
    lastProxyFetchTime = now - 5 * 60 * 1000;
  }
}

const COOKIE_FILE = path.join(process.cwd(), "ivas_cookies.txt");

async function runCurlWithProxyAndCookies(url: string, method: "GET" | "POST" = "GET", postData?: string): Promise<{ status: number; body: string }> {
  await refreshProxyList();

  const headers = [
    `-A "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"`,
    `-H "Accept: text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7"`,
    `-H "Accept-Language: en-US,en;q=0.9"`,
    `-H "Sec-Ch-Ua: \\"Chromium\\";v=\\"124\\", \\"Google Chrome\\";v=\\"124\\", \\"Not-A.Brand\\";v=\\"99\\""`,
    `-H "Sec-Ch-Ua-Mobile: ?0"`,
    `-H "Sec-Ch-Ua-Platform: \\"Windows\\""`,
    `-H "Sec-Fetch-Dest: document"`,
    `-H "Sec-Fetch-Mode: navigate"`,
    `-H "Sec-Fetch-Site: none"`,
    `-H "Sec-Fetch-User: ?1"`,
    `-H "Upgrade-Insecure-Requests: 1"`,
    `--compressed`
  ].join(" ");

  if (proxyList.length === 0) {
    try {
      const dataOption = postData ? `-d "${postData.replace(/"/g, '\\"')}"` : "";
      const methodOption = method === "POST" ? "-X POST" : "-X GET";
      const cmd = `curl -s -4 -m 10 ${methodOption} ${headers} -b "${COOKIE_FILE}" -c "${COOKIE_FILE}" -w "\n%{http_code}" ${dataOption} "${url}"`;
      const output = await execPromise(cmd);
      const lines = output.split("\n");
      const status = parseInt(lines[lines.length - 1].trim()) || 0;
      const body = lines.slice(0, lines.length - 1).join("\n");
      return { status, body };
    } catch (err: any) {
      return { status: 0, body: "" };
    }
  }

  for (let attempt = 0; attempt < 35; attempt++) {
    const proxy = proxyList[currentProxyIndex];
    currentProxyIndex = (currentProxyIndex + 1) % proxyList.length;

    try {
      const dataOption = postData ? `-d "${postData.replace(/"/g, '\\"')}"` : "";
      const methodOption = method === "POST" ? "-X POST" : "-X GET";
      const cmd = `curl -x "${proxy}" -s -4 -m 3.5 ${methodOption} ${headers} -b "${COOKIE_FILE}" -c "${COOKIE_FILE}" -w "\n%{http_code}" ${dataOption} "${url}"`;
      
      const output = await execPromise(cmd, { timeout: 4500 });
      const lines = output.split("\n");
      const status = parseInt(lines[lines.length - 1].trim()) || 0;
      const body = lines.slice(0, lines.length - 1).join("\n");

      // 401 Unauthorized is also a valid status code that shows a connection succeeded through the proxy to the target host (instead of being blocked or failing)
      if (status === 200 || status === 302 || status === 401) {
        currentProxyIndex = (currentProxyIndex - 1 + proxyList.length) % proxyList.length;
        return { status, body };
      }
    } catch (err: any) {
      // proxy failed, try next
    }
  }

  // Fallback: If all proxies fail or return bad status codes, try a direct connection as final resort
  try {
    const dataOption = postData ? `-d "${postData.replace(/"/g, '\\"')}"` : "";
    const methodOption = method === "POST" ? "-X POST" : "-X GET";
    const cmd = `curl -s -4 -m 10 ${methodOption} ${headers} -b "${COOKIE_FILE}" -c "${COOKIE_FILE}" -w "\n%{http_code}" ${dataOption} "${url}"`;
    const output = await execPromise(cmd);
    const lines = output.split("\n");
    const status = parseInt(lines[lines.length - 1].trim()) || 0;
    const body = lines.slice(0, lines.length - 1).join("\n");
    return { status, body };
  } catch (err: any) {
    return { status: 0, body: "" };
  }
}

function extractCsrfToken(html: string): string {
  let match = html.match(/name=["']_token["']\s+value=["']([^"']+)["']/i);
  if (match) return match[1];

  match = html.match(/value=["']([^"']+)["']\s+name=["']_token["']/i);
  if (match) return match[1];

  match = html.match(/content=["']([^"']+)["']\s+name=["']csrf-token["']/i);
  if (match) return match[1];

  match = html.match(/name=["']csrf-token["']\s+content=["']([^"']+)["']/i);
  if (match) return match[1];

  return "";
}

interface IvasmsSession {
  isLoggedIn: boolean;
  lastLoginTry: number;
}

const ivasmsSession: IvasmsSession = {
  isLoggedIn: false,
  lastLoginTry: 0
};

async function loginToIvasms(): Promise<boolean> {
  const now = Date.now();
  if (now - ivasmsSession.lastLoginTry < 30000) {
    return ivasmsSession.isLoggedIn;
  }
  ivasmsSession.lastLoginTry = now;

  try {
    console.log("[iVasms] Attempting login to portal...");
    
    if (fs.existsSync(COOKIE_FILE)) {
      try { fs.unlinkSync(COOKIE_FILE); } catch {}
    }

    const loginPageUrl = "https://ivas.tempnum.qzz.io/login";
    const getRes = await runCurlWithProxyAndCookies(loginPageUrl, "GET");

    if (getRes.status !== 200) {
      console.log(`[iVasms] Initial check response: ${getRes.status}`);
      return false;
    }

    const token = extractCsrfToken(getRes.body);
    if (!token) {
      console.log("[iVasms] Token empty on login page");
      return false;
    }

    const params = new URLSearchParams();
    params.append("_token", token);
    params.append("username", "MAFYA123");
    params.append("email", "MAFYA123");
    params.append("password", "Bn_1411");

    const postRes = await runCurlWithProxyAndCookies(loginPageUrl, "POST", params.toString());

    if (postRes.status === 302 || postRes.status === 200) {
      console.log("[iVasms] Login successful.");
      ivasmsSession.isLoggedIn = true;
      return true;
    } else {
      console.log(`[iVasms] Status update: ${postRes.status}`);
      return false;
    }
  } catch (err: any) {
    console.log("[iVasms] Login update:", err.message);
    return false;
  }
}

function parseIvasmsResponse(text: string): any[] {
  if (!text) return [];
  
  try {
    const data = JSON.parse(text);
    let list: any[] = [];
    if (Array.isArray(data)) list = data;
    else if (data && Array.isArray(data.data)) list = data.data;
    else if (data && Array.isArray(data.result)) list = data.result;
    
    if (list.length > 0) {
      return list.map((item: any) => {
        const number = String(item.number || item.num || item.to || "").trim();
        const sender = String(item.sender || item.cli || item.from || "Unknown");
        const message = String(item.message || item.sms || item.text || "");
        const dateStr = String(item.date || item.timestamp || item.created_at || "");
        const timestamp = isNaN(Date.parse(dateStr)) ? new Date().toISOString() : new Date(dateStr).toISOString();
        return {
          timestamp,
          number,
          service: detectServiceFromMessageAndSender(sender, message),
          message,
          country: getCountryFromNumber(number),
          source: "iVasms"
        };
      }).filter((o: any) => o && o.number);
    }
  } catch {
    // Treat as HTML
  }

  const otps: any[] = [];
  const phoneRegex = /\+?[0-9]{9,15}/g;
  const rows = text.split(/<\/tr>|<\/div>/i);
  for (const row of rows) {
    const numbers = row.match(phoneRegex);
    if (numbers && numbers.length > 0) {
      const number = numbers[0];
      const cleanRow = row.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
      if (cleanRow.length > number.length + 10) {
        const message = cleanRow.replace(number, "").trim();
        const service = detectServiceFromMessageAndSender("Unknown", message);
        otps.push({
          timestamp: new Date().toISOString(),
          number,
          service,
          message,
          country: getCountryFromNumber(number),
          source: "iVasms"
        });
      }
    }
  }
  return otps;
}

let cachedIvasSms: any[] = [];
let lastIvasSmsFetchTime = 0;
const IVAS_SMS_CACHE_TTL = 30 * 1000; // 30 seconds

async function fetchIvasmsSms(): Promise<any[]> {
  const now = Date.now();
  if (cachedIvasSms.length > 0 && now - lastIvasSmsFetchTime < IVAS_SMS_CACHE_TTL) {
    return cachedIvasSms;
  }

  try {
    if (!ivasmsSession.isLoggedIn) {
      const loggedIn = await loginToIvasms();
      if (!loggedIn) {
        return cachedIvasSms.length > 0 && now - lastIvasSmsFetchTime < 5 * 60 * 1000 ? cachedIvasSms : [];
      }
    }

    const getsmsUrl = "https://ivas.tempnum.qzz.io/portal/sms/received/getsms";
    const res = await runCurlWithProxyAndCookies(getsmsUrl, "GET");

    if (res.status === 401 || res.status === 403 || res.body.includes("/login") || res.body.includes("Redirecting to")) {
      console.log("[iVasms] Session expired or redirected. Re-logging in...");
      ivasmsSession.isLoggedIn = false;
      const loggedIn = await loginToIvasms();
      if (!loggedIn) {
        return cachedIvasSms.length > 0 && now - lastIvasSmsFetchTime < 5 * 60 * 1000 ? cachedIvasSms : [];
      }
      
      const retryRes = await runCurlWithProxyAndCookies(getsmsUrl, "GET");
      const parsed = parseIvasmsResponse(retryRes.body);
      if (parsed && parsed.length > 0) {
        cachedIvasSms = parsed;
        lastIvasSmsFetchTime = Date.now();
        return parsed;
      }
    } else {
      const parsed = parseIvasmsResponse(res.body);
      if (parsed && parsed.length > 0) {
        cachedIvasSms = parsed;
        lastIvasSmsFetchTime = Date.now();
        return parsed;
      }
    }

    if (cachedIvasSms.length > 0 && now - lastIvasSmsFetchTime < 5 * 60 * 1000) {
      return cachedIvasSms;
    }
    return [];
  } catch (err: any) {
    console.log("[iVasms] Fetch update:", err.message);
    if (cachedIvasSms.length > 0 && now - lastIvasSmsFetchTime < 5 * 60 * 1000) {
      return cachedIvasSms;
    }
    return [];
  }
}

async function fetchWithTimeout(url: string, options: any = {}, timeout = 4000) {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeout);
  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal
    });
    clearTimeout(id);
    return response;
  } catch (err) {
    clearTimeout(id);
    throw err;
  }
}

async function fetchNewApiSms(url: string, token: string, label: string): Promise<any[]> {
  try {
    const finalUrl = `${url}?token=${encodeURIComponent(token)}&key=${encodeURIComponent(token)}`;
    const response = await fetchWithTimeout(finalUrl, {
      headers: {
        "Authorization": `Bearer ${token}`,
        "Token": token,
        "Key": token,
        "X-API-KEY": token
      }
    });
    if (!response.ok) {
      console.log(`[${label}] Response not OK: ${response.status}`);
      return perSourceSmsCache[label] || [];
    }
    
    const text = await response.text();
    let data: any;
    try {
      data = JSON.parse(text);
    } catch (jsonErr) {
      console.log(`[${label}] Response is not valid JSON: ${text.slice(0, 100)}`);
      return perSourceSmsCache[label] || [];
    }
    
    let list: any[] = [];
    if (Array.isArray(data)) {
      list = data;
    } else if (data && Array.isArray(data.data)) {
      list = data.data;
    } else if (data && Array.isArray(data.result)) {
      list = data.result;
    } else if (data && typeof data === 'object') {
      for (const k of Object.keys(data)) {
        if (Array.isArray(data[k])) {
          list = data[k];
          break;
        }
      }
    }
    
    const mapped = list.map((item: any) => {
      if (Array.isArray(item)) {
        const sender = String(item[0] || "Unknown");
        const number = String(item[1] || "").trim();
        const message = String(item[2] || "");
        const dateStr = String(item[3] || "");
        const timestamp = isNaN(Date.parse(dateStr)) ? new Date().toISOString() : new Date(dateStr).toISOString();
        return {
          timestamp,
          number,
          service: detectServiceFromMessageAndSender(sender, message),
          message,
          country: getCountryFromNumber(number),
          source: label
        };
      } else if (item && typeof item === 'object') {
        const number = String(item.num || item.number || item.to || "").trim();
        const sender = String(item.cli || item.sender || item.from || "Unknown");
        const message = String(item.sms || item.message || item.text || "");
        const dateStr = String(item.dateadded || item.date || item.timestamp || item.created_at || "");
        const timestamp = isNaN(Date.parse(dateStr)) ? new Date().toISOString() : new Date(dateStr).toISOString();
        return {
          timestamp,
          number,
          service: detectServiceFromMessageAndSender(sender, message),
          message,
          country: getCountryFromNumber(number),
          source: label
        };
      }
      return null;
    }).filter((o: any) => o && o.number);
    
    perSourceSmsCache[label] = mapped;
    return mapped;
  } catch (err) {
    console.log(`Error fetching from ${label}:`, err);
    return perSourceSmsCache[label] || [];
  }
}

async function fetchApi3Sms(): Promise<any[]> {
  try {
    const url = "https://pscall.net/restapi/smsreport";
    const key = "SFNYSj1SS16DgYdyf4KIgA==";
    const finalUrl = `${url}?key=${encodeURIComponent(key)}&token=${encodeURIComponent(key)}`;
    const response = await fetchWithTimeout(finalUrl, {
      headers: {
        "Authorization": `Bearer ${key}`,
        "X-API-KEY": key,
        "Key": key,
        "Token": key
      }
    });
    if (!response.ok) {
      console.log(`[API 3] Response not OK: ${response.status}`);
      return perSourceSmsCache["API 3"] || [];
    }
    
    const text = await response.text();
    let data: any;
    try {
      data = JSON.parse(text);
    } catch (jsonErr) {
      console.log(`[API 3] Response is not valid JSON: ${text.slice(0, 100)}`);
      return perSourceSmsCache["API 3"] || [];
    }
    
    let list: any[] = [];
    if (data && Array.isArray(data.data)) {
      list = data.data;
    } else if (Array.isArray(data)) {
      list = data;
    } else if (data && Array.isArray(data.result)) {
      list = data.result;
    }
    
    const mapped = list.map((item: any) => {
      const number = String(item.num || item.number || "").trim();
      const sender = String(item.cli || item.sender || "Unknown");
      const message = String(item.sms || item.message || "");
      const dateStr = String(item.dateadded || item.date || "");
      const timestamp = isNaN(Date.parse(dateStr)) ? new Date().toISOString() : new Date(dateStr).toISOString();
      return {
        timestamp,
        number,
        service: detectServiceFromMessageAndSender(sender, message),
        message,
        country: getCountryFromNumber(number),
        source: "API 3"
      };
    }).filter(o => o.number);
    
    perSourceSmsCache["API 3"] = mapped;
    return mapped;
  } catch (err) {
    console.log("Error fetching from API 3:", err);
    return perSourceSmsCache["API 3"] || [];
  }
}

const FALLBACK_AUTO_NUMBERS: any[] = [];

// Helper to get all active subscriber numbers currently waiting for OTP
function getActiveSubscribersNumbers(): string[] {
  const db = readDb();
  const active: string[] = [];
  db.users.forEach((user: any) => {
    (user.subscribers || []).forEach((sub: any) => {
      (sub.numbers || []).forEach((numObj: any) => {
        const rawNum = String(numObj.number || numObj.num || "").trim();
        if (rawNum) {
          active.push(rawNum);
        }
      });
    });
  });
  return Array.from(new Set(active));
}

// Helper to parse numbers list from API response
function parseNumbersList(text: string, label: string): any[] {
  try {
    const data = JSON.parse(text);
    let list: any[] = [];
    if (Array.isArray(data)) {
      list = data;
    } else if (data && Array.isArray(data.numbers)) {
      list = data.numbers;
    } else if (data && Array.isArray(data.data)) {
      list = data.data;
    } else if (data && typeof data === "object") {
      for (const k of Object.keys(data)) {
        if (Array.isArray(data[k])) {
          list = data[k];
          break;
        }
      }
    }

    return list.map((item: any) => {
      let numStr = "";
      let country = "";
      if (typeof item === "string") {
        numStr = item.trim();
        country = getCountryFromNumber(numStr);
      } else if (item && typeof item === "object") {
        numStr = String(item.number || item.num || item.phone || "").trim();
        country = String(item.country || getCountryFromNumber(numStr));
      }
      if (!numStr) return null;

      return {
        number: numStr,
        raw: numStr,
        e164: numStr,
        country: country === "Unknown" ? getCountryFromNumber(numStr) : country,
        source: label
      };
    }).filter(Boolean);
  } catch {
    return [];
  }
}

// Helper to parse SMS list from API response
function parseSmsList(text: string, label: string): any[] {
  try {
    const data = JSON.parse(text);
    let list: any[] = [];
    if (Array.isArray(data)) {
      list = data;
    } else if (data && Array.isArray(data.sms)) {
      list = data.sms;
    } else if (data && Array.isArray(data.data)) {
      list = data.data;
    } else if (data && Array.isArray(data.result)) {
      list = data.result;
    } else if (data && typeof data === "object") {
      for (const k of Object.keys(data)) {
        if (Array.isArray(data[k])) {
          list = data[k];
          break;
        }
      }
    }

    return list.map((item: any) => {
      if (!item) return null;
      let number = "";
      let sender = "Unknown";
      let message = "";
      let dateStr = "";

      if (Array.isArray(item)) {
        sender = String(item[0] || "Unknown");
        number = String(item[1] || "").trim();
        message = String(item[2] || "");
        dateStr = String(item[3] || "");
      } else if (typeof item === "object") {
        number = String(item.number || item.num || item.to || "").trim();
        sender = String(item.sender || item.cli || item.from || "Unknown");
        message = String(item.message || item.sms || item.text || "");
        dateStr = String(item.date || item.timestamp || item.created_at || item.dateadded || "");
      }

      if (!number) return null;

      const timestamp = isNaN(Date.parse(dateStr)) ? new Date().toISOString() : new Date(dateStr).toISOString();
      return {
        timestamp,
        number,
        service: detectServiceFromMessageAndSender(sender, message),
        message,
        country: getCountryFromNumber(number),
        source: label
      };
    }).filter((o: any) => o && o.number);
  } catch {
    return [];
  }
}

async function fetchAggregatedNumbers(targetCountry?: string, force = false) {
  const db = readDb();
  const claimed = db.claimedNumbers || [];
  const manual = db.manualNumbers || [];
  
  const now = Date.now();
  const shouldFetchExt = force || cachedNumbers.length === 0 || (now - lastNumbersFetchTime > CACHE_TTL) || !!targetCountry;
  if (shouldFetchExt) {
    const apiLists: any[] = [];
    
    // Process each API endpoint configuration in parallel
    const promises = API_ENDPOINTS.map(async (api) => {
      if (!backgroundApiStats[api.label]) {
        backgroundApiStats[api.label] = { success: 0, fail: 0, lastStatus: "Pending", lastError: "", lastSuccessTime: "", url: api.sms };
      }
      const endpointsToTry = [api.numbers, ...(api.fallbackNumbers || [])];
      let numbersSuccess = false;
      let lastErrMessage = "";
      const currentApiLists: any[] = [];

      for (const url of endpointsToTry) {
        if (numbersSuccess) break;
        try {
          const res = await fetchWithTimeout(url, {}, 3000);
          if (res.ok) {
            const text = await res.text();
            const parsed = parseNumbersList(text, api.label);
            if (parsed && parsed.length > 0) {
              currentApiLists.push(...parsed);
              numbersSuccess = true;
            } else {
              lastErrMessage = "Empty or invalid response format";
            }
          } else {
            lastErrMessage = `HTTP ${res.status}`;
          }
        } catch (err: any) {
          lastErrMessage = err.message || "Timeout";
        }
      }

      if (numbersSuccess) {
        backgroundApiStats[api.label].success++;
        backgroundApiStats[api.label].lastStatus = "Online";
        backgroundApiStats[api.label].lastSuccessTime = new Date().toISOString();
        backgroundApiStats[api.label].lastError = "";
      } else {
        backgroundApiStats[api.label].fail++;
        backgroundApiStats[api.label].lastStatus = "Offline";
        backgroundApiStats[api.label].lastError = lastErrMessage || "Failed to fetch numbers";
      }

      // 2. Fetch target country specific numbers by appending country or querying country in parallel
      if (targetCountry) {
        const formatsToTry = Array.from(new Set([targetCountry, targetCountry.toLowerCase()]));
        const countryUrls: string[] = [];
        for (const baseUrl of endpointsToTry) {
          const urlWithoutQuery = baseUrl.split("?")[0];
          for (const countryVal of formatsToTry) {
            countryUrls.push(`${urlWithoutQuery}/${encodeURIComponent(countryVal)}`);
            countryUrls.push(`${baseUrl}${baseUrl.includes("?") ? "&" : "?"}country=${encodeURIComponent(countryVal)}`);
          }
        }

        const uniqueCountryUrls = Array.from(new Set(countryUrls));
        const countryPromises = uniqueCountryUrls.slice(0, 5).map(async (url) => {
          try {
            const res = await fetchWithTimeout(url, {}, 2500);
            if (res.ok) {
              const text = await res.text();
              return parseNumbersList(text, api.label);
            }
          } catch {}
          return [];
        });

        try {
          const countryResults = await Promise.all(countryPromises);
          for (const list of countryResults) {
            if (list && list.length > 0) {
              currentApiLists.push(...list);
            }
          }
        } catch {}
      }

      return currentApiLists;
    });

    const results = await Promise.all(promises);
    for (const list of results) {
      if (list && list.length > 0) {
        apiLists.push(...list);
      }
    }

    // 3. Extract active numbers from iVasms portal messages to populate virtual numbers pool automatically
    try {
      console.log("[iVasms] Extracting active numbers from portal messages...");
      const ivasSms = await fetchIvasmsSms();
      const ivasNumbers = ivasSms.map((s: any) => ({
        number: s.number,
        raw: s.number,
        e164: s.number,
        country: s.country,
        source: "iVasms"
      }));
      for (const n of ivasNumbers) {
        if (!apiLists.some((item: any) => item.number.replace(/[\s\-\+]/g, "") === n.number.replace(/[\s\-\+]/g, ""))) {
          apiLists.push(n);
        }
      }
    } catch (err: any) {
      console.log("iVasms numbers check:", err.message);
    }
    
    // Always combine fallback auto numbers so there are always options available
    const mappedFallbacks = FALLBACK_AUTO_NUMBERS.map(f => ({
      number: f.number,
      raw: f.number,
      e164: f.number,
      country: f.country,
      source: "System Automatic"
    }));

    cachedNumbers = [...apiLists, ...mappedFallbacks];
    lastNumbersFetchTime = now;
  }

  // Combine manual numbers from db and cached API numbers
  const combined = [
    ...manual.map((n: any) => ({
      number: n.number,
      raw: n.number,
      e164: n.number,
      country: n.country || getCountryFromNumber(n.number),
      source: n.server || "Manual"
    })),
    ...cachedNumbers
  ];

  // Filter out claimed/deleted numbers
  const filtered = combined.filter((n: any) => {
    const cleanNum = n.number.replace(/[\s\-\+]/g, "");
    return !claimed.includes(cleanNum);
  });

  return filtered;
}

async function fetchAggregatedSms(force = false) {
  const now = Date.now();
  
  if (force || cachedSms.length === 0 || now - lastSmsFetchTime > CACHE_TTL) {
    const db = readDb();
    let allOtps = db.manualSms || [];
    allOtps = [...allOtps];

    const activeNumbers = getActiveSubscribersNumbers();

    // Fetch from all API endpoints in parallel
    const promises = API_ENDPOINTS.map(async (api) => {
      if (!backgroundApiStats[api.label]) {
        backgroundApiStats[api.label] = { success: 0, fail: 0, lastStatus: "Pending", lastError: "", lastSuccessTime: "", url: api.sms };
      }
      const smsEndpoints = [api.sms, ...(api.fallbackSms || [])];
      let smsSuccess = false;
      let lastErrMessage = "";
      const currentOtps: any[] = [];
  
      // 1. General fetch
      for (const url of smsEndpoints) {
        if (smsSuccess) break;
        try {
          const res = await fetchWithTimeout(url, {}, 3000);
          if (res.ok) {
            const text = await res.text();
            const parsed = parseSmsList(text, api.label);
            if (parsed && parsed.length > 0) {
              currentOtps.push(...parsed);
              smsSuccess = true;
            } else {
              lastErrMessage = "Empty or invalid response format";
            }
          } else {
            lastErrMessage = `HTTP ${res.status}`;
          }
        } catch (err: any) {
          lastErrMessage = err.message || "Timeout";
        }
      }

      if (smsSuccess) {
        backgroundApiStats[api.label].success++;
        backgroundApiStats[api.label].lastStatus = "Online";
        backgroundApiStats[api.label].lastSuccessTime = new Date().toISOString();
        backgroundApiStats[api.label].lastError = "";
      } else {
        backgroundApiStats[api.label].fail++;
        backgroundApiStats[api.label].lastStatus = "Offline";
        backgroundApiStats[api.label].lastError = lastErrMessage || "Failed to fetch SMS";
      }

      // 2. Fetch specifically for active/claimed subscriber numbers in parallel
      if (activeNumbers.length > 0) {
        const urlsToFetch: string[] = [];
        for (const rawNum of activeNumbers) {
          const cleanNum = rawNum.replace(/[\s\-\+]/g, "");
          const formattedWithPlus = rawNum.startsWith("+") ? rawNum : `+${rawNum}`;
          const formatsToTry = Array.from(new Set([cleanNum, formattedWithPlus, rawNum]));

          for (const numToQuery of formatsToTry) {
            for (const baseUrl of smsEndpoints) {
              const urlWithoutQuery = baseUrl.split("?")[0];
              urlsToFetch.push(`${urlWithoutQuery}/${encodeURIComponent(numToQuery)}`);
              urlsToFetch.push(`${baseUrl}${baseUrl.includes("?") ? "&" : "?"}number=${encodeURIComponent(numToQuery)}`);
              urlsToFetch.push(`${baseUrl}${baseUrl.includes("?") ? "&" : "?"}num=${encodeURIComponent(numToQuery)}`);
            }
          }
        }

        const uniqueUrls = Array.from(new Set(urlsToFetch));
        // Limit unique candidate requests per iteration to prevent too many parallel fetches
        const fetchPromises = uniqueUrls.slice(0, 5).map(async (url) => {
          try {
            const res = await fetchWithTimeout(url, {}, 2500);
            if (res.ok) {
              const text = await res.text();
              return parseSmsList(text, api.label);
            }
          } catch {
            // Ignore sub-query timeouts/errors silently
          }
          return [];
        });

        try {
          const results = await Promise.all(fetchPromises);
          for (const list of results) {
            if (list && list.length > 0) {
              currentOtps.push(...list);
            }
          }
        } catch {}
      }

      return currentOtps;
    });

    const results = await Promise.all(promises);
    for (const list of results) {
      if (list && list.length > 0) {
        allOtps.push(...list);
      }
    }

    // 3. Fetch from iVasms session-based portal
    try {
      console.log("[iVasms] Querying active SMS from portal...");
      const ivasSms = await fetchIvasmsSms();
      if (!backgroundApiStats["iVasms"]) {
        backgroundApiStats["iVasms"] = { success: 0, fail: 0, lastStatus: "Pending", lastError: "", lastSuccessTime: "", url: "Portal session-based extraction" };
      }
      if (ivasSms && ivasSms.length > 0) {
        allOtps.push(...ivasSms);
        backgroundApiStats["iVasms"].success++;
        backgroundApiStats["iVasms"].lastStatus = "Online";
        backgroundApiStats["iVasms"].lastSuccessTime = new Date().toISOString();
        backgroundApiStats["iVasms"].lastError = "";
      } else {
        backgroundApiStats["iVasms"].fail++;
        backgroundApiStats["iVasms"].lastStatus = "Offline";
        backgroundApiStats["iVasms"].lastError = "No active SMS found";
      }
    } catch (err: any) {
      console.log("iVasms SMS check:", err.message);
      if (!backgroundApiStats["iVasms"]) {
        backgroundApiStats["iVasms"] = { success: 0, fail: 0, lastStatus: "Pending", lastError: "", lastSuccessTime: "", url: "Portal session-based extraction" };
      }
      backgroundApiStats["iVasms"].fail++;
      backgroundApiStats["iVasms"].lastStatus = "Offline";
      backgroundApiStats["iVasms"].lastError = err.message || "Failed to fetch portal SMS";
    }

    // Sort by timestamp desc and de-duplicate by message text + number
    allOtps.sort((a: any, b: any) => b.timestamp.localeCompare(a.timestamp));
    
    const uniqueOtps: any[] = [];
    const seen = new Set<string>();
    for (const o of allOtps) {
      const key = `${o.number}_${o.message.slice(0, 30)}`;
      if (!seen.has(key)) {
        seen.add(key);
        uniqueOtps.push(o);
      }
    }

    cachedSms = uniqueOtps.slice(0, 100);
    lastSmsFetchTime = now;
  }

  return cachedSms;
}

// Bot offsets map
const botOffsets: { [token: string]: number } = {};
let lastForwardedSmsIds = new Set<string>();

// Dynamic URL fallback helpers to isolate reseller bot branding from super-admin
function getPanelUrl(user: any) {
  if (user.botConfig?.botLink && user.botConfig.botLink.startsWith("http")) {
    return user.botConfig.botLink;
  }
  // Default fallback to applet's live preview URL
  return "https://ais-dev-rcchkwwyf6ddcladrjglj4-18318808268.asia-southeast1.run.app";
}

function getOtpUrl(user: any) {
  if (user.botConfig?.otpGroupUrl && user.botConfig.otpGroupUrl.startsWith("http")) {
    return user.botConfig.otpGroupUrl;
  }
  return "https://ais-dev-rcchkwwyf6ddcladrjglj4-18318808268.asia-southeast1.run.app";
}

// Keyboard Generator Helpers
function getMainKeyboard(user: any) {
  const keyboard: any[][] = [
    [
      { text: "📱 Get Number", callback_data: "btn_get_number" },
      { text: "📦 My Numbers", callback_data: "btn_my_numbers" }
    ],
    [
      { text: "❓ Help", callback_data: "btn_help" }
    ]
  ];

  return { inline_keyboard: keyboard };
}

function isSmsDuplicateForUser(user: any, numberClean: string, messageText: string): boolean {
  if (!user || !user.otpHistory || !Array.isArray(user.otpHistory)) {
    return false;
  }
  const now = Date.now();
  const normalizedMsg = messageText.trim().toLowerCase();

  return user.otpHistory.some((h: any) => {
    const hNumClean = (h.number || "").replace(/[\s\-\+]/g, "");
    const hMsg = (h.message || "").trim().toLowerCase();
    
    if (hNumClean === numberClean && hMsg === normalizedMsg) {
      const hTime = new Date(h.timestamp).getTime();
      if (!isNaN(hTime)) {
        const ageMs = now - hTime;
        // Check if duplicate is within 1 hour (3,600,000 ms)
        if (ageMs < 60 * 60 * 1000) {
          return true;
        }
      } else {
        return true; // Treat as duplicate if invalid timestamp to be safe
      }
    }
    return false;
  });
}

function maskPhoneNumber(num: string): string {
  const clean = num.replace(/[\s\-\+]/g, "");
  if (clean.length <= 6) return num;
  const start = clean.substring(0, 3);
  const end = clean.substring(clean.length - 4);
  return `${start}****${end}`;
}

function extractOtp(message: string): string {
  const hyphenMatch = message.match(/\b\d{3}[-\s]\d{3,4}\b/);
  if (hyphenMatch) return hyphenMatch[0];

  const codeKeywords = ["code", "verification", "otp", "otp:", "passcode", "pin", "verification:"];
  const words = message.toLowerCase().split(/\s+/);
  for (let i = 0; i < words.length; i++) {
    const word = words[i].replace(/[:.,'"()]/g, "");
    if (codeKeywords.some(kw => word.includes(kw))) {
      for (const offset of [-2, -1, 1, 2]) {
        const nearIdx = i + offset;
        if (nearIdx >= 0 && nearIdx < words.length) {
          const nearWord = words[nearIdx].replace(/[:.,'"()]/g, "");
          if (/^\d{4,8}$/.test(nearWord) || /^\d{3}[-\s]\d{3,4}$/.test(nearWord)) {
            return nearWord;
          }
        }
      }
    }
  }

  const digitMatches = message.match(/\b\d{4,8}\b/g);
  if (digitMatches) {
    const valid = digitMatches.filter(m => m !== "2024" && m !== "2025" && m !== "2026");
    if (valid.length > 0) return valid[0];
  }

  const gMatch = message.match(/\b[Gg]-\d{5,8}\b/);
  if (gMatch) return gMatch[0];

  return "PENDING";
}

function escapeTelegramHtml(str: string): string {
  return String(str || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function formatTelegramOtpMessage(otp: any, msg: string, service: string, country: string): string {
  const flag = getCountryFlag(country);
  const maskedNum = maskPhoneNumber(otp.number);
  const extractedOtp = extractOtp(msg);

  const escCountry = escapeTelegramHtml(country);
  const escService = escapeTelegramHtml(service);
  const escOtp = extractedOtp === "PENDING" ? "Awaiting Code..." : escapeTelegramHtml(extractedOtp);

  let text = `╭━━━━━━━━━━━━━━━━━━━━╮\n`;
  text += `┃ ${flag} ${escCountry} ${escService}\n`;
  text += `┃━━━━━━━━━━━━━━━━━━━━━\n`;
  text += `┃☎ Number :  <code>${maskedNum}</code>\n`;
  text += `┃🔒 OTP :  <code>${escOtp}</code>\n`;
  text += `┃━━━━━━━━━━━━━━━━━━━━━\n`;
  text += `┃📝 :\n`;
  
  const lines = msg.split("\n");
  for (const line of lines) {
    if (line.trim()) {
      const escapedLine = escapeTelegramHtml(line.trim());
      text += `┃ ${escapedLine}\n`;
    }
  }
  
  text += `╰━━━━━━━━━━━━━━━━━━━━╯`;
  return text;
}

async function getCountryKeyboard() {
  const activeNumbers = await fetchAggregatedNumbers();
  
  if (activeNumbers.length === 0) {
    return {
      inline_keyboard: [
        [{ text: "⚠️ No Countries Available", callback_data: "btn_main_menu" }],
        [{ text: "🏠 Main Menu", callback_data: "btn_main_menu" }]
      ]
    };
  }

  // Get unique countries
  const uniqueCountries = Array.from(new Set(activeNumbers.map((n: any) => String(n.country || "Indonesia"))));
  uniqueCountries.sort();

  const buttons: any[] = [];
  uniqueCountries.forEach((country) => {
    const flag = getCountryFlag(country);
    buttons.push({
      text: `${flag} ${country}`,
      callback_data: `btn_country_${country}`
    });
  });

  const keyboard: any[][] = [];
  for (let i = 0; i < buttons.length; i += 2) {
    const row: any[] = [buttons[i]];
    if (i + 1 < buttons.length) {
      row.push(buttons[i + 1]);
    }
    keyboard.push(row);
  }
  
  keyboard.push([{ text: "🏠 Main Menu", callback_data: "btn_main_menu" }]);
  
  return { inline_keyboard: keyboard };
}

function getNumberSessionKeyboard(user: any, country: string, number: string) {
  const keyboard: any[][] = [
    [
      { text: "🔄 Change Number", callback_data: `btn_country_${country}` },
      { text: "🌍 Change Country", callback_data: "btn_get_number" }
    ],
    [
      { text: "📋 Copy Number", callback_data: `btn_copy_${number}` }
    ],
    [
      { text: "📱 Get New Number", callback_data: "btn_get_number" },
      { text: "🏠 Main Menu", callback_data: "btn_main_menu" }
    ]
  ];

  return { inline_keyboard: keyboard };
}

function getHelpKeyboard() {
  return {
    inline_keyboard: [
      [
        { text: "📱 Get Number", callback_data: "btn_get_number" },
        { text: "📦 My Numbers", callback_data: "btn_my_numbers" }
      ],
      [
        { text: "🏠 Main Menu", callback_data: "btn_main_menu" }
      ]
    ]
  };
}

// Centralized Telegram Request Executor with robust multi-proxy rotation and fallback
async function runTelegramRequest(token: string, apiMethod: string, payload?: any): Promise<{ ok: boolean; result?: any }> {
  await refreshProxyList();

  const url = `https://api.telegram.org/bot${token}/${apiMethod}`;
  const hasPayload = payload !== undefined;
  
  // Write the payload to a temp file if it exists, to avoid shell escaping issues and support full unicode/emoji
  let tempFileName = "";
  let dataOption = "";
  if (hasPayload) {
    const fileId = crypto.randomBytes(8).toString("hex");
    tempFileName = path.join(isVercel ? "/tmp" : process.cwd(), `tg_payload_${fileId}.json`);
    fs.writeFileSync(tempFileName, JSON.stringify(payload), "utf8");
    dataOption = `--data-binary "@${tempFileName}"`;
  }
  
  const methodOption = hasPayload ? "-X POST" : "-X GET";
  const headerOption = `-H "Content-Type: application/json"`;

  try {
    // 1. Always try DIRECT curl first (Cloud Run has high-speed direct access to Telegram API)
    try {
      const cmd = `curl -s -4 -m 10 ${methodOption} ${headerOption} ${dataOption} "${url}"`;
      const output = await execPromise(cmd, { timeout: 12000 });
      if (output && output.trim()) {
        const parsed = JSON.parse(output);
        if (parsed && parsed.ok !== undefined) {
          return parsed;
        }
      }
    } catch (err: any) {
      // direct failed, proceed to proxy pool fallback
    }

    // 2. Proxy rotation fallback (only if direct fails)
    if (proxyList.length > 0) {
      for (let attempt = 0; attempt < 8; attempt++) {
        const proxy = proxyList[currentProxyIndex];
        currentProxyIndex = (currentProxyIndex + 1) % proxyList.length;

        try {
          const cmd = `curl -x "${proxy}" -s -4 -m 5 ${methodOption} ${headerOption} ${dataOption} "${url}"`;
          const output = await execPromise(cmd, { timeout: 7000 });
          if (output && output.trim()) {
            const parsed = JSON.parse(output);
            if (parsed && (parsed.ok !== undefined || parsed.result)) {
              // Found a working proxy or genuine API response, adjust currentProxyIndex to stick to this proxy zone
              currentProxyIndex = (currentProxyIndex - 1 + proxyList.length) % proxyList.length;
              return parsed;
            }
          }
        } catch (err: any) {
          // try next proxy
        }
      }
    }

    return { ok: false };
  } finally {
    if (tempFileName) {
      try {
        if (fs.existsSync(tempFileName)) {
          fs.unlinkSync(tempFileName);
        }
      } catch {}
    }
  }
}

// Helper to send message via Telegram API
async function sendCustomTelegramMessage(token: string, chatId: string | number, text: string) {
  if (!token) return false;
  try {
    const res = await runTelegramRequest(token, "sendMessage", {
      chat_id: chatId,
      text,
      parse_mode: "HTML"
    });
    if (res && res.ok) {
      return res.result?.message_id || true;
    }
    
    // Retry without HTML if it failed
    console.warn(`HTML message failed to send to ${chatId} on token ${token.substring(0, 8)}. Retrying as plain text.`);
    const resRetry = await runTelegramRequest(token, "sendMessage", {
      chat_id: chatId,
      text: text.replace(/<[^>]*>/g, "")
    });
    if (resRetry && resRetry.ok) {
      return resRetry.result?.message_id || true;
    }
    return false;
  } catch (err: any) {
    console.error(`Error sending message on token ${token.substring(0, 8)} to ${chatId}:`, err);
    return false;
  }
}

// Helper to send message with custom Inline Keyboard Markup
async function sendCustomTelegramMessageWithKeyboard(token: string, chatId: string | number, text: string, replyMarkup?: any) {
  if (!token) return false;
  try {
    const body: any = {
      chat_id: chatId,
      text,
      parse_mode: "HTML",
    };
    if (replyMarkup) {
      body.reply_markup = replyMarkup;
    }
    let res = await runTelegramRequest(token, "sendMessage", body);
    if (res && res.ok) {
      return res.result?.message_id || true;
    }
    
    console.warn(`HTML message with keyboard failed to send to ${chatId}. Reason: ${JSON.stringify(res)}. Retrying as plain text with no keyboard fallback.`);
    const cleanText = text.replace(/<[^>]*>/g, "");
    const resRetry = await runTelegramRequest(token, "sendMessage", {
      chat_id: chatId,
      text: cleanText
    });
    if (resRetry && resRetry.ok) {
      return resRetry.result?.message_id || true;
    }
    return false;
  } catch (err: any) {
    console.error(`Error sending keyboard message on token ${token.substring(0, 8)} to ${chatId}:`, err);
    return false;
  }
}

// Helper to answer Telegram Callback Query popups
async function answerBotCallbackQuery(token: string, callbackQueryId: string, text?: string) {
  try {
    await runTelegramRequest(token, "answerCallbackQuery", {
      callback_query_id: callbackQueryId,
      text: text || "",
      show_alert: text ? true : false
    });
  } catch (err) {
    console.error("Error answering callback query:", err);
  }
}

// Helper to update / edit existing message inline in real-time
async function editBotMessageText(token: string, chatId: string | number, messageId: number, text: string, replyMarkup?: any) {
  try {
    const body: any = {
      chat_id: chatId,
      message_id: messageId,
      text,
      parse_mode: "HTML",
      reply_markup: replyMarkup
    };
    let res = await runTelegramRequest(token, "editMessageText", body);
    if (res && res.ok) {
      return;
    }
    
    console.warn(`HTML message edit failed for ${chatId} / message ${messageId}. Retrying as plain text.`);
    body.text = text.replace(/<[^>]*>/g, "");
    delete body.parse_mode;
    await runTelegramRequest(token, "editMessageText", body);
  } catch (err) {
    console.error("Error editing message text:", err);
  }
}

// Subscriber binder helper
function registerNumberForSubInDb(userId: string, chatId: number, number: string, country: string, messageId?: number) {
  const db = readDb();
  const userIdx = db.users.findIndex((u: any) => u.id === userId);
  if (userIdx === -1) return;

  const user = db.users[userIdx];
  if (!user.subscribers) user.subscribers = [];

  const subIdx = user.subscribers.findIndex((s: any) => s.chatId === chatId);
  const now = new Date().toISOString();
  const formattedNum = number.replace(/[\s\-]/g, "");

  if (subIdx !== -1) {
    const hasNum = user.subscribers[subIdx].numbers.some(
      (n: any) => n.number.replace(/[\s\-]/g, "") === formattedNum
    );
    if (!hasNum) {
      if (!user.subscribers[subIdx].numbers) user.subscribers[subIdx].numbers = [];
      user.subscribers[subIdx].numbers.push({ number, country, registeredAt: now, messageId });
    }
  } else {
    user.subscribers.push({
      chatId,
      username: "Simulated_User",
      firstName: "User_" + chatId,
      registeredAt: now,
      numbers: [{ number, country, registeredAt: now, messageId }]
    });
  }
  writeDb(db);
}

// Handle Bot Commands and Button Interactions (Inline & Text)
async function handleBotUpdate(userId: string, token: string, update: any) {
  const db = readDb();
  const userIdx = db.users.findIndex((u: any) => u.id === userId);
  if (userIdx === -1) return;

  const user = db.users[userIdx];
  if (!user.subscribers) user.subscribers = [];

  // 1. HANDLE BUTTON CALLBACKS (Inline Interactive Mode)
  if (update.callback_query) {
    const cbQuery = update.callback_query;
    const chatId = cbQuery.message?.chat?.id;
    const messageId = cbQuery.message?.message_id;
    const data = cbQuery.data || "";
    const username = cbQuery.from.username || "";
    const firstName = cbQuery.from.first_name || "User";

    // Register active subscriber session
    let subIdx = user.subscribers.findIndex((s: any) => s.chatId === chatId);
    if (subIdx === -1) {
      user.subscribers.push({
        chatId,
        username: username || "",
        firstName,
        registeredAt: new Date().toISOString(),
        numbers: []
      });
      writeDb(db);
    }

    // Acknowledge the callback immediately to clear the loading spinner
    await answerBotCallbackQuery(token, cbQuery.id);

    // Handle button routing
    if (data === "btn_main_menu") {
      const textMsg = `🤖 TEAM ZERO SMS PANEL\n\n👋 Welcome, ${firstName}!\n\nGet virtual numbers and receive OTPs instantly.\n\nChoose an option:`;
      await editBotMessageText(token, chatId, messageId, textMsg, getMainKeyboard(user));
      return;
    }

    if (data === "btn_get_number") {
      const textMsg = `🌍 SELECT COUNTRY\n\nChoose a country:`;
      await editBotMessageText(token, chatId, messageId, textMsg, await getCountryKeyboard());
      return;
    }

    if (data.startsWith("btn_country_")) {
      const country = data.substring(12);
      const numbersList = await fetchAggregatedNumbers(country);
      const countryLines = numbersList.filter((n: any) => 
        String(n.country || "").trim().toLowerCase() === country.trim().toLowerCase()
      );

      if (countryLines.length === 0) {
        await editBotMessageText(token, chatId, messageId, `⚠️ No active lines available for ${country} in our pipeline. Tap below to choose another country.`, {
          inline_keyboard: [
            [{ text: "🌍 Select Another Country", callback_data: "btn_get_number" }],
            [{ text: "🏠 Main Menu", callback_data: "btn_main_menu" }]
          ]
        });
        return;
      }

      const randomLine = countryLines[Math.floor(Math.random() * countryLines.length)];
      const displayNum = randomLine.number;

      // Register the number with the subscriber and immediately claim/delete it
      registerNumberForSubInDb(userId, chatId, displayNum, country, messageId);
      claimNumberInDb(displayNum);

      const flag = getCountryFlag(country);
      const serviceName = user.botConfig?.whatsappEnabled ? "WhatsApp" : "All Services";

      const textMsg = `🌍 <b>Country:</b> ${country} ${flag}\n🔌 <b>Service:</b> ${serviceName}\n\n☎ <b>Number:</b> <code>${displayNum}</code>\n\n⌛ <b>Waiting for OTP...</b>`;
      await editBotMessageText(token, chatId, messageId, textMsg, getNumberSessionKeyboard(user, country, displayNum));
      return;
    }

    if (data.startsWith("btn_num_")) {
      const numId = data.substring(8);
      const db = readDb();
      const manual = db.manualNumbers || [];
      const selectedLine = manual.find((n: any) => n.id === numId);

      if (!selectedLine) {
        await editBotMessageText(token, chatId, messageId, `⚠️ This line is no longer available. Tap below to choose another.`, {
          inline_keyboard: [
            [{ text: "🌍 Select Country", callback_data: "btn_get_number" }],
            [{ text: "🏠 Main Menu", callback_data: "btn_main_menu" }]
          ]
        });
        return;
      }

      const displayNum = selectedLine.number;
      const country = selectedLine.country || "Indonesia";

      // Register the number with the subscriber and immediately claim/delete it
      registerNumberForSubInDb(userId, chatId, displayNum, country, messageId);
      claimNumberInDb(displayNum);

      const flag = getCountryFlag(country);
      const serviceName = user.botConfig?.whatsappEnabled ? "WhatsApp" : "All Services";

      const textMsg = `🌍 <b>Country:</b> ${country} ${flag}\n🔌 <b>Service:</b> ${serviceName}\n\n☎ <b>Number:</b> <code>${displayNum}</code>\n\n⌛ <b>Waiting for OTP...</b>`;
      await editBotMessageText(token, chatId, messageId, textMsg, getNumberSessionKeyboard(user, country, displayNum));
      return;
    }

    if (data.startsWith("btn_copy_")) {
      const numToCopy = data.substring(9);
      await answerBotCallbackQuery(token, cbQuery.id, `📋 Copied Number: ${numToCopy}`);
      return;
    }

    if (data === "btn_my_numbers") {
      const subObj = user.subscribers.find((s: any) => s.chatId === chatId);
      const activeLines = subObj ? (subObj.numbers || []) : [];

      if (activeLines.length === 0) {
        const textMsg = `📦 Your Active Numbers\n\nYou do not have any virtual lines registered yet. Click "Get Number" to obtain one!`;
        await editBotMessageText(token, chatId, messageId, textMsg, {
          inline_keyboard: [
            [{ text: "📱 Get Number", callback_data: "btn_get_number" }],
            [{ text: "🏠 Main Menu", callback_data: "btn_main_menu" }]
          ]
        });
      } else {
        let textMsg = `📦 Your Active Numbers & OTP Records\n\n`;
        activeLines.slice(-5).forEach((n: any, idx: number) => {
          textMsg += `🔹 ${idx + 1}. \`${n.number}\` (${n.country}) - Registered: ${new Date(n.registeredAt).toLocaleTimeString()}\n`;
        });
        textMsg += `\nIncoming messages will automatically trigger instant flash-alerts here!`;
        await editBotMessageText(token, chatId, messageId, textMsg, {
          inline_keyboard: [
            [{ text: "📱 Get New Number", callback_data: "btn_get_number" }],
            [{ text: "🏠 Main Menu", callback_data: "btn_main_menu" }]
          ]
        });
      }
      return;
    }

    if (data === "btn_help") {
      const textMsg = `❓ COMMANDS & HELP\n\n` +
        `• \`/get_number\` — Request virtual number\n` +
        `• \`/info\` — Contact owners\n\n` +
        `How it works:\n` +
        `1️⃣ Tap Get Number below\n` +
        `2️⃣ Choose a country queue\n` +
        `3️⃣ Register with the provided temp number\n` +
        `4️⃣ Incoming OTP arrives here automatically! ⚡`;
      await editBotMessageText(token, chatId, messageId, textMsg, getHelpKeyboard());
      return;
    }

    return;
  }

  // 2. HANDLE RAW TEXT COMMANDS (Standard Keyboard / CLI Mode)
  if (!update.message) return;
  const chatId = update.message.chat.id;
  const text = (update.message.text || "").trim();
  const username = update.message.from.username || "";
  const firstName = update.message.from.first_name || "User";

  // Ensure subscriber session is registered
  let subIdx = user.subscribers.findIndex((s: any) => s.chatId === chatId);
  if (subIdx === -1) {
    user.subscribers.push({
      chatId,
      username: username || "",
      firstName,
      registeredAt: new Date().toISOString(),
      numbers: []
    });
    writeDb(db);
  } else {
    user.subscribers[subIdx].username = username || user.subscribers[subIdx].username;
    user.subscribers[subIdx].firstName = firstName || user.subscribers[subIdx].firstName;
    writeDb(db);
  }

  const cleanText = text.toLowerCase();
  const ownerIdStr = String(user.botConfig?.ownerChatId || "").trim();
  const isOwner = String(chatId).trim() === ownerIdStr;

  // Owner broadcast command
  if (cleanText.startsWith("/broadcast")) {
    if (!isOwner) {
      await sendCustomTelegramMessage(token, chatId, "⚠️ You are not authorized to run the /broadcast command on this bot.");
      return;
    }
    const messageToBroadcast = text.substring(10).trim();
    if (!messageToBroadcast) {
      await sendCustomTelegramMessage(token, chatId, "⚠️ Usage: /broadcast <your message>");
      return;
    }

    let successCount = 0;
    const subs = user.subscribers || [];
    for (const sub of subs) {
      const ok = await sendCustomTelegramMessage(token, sub.chatId, `📢 Announcement from Bot Admin:\n\n${messageToBroadcast}`);
      if (ok) successCount++;
    }

    await sendCustomTelegramMessage(token, chatId, `✅ Broadcast complete!\nSent to ${successCount} of ${subs.length} subscribers.`);
    return;
  }

  // Command handlers
  if (cleanText.startsWith("/start")) {
    const textMsg = `🤖 TEAM ZERO SMS PANEL\n\n👋 Welcome, ${firstName}!\n\nGet virtual numbers and receive OTPs instantly.\n\nChoose an option:`;
    await sendCustomTelegramMessageWithKeyboard(token, chatId, textMsg, getMainKeyboard(user));
  } else if (cleanText.startsWith("/info")) {
    const contactOwner = user.botConfig?.botLink ? `🌐 Owner Contact: ${user.botConfig.botLink}\n` : "";
    const officialChan = user.botConfig?.otpGroupUrl ? `📢 Official Channel: ${user.botConfig.otpGroupUrl}\n` : "";
    
    await sendCustomTelegramMessage(
      token,
      chatId,
      `ℹ️ Information & Links\n\n` +
      contactOwner +
      officialChan +
      `Contact us for premium virtual lines and support.`
    );
  } else if (cleanText.startsWith("/get_number") || cleanText.startsWith("/getnumber")) {
    const numbersList = await fetchAggregatedNumbers();
    if (numbersList.length === 0) {
      await sendCustomTelegramMessage(
        token,
        chatId,
        `⚠️ Sorry! No numbers are currently available in the aggregation queue. Try again later.`
      );
      return;
    }
    const random = numbersList[Math.floor(Math.random() * numbersList.length)];
    const displayNum = random.number;
    const flag = getCountryFlag(random.country);
    const serviceName = user.botConfig?.whatsappEnabled ? "WhatsApp" : "All Services";

    const textMsg = `🌍 <b>Country:</b> ${random.country} ${flag}\n🔌 <b>Service:</b> ${serviceName}\n\n☎ <b>Number:</b> <code>${displayNum}</code>\n\n⌛ <b>Waiting for OTP...</b>`;

    const sentMessageId = await sendCustomTelegramMessage(
      token,
      chatId,
      textMsg
    );

    // Register the number with the subscriber (with message ID) and immediately claim/delete it
    registerNumberForSubInDb(userId, chatId, displayNum, random.country, typeof sentMessageId === "number" ? sentMessageId : undefined);
    claimNumberInDb(displayNum);

  } else {
    const textMsg = `🤖 TEAM ZERO SMS PANEL\n\n👋 Welcome, ${firstName}!\n\nGet virtual numbers and receive OTPs instantly.\n\nChoose an option:`;
    await sendCustomTelegramMessageWithKeyboard(token, chatId, textMsg, getMainKeyboard(user));
  }
}

const activeBotPollers = new Set<string>();

async function pollSingleTelegramBot(userId: string, token: string) {
  if (isPollingPaused) {
    setTimeout(() => pollSingleTelegramBot(userId, token), 2000);
    return;
  }

  // Reload DB to get freshest configurations
  const db = readDb();
  const user = db.users.find((u: any) => u.id === userId);
  
  // If user doesn't exist, botConfig has changed or status is paused/inactive, stop polling for this token
  if (!user || !user.botConfig || user.botConfig.token !== token || user.botConfig.status === "paused") {
    activeBotPollers.delete(token);
    return;
  }

  let hasUpdates = false;
  try {
    const lastUpdateId = botOffsets[token] || 0;
    const data = await runTelegramRequest(token, "getUpdates", {
      offset: lastUpdateId + 1,
      timeout: 0,
      allowed_updates: ["message", "callback_query"]
    });
    if (data && data.ok && data.result && Array.isArray(data.result)) {
      if (data.result.length > 0) {
        hasUpdates = true;
        for (const update of data.result) {
          botOffsets[token] = update.update_id;
          await handleBotUpdate(userId, token, update);
        }
      }
    }
  } catch (err) {
    // Silently catch individual bot polling issues
  }

  // Poll immediately if we got updates, otherwise sleep for 150ms to keep it super lightweight but instant (under 1 sec response!)
  const delay = hasUpdates ? 0 : 150;
  setTimeout(() => pollSingleTelegramBot(userId, token), delay);
}

// Telegram Worker: Multi-bot polling coordinator supporting independent parallel pollers
async function pollAllTelegramBots() {
  if (isPollingPaused) {
    if (!process.env.VERCEL) {
      setTimeout(pollAllTelegramBots, 5000);
    }
    return;
  }

  try {
    const db = readDb();
    const users = db.users || [];

    for (const user of users) {
      const token = user.botConfig?.token;
      if (token && user.botConfig?.status !== "paused") {
        if (!activeBotPollers.has(token)) {
          activeBotPollers.add(token);
          // Spin up independent fast polling loop for this bot
          pollSingleTelegramBot(user.id, token);
        }
      }
    }
  } catch (err) {
    console.error("Error coordinating telegram bot pollers:", err);
  }

  // Keep coordinating periodically to discover any newly added bots
  if (!process.env.VERCEL) {
    setTimeout(pollAllTelegramBots, 10000);
  }
}

function formatTelegramUrl(url: string): string {
  if (!url) return "";
  let clean = url.trim();
  if (clean.startsWith("@")) {
    return `https://t.me/${clean.substring(1)}`;
  }
  if (clean.startsWith("t.me/")) {
    return `https://${clean}`;
  }
  if (!clean.startsWith("http://") && !clean.startsWith("https://")) {
    if (clean.includes("/") || clean.includes(".")) {
      return `https://${clean}`;
    }
    return `https://t.me/${clean}`;
  }
  return clean;
}

function getOtpInlineKeyboard(botConfig: any) {
  const keyboard: any[][] = [];
  const row: any[] = [];
  
  const b1Text = botConfig?.btn1Text || "🤖 Bot Panel";
  const b1Url = formatTelegramUrl(botConfig?.btn1Url || botConfig?.botLink || "");
  
  const b2Text = botConfig?.btn2Text || "⚡ See OTP";
  const b2Url = formatTelegramUrl(botConfig?.btn2Url || botConfig?.otpGroupUrl || "");

  const b3Text = botConfig?.btn3Text || "📢 Main Channel";
  const b3Url = formatTelegramUrl(botConfig?.btn3Url || "");

  const hasAnyLink = (b1Url && b1Url.startsWith("http")) ||
                     (b2Url && b2Url.startsWith("http")) ||
                     (b3Url && b3Url.startsWith("http"));

  if (!hasAnyLink) {
    return undefined;
  }

  if (b1Url && b1Url.startsWith("http")) {
    row.push({ text: b1Text, url: b1Url });
  }
  
  if (b2Url && b2Url.startsWith("http")) {
    row.push({ text: b2Text, url: b2Url });
  }

  if (row.length > 0) {
    keyboard.push(row);
  }

  if (b3Url && b3Url.startsWith("http")) {
    keyboard.push([{ text: b3Text, url: b3Url }]);
  }

  return keyboard.length > 0 ? { inline_keyboard: keyboard } : undefined;
}

function getOtpInlineKeyboardWithOtp(botConfig: any, extractedOtp: string, targetChatId?: string | number) {
  const keyboard: any[][] = [];
  
  const b1Text = botConfig?.btn1Text || "🤖 Number Bot";
  const b1Url = formatTelegramUrl(botConfig?.btn1Url || botConfig?.botLink || "");
  
  const b2Text = botConfig?.btn2Text || "🤖 File To Link Bot";
  const b2Url = formatTelegramUrl(botConfig?.btn2Url || botConfig?.otpGroupUrl || "");
  
  const b3Text = botConfig?.btn3Text || "📢 Main Channel";
  const b3Url = formatTelegramUrl(botConfig?.btn3Url || "");

  const hasAnyLink = (b1Url && b1Url.startsWith("http")) ||
                     (b2Url && b2Url.startsWith("http")) ||
                     (b3Url && b3Url.startsWith("http"));

  const isChannelOrGroup = targetChatId ? String(targetChatId).startsWith("-") : false;

  if (!hasAnyLink && isChannelOrGroup) {
    return undefined;
  }

  if (isChannelOrGroup) {
    // For channels and groups, we MUST NOT include any callback_data buttons (e.g. the copy button).
    // Telegram will reject reply markup with callback_data if sent to a channel.
    // Instead, only show the link buttons!
    const row1: any[] = [];
    if (b1Url && b1Url.startsWith("http")) {
      row1.push({ text: b1Text, url: b1Url });
    }
    if (row1.length > 0) {
      keyboard.push(row1);
    }

    const row2: any[] = [];
    if (b2Url && b2Url.startsWith("http")) {
      row2.push({ text: b2Text, url: b2Url });
    }
    if (b3Url && b3Url.startsWith("http")) {
      row2.push({ text: b3Text, url: b3Url });
    }
    if (row2.length > 0) {
      keyboard.push(row2);
    }
  } else {
    // For private chats, we can safely include the Copy OTP callback button.
    const row1: any[] = [];
    row1.push({ text: `🔒 ${extractedOtp}`, callback_data: `btn_copy_${extractedOtp}` });
    
    if (b1Url && b1Url.startsWith("http")) {
      row1.push({ text: b1Text, url: b1Url });
    }
    keyboard.push(row1);

    const row2: any[] = [];
    if (b2Url && b2Url.startsWith("http")) {
      row2.push({ text: b2Text, url: b2Url });
    }
    if (b3Url && b3Url.startsWith("http")) {
      row2.push({ text: b3Text, url: b3Url });
    }
    if (row2.length > 0) {
      keyboard.push(row2);
    }
  }

  return { inline_keyboard: keyboard };
}

// Fast user target APIs configuration and stats
export const apiStats: { [key: string]: { success: number; fail: number; lastStatus: string; lastError: string; lastSuccessTime: string } } = {
  "API 1": { success: 0, fail: 0, lastStatus: "Pending", lastError: "", lastSuccessTime: "" },
  "API 2": { success: 0, fail: 0, lastStatus: "Pending", lastError: "", lastSuccessTime: "" },
  "API 3": { success: 0, fail: 0, lastStatus: "Pending", lastError: "", lastSuccessTime: "" },
  "API 4": { success: 0, fail: 0, lastStatus: "Pending", lastError: "", lastSuccessTime: "" }
};

export let isPollingPaused = false;
let isFastPolling = false;

async function fetchUserTargetApi(label: string, url: string, token: string, format: "array" | "pscall"): Promise<any[]> {
  try {
    let finalUrl = url;
    if (format === "pscall") {
      finalUrl = `${url}?key=${encodeURIComponent(token)}&token=${encodeURIComponent(token)}`;
    } else {
      finalUrl = `${url}?token=${encodeURIComponent(token)}&key=${encodeURIComponent(token)}`;
    }

    let text = "";
    let success = false;
    let lastErrMessage = "";

    // 1. Try direct fetch first
    try {
      const response = await fetchWithTimeout(finalUrl, {
        headers: {
          "Authorization": `Bearer ${token}`,
          "Token": token,
          "Key": token,
          "X-API-KEY": token
        }
      }, 3500);
      if (response.ok) {
        text = await response.text();
        success = true;
      } else {
        lastErrMessage = `HTTP ${response.status}`;
      }
    } catch (err: any) {
      lastErrMessage = err.message || "Timeout";
    }

    // 2. If direct fetch fails, immediately try via proxy curl (multi-proxy rotation)
    if (!success) {
      await refreshProxyList();
      const headersOption = [
        `-H "Authorization: Bearer ${token}"`,
        `-H "Token: ${token}"`,
        `-H "Key: ${token}"`,
        `-H "X-API-KEY: ${token}"`
      ].join(" ");

      // Try up to 10 proxies
      for (let attempt = 0; attempt < 10; attempt++) {
        if (proxyList.length === 0) break;
        const proxy = proxyList[currentProxyIndex];
        currentProxyIndex = (currentProxyIndex + 1) % proxyList.length;

        try {
          const cmd = `curl -x "${proxy}" -s -4 -m 3.5 -X GET ${headersOption} -w "\\n%{http_code}" "${finalUrl}"`;
          const output = await execPromise(cmd, { timeout: 4500 });
          if (output && output.trim()) {
            const lines = output.split("\n");
            const status = parseInt(lines[lines.length - 1].trim()) || 0;
            const body = lines.slice(0, lines.length - 1).join("\n");
            if (status === 200 || status === 302 || status === 401) {
              text = body;
              success = true;
              currentProxyIndex = (currentProxyIndex - 1 + proxyList.length) % proxyList.length;
              break;
            } else {
              lastErrMessage = `Proxy HTTP ${status}`;
            }
          }
        } catch (err: any) {
          lastErrMessage = err.message || "Proxy timeout";
        }
      }
    }

    if (!success) {
      throw new Error(lastErrMessage || "Fetch failed");
    }

    let data: any;
    try {
      data = JSON.parse(text);
    } catch {
      throw new Error("Invalid JSON response");
    }

    let list: any[] = [];
    if (format === "pscall") {
      if (data && Array.isArray(data.data)) {
        list = data.data;
      } else if (Array.isArray(data)) {
        list = data;
      } else if (data && Array.isArray(data.result)) {
        list = data.result;
      }
    } else {
      if (Array.isArray(data)) {
        list = data;
      } else if (data && Array.isArray(data.data)) {
        list = data.data;
      } else if (data && Array.isArray(data.result)) {
        list = data.result;
      } else if (data && typeof data === "object") {
        for (const k of Object.keys(data)) {
          if (Array.isArray(data[k])) {
            list = data[k];
            break;
          }
        }
      }
    }

    const mapped = list.map((item: any) => {
      let number = "";
      let sender = "Unknown";
      let message = "";
      let dateStr = "";

      if (Array.isArray(item)) {
        sender = String(item[0] || "Unknown");
        number = String(item[1] || "").trim();
        message = String(item[2] || "");
        dateStr = String(item[3] || "");
      } else if (item && typeof item === "object") {
        number = String(item.num || item.number || "").trim();
        sender = String(item.cli || item.sender || "Unknown");
        message = String(item.sms || item.message || "");
        dateStr = String(item.dateadded || item.date || "");
      }

      if (!number) return null;

      const timestamp = isNaN(Date.parse(dateStr)) ? new Date().toISOString() : new Date(dateStr).toISOString();
      return {
        timestamp,
        number,
        service: detectServiceFromMessageAndSender(sender, message),
        message,
        country: getCountryFromNumber(number),
        source: label
      };
    }).filter((o: any) => o && o.number);

    apiStats[label].success++;
    apiStats[label].lastStatus = "Online";
    apiStats[label].lastError = "";
    apiStats[label].lastSuccessTime = new Date().toISOString();

    return mapped;
  } catch (err: any) {
    apiStats[label].fail++;
    apiStats[label].lastStatus = "Offline";
    apiStats[label].lastError = err.message || "Timeout or network error";
    return [];
  }
}

async function runFastUserApiPoller() {
  if (isFastPolling) {
    setTimeout(runFastUserApiPoller, 1000);
    return;
  }
  if (isPollingPaused) {
    setTimeout(runFastUserApiPoller, 2000);
    return;
  }
  isFastPolling = true;

  try {
    const api1Logs = await fetchUserTargetApi("API 1", "http://147.135.212.197/crapi/st/viewstats", "SE5XREZBUzRfTpVnX2dQh3NQcYB2dZBWQ4JpXVxmblp2alCDi25oZg==", "array");
    const api2Logs = await fetchUserTargetApi("API 2", "http://147.135.212.197/crapi/st/viewstats", "RVdWRElBUzRGcW9WeneNcmd2cGV9ZJd8e29PVlyPcFxeamxSgWVXfw==", "array");
    const api3Logs = await fetchUserTargetApi("API 3", "https://pscall.net/restapi/smsreport", "SFNYSj1SS16DgYdyf4KIgA==", "pscall");
    const api4Logs = await fetchUserTargetApi("API 4", "http://147.135.212.197/crapi/time/viewstats", "RldRNEVBYIFbkYpaY19udX53hX1DZnZhiI9iRkGEjGGFdXZKfmw", "array");

    const allNewSms = [...api1Logs, ...api2Logs, ...api3Logs, ...api4Logs];

    if (allNewSms.length > 0) {
      // Prepend to targetApiSmsHistory for visual logs in Admin Panel
      for (const sms of allNewSms) {
        const isDuplicate = targetApiSmsHistory.some(
          (s: any) => s.number === sms.number && s.message === sms.message && s.timestamp === sms.timestamp
        );
        if (!isDuplicate) {
          targetApiSmsHistory.unshift(sms);
        }
      }
      if (targetApiSmsHistory.length > 100) {
        targetApiSmsHistory = targetApiSmsHistory.slice(0, 100);
      }

      const db = readDb();
      let dbUpdated = false;

      // Merge into cachedSms
      const mergedList = [...allNewSms, ...cachedSms];
      mergedList.sort((a, b) => b.timestamp.localeCompare(a.timestamp));
      const seen = new Set<string>();
      const uniqueList: any[] = [];
      for (const sms of mergedList) {
        const key = `${sms.number}_${sms.message.slice(0, 30)}`;
        if (!seen.has(key)) {
          seen.add(key);
          uniqueList.push(sms);
        }
      }
      cachedSms = uniqueList.slice(0, 100);

      // Look for NEW unforwarded ones to trigger instant Telegram delivery!
      for (const sms of allNewSms) {
        const numberClean = sms.number.replace(/[\s\-\+]/g, "");
        const msg = sms.message;
        const service = sms.service;
        const timestamp = sms.timestamp;
        const country = sms.country;

        // Auto claim in DB
        if (!db.claimedNumbers.includes(numberClean)) {
          db.claimedNumbers.push(numberClean);
          dbUpdated = true;
        }
        if (db.manualNumbers) {
          const originalLength = db.manualNumbers.length;
          db.manualNumbers = db.manualNumbers.filter(
            (n: any) => n.number.replace(/[\s\-\+]/g, "") !== numberClean
          );
          if (db.manualNumbers.length !== originalLength) {
            dbUpdated = true;
          }
        }

        const smsId = `${numberClean}_${msg.trim()}`;
        const userSmsKeyBase = `${numberClean}_${msg.trim()}`;

        // Auto add to db.manualSms so any API OTPs are permanently stored
        if (!db.manualSms) db.manualSms = [];
        const isDuplicateManual = db.manualSms.some(
          (s: any) => s.number === sms.number && s.message === sms.message
        );
        if (!isDuplicateManual) {
          db.manualSms.unshift(sms);
          if (db.manualSms.length > 100) {
            db.manualSms = db.manualSms.slice(0, 100);
          }
          dbUpdated = true;
        }

        for (const user of db.users) {
          if (user.botConfig?.status === "paused") continue;
          const userSmsKey = `${user.id}_${userSmsKeyBase}`;
          if (lastForwardedSmsIds.has(userSmsKey)) continue;
          if (isSmsDuplicateForUser(user, numberClean, msg)) {
            lastForwardedSmsIds.add(userSmsKey);
            continue;
          }
          lastForwardedSmsIds.add(userSmsKey);

          if (lastForwardedSmsIds.size > 1000) {
            const arr = Array.from(lastForwardedSmsIds);
            lastForwardedSmsIds = new Set(arr.slice(200));
          }

          const token = user.botConfig?.token;
          const extOtp = extractOtp(msg);
          const customMsgText = formatTelegramOtpMessage(sms, msg, service, country);

          const matchedSubs = (user.subscribers || []).filter((s: any) =>
            (s.numbers || []).some((n: any) => n.number.replace(/[\s\-\+]/g, "") === numberClean)
          );

          if (token) {
            for (const sub of matchedSubs) {
              if (sub.chatId === 0) continue;
              
              // Find if this number has an active session with a messageId
              const numSession = (sub.numbers || []).find((n: any) => n.number.replace(/[\s\-\+]/g, "") === numberClean);
              if (numSession && numSession.messageId) {
                const flag = getCountryFlag(country);
                const serviceName = user.botConfig?.whatsappEnabled ? "WhatsApp" : "All Services";
                const displayOtp = extOtp === "PENDING" ? "Awaiting Code..." : extOtp;
                const updatedText = `🌍 <b>Country:</b> ${country} ${flag}\n🔌 <b>Service:</b> ${serviceName}\n\n☎ <b>Number:</b> <code>${numSession.number}</code>\n\n✅ <b>OTP Received:</b> <code>${displayOtp}</code>\n\n💬 <b>Message:</b>\n<i>${escapeTelegramHtml(msg)}</i>`;
                
                const inlineKbWithOtp = getOtpInlineKeyboardWithOtp(user.botConfig, extOtp, sub.chatId);
                await editBotMessageText(token, sub.chatId, numSession.messageId, updatedText, inlineKbWithOtp);
              }

              const inlineKbWithOtp = getOtpInlineKeyboardWithOtp(user.botConfig, extOtp, sub.chatId);
              await sendCustomTelegramMessageWithKeyboard(token, sub.chatId, customMsgText, inlineKbWithOtp);
            }
            if (user.botConfig?.groupId) {
              const inlineKbWithOtp = getOtpInlineKeyboardWithOtp(user.botConfig, extOtp, user.botConfig.groupId);
              await sendCustomTelegramMessageWithKeyboard(token, user.botConfig.groupId, customMsgText, inlineKbWithOtp);
            }
          }
          
          // Also feed user's internal OTP logs so the web interface is populated!
          if (user.botConfig) {
            if (!user.otpHistory) user.otpHistory = [];
            const isDuplicate = user.otpHistory.some(
              (h: any) => h.number === sms.number && h.message === sms.message
            );
            if (!isDuplicate) {
              user.otpHistory.unshift(sms);
              if (user.otpHistory.length > 30) {
                user.otpHistory = user.otpHistory.slice(0, 30);
              }
              dbUpdated = true;
            }
          }
        }
      }

      if (dbUpdated) {
        writeDb(db);
      }
    }
  } catch (err) {
    console.error("[Fast Poller] Error:", err);
  } finally {
    isFastPolling = false;
    if (!process.env.VERCEL) {
      setTimeout(runFastUserApiPoller, 5000);
    }
  }
}

// Start fast target APIs background loop
if (!process.env.VERCEL) {
  setTimeout(runFastUserApiPoller, 1000);
}

let isPollingIncomingSms = false;

// SMS Worker: Forwarding to all subscribers across all bots
async function pollIncomingSms() {
  if (isPollingIncomingSms) {
    setTimeout(pollIncomingSms, 10000);
    return;
  }
  isPollingIncomingSms = true;

  try {
    // Poll all numbers from all APIs to cache them respectably
    try {
      await fetchAggregatedNumbers(undefined, false);
    } catch (numErr: any) {
      console.error("[Worker] Background numbers poll error:", numErr.message);
    }

    const otps = await fetchAggregatedSms(false);
    const db = readDb();
    let dbUpdated = false;

    for (const otp of otps) {
      const numberClean = otp.number.replace(/[\s\-\+]/g, "");
      const msg = otp.message;
      const service = otp.service;
      const timestamp = otp.timestamp;
      const country = otp.country;

      // Unconditionally claim and remove number from manual/active list since an OTP has been received!
      if (!db.claimedNumbers.includes(numberClean)) {
        db.claimedNumbers.push(numberClean);
        dbUpdated = true;
      }
      if (db.manualNumbers) {
        const originalLength = db.manualNumbers.length;
        db.manualNumbers = db.manualNumbers.filter(
          (n: any) => n.number.replace(/[\s\-\+]/g, "") !== numberClean
        );
        if (db.manualNumbers.length !== originalLength) {
          dbUpdated = true;
        }
      }

      const smsId = `${numberClean}_${msg.trim()}`;
      const userSmsKeyBase = `${numberClean}_${msg.trim()}`;

      // Auto add to db.manualSms so any API OTPs are permanently stored
      if (!db.manualSms) db.manualSms = [];
      const isDuplicateManual = db.manualSms.some(
        (s: any) => s.number === otp.number && s.message === otp.message
      );
      if (!isDuplicateManual) {
        db.manualSms.unshift(otp);
        if (db.manualSms.length > 100) {
          db.manualSms = db.manualSms.slice(0, 100);
        }
        dbUpdated = true;
      }

      // Check subscribers of every user
      for (const user of db.users) {
        const userSmsKey = `${user.id}_${userSmsKeyBase}`;
        if (lastForwardedSmsIds.has(userSmsKey)) continue;
        if (isSmsDuplicateForUser(user, numberClean, msg)) {
          lastForwardedSmsIds.add(userSmsKey);
          continue;
        }
        lastForwardedSmsIds.add(userSmsKey);

        if (lastForwardedSmsIds.size > 1000) {
          const arr = Array.from(lastForwardedSmsIds);
          lastForwardedSmsIds = new Set(arr.slice(200));
        }

        const token = user.botConfig?.token;
        const extOtp = extractOtp(msg);
        const customMsgText = formatTelegramOtpMessage(otp, msg, service, country);

        const matchedSubs = (user.subscribers || []).filter((s: any) =>
          (s.numbers || []).some((n: any) => n.number.replace(/[\s\-\+]/g, "") === numberClean)
        );

        if (token) {
          for (const sub of matchedSubs) {
            if (sub.chatId === 0) continue; // Skip dummy subscriber used for web claims
            
            // Find if this number has an active session with a messageId
            const numSession = (sub.numbers || []).find((n: any) => n.number.replace(/[\s\-\+]/g, "") === numberClean);
            if (numSession && numSession.messageId) {
              const flag = getCountryFlag(country);
              const serviceName = user.botConfig?.whatsappEnabled ? "WhatsApp" : "All Services";
              const displayOtp = extOtp === "PENDING" ? "Awaiting Code..." : extOtp;
              const updatedText = `🌍 <b>Country:</b> ${country} ${flag}\n🔌 <b>Service:</b> ${serviceName}\n\n☎ <b>Number:</b> <code>${numSession.number}</code>\n\n✅ <b>OTP Received:</b> <code>${displayOtp}</code>\n\n💬 <b>Message:</b>\n<i>${escapeTelegramHtml(msg)}</i>`;
              
              const inlineKbWithOtp = getOtpInlineKeyboardWithOtp(user.botConfig, extOtp, sub.chatId);
              await editBotMessageText(token, sub.chatId, numSession.messageId, updatedText, inlineKbWithOtp);
            }

            const inlineKbWithOtp = getOtpInlineKeyboardWithOtp(user.botConfig, extOtp, sub.chatId);
            await sendCustomTelegramMessageWithKeyboard(
              token,
              sub.chatId,
              customMsgText,
              inlineKbWithOtp
            );
          }

          if (user.botConfig?.groupId) {
            const inlineKbWithOtp = getOtpInlineKeyboardWithOtp(user.botConfig, extOtp, user.botConfig.groupId);
            await sendCustomTelegramMessageWithKeyboard(
              token,
              user.botConfig.groupId,
              customMsgText,
              inlineKbWithOtp
            );
          }
        }

        // WhatsApp forwarding trigger (Simulated Delivery Log)
        if (user.botConfig?.whatsappEnabled) {
          if (!user.whatsappHistory) {
            user.whatsappHistory = [];
          }
          const whatsappLog = {
            timestamp: new Date().toISOString(),
            number: otp.number,
            service: service,
            message: msg,
            country: country,
            newsletter: user.botConfig.whatsappNewsletter || "",
            numberChannel: user.botConfig.whatsappNumberChannel || "",
            mainChannel: user.botConfig.whatsappMainChannel || "",
            poweredBy: user.botConfig.whatsappPoweredBy || "Team Zero Bot",
            phone: user.botConfig.whatsappPhone || "",
            btn1Text: user.botConfig.btn1Text || "🤖 Bot Panel",
            btn1Url: user.botConfig.btn1Url || user.botConfig.botLink || "",
            btn2Text: user.botConfig.btn2Text || "⚡ See OTP",
            btn2Url: user.botConfig.btn2Url || user.botConfig.otpGroupUrl || "",
            btn3Text: user.botConfig.btn3Text || "📢 Main Channel",
            btn3Url: user.botConfig.btn3Url || ""
          };
          
          const isDuplicateWA = user.whatsappHistory.some(
            (h: any) => h.number === otp.number && h.message === msg
          );
          if (!isDuplicateWA) {
            user.whatsappHistory.unshift(whatsappLog);
            if (user.whatsappHistory.length > 30) {
              user.whatsappHistory = user.whatsappHistory.slice(0, 30);
            }
            dbUpdated = true;
          }
        }

        if (matchedSubs.length > 0 || user.botConfig?.whatsappEnabled) {
          if (!user.otpHistory) user.otpHistory = [];
          const isDuplicate = user.otpHistory.some(
            (h: any) => h.number === otp.number && h.message === otp.message
          );
          if (!isDuplicate) {
            user.otpHistory.unshift(otp);
            if (user.otpHistory.length > 30) {
              user.otpHistory = user.otpHistory.slice(0, 30);
            }
            dbUpdated = true;
          }
        }
      }
    }

    if (dbUpdated) {
      writeDb(db);
    }
  } catch (err) {
    console.error("SMS poll failure:", err);
  } finally {
    isPollingIncomingSms = false;
    if (!process.env.VERCEL) {
      setTimeout(pollIncomingSms, 5000);
    }
  }
}

let isAutoAddingNumbers = false;

async function autoAddNumbersFromApis() {
  if (isAutoAddingNumbers) return;
  isAutoAddingNumbers = true;

  try {
    console.log("[AutoNumberAdder] Polling and adding numbers from all APIs into manualNumbers...");
    const activeApiNumbers = await fetchAggregatedNumbers(undefined, true);
    
    const db = readDb();
    if (!db.manualNumbers) db.manualNumbers = [];
    if (!db.claimedNumbers) db.claimedNumbers = [];

    let addedCount = 0;
    const nowStr = new Date().toISOString();
    const newlyAddedNumbers: any[] = [];

    for (const item of activeApiNumbers) {
      const cleanNum = item.number.replace(/[\s\-\+]/g, "");
      if (!cleanNum) continue;

      if (db.claimedNumbers.includes(cleanNum)) continue;

      const exists = db.manualNumbers.some((n: any) => n.number.replace(/[\s\-\+]/g, "") === cleanNum);
      if (!exists) {
        const newNumObj = {
          id: "num_" + Date.now() + "_" + Math.random().toString(36).substring(2, 7),
          number: item.number,
          country: item.country || "Indonesia",
          server: item.source || "API Aggregator",
          addedAt: nowStr
        };
        db.manualNumbers.push(newNumObj);
        newlyAddedNumbers.push(newNumObj);
        addedCount++;
      }
    }

    if (addedCount > 0) {
      writeDb(db);
      console.log(`[AutoNumberAdder] Successfully auto-added ${addedCount} new numbers from API aggregators.`);
      dispatchNewNumbers(newlyAddedNumbers).catch(err => {
        console.error("[AutoNumberAdder] Error broadcasting auto-added numbers:", err);
      });
    } else {
      console.log("[AutoNumberAdder] No new unique numbers found to auto-add.");
    }
  } catch (err: any) {
    console.error("[AutoNumberAdder] Error:", err.message);
  } finally {
    isAutoAddingNumbers = false;
    if (!process.env.VERCEL) {
      setTimeout(autoAddNumbersFromApis, 60 * 1000);
    }
  }
}

// Start workers
if (!process.env.VERCEL) {
  pollAllTelegramBots();
  setTimeout(pollIncomingSms, 2000);
  setTimeout(autoAddNumbersFromApis, 5000);
}

// ============================================================
//  API ROUTES
// ============================================================

// 0. Vercel Cron 24/7 background polling endpoint
app.get("/api/cron/poll", async (req, res) => {
  try {
    console.log("[Cron] Running 24/7 background pollers...");
    // Explicitly reset locks to allow cron executions to proceed
    isFastPolling = false;
    isPollingIncomingSms = false;

    // Run each of the main workers once
    await Promise.all([
      runFastUserApiPoller(),
      pollIncomingSms(),
      pollAllTelegramBots()
    ]);

    res.json({ success: true, message: "Cron polling completed successfully." });
  } catch (err: any) {
    console.error("[Cron] Error:", err);
    res.status(500).json({ success: true, error: err.message, note: "Handled gracefully to prevent cron failures" });
  }
});

// 1. Get Aggregated Numbers with Stats
app.get("/api/numbers", async (req, res) => {
  try {
    const list = await fetchAggregatedNumbers();
    const countryCounts: { [key: string]: number } = {};
    list.forEach((n) => {
      const c = n.country || "Unknown";
      countryCounts[c] = (countryCounts[c] || 0) + 1;
    });

    res.json({
      success: true,
      numbers: list,
      stats: {
        totalNumbers: list.length,
        countryBreakdown: countryCounts,
      },
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 1b. Claim virtual number (registers it to user session and immediately claims/deletes it)
app.post("/api/numbers/claim", (req, res) => {
  const { number, userId, country } = req.body;
  if (!number) {
    return res.status(400).json({ success: false, error: "Number is required" });
  }

  if (userId) {
    registerNumberForSubInDb(userId, 0, number, country || "Virtual Number");
  }
  claimNumberInDb(number);

  res.json({ success: true, message: "Number assigned to user session and claimed successfully" });
});

// Polling Stats and Control Endpoints
app.get("/api/admin/system-status", (req, res) => {
  res.json({
    success: true,
    isVercel: !!process.env.VERCEL,
    isKvConfigured: !!(process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN),
    dbFile: DB_FILE
  });
});

app.get("/api/admin/polling-stats", (req, res) => {
  res.json({
    success: true,
    stats: apiStats,
    backgroundStats: backgroundApiStats,
    isPollingPaused: isPollingPaused
  });
});

app.post("/api/admin/polling-control", (req, res) => {
  const { paused } = req.body;
  if (typeof paused === "boolean") {
    isPollingPaused = paused;
  }
  res.json({
    success: true,
    isPollingPaused: isPollingPaused
  });
});

app.get("/api/admin/target-sms", (req, res) => {
  res.json({
    success: true,
    sms: targetApiSmsHistory
  });
});

// 2. Get Aggregated SMS Logs
app.get("/api/sms", async (req, res) => {
  try {
    const list = await fetchAggregatedSms();
    const db = readDb();
    
    const augmentedList = list.map((o: any) => {
      const numberClean = o.number.replace(/[\s\-\+]/g, "");
      let btn1Text = "";
      let btn1Url = "";
      let btn2Text = "";
      let btn2Url = "";
      let btn3Text = "";
      let btn3Url = "";
      let botUsername = "";

      for (const u of db.users) {
        const hasSub = (u.subscribers || []).some((s: any) => 
          (s.numbers || []).some((n: any) => n.number.replace(/[\s\-\+]/g, "") === numberClean)
        );
        if (hasSub) {
          btn1Text = u.botConfig?.btn1Text || "";
          btn1Url = u.botConfig?.btn1Url || u.botConfig?.botLink || "";
          btn2Text = u.botConfig?.btn2Text || u.botConfig?.otpGroupUrl || "";
          btn3Text = u.botConfig?.btn3Text || "";
          btn3Url = u.botConfig?.btn3Url || "";
          botUsername = u.username || "";
          break;
        }
      }

      return {
        ...o,
        btn1Text,
        btn1Url,
        btn2Text,
        btn2Url,
        btn3Text,
        btn3Url,
        botUsername
      };
    });

    res.json({ success: true, otps: augmentedList });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 3. User Registration (Account to Deploy Bot)
app.post("/api/users/register", (req, res) => {
  const { username, email, password } = req.body;
  if (!username || !email || !password) {
    return res.status(400).json({ success: false, error: "Please fill in all details." });
  }

  const db = readDb();
  const exists = db.users.some((u: any) => u.email.toLowerCase() === email.toLowerCase());
  if (exists) {
    return res.status(400).json({ success: false, error: "Email is already registered." });
  }

  const newUser = {
    id: "user_" + Date.now(),
    username,
    email,
    password,
    botConfig: {
      token: "",
      groupId: "",
      ownerChatId: "",
      botLink: "",
      otpGroupUrl: "",
    },
    subscribers: [],
  };

  db.users.push(newUser);
  writeDb(db);

  res.json({
    success: true,
    user: {
      id: newUser.id,
      username: newUser.username,
      email: newUser.email,
      botConfig: newUser.botConfig,
      subscribers: newUser.subscribers,
      otpHistory: [],
      whatsappHistory: [],
    },
  });
});

// 4. User Login
app.post("/api/users/login", (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ success: false, error: "Credentials required" });
  }

  const db = readDb();
  const user = db.users.find(
    (u: any) => u.email.toLowerCase() === email.toLowerCase() && u.password === password
  );

  if (!user) {
    return res.status(401).json({ success: false, error: "Invalid email or password." });
  }

  res.json({
    success: true,
    user: {
      id: user.id,
      username: user.username,
      email: user.email,
      botConfig: user.botConfig,
      subscribers: user.subscribers || [],
      otpHistory: user.otpHistory || [],
      whatsappHistory: user.whatsappHistory || [],
    },
  });
});

// 4b. Toggle User Bot Polling Status (paused / active)
app.post("/api/users/bot/toggle-status", (req, res) => {
  const { userId } = req.body;
  if (!userId) {
    return res.status(400).json({ success: false, error: "User ID required" });
  }

  const db = readDb();
  const userIdx = db.users.findIndex((u: any) => u.id === userId);
  if (userIdx === -1) {
    return res.status(404).json({ success: false, error: "User not found" });
  }

  const botConfig = db.users[userIdx].botConfig || {};
  const currentStatus = botConfig.status || "offline";
  const newStatus = currentStatus === "paused" ? "active" : "paused";

  db.users[userIdx].botConfig = {
    ...botConfig,
    status: newStatus
  };

  writeDb(db);
  res.json({ success: true, status: newStatus, botConfig: db.users[userIdx].botConfig });
});

// 5. Update User Bot Configuration
app.post("/api/users/bot/config", (req, res) => {
  const {
    userId,
    token,
    groupId,
    ownerChatId,
    botLink,
    otpGroupUrl,
    btn1Text,
    btn1Url,
    btn2Text,
    btn2Url,
    btn3Text,
    btn3Url,
    whatsappEnabled,
    whatsappNewsletter,
    whatsappNumberChannel,
    whatsappMainChannel,
    whatsappPoweredBy,
    whatsappPhone,
    whatsappStatus
  } = req.body;

  if (!userId) {
    return res.status(400).json({ success: false, error: "User ID required" });
  }

  const db = readDb();
  const userIdx = db.users.findIndex((u: any) => u.id === userId);
  if (userIdx === -1) {
    return res.status(404).json({ success: false, error: "User not found" });
  }

  db.users[userIdx].botConfig = {
    token: token || "",
    groupId: groupId || "",
    ownerChatId: ownerChatId || "",
    botLink: botLink || "",
    otpGroupUrl: otpGroupUrl || "",
    status: token ? "active" : "offline",
    btn1Text: btn1Text || "",
    btn1Url: btn1Url || "",
    btn2Text: btn2Text || "",
    btn2Url: btn2Url || "",
    btn3Text: btn3Text || "",
    btn3Url: btn3Url || "",
    whatsappEnabled: !!whatsappEnabled,
    whatsappNewsletter: whatsappNewsletter || "",
    whatsappNumberChannel: whatsappNumberChannel || "",
    whatsappMainChannel: whatsappMainChannel || "",
    whatsappPoweredBy: whatsappPoweredBy || "",
    whatsappPhone: whatsappPhone || "",
    whatsappStatus: whatsappStatus || "offline"
  };

  writeDb(db);

  // Send real Telegram notification upon successful WhatsApp device linkage
  if (token && whatsappEnabled && whatsappStatus === "active") {
    const cleanPhone = String(whatsappPhone || "").replace(/[^0-9]/g, "");
    const textMsg = `🟢 *TEAM ZERO WHATSAPP MODULE CONNECTED*\n\n` +
      `📱 *WhatsApp Phone:* \`+${cleanPhone}\`\n` +
      `🛡️ *Status:* ACTIVE\n` +
      `📢 *Newsletter Link:* ${whatsappNewsletter || "None"}\n\n` +
      `⚡ *Real WhatsApp link generated:* https://wa.me/${cleanPhone}`;
    
    if (ownerChatId) {
      sendCustomTelegramMessageWithKeyboard(token, ownerChatId, textMsg);
    }
    if (groupId) {
      sendCustomTelegramMessageWithKeyboard(token, groupId, textMsg);
    }
  }

  res.json({ success: true, botConfig: db.users[userIdx].botConfig });
});

// ============================================================
//  REAL WHATSAPP ENDPOINTS
// ============================================================
app.post("/api/whatsapp/pair", async (req, res) => {
  const { userId, phoneNumber } = req.body;
  if (!userId || !phoneNumber) {
    return res.status(400).json({ success: false, error: "User ID and phone number are required" });
  }

  try {
    console.log(`Starting real WhatsApp pairing for user ${userId} and phone ${phoneNumber}`);
    const pairingCode = await requestWhatsAppPairingCode(phoneNumber);
    
    // Save to user DB config
    const db = readDb();
    const userIdx = db.users.findIndex((u: any) => u.id === userId);
    if (userIdx !== -1) {
      if (!db.users[userIdx].botConfig) db.users[userIdx].botConfig = {};
      db.users[userIdx].botConfig.whatsappPhone = phoneNumber;
      db.users[userIdx].botConfig.whatsappStatus = "connecting";
      writeDb(db);
    }

    res.json({ success: true, pairingCode });
  } catch (err: any) {
    console.error("Error generating real WhatsApp pairing code:", err);
    res.status(500).json({ success: false, error: err.message || "Failed to generate pairing code" });
  }
});

app.get("/api/whatsapp/status", (req, res) => {
  const { userId } = req.query;
  if (!userId) {
    return res.status(400).json({ success: false, error: "User ID is required" });
  }

  const db = readDb();
  const user = db.users.find((u: any) => u.id === userId);
  const currentStatusInDb = user?.botConfig?.whatsappStatus || "offline";

  // If DB says offline but memory says active (e.g. reconnected on startup), sync them
  let syncedStatus = whatsappStatus;
  if (whatsappStatus === "active" && currentStatusInDb !== "active") {
    if (user && user.botConfig) {
      user.botConfig.whatsappStatus = "active";
      user.botConfig.whatsappEnabled = true;
      writeDb(db);
    }
  }

  res.json({
    success: true,
    status: syncedStatus,
    pairingCode: lastPairingCode,
    phone: user?.botConfig?.whatsappPhone || ""
  });
});

app.post("/api/whatsapp/disconnect", (req, res) => {
  const { userId } = req.body;
  if (!userId) {
    return res.status(400).json({ success: false, error: "User ID is required" });
  }

  try {
    console.log(`Disconnecting WhatsApp for user ${userId}`);
    whatsappStatus = "offline";
    lastPairingCode = "";
    
    if (whatsappSocket) {
      try {
        whatsappSocket.logout();
      } catch {}
      try {
        whatsappSocket.end();
      } catch {}
      whatsappSocket = null;
    }

    const authDir = path.join(process.cwd(), "whatsapp_auth");
    if (fs.existsSync(authDir)) {
      fs.rmSync(authDir, { recursive: true, force: true });
    }

    const db = readDb();
    const userIdx = db.users.findIndex((u: any) => u.id === userId);
    if (userIdx !== -1) {
      if (db.users[userIdx].botConfig) {
        db.users[userIdx].botConfig.whatsappStatus = "offline";
        db.users[userIdx].botConfig.whatsappEnabled = false;
        writeDb(db);
      }
    }

    res.json({ success: true, message: "WhatsApp disconnected and session cleared" });
  } catch (err: any) {
    console.error("Error disconnecting WhatsApp:", err);
    res.status(500).json({ success: false, error: err.message });
  }
});


// 6. Admin Panel password-based authentication (ranausman094)
app.post("/api/admin/login", (req, res) => {
  try {
    const { password } = req.body || {};
    if (password === "ranausman094") {
      return res.json({ success: true, message: "Welcome Admin" });
    }
    res.status(401).json({ success: false, error: "Invalid Admin Password" });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 7. Get All Users (Admin Only) - Shows emails, usernames, raw passwords, bot tokens
app.post("/api/admin/users", (req, res) => {
  try {
    const { password } = req.body || {};
    if (password !== "ranausman094") {
      return res.status(401).json({ success: false, error: "Unauthorized" });
    }

    const db = readDb();
    res.json({ success: true, users: db.users || [] });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 8. Super-Admin Broadcast (Sends message to ALL subscribers of ALL bots in database)
app.post("/api/admin/broadcast", async (req, res) => {
  const { password, message } = req.body;
  if (password !== "ranausman094") {
    return res.status(401).json({ success: false, error: "Unauthorized" });
  }
  if (!message) {
    return res.status(400).json({ success: false, error: "Announcement message is required." });
  }

  const db = readDb();
  let totalBotsUsed = 0;
  let totalMessagesSent = 0;

  for (const user of db.users) {
    const token = user.botConfig?.token;
    const subs = user.subscribers || [];
    if (!token || subs.length === 0) continue;

    totalBotsUsed++;
    for (const sub of subs) {
      const ok = await sendCustomTelegramMessage(
        token,
        sub.chatId,
        `📢 *Global Announcement from Team Zero Admin* 📢\n\n${message}`
      );
      if (ok) totalMessagesSent++;
    }
  }

  res.json({
    success: true,
    totalBots: totalBotsUsed,
    sentCount: totalMessagesSent,
    message: `Broadcast successfully pushed through ${totalBotsUsed} bots, reaching ${totalMessagesSent} subscribers.`,
  });
});

// 9. Simulation manually register number on behalf of bot subscribers
app.post("/api/telegram/subscribers/register", (req, res) => {
  const { userId, chatId, number, country } = req.body;
  if (!userId || !chatId || !number) {
    return res.status(400).json({ success: false, error: "Missing required parameters." });
  }

  registerNumberForSubInDb(userId, Number(chatId), number, country || "Unknown");
  res.json({ success: true, message: "Successfully simulation joined number to subscriber" });
});

// 9b. GET Subscribers (handles query/fallback to flattened list)
app.get("/api/telegram/subscribers", (req, res) => {
  const { userId } = req.query;
  const db = readDb();
  if (userId) {
    const user = db.users.find((u: any) => u.id === userId);
    return res.json({ success: true, subscribers: user ? (user.subscribers || []) : [] });
  }
  const allSubs = db.users.flatMap((u: any) => u.subscribers || []);
  res.json({ success: true, subscribers: allSubs });
});

app.get("/api/subscribers", (req, res) => {
  const { userId } = req.query;
  const db = readDb();
  if (userId) {
    const user = db.users.find((u: any) => u.id === userId);
    return res.json({ success: true, subscribers: user ? (user.subscribers || []) : [] });
  }
  const allSubs = db.users.flatMap((u: any) => u.subscribers || []);
  res.json({ success: true, subscribers: allSubs });
});

// 9d. Super-Admin manual SMS/OTP injection
app.post("/api/admin/sms/send", (req, res) => {
  const { password, number, country, server, message } = req.body;
  if (password !== "ranausman094") {
    return res.status(401).json({ success: false, error: "Unauthorized" });
  }
  if (!number || !server || !message) {
    return res.status(400).json({ success: false, error: "Number, server, and message are required." });
  }

  const db = readDb();
  if (!db.manualSms) db.manualSms = [];

  const otp = {
    timestamp: new Date().toISOString(),
    number: number,
    service: server,
    message: message,
    country: country || "Unknown",
    source: "Manual"
  };

  db.manualSms.unshift(otp);
  if (db.manualSms.length > 100) {
    db.manualSms = db.manualSms.slice(0, 100);
  }
  writeDb(db);
  res.json({ success: true, otp });
});

app.post("/api/admin/sms/clear", (req, res) => {
  const { password } = req.body;
  if (password !== "ranausman094") {
    return res.status(401).json({ success: false, error: "Unauthorized" });
  }
  const db = readDb();
  db.manualSms = [];
  writeDb(db);
  res.json({ success: true });
});

// Helper to broadcast newly added/injected numbers immediately to all registered user bot groups
async function dispatchNewNumbers(newNumbers: any[]) {
  if (!newNumbers || newNumbers.length === 0) return;
  const db = readDb();
  
  for (const user of db.users) {
    const token = user.botConfig?.token;
    const groupId = user.botConfig?.groupId;
    if (!token || !groupId) continue;

    // Build the broadcast message
    let textMsg = `🔥 <b>NEW ACTIVE TEMPORARY LINES DETECTED</b> 🔥\n\n`;
    textMsg += `The following premium virtual lines have been successfully injected and are now active in the pool. Use the bot commands or main menu to claim them instantly!\n\n`;

    newNumbers.forEach((num: any, idx: number) => {
      const country = num.country || "Sudan";
      const flag = getCountryFlag(country);
      const service = num.server || "WhatsApp";
      textMsg += `📍 <b>Line #${idx + 1}:</b> <code>${num.number}</code>\n`;
      textMsg += `   🌍 <b>Country:</b> ${country} ${flag}\n`;
      textMsg += `   🔌 <b>Service:</b> ${service}\n\n`;
    });

    textMsg += `⚡ <b>How to claim:</b> Click <b>📱 Get Number</b> below or type /get_number!`;

    // Send to the Telegram group/channel!
    const inlineKb = getMainKeyboard(user);
    await sendCustomTelegramMessageWithKeyboard(token, groupId, textMsg, inlineKb);
  }
}

// 9c. Super-Admin manual number management
app.post("/api/admin/numbers/add", (req, res) => {
  const { password, country, server, numbersText } = req.body;
  if (password !== "ranausman094") {
    return res.status(401).json({ success: false, error: "Unauthorized" });
  }
  if (!country || !server || !numbersText) {
    return res.status(400).json({ success: false, error: "Country, server, and numbers list are required." });
  }

  const lines = numbersText.split(/[\n,]+/).map((s: string) => s.trim()).filter(Boolean);
  const db = readDb();
  if (!db.manualNumbers) db.manualNumbers = [];

  let addedCount = 0;
  const now = new Date().toISOString();
  const newlyAddedNumbers: any[] = [];

  for (const num of lines) {
    const cleanNum = num.replace(/[\s\-\+]/g, "");
    if (!cleanNum) continue;

    // Avoid duplicates in active manual numbers
    const exists = db.manualNumbers.some((n: any) => n.number.replace(/[\s\-\+]/g, "") === cleanNum);
    if (!exists) {
      const newNumObj = {
        id: "num_" + Date.now() + "_" + Math.random().toString(36).substring(2, 7),
        number: num,
        country: country,
        server: server,
        addedAt: now
      };
      db.manualNumbers.push(newNumObj);
      newlyAddedNumbers.push(newNumObj);
      addedCount++;
    }
  }

  writeDb(db);

  if (newlyAddedNumbers.length > 0) {
    dispatchNewNumbers(newlyAddedNumbers).catch(err => {
      console.error("Error broadcasting new numbers to bot groups:", err);
    });
  }

  res.json({ success: true, addedCount });
});

app.post("/api/admin/numbers", (req, res) => {
  try {
    const { password } = req.body || {};
    if (password !== "ranausman094") {
      return res.status(401).json({ success: false, error: "Unauthorized" });
    }
    const db = readDb();
    res.json({ success: true, numbers: db.manualNumbers || [] });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post("/api/admin/numbers/delete", (req, res) => {
  try {
    const { password, numberId } = req.body || {};
    if (password !== "ranausman094") {
      return res.status(401).json({ success: false, error: "Unauthorized" });
    }
    const db = readDb();
    if (db.manualNumbers) {
      db.manualNumbers = db.manualNumbers.filter((n: any) => n.id !== numberId);
    }
    writeDb(db);
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 10. Server-side Gemini SMS Security Guard Analyzer
app.post("/api/gemini/analyze", async (req, res) => {
  try {
    const { message } = req.body || {};
    if (!message) {
      return res.status(400).json({ success: false, error: "Message content is required" });
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return res.status(400).json({
        success: false,
        error: "GEMINI_API_KEY is not configured.",
      });
    }

    const ai = new GoogleGenAI({
      apiKey: apiKey,
      httpOptions: { headers: { "User-Agent": "aistudio-build" } },
    });

    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: `Analyze this SMS message:\n"${message}"`,
      config: {
        systemInstruction:
          "You are an expert security and SMS analyzer for Team Zero. Analyze the SMS. Determine its intent (e.g., login OTP, subscription confirmation, scam/phishing threat, general notification). Identify the target service/brand and extract the numeric/alphanumeric OTP code or verification link. Return the response in clean, bulleted, bold, concise markdown.",
      },
    });

    res.json({ success: true, analysis: response.text });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Catch-all for undefined API routes to prevent falling through to SPA HTML
app.all("/api/*", (req, res) => {
  res.status(404).json({
    success: false,
    error: `API endpoint ${req.method} ${req.path} not found or unsupported method.`
  });
});

// Express Static asset fallbacks
const distPath = path.join(process.cwd(), "dist");

if (process.env.NODE_ENV !== "production") {
  createViteServer({
    server: { middlewareMode: true },
    appType: "spa",
  }).then((vite) => {
    app.use(vite.middlewares);
    app.listen(PORT, "0.0.0.0", () => {
      console.log(`Server running on port ${PORT}`);
    });
  });
} else {
  if (!process.env.VERCEL) {
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
    app.listen(PORT, "0.0.0.0", () => {
      console.log(`Server running on port ${PORT}`);
    });
  }
}

export default app;
