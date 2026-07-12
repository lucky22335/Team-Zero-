const express = require("express");
const cors = require("cors");
const path = require("path");
const fs = require("fs");
const pino = require("pino");
const {
  default: makeWASocket,
  useMultiFileAuthState,
  DisconnectReason,
  delay
} = require("@whiskeysockets/baileys");

// Initialize Express
const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 4000;
const SESSION_DIR = path.join(__dirname, "wa_auth_session");
const CONFIG_FILE = path.join(__dirname, "wa_config.json");

// Bot global variables
let sock = null;
let botStatus = "disconnected"; // disconnected, connecting, connected
let botUser = null; // Connected user details
let lastError = null;

// Admin setup conversation state tracker
let adminSetupState = {
  active: false,
  step: 0,
  adminJid: null
};

// Default WhatsApp configuration values
const defaultConfig = {
  adminNumber: "", // If empty, the first person sending !setup becomes the Admin
  newsletterId: "", // Step 1: newsletter ID (e.g. 120363426165980012@newsletter)
  numbersChannelLink: "https://whatsapp.com/channel/0029Vb8DpvPEFeXkJN8ax33b", // Step 2: Numbers channel
  mainChannelLink: "https://whatsapp.com/channel/0029Vb7CHRO96H4QS1ynKI1J", // Step 3: Main channel
  brandName: "Team Zero™ 🇵🇰" // Step 4: Brand name
};

let botConfig = { ...defaultConfig };

// Load config from file
function loadConfig() {
  try {
    if (fs.existsSync(CONFIG_FILE)) {
      const data = fs.readFileSync(CONFIG_FILE, "utf8");
      botConfig = { ...defaultConfig, ...JSON.parse(data) };
      console.log("[Config] Loaded successfully:", botConfig);
    } else {
      saveConfig();
      console.log("[Config] Created default config file.");
    }
  } catch (err) {
    console.error("[Config] Error loading config:", err);
  }
}

// Save config to file
function saveConfig() {
  try {
    fs.writeFileSync(CONFIG_FILE, JSON.stringify(botConfig, null, 2), "utf8");
    console.log("[Config] Saved successfully:", botConfig);
  } catch (err) {
    console.error("[Config] Error saving config:", err);
  }
}

loadConfig();

// Ensure session directory exists helper
function clearSessionDir() {
  try {
    if (fs.existsSync(SESSION_DIR)) {
      fs.rmSync(SESSION_DIR, { recursive: true, force: true });
      console.log("[Bot State] Auth session directory cleared successfully.");
    }
  } catch (err) {
    console.error("[Bot State] Error clearing session directory:", err);
  }
}

// Country flags helper mapping country codes
function getCountryFlag(countryCode) {
  const code = String(countryCode || "").replace(/[^0-9]/g, "");
  const flagMap = {
    "967": "🇾🇪", // Yemen
    "92": "🇵🇰",  // Pakistan
    "91": "🇮🇳",  // India
    "1": "🇺🇸",   // USA
    "44": "🇬🇧",  // UK
    "966": "🇸🇦", // Saudi Arabia
    "971": "🇦🇪", // UAE
    "964": "🇮🇶", // Iraq
    "20": "🇪🇬",  // Egypt
    "212": "🇲🇦", // Morocco
    "90": "🇹🇷",  // Turkey
    "880": "🇧🇩", // Bangladesh
    "62": "🇮🇩"   // Indonesia
  };
  return flagMap[code] || "🌐";
}

// Phone number masking helper (e.g. 967773663808 -> 9677•••3808)
function maskPhoneNumber(num, countryCode = "") {
  const cleanNum = String(num || "").replace(/[^0-9]/g, "");
  if (cleanNum.length < 6) return cleanNum;

  // Extract country prefix if it matches
  let prefix = countryCode ? String(countryCode).replace(/[^0-9]/g, "") : "";
  if (prefix && cleanNum.startsWith(prefix)) {
    const rest = cleanNum.slice(prefix.length);
    if (rest.length > 5) {
      return `${prefix}${rest[0]}•••${rest.slice(-4)}`;
    }
  }

  // General fallback mask
  return `${cleanNum.slice(0, 4)}•••${cleanNum.slice(-4)}`;
}

