# ⚡ Team Zero WhatsApp OTP Forwarding Bot

A production-ready, fully-featured, and robust WhatsApp OTP Bot powered by `@whiskeysockets/baileys`. This bot allows you to link your WhatsApp account via phone number/pairing code on-demand, formats all incoming SMS notifications beautifully with an elegant Yemen high-contrast theme, and includes an interactive web dashboard control panel.

---

## 🚀 Features
1. **Device Pairing System**: Enter your phone number via the dashboard or API endpoint to generate a secure, official pairing code instantly.
2. **Interactive Control Panel Dashboard**: Manage the bot state, monitor connections, and test-send formatted OTPs through a beautiful slate-dark, fully-responsive dashboard UI.
3. **Automated Welcome & Promotion**: Automatically welcomes incoming personal message interactions with promotional invitations, group/bot instructions, and configured newsletter channel links.
4. **Strict-Theme Formatting Engine**: Converts basic SMS logs into high-contrast formatted templates complete with country flags, timestamps, and masked numbers.

---

## 🗄️ How Session State is Handled (Bandoobast)

Session state persistence is critical to prevent the bot from disconnecting or logging out whenever your server (such as Heroku or Vercel) restarts. 

This bot handles session states with the following robust design:

### 1. Multi-File Authentication State (`useMultiFileAuthState`)
We use Baileys' native `useMultiFileAuthState` helper, pointing to a local directory called `./wa_auth_session`. 
* **What it does**: This saves your complete linked session (encryption keys, noise credentials, pairing logs) as separate lightweight JSON files.
* **Why it's reliable**: When the bot boots, it automatically checks if `./wa_auth_session` exists. If it does, it will reconstruct the connection instantly without needing a new pairing code or QR scan.

### 2. Session Permanence Across Deployments (GitHub & Heroku Integration)
On cloud platforms like Heroku, the filesystem is ephemeral (it resets whenever the dyno goes to sleep or restarts). To protect your session state from being deleted:
* **Recommendation**: Use a persistent store or keep a backup of the `./wa_auth_session` folder.
* **Git Version Control (Optional)**: If you are running on a private repository, you can commit your authenticated `./wa_auth_session` folder so it is built directly into your deployed instance.
* **Database Sync**: If you use our main Web Panel, you can use the built-in **GitHub Cloud Database Auto-Sync (Bandoobast)** configured directly from your admin panel to backup and restore your primary databases instantly across restarts.

---

## 🛠️ Getting Started & Installation

### 1. Prerequisites
Make sure you have [Node.js](https://nodejs.org) (v18 or higher) installed.

### 2. Install Dependencies
Navigate into the bot directory and install:
```bash
cd whatsapp-bot
npm install
```

### 3. Run the Bot
Start the bot server:
```bash
npm start
```

Once started, open your browser and navigate to:
👉 **`http://localhost:4000`**

---

## 🛰️ REST API Documentation

### 1. Get Connection Status
* **Endpoint**: `GET /api/wa/status`
* **Response**:
```json
{
  "success": true,
  "status": "connected", // disconnected | connecting | connected
  "user": { "id": "967773663808:1@s.whatsapp.net", "name": "Team Zero Bot" },
  "sessionExists": true
}
```

### 2. Request Device Pairing Code
* **Endpoint**: `POST /api/wa/pair`
* **Body**:
```json
{
  "phoneNumber": "967773663808"
}
```
* **Response**:
```json
{
  "success": true,
  "pairingCode": "A3B9-Z8C2",
  "message": "Pairing code generated successfully..."
}
```

### 3. Format and Send OTP
* **Endpoint**: `POST /api/wa/send-otp`
* **Body**:
```json
{
  "targetJid": "120363198547363412@g.us", // Target number or Group JID
  "senderNumber": "967773663808",
  "originalSmsText": "Your Google verification code is 482931.",
  "msgIndex": "1",
  "serviceName": "Google",
  "otpCode": "482931",
  "countryCode": "967",
  "countryName": "Yemen"
}
```
* **Response**:
```json
{
  "success": true,
  "messageId": "BAE591F843",
  "formattedText": "✨ 🇾🇪 | 967773663808 Message 1 ⚡...",
  "status": "Sent successfully"
}
```

### 4. Logout / Disconnect
* **Endpoint**: `POST /api/wa/logout`
* **Response**:
```json
{
  "success": true,
  "message": "Logged out successfully and session data cleared."
}
```

---

*Developed with ❤️ by **Team Zero Trace Intelligence™ 🇵🇰***