// Dynamic welcome template
function getWelcomeMessage() {
  return `👋 *Assalamu Alaikum / Welcome to Team Zero OTP Bot!*

Linked Successfully! ⚡ This is your dedicated WhatsApp OTP Forwarding Assistant.

📢 *Join Our Exclusive WhatsApp Channels for Fresh Numbers & Free Logs:*
1️⃣ *Main Channel:* ${botConfig.mainChannelLink}
2️⃣ *Numbers Channel:* ${botConfig.numbersChannelLink}

🚀 _All OTPs are forwarded instantaneously with maximum reliability._

> Powered by ${botConfig.brandName}`;
}

// Strict theme OTP Formatting Engine
function formatOtpMessage(data) {
  const {
    senderNumber = "967773663808",
    originalSmsText = "Default verification code is 123456",
    msgIndex = "1",
    serviceName = "Google",
    otpCode = "123456",
    countryCode = "967",
    countryName = "Yemen"
  } = data;

  const flag = getCountryFlag(countryCode);
  const maskedNumber = maskPhoneNumber(senderNumber, countryCode);
  
  // Format local Pakistani Time for aesthetics (Asia/Karachi)
  let timestamp = "";
  try {
    timestamp = new Date().toLocaleString("en-US", {
      timeZone: "Asia/Karachi",
      hour12: true,
      year: "numeric",
      month: "short",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit"
    }) + " (PKT)";
  } catch (e) {
    timestamp = new Date().toISOString();
  }

  return `✨ *${flag} | ${senderNumber} Message ${msgIndex}* ⚡

> *Time:* ${timestamp}
> *Country:* ${flag} ${countryName}
   *Number:* *${maskedNumber}*
> *Service:* ${serviceName}
   *OTP:* *${otpCode}*

> *Join For Numbers:*
> 1 ${botConfig.mainChannelLink}
> 2 ${botConfig.numbersChannelLink}

*Full Message:*
${originalSmsText}

> Developed by ${botConfig.brandName}`;
}

// Main Baileys Connection Setup
async function initWhatsApp(phoneNumberToPair = null) {
  try {
    botStatus = "connecting";
    lastError = null;

    // Load or create authentication state
    const { state, saveCreds } = await useMultiFileAuthState(SESSION_DIR);

    // Initialize socket connection
    sock = makeWASocket({
      auth: state,
      printQRInTerminal: false, // Disable terminal QR, using web/pairing flow
      logger: pino({ level: "silent" }),
      browser: ["Chrome (Linux)", "Baileys OTP", "10.0"] // Required for pairing code accuracy
    });

    // Save credentials when updated
    sock.ev.on("creds.update", saveCreds);

    // Listen to connection updates
    sock.ev.on("connection.update", async (update) => {
      const { connection, lastDisconnect } = update;

      if (connection === "connecting") {
        botStatus = "connecting";
        console.log("[WhatsApp Connection] Connecting to servers...");
      }

      if (connection === "open") {
        botStatus = "connected";
        botUser = sock.user;
        console.log("[WhatsApp Connection] Successfully Connected as:", sock.user.id);
      }

      if (connection === "close") {
        botUser = null;
        const statusCode = lastDisconnect?.error?.output?.statusCode;
        const shouldReconnect = statusCode !== DisconnectReason.loggedOut;
        
        console.log(`[WhatsApp Connection] Closed. Status: ${statusCode}. Reconnecting: ${shouldReconnect}`);
        
        if (shouldReconnect) {
          botStatus = "connecting";
          // Delay to prevent loops
          setTimeout(() => initWhatsApp(), 5000);
        } else {
          botStatus = "disconnected";
          clearSessionDir();
        }
      }
    });

    // Automatically listen to incoming messages for Admin Setup Wizard & Welcome message
    sock.ev.on("messages.upsert", async (m) => {
      try {
        const { messages, type } = m;
        if (type !== "notify") return;

        for (const msg of messages) {
          // Ignore if message from self or has no key/message
          if (msg.key.fromMe || !msg.message) continue;

          const fromJid = msg.key.remoteJid;
          const senderNumber = fromJid.split("@")[0];
          
          // Only auto-respond to direct personal messages (not groups/newsletters)
          if (fromJid.endsWith("@s.whatsapp.net")) {
            const body = (msg.message.conversation || 
                          msg.message.extendedTextMessage?.text || 
                          "").trim();
                          
            if (!body) continue;

            console.log(`[Bot Message] Received message from ${senderNumber}: "${body.slice(0, 50)}"`);

            // --- ADMIN CONFIGURATION WIZARD STATE MACHINE ---
            const isAdmin = botConfig.adminNumber === "" || botConfig.adminNumber === senderNumber;

            if (isAdmin && (body.toLowerCase() === "!setup" || body.toLowerCase() === "/setup")) {
              // Initiate Setup Wizard
              if (botConfig.adminNumber === "") {
                botConfig.adminNumber = senderNumber;
                saveConfig();
              }
              adminSetupState = {
                active: true,
                step: 1,
                adminJid: fromJid
              };
              await sock.sendMessage(fromJid, {
                text: `✨ *Team Zero Setup Wizard - Step 1/4* ✨\n\nWelcome Admin! Please reply with your *Newsletter ID/JID* where OTP messages should be auto-forwarded.\n\n_Example:_\n\`120363426165980012@newsletter\`\n\n(Type *!cancel* anytime to abort)`
              });
              continue;
            }

            // Handle cancellation
            if (adminSetupState.active && fromJid === adminSetupState.adminJid && body.toLowerCase() === "!cancel") {
              adminSetupState = { active: false, step: 0, adminJid: null };
              await sock.sendMessage(fromJid, { text: "❌ *Setup Wizard Canceled.* Changes were not saved." });
              continue;
            }

            // Handle Wizard Steps
            if (adminSetupState.active && fromJid === adminSetupState.adminJid) {
              const currentStep = adminSetupState.step;
              
              if (currentStep === 1) {
                // Save Newsletter JID
                botConfig.newsletterId = body;
                adminSetupState.step = 2;
                await sock.sendMessage(fromJid, {
                  text: `✅ *Step 1 Saved!* (Newsletter ID: \`${body}\`)\n\n✨ *Step 2/4* ✨\n\nPlease reply with the *Numbers Channel Link*:\n\n_Example:_\n\`https://whatsapp.com/channel/0029Vb8DpvPEFeXkJN8ax33b\``
                });
              } else if (currentStep === 2) {
                // Save Numbers Channel Link
                botConfig.numbersChannelLink = body;
                adminSetupState.step = 3;
                await sock.sendMessage(fromJid, {
                  text: `✅ *Step 2 Saved!*\n\n✨ *Step 3/4* ✨\n\nPlease reply with the *Main Channel Link*:\n\n_Example:_\n\`https://whatsapp.com/channel/0029Vb7CHRO96H4QS1ynKI1J\``
                });
              } else if (currentStep === 3) {
                // Save Main Channel Link
                botConfig.mainChannelLink = body;
                adminSetupState.step = 4;
                await sock.sendMessage(fromJid, {
                  text: `✅ *Step 3 Saved!*\n\n✨ *Step 4/4* ✨\n\nPlease reply with your *Brand Name*:\n\n_Example:_\n\`Team Zero™ 🇵🇰\``
                });
              } else if (currentStep === 4) {
                // Save Brand Name & Finish
                botConfig.brandName = body;
                adminSetupState.active = false;
                adminSetupState.step = 0;
                adminSetupState.adminJid = null;
                
                saveConfig(); // Save to wa_config.json

                await sock.sendMessage(fromJid, {
                  text: `🎉 *Setup Completed Successfully!* 🎉\n\nHere is your active setup configuration:\n\n📢 *Newsletter JID:* \`${botConfig.newsletterId}\`\n🔗 *Numbers Channel:* ${botConfig.numbersChannelLink}\n🔗 *Main Channel:* ${botConfig.mainChannelLink}\n🏷️ *Brand Name:* ${botConfig.brandName}\n👤 *Admin Number:* +${botConfig.adminNumber}\n\nAll configurations have been successfully saved and applied to the OTP forwarding engine!`
                });
              }
              continue;
            }

            // General Admin Status request
            if (isAdmin && (body.toLowerCase() === "!status" || body.toLowerCase() === "!config")) {
              await sock.sendMessage(fromJid, {
                text: `📊 *Team Zero Bot Config Status*:\n\n👤 *Admin:* +${botConfig.adminNumber || "Not Set"}\n📢 *Newsletter JID:* \`${botConfig.newsletterId || "Not Configured"}\`\n🔗 *Numbers Channel:* ${botConfig.numbersChannelLink}\n🔗 *Main Channel:* ${botConfig.mainChannelLink}\n🏷️ *Brand Name:* ${botConfig.brandName}\n⚡ *Bot Status:* ${botStatus}\n\n_Send !setup to launch the 4-step wizard._`
              });
              continue;
            }

            // Command helper
            if (isAdmin && (body.toLowerCase() === "!help" || body.toLowerCase() === "/help")) {
              await sock.sendMessage(fromJid, {
                text: `🛠️ *Team Zero Admin Commands*:\n\n• \`!setup\` - Launch 4-step Admin setup wizard\n• \`!status\` - View current bot settings & JIDs\n• \`!cancel\` - Cancel the active setup setup wizard`
              });
              continue;
            }

            // Send welcome/promotional message for regular users
            await sock.sendMessage(fromJid, {
              text: getWelcomeMessage()
            });
            console.log(`[Bot Message] Sent auto-welcome to ${fromJid}`);
          }
        }
      } catch (err) {
        console.error("[Bot message listener error]:", err);
      }
    });

    // If pairing phone number is passed, request code immediately
    if (phoneNumberToPair && !sock.authState.creds.registered) {
      await delay(4000); // Wait for socket handshake to establish fully
      const cleanNumber = phoneNumberToPair.replace(/[^0-9]/g, "");
      console.log(`[WhatsApp Pairing] Requesting pairing code for: ${cleanNumber}`);
      const pairingCode = await sock.requestPairingCode(cleanNumber);
      return pairingCode;
    }

    return null;
  } catch (err) {
    console.error("[WhatsApp Init Error]:", err);
    botStatus = "disconnected";
    lastError = err.message;
    throw err;
  }
}

// Auto start on boot if session exists
if (fs.existsSync(SESSION_DIR)) {
  console.log("[Bot Boot] Existing session detected, connecting automatically...");
  initWhatsApp().catch(() => {});
}

// API: Get status
app.get("/api/wa/status", (req, res) => {
  res.json({
    success: true,
    status: botStatus,
    user: botUser,
    error: lastError,
    sessionExists: fs.existsSync(SESSION_DIR),
    config: botConfig
  });
});

// API: Request pairing code
app.post("/api/wa/pair", async (req, res) => {
  const { phoneNumber } = req.body;
  if (!phoneNumber) {
    return res.status(400).json({ success: false, error: "Phone number with country code is required." });
  }

  try {
    if (botStatus === "connected") {
      return res.status(400).json({ success: false, error: "Bot is already connected. Please logout first." });
    }

    // Stop current socket if any
    if (sock) {
      try { sock.end(); } catch (e) {}
    }

    // Fresh session preparation
    clearSessionDir();

    // Call init and get pairing code
    const pairingCode = await initWhatsApp(phoneNumber);
    
    if (pairingCode) {
      res.json({
        success: true,
        pairingCode: pairingCode,
        message: "Pairing code generated successfully. Use this on your phone's WhatsApp -> Link a Device -> Link with phone number."
      });
    } else {
      res.status(500).json({
        success: false,
        error: "Failed to generate pairing code. Credentials might already be registered."
      });
    }
  } catch (err) {
    res.status(500).json({ success: false, error: err.message || "Connection failed" });
  }
});

// API: Get current config
app.get("/api/wa/config", (req, res) => {
  res.json({ success: true, config: botConfig });
});

// API: Update config directly via JSON/Web panel
app.post("/api/wa/config", (req, res) => {
  const { adminNumber, newsletterId, numbersChannelLink, mainChannelLink, brandName } = req.body;
  
  if (adminNumber !== undefined) botConfig.adminNumber = adminNumber.replace(/[^0-9]/g, "");
  if (newsletterId !== undefined) botConfig.newsletterId = newsletterId;
  if (numbersChannelLink !== undefined) botConfig.numbersChannelLink = numbersChannelLink;
  if (mainChannelLink !== undefined) botConfig.mainChannelLink = mainChannelLink;
  if (brandName !== undefined) botConfig.brandName = brandName;
  
  saveConfig();
  res.json({ success: true, config: botConfig, message: "Configuration updated successfully." });
});

// API: Send formatted OTP message & forward to WhatsApp Newsletter
app.post("/api/wa/send-otp", async (req, res) => {
  if (botStatus !== "connected" || !sock) {
    return res.status(400).json({ success: false, error: "WhatsApp Bot is not connected/paired yet." });
  }

  const {
    targetJid, // Optional direct recipient JID
    senderNumber,
    originalSmsText,
    msgIndex,
    serviceName,
    otpCode,
    countryCode,
    countryName
  } = req.body;

  // By default, forward to the configured Newsletter ID from step 1
  const finalJid = targetJid || botConfig.newsletterId;

  if (!finalJid) {
    return res.status(400).json({ success: false, error: "Recipient JID is required. Please set up the Newsletter ID via the !setup command first." });
  }

  try {
    // Format payload using custom OTP Engine loaded with dynamic config
    const formattedMessage = formatOtpMessage({
      senderNumber,
      originalSmsText,
      msgIndex,
      serviceName,
      otpCode,
      countryCode,
      countryName
    });

    // Send formatted message to targeted Newsletter/Group/JID
    console.log(`[WA Forwarder] Forwarding OTP to JID: ${finalJid}`);
    const sendResult = await sock.sendMessage(finalJid, { text: formattedMessage });

    res.json({
      success: true,
      messageId: sendResult.key.id,
      formattedText: formattedMessage,
      status: "Sent and forwarded successfully"
    });
  } catch (err) {
    console.error("[WA Forwarder Error]:", err);
    res.status(500).json({ success: false, error: `Failed to forward OTP over WhatsApp: ${err.message}` });
  }
});

// API: Logout
app.post("/api/wa/logout", async (req, res) => {
  try {
    if (sock) {
      try { sock.logout(); } catch (e) {}
      try { sock.end(); } catch (e) {}
    }
    clearSessionDir();
    botStatus = "disconnected";
    botUser = null;
    res.json({ success: true, message: "Logged out successfully and session data cleared." });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Serve Control Dashboard & Configuration UI
app.get("/", (req, res) => {
  res.send(`
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>WhatsApp OTP Bot Control - Team Zero</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <link href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;600;700&family=JetBrains+Mono:wght@400;500;700&display=swap" rel="stylesheet">
  <style>
    body {
      font-family: 'Space Grotesk', sans-serif;
    }
    .font-mono {
      font-family: 'JetBrains Mono', monospace;
    }
    .glow-green {
      box-shadow: 0 0 15px rgba(0, 255, 153, 0.2);
    }
  </style>
</head>
<body class="bg-[#0b0c10] text-gray-200 min-h-screen py-8 px-4 flex flex-col justify-between">
  
  <!-- Header / Navigation Bar -->
  <header class="max-w-4xl w-full mx-auto flex justify-between items-center bg-[#10121a] border border-gray-800 rounded-2xl p-5 shadow-2xl mb-6">
    <div class="flex items-center gap-3">
      <div class="w-10 h-10 rounded-xl bg-gradient-to-tr from-[#00ff99] to-[#008b45] flex items-center justify-center font-bold text-black text-xl shadow-lg shadow-[#00ff99]/20">
        Z
      </div>
      <div>
        <h1 class="text-lg font-bold text-white tracking-wide">TEAM ZERO</h1>
        <p class="text-[10px] text-gray-400 uppercase tracking-widest font-mono">WhatsApp OTP Bot Engine</p>
      </div>
    </div>
    
    <div id="statusBadge" class="flex items-center gap-2 bg-[#00ff99]/10 text-[#00ff99] border border-[#00ff99]/20 font-bold px-3 py-1 rounded-xl text-xs font-mono">
      <span class="w-2.5 h-2.5 rounded-full bg-[#00ff99] animate-pulse"></span>
      <span>Checking Bot Status...</span>
    </div>
  </header>

  <!-- Main Content Dashboard -->
  <main class="max-w-4xl w-full mx-auto grid grid-cols-1 md:grid-cols-2 gap-6 flex-grow">
    
    <!-- Connection & Pairing Panel -->
    <section class="bg-[#10121a] border border-gray-800 rounded-2xl p-6 shadow-2xl space-y-5">
      <div class="border-b border-gray-800 pb-3">
        <h2 class="text-sm font-bold text-white uppercase tracking-wider">🔗 Device Pairing & Link</h2>
        <p class="text-xs text-gray-400 mt-1">Generate a pairing code instantly without QR scanner to link WhatsApp.</p>
      </div>

      <!-- Pairing Form -->
      <div class="space-y-4">
        <div>
          <label class="block text-[11px] text-gray-400 uppercase font-semibold mb-1.5 font-mono">📱 WhatsApp Number (With Country Code):</label>
          <input 
            type="text" 
            id="phoneNumberInput" 
            placeholder="e.g. 967773663808" 
            class="w-full bg-black border border-gray-800 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-[#00ff99] transition font-mono text-white tracking-wider"
          >
        </div>

        <div class="flex gap-3">
          <button 
            onclick="requestPairingCode()" 
            id="pairBtn"
            class="flex-1 bg-gradient-to-r from-[#00ff99] to-[#008b45] hover:opacity-95 text-black font-bold text-sm py-3 px-4 rounded-xl shadow-lg shadow-[#00ff99]/10 active:scale-[0.98] transition flex items-center justify-center gap-2"
          >
            Get Pairing Code
          </button>
          
          <button 
            onclick="logoutBot()" 
            id="logoutBtn"
            class="bg-red-950/40 border border-red-900/40 text-red-400 hover:bg-red-950/80 font-bold text-sm py-3 px-4 rounded-xl transition"
          >
            Logout
          </button>
        </div>
      </div>

      <!-- Pairing Code Output Container -->
      <div id="pairingContainer" class="hidden bg-[#07080c] border border-dashed border-gray-800 rounded-xl p-5 text-center space-y-4 animate-fade-in">
        <p class="text-xs text-gray-400 font-mono">YOUR WHATSAPP PAIRING CODE:</p>
        <div id="pairingCodeOutput" class="text-3xl font-mono font-bold tracking-[8px] text-[#00ff99] py-2">
          A1B2-C3D4
        </div>
        <button onclick="copyPairingCode()" class="text-[11px] text-[#00ff99] hover:underline flex items-center justify-center gap-1 mx-auto font-mono">
          Copy Code
        </button>
        
        <div class="text-left text-xs text-gray-400 space-y-2 mt-4 border-t border-gray-800/80 pt-4">
          <p class="font-bold text-white text-[11px] uppercase tracking-wider">Steps to Link Device:</p>
          <p>1. Open WhatsApp on your target phone.</p>
          <p>2. Tap <strong>Linked Devices</strong> -> <strong>Link a Device</strong>.</p>
          <p>3. Choose <strong>Link with phone number instead</strong> at the bottom.</p>
          <p>4. Enter the pairing code shown above to authorize.</p>
        </div>
      </div>
    </section>

    <!-- Configuration Panel -->
    <section class="bg-[#10121a] border border-gray-800 rounded-2xl p-6 shadow-2xl space-y-5">
      <div class="border-b border-gray-800 pb-3">
        <h2 class="text-sm font-bold text-white uppercase tracking-wider">⚙️ Config Wizard Settings</h2>
        <p class="text-xs text-gray-400 mt-1">Configure parameters or let the WhatsApp Admin trigger '!setup'.</p>
      </div>

      <div class="space-y-4 text-xs">
        <div>
          <label class="block text-[10px] text-gray-400 uppercase mb-1 font-mono">👤 Admin Number (e.g., 923123456789)</label>
          <input id="cfgAdmin" type="text" class="w-full bg-black border border-gray-800 rounded-lg px-3 py-2 font-mono text-white">
        </div>
        <div>
          <label class="block text-[10px] text-gray-400 uppercase mb-1 font-mono">📢 Newsletter JID (Step 1)</label>
          <input id="cfgNewsletter" type="text" class="w-full bg-black border border-gray-800 rounded-lg px-3 py-2 font-mono text-white">
        </div>
        <div>
          <label class="block text-[10px] text-gray-400 uppercase mb-1 font-mono">🔗 Numbers Channel Link (Step 2)</label>
          <input id="cfgNumbersChan" type="text" class="w-full bg-black border border-gray-800 rounded-lg px-3 py-2 font-mono text-white">
        </div>
        <div>
          <label class="block text-[10px] text-gray-400 uppercase mb-1 font-mono">🔗 Main Channel Link (Step 3)</label>
          <input id="cfgMainChan" type="text" class="w-full bg-black border border-gray-800 rounded-lg px-3 py-2 font-mono text-white">
        </div>
        <div>
          <label class="block text-[10px] text-gray-400 uppercase mb-1 font-mono">🏷️ Brand Name (Step 4)</label>
          <input id="cfgBrand" type="text" class="w-full bg-black border border-gray-800 rounded-lg px-3 py-2 text-white">
        </div>

        <button 
          onclick="updateConfig()" 
          class="w-full bg-[#00ff99]/10 border border-[#00ff99]/20 hover:bg-[#00ff99]/20 text-[#00ff99] font-bold py-2 px-4 rounded-xl transition"
        >
          Save Configuration
        </button>
      </div>
    </section>

  </main>

  <!-- Footer Info -->
  <footer class="max-w-4xl w-full mx-auto text-center mt-6 pt-5 border-t border-gray-800/60">
    <p class="text-xs text-gray-500">
      Developed by <strong>Team Zero™ 🇵🇰</strong>. All rights reserved.
    </p>
    <div class="flex justify-center gap-4 text-[10px] text-gray-400 mt-2 font-mono">
      <span>Express Port: ${PORT}</span>
      <span>•</span>
      <span>Baileys Engine: v7.0.0-rc13</span>
      <span>•</span>
      <span>Server Time: <span id="serverTime"></span></span>
    </div>
  </footer>

  <!-- Script logic for controlling app -->
  <script>
    const API_BASE = "";

    // Poll Bot Status on Loop
    async function updateStatus() {
      try {
        const res = await fetch(\`\${API_BASE}/api/wa/status\`);
        const data = await res.json();
        
        const badge = document.getElementById("statusBadge");
        const pairBtn = document.getElementById("pairBtn");
        
        if (data.status === "connected") {
          badge.className = "flex items-center gap-2 bg-[#00ff99]/10 text-[#00ff99] border border-[#00ff99]/20 font-bold px-3 py-1 rounded-xl text-xs font-mono glow-green";
          badge.innerHTML = \`<span class="w-2 h-2 rounded-full bg-[#00ff99] animate-ping"></span> Connected (\${data.user.id.split(':')[0]})\`;
          pairBtn.disabled = true;
          pairBtn.className = "flex-1 bg-gray-800 text-gray-500 font-bold text-sm py-3 px-4 rounded-xl cursor-not-allowed transition flex items-center justify-center gap-2";
        } else if (data.status === "connecting") {
          badge.className = "flex items-center gap-2 bg-yellow-500/10 text-yellow-500 border border-yellow-500/20 font-bold px-3 py-1 rounded-xl text-xs font-mono";
          badge.innerHTML = \`<span class="w-2 h-2 rounded-full bg-yellow-500 animate-pulse"></span> Connecting...\`;
          pairBtn.disabled = true;
        } else {
          badge.className = "flex items-center gap-2 bg-red-500/10 text-red-400 border border-red-500/20 font-bold px-3 py-1 rounded-xl text-xs font-mono";
          badge.innerHTML = \`<span class="w-2 h-2 rounded-full bg-red-500"></span> Disconnected\`;
          pairBtn.disabled = false;
          pairBtn.className = "flex-1 bg-gradient-to-r from-[#00ff99] to-[#008b45] hover:opacity-95 text-black font-bold text-sm py-3 px-4 rounded-xl shadow-lg active:scale-[0.98] transition flex items-center justify-center gap-2";
        }

        // Fill inputs if not focused
        if (data.config) {
          const inputs = {
            cfgAdmin: data.config.adminNumber,
            cfgNewsletter: data.config.newsletterId,
            cfgNumbersChan: data.config.numbersChannelLink,
            cfgMainChan: data.config.mainChannelLink,
            cfgBrand: data.config.brandName
          };
          for (let [id, val] of Object.entries(inputs)) {
            const el = document.getElementById(id);
            if (el && document.activeElement !== el) {
              el.value = val || "";
            }
          }
        }
      } catch (err) {
        console.error("Status Poll Error:", err);
      }
    }

    setInterval(updateStatus, 3000);
    updateStatus();

    // Trigger Pairing Code
    async function requestPairingCode() {
      const phoneNumber = document.getElementById("phoneNumberInput").value.trim();
      if (!phoneNumber) {
        alert("Please enter your phone number with country code first.");
        return;
      }

      const pairBtn = document.getElementById("pairBtn");
      pairBtn.innerHTML = "Generating Code...";
      pairBtn.disabled = true;

      try {
        const res = await fetch(\`\${API_BASE}/api/wa/pair\`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ phoneNumber })
        });
        const data = await res.json();
        
        if (data.success) {
          document.getElementById("pairingContainer").classList.remove("hidden");
          document.getElementById("pairingCodeOutput").innerText = data.pairingCode;
          updateStatus();
        } else {
          alert("Error: " + data.error);
        }
      } catch (err) {
        alert("Network Error generating pairing code.");
      } finally {
        pairBtn.innerHTML = "Get Pairing Code";
        pairBtn.disabled = false;
      }
    }

    // Update Config
    async function updateConfig() {
      const payload = {
        adminNumber: document.getElementById("cfgAdmin").value,
        newsletterId: document.getElementById("cfgNewsletter").value,
        numbersChannelLink: document.getElementById("cfgNumbersChan").value,
        mainChannelLink: document.getElementById("cfgMainChan").value,
        brandName: document.getElementById("cfgBrand").value
      };

      try {
        const res = await fetch(\`\${API_BASE}/api/wa/config\`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload)
        });
        const data = await res.json();
        if (data.success) {
          alert("✅ Settings saved successfully!");
          updateStatus();
        } else {
          alert("❌ Failed to save config: " + data.error);
        }
      } catch (err) {
        alert("Network Error trying to save configuration.");
      }
    }

    // Trigger Bot Logout
    async function logoutBot() {
      if (!confirm("Are you sure you want to disconnect WhatsApp and log out?")) return;
      
      try {
        const res = await fetch(\`\${API_BASE}/api/wa/logout\`, { method: "POST" });
        const data = await res.json();
        if (data.success) {
          document.getElementById("pairingContainer").classList.add("hidden");
          document.getElementById("phoneNumberInput").value = "";
          updateStatus();
          alert("Logged out and session cleared.");
        }
      } catch (err) {
        alert("Logout failed.");
      }
    }

    // Copy to clipboard helper
    function copyPairingCode() {
      const code = document.getElementById("pairingCodeOutput").innerText;
      navigator.clipboard.writeText(code);
      alert("Pairing code copied to clipboard: " + code);
    }

    // Update Footer Time
    function updateClock() {
      const options = { timeZone: "Asia/Karachi", hour12: true, hour: '2-digit', minute: '2-digit', second: '2-digit' };
      document.getElementById("serverTime").innerText = new Date().toLocaleTimeString("en-US", options) + " PKT";
    }
    setInterval(updateClock, 1000);
    updateClock();
  </script>
</body>
</html>
  `);
});

// Run Bot Server
app.listen(PORT, "0.0.0.0", () => {
  console.log(`====================================================`);
  console.log(`🚀 Team Zero WhatsApp OTP Bot Dashboard listening!`);
  console.log(`🌐 Control Panel: http://localhost:${PORT}`);
  console.log(`🛰️ API Server: http://localhost:${PORT}`);
  console.log(`====================================================`);
});
