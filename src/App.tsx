import React, { useState, useEffect, useRef, FormEvent } from "react";
import {
  Smartphone,
  Send,
  RefreshCw,
  Copy,
  Check,
  Radio,
  Cpu,
  User,
  ExternalLink,
  Sliders,
  Settings,
  X,
  Users,
  Layers,
  Database,
  Globe,
  Bell,
  Lock,
  Unlock,
  PlusCircle,
  LogIn,
  LogOut,
  Sparkles,
  Eye,
  EyeOff,
  MessageCircle
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { NumberInfo, SmsInfo, BotConfig, Subscriber, PanelStats, UserAccount } from "./types";

export default function App() {
  // Navigation State: "public" | "bot" | "admin"
  const [activeTab, setActiveTab] = useState<"public" | "bot" | "admin">("public");

  // Global APIs list
  const [numbers, setNumbers] = useState<NumberInfo[]>([]);
  const [smsLogs, setSmsLogs] = useState<SmsInfo[]>([]);
  const [stats, setStats] = useState<PanelStats>({ totalNumbers: 0, countryBreakdown: {} });
  
  // Filtering & Selection State
  const [selectedCountry, setSelectedCountry] = useState<string>("all");
  const [activeNumber, setActiveNumber] = useState<NumberInfo | null>(null);
  const [previousNumbers, setPreviousNumbers] = useState<NumberInfo[]>([]);
  
  // Loading & Action states
  const [loadingNumbers, setLoadingNumbers] = useState(true);
  const [loadingSms, setLoadingSms] = useState(true);
  const [isRefreshingSms, setIsRefreshingSms] = useState(false);
  const [copyToast, setCopyToast] = useState<string | null>(null);

  // SEARCH filter for live OTP console
  const [smsSearchQuery, setSmsSearchQuery] = useState("");
  const [showOnlyMySms, setShowOnlyMySms] = useState(false);
  const [myGeneratedNumbers, setMyGeneratedNumbers] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem("my_generated_numbers");
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  // Save generated numbers to localStorage
  useEffect(() => {
    localStorage.setItem("my_generated_numbers", JSON.stringify(myGeneratedNumbers));
  }, [myGeneratedNumbers]);

  // ==========================================
  // 1. "DEPLOY MY BOT" (USER REGISTRATION & LOGIN) STATE
  // ==========================================
  const [userSession, setUserSession] = useState<any>(() => {
    const saved = localStorage.getItem("team_zero_user_session");
    return saved ? JSON.parse(saved) : null;
  });
  const [userAuthMode, setUserAuthMode] = useState<"login" | "register">("login");
  const [regUsername, setRegUsername] = useState("");
  const [regEmail, setRegEmail] = useState("");
  const [regPassword, setRegPassword] = useState("");
  const [authError, setAuthError] = useState<string | null>(null);
  const [authLoading, setAuthLoading] = useState(false);

  // User's own bot config form (once logged in)
  const [userBotToken, setUserBotToken] = useState("");
  const [userBotGroupId, setUserBotGroupId] = useState("");
  const [userBotOwnerChatId, setUserBotOwnerChatId] = useState("");
  const [userBotLink, setUserBotLink] = useState("");
  const [tgDiagnosticStatus, setTgDiagnosticStatus] = useState<"idle" | "checking" | "success" | "failed">("idle");
  const [tgDiagnosticResult, setTgDiagnosticResult] = useState<{ botName?: string; username?: string; error?: string } | null>(null);
  const [userBotOtpGroupUrl, setUserBotOtpGroupUrl] = useState("");
  const [userBotUpdating, setUserBotUpdating] = useState(false);

  // Custom inline buttons states
  const [userBotBtn1Text, setUserBotBtn1Text] = useState("");
  const [userBotBtn1Url, setUserBotBtn1Url] = useState("");
  const [userBotBtn2Text, setUserBotBtn2Text] = useState("");
  const [userBotBtn2Url, setUserBotBtn2Url] = useState("");
  const [userBotBtn3Text, setUserBotBtn3Text] = useState("");
  const [userBotBtn3Url, setUserBotBtn3Url] = useState("");

  // WhatsApp OTP Bot States
  const [userBotWhatsappEnabled, setUserBotWhatsappEnabled] = useState(false);
  const [userBotWhatsappNewsletter, setUserBotWhatsappNewsletter] = useState("");
  const [userBotWhatsappNumberChannel, setUserBotWhatsappNumberChannel] = useState("");
  const [userBotWhatsappMainChannel, setUserBotWhatsappMainChannel] = useState("");
  const [userBotWhatsappPoweredBy, setUserBotWhatsappPoweredBy] = useState("");
  const [userBotWhatsappPhone, setUserBotWhatsappPhone] = useState("");
  const [userBotWhatsappStatus, setUserBotWhatsappStatus] = useState("offline");
  const [whatsappConnecting, setWhatsappConnecting] = useState(false);
  const [whatsappVerifying, setWhatsappVerifying] = useState(false);
  const [whatsappPairingCode, setWhatsappPairingCode] = useState("");
  const [enteredPairingCode, setEnteredPairingCode] = useState("");
  const [pairingLogs, setPairingLogs] = useState<string[]>([]);
  const [botActiveSubTab, setBotActiveSubTab] = useState<"telegram" | "whatsapp">("telegram");

  // User's own bot simulation
  const [simUserChatId, setSimUserChatId] = useState("");
  const [simUserPhone, setSimUserPhone] = useState("");
  const [simUserCountry, setSimUserCountry] = useState("Pakistan");
  const [simUserLoading, setSimUserLoading] = useState(false);

  // ==========================================
  // 2. ADMIN PORTAL STATE (ranausman094)
  // ==========================================
  const [adminPassword, setAdminPassword] = useState("");
  const [isAdminAuthenticated, setIsAdminAuthenticated] = useState(() => {
    return localStorage.getItem("team_zero_admin_auth") === "true";
  });
  const [adminError, setAdminError] = useState<string | null>(null);
  const [adminUsersList, setAdminUsersList] = useState<UserAccount[]>([]);
  const [loadingAdminUsers, setLoadingAdminUsers] = useState(false);
  
  // Admin Number Management State
  const [adminCountry, setAdminCountry] = useState("");
  const [adminServer, setAdminServer] = useState("");
  const [adminNumbersText, setAdminNumbersText] = useState("");
  const [addingNumbers, setAddingNumbers] = useState(false);
  const [adminNumbersList, setAdminNumbersList] = useState<any[]>([]);
  const [loadingAdminNumbers, setLoadingAdminNumbers] = useState(false);
  
  // Admin SMS Injection State
  const [adminInjectNumber, setAdminInjectNumber] = useState("");
  const [adminInjectCountry, setAdminInjectCountry] = useState("");
  const [adminInjectServer, setAdminInjectServer] = useState("");
  const [adminInjectMessage, setAdminInjectMessage] = useState("");
  const [injectingSms, setInjectingSms] = useState(false);
  
  // Admin Super Broadcast
  const [adminBroadcastMessage, setAdminBroadcastMessage] = useState("");
  const [adminBroadcastLoading, setAdminBroadcastLoading] = useState(false);
  const [adminBroadcastStatus, setAdminBroadcastStatus] = useState<string | null>(null);

  // ==========================================
  // 3. GEMINI SECURITY ANALYSIS
  // ==========================================
  const [selectedSmsForAnalysis, setSelectedSmsForAnalysis] = useState<string | null>(null);
  const [aiAnalysis, setAiAnalysis] = useState<string | null>(null);
  const [analyzingSms, setAnalyzingSms] = useState(false);

  // Password visibility triggers
  const [showPass, setShowPass] = useState(false);

  // Flags Helper
  const getFlag = (country: string): string => {
    const map: { [key: string]: string } = {
      Venezuela: "🇻🇪",
      Pakistan: "🇵🇰",
      India: "🇮🇳",
      USA: "🇺🇸",
      Canada: "🇨🇦",
      UK: "🇬🇧",
      Brazil: "🇧🇷",
      Argentina: "🇦🇷",
      Colombia: "🇨🇴",
      Mexico: "🇲🇽",
      France: "🇫🇷",
      Germany: "🇩🇪",
      Spain: "🇪🇸",
      Italy: "🇮🇹",
      Russia: "🇷🇺",
      Japan: "🇯🇵",
      China: "🇨🇳",
      "South Korea": "🇰🇷",
      "Saudi Arabia": "🇸🇦",
      UAE: "🇦🇪",
      Egypt: "🇪🇬",
      Nigeria: "🇳🇬",
      "South Africa": "🇿🇦",
      Australia: "🇦🇺",
      "New Zealand": "🇳🇿",
      Indonesia: "🇲🇨",
      Ghana: "🇬🇭",
      Sudan: "🇸🇩",
      Senegal: "🇸🇳",
      Zambia: "🇿🇲",
      Gabon: "🇬🇦",
      Cambodia: "🇰🇭",
      Barbados: "🇧🇧",
      Mozambique: "🇲🇿",
      Jordan: "🇯🇴",
      Algeria: "🇩🇿",
      Zimbabwe: "🇿🇼",
      Bangladesh: "🇧🇩",
      Iraq: "🇮🇶",
      Morocco: "🇲🇦",
      Kenya: "🇰🇪",
      Portugal: "🇵🇹",
      Ireland: "🇮🇪",
      Ukraine: "🇺🇦",
      Lebanon: "🇱🇧",
      Syria: "🇸🇾",
      Kuwait: "🇰🇼",
      Yemen: "🇾🇪",
      Oman: "🇴🇲",
      Israel: "🇮🇱",
      Qatar: "🇶🇦",
      Azerbaijan: "🇦🇿"
    };

    return map[country] || "🇲🇨"; // Fallback to Indonesia flags so it is never a plain earth or missing flag
  };

  // Mask Number Helper
  const maskNumber = (num: string): string => {
    if (!num || num.length <= 7) return num;
    return num.substring(0, 4) + "••••" + num.substring(num.length - 3);
  };

  // Synthesize digital sounds using standard Web Audio API without loading external media
  const playNotificationSound = (type: "otp" | "link" | "click") => {
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      
      if (type === "otp") {
        // High-pitched twin chime alert
        const osc1 = ctx.createOscillator();
        const gain = ctx.createGain();
        osc1.type = "sine";
        osc1.frequency.setValueAtTime(659.25, ctx.currentTime); // E5
        osc1.frequency.setValueAtTime(987.77, ctx.currentTime + 0.12); // B5
        
        gain.gain.setValueAtTime(0.12, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.45);
        
        osc1.connect(gain);
        gain.connect(ctx.destination);
        osc1.start();
        osc1.stop(ctx.currentTime + 0.45);
      } else if (type === "link") {
        // Successful link-up arpeggio
        const notes = [523.25, 659.25, 783.99, 1046.50]; // C5, E5, G5, C6
        notes.forEach((freq, idx) => {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = "triangle";
          osc.frequency.setValueAtTime(freq, ctx.currentTime + idx * 0.08);
          gain.gain.setValueAtTime(0.1, ctx.currentTime + idx * 0.08);
          gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + idx * 0.08 + 0.25);
          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.start(ctx.currentTime + idx * 0.08);
          osc.stop(ctx.currentTime + idx * 0.08 + 0.25);
        });
      } else {
        // Interactive interface tap
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = "sine";
        osc.frequency.setValueAtTime(900, ctx.currentTime);
        gain.gain.setValueAtTime(0.03, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.06);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start();
        osc.stop(ctx.currentTime + 0.06);
      }
    } catch (err) {
      console.log("Audio feedback ignored/blocked:", err);
    }
  };

  // Secure Fetch API wrapper with signature header authentication and safe JSON parsing fallback
  const secureFetch = async (url: string, options: RequestInit = {}) => {
    const headers = {
      ...options.headers,
      "Content-Type": "application/json",
      "x-app-request-signature": "IPRN-SMS-PANEL-SECURE-2026"
    };
    const res = await fetch(url, { ...options, headers });
    
    // Polyfill res.json to handle offline/HTML errors gracefully
    const originalJson = res.json.bind(res);
    res.json = async () => {
      const contentType = res.headers.get("content-type") || "";
      if (!contentType.includes("application/json")) {
        return { 
          success: false, 
          error: "Server offline or restarting. Please try again.", 
          otps: [], 
          numbers: [], 
          users: [], 
          stats: { totalNumbers: 0, countryBreakdown: {} } 
        };
      }
      try {
        return await originalJson();
      } catch (err) {
        return { 
          success: false, 
          error: "Malformed JSON response.", 
          otps: [], 
          numbers: [], 
          users: [], 
          stats: { totalNumbers: 0, countryBreakdown: {} } 
        };
      }
    };
    return res;
  };

  // Helper to instantly claim (and delete) number from database queue
  const claimAndRemoveNumber = async (numStr: string, countryName?: string) => {
    try {
      await secureFetch("/api/numbers/claim", {
        method: "POST",
        body: JSON.stringify({ 
          number: numStr, 
          userId: userSession?.id,
          country: countryName 
        }),
      });
      // Force refreshing lines to reflect the update instantly
      fetchNumbers();
    } catch (err) {
      console.error("Failed to claim/delete virtual line:", err);
    }
  };

  // Fetch virtual aggregator lists
  const fetchNumbers = async () => {
    try {
      const res = await secureFetch("/api/numbers");
      const data = await res.json();
      if (data.success) {
        setNumbers(data.numbers);
        setStats(data.stats);
      }
    } catch (err) {
      console.error("Error loading virtual aggregator lines:", err);
    } finally {
      setLoadingNumbers(false);
    }
  };

  // Automated UI state cleanup for performance optimization (removes logs older than 24 hours)
  const cleanupOldSmsLogsInUI = () => {
    const ONE_DAY_MS = 24 * 60 * 60 * 1000;
    const now = Date.now();
    
    setSmsLogs((prev) => 
      (prev || []).filter((sms) => {
        const t = new Date(sms.timestamp).getTime();
        return isNaN(t) || (now - t < ONE_DAY_MS);
      })
    );
    
    setTargetApiSms((prev) => 
      (prev || []).filter((sms) => {
        const t = new Date(sms.timestamp).getTime();
        return isNaN(t) || (now - t < ONE_DAY_MS);
      })
    );
  };

  const fetchSms = async (silent = false) => {
    if (!silent) setLoadingSms(true);
    setIsRefreshingSms(true);
    try {
      const res = await secureFetch("/api/sms");
      const data = await res.json();
      if (data.success) {
        setSmsLogs((prevLogs) => {
          if (prevLogs && prevLogs.length > 0 && data.otps && data.otps.length > 0) {
            const newestLocal = prevLogs[0];
            const newestRemote = data.otps[0];
            if (newestRemote.timestamp !== newestLocal.timestamp || newestRemote.message !== newestLocal.message) {
              playNotificationSound("otp");
              const shortMsg = newestRemote.message.match(/\d{4,8}/)?.[0] || "Code Received";
              showToast(`⚡ OTP Received: ${newestRemote.service} - Code [${shortMsg}] on ${newestRemote.number}`);
            }
          }
          
          // Apply automatic 24-hour cleanup to UI state immediately
          const ONE_DAY_MS = 24 * 60 * 60 * 1000;
          const now = Date.now();
          return (data.otps || []).filter((sms: any) => {
            const t = new Date(sms.timestamp).getTime();
            return isNaN(t) || (now - t < ONE_DAY_MS);
          });
        });
      }
    } catch (err) {
      console.error("Error loading SMS logs:", err);
    } finally {
      setLoadingSms(false);
      setIsRefreshingSms(false);
    }
  };

  // Load Admin Data if logged in
  const fetchAdminUsers = async () => {
    if (!isAdminAuthenticated) return;
    setLoadingAdminUsers(true);
    try {
      const res = await secureFetch("/api/admin/users", {
        method: "POST",
        body: JSON.stringify({ password: "ranausman094" }),
      });
      const data = await res.json();
      if (data.success) {
        setAdminUsersList(data.users);
      }
    } catch (err) {
      console.error("Admin list error:", err);
    } finally {
      setLoadingAdminUsers(false);
    }
  };

  // Fetch active user details again to sync subscribers list
  const syncUserSession = async () => {
    if (!userSession) return;
    try {
      const res = await secureFetch("/api/users/login", {
        method: "POST",
        body: JSON.stringify({ email: userSession.email, password: regPassword || userSession.password }),
      });
      const data = await res.json();
      if (data.success) {
        // preserve password in memory for syncs
        const updatedUser = { ...data.user, password: userSession.password };
        
        // sync whatsapp history notifications
        if (updatedUser.whatsappHistory && updatedUser.whatsappHistory.length > 0) {
          const hasPrevHistory = userSession.whatsappHistory && userSession.whatsappHistory.length > 0;
          const isNewLog = !hasPrevHistory || (updatedUser.whatsappHistory[0].timestamp !== userSession.whatsappHistory[0].timestamp || updatedUser.whatsappHistory[0].message !== userSession.whatsappHistory[0].message);
          if (isNewLog) {
            const latestWa = updatedUser.whatsappHistory[0];
            playNotificationSound("otp");
            showToast(`📲 WhatsApp Bot: Forwarded code successfully to WhatsApp phone ${latestWa.phone || "linked device"}!`);
          }
        }

        setUserSession(updatedUser);
        localStorage.setItem("team_zero_user_session", JSON.stringify(updatedUser));
        
        // sync form states
        setUserBotToken(updatedUser.botConfig?.token || "");
        setUserBotGroupId(updatedUser.botConfig?.groupId || "");
        setUserBotOwnerChatId(updatedUser.botConfig?.ownerChatId || "");
        setUserBotLink(updatedUser.botConfig?.botLink || "");
        setUserBotOtpGroupUrl(updatedUser.botConfig?.otpGroupUrl || "");

        setUserBotBtn1Text(updatedUser.botConfig?.btn1Text || "");
        setUserBotBtn1Url(updatedUser.botConfig?.btn1Url || "");
        setUserBotBtn2Text(updatedUser.botConfig?.btn2Text || "");
        setUserBotBtn2Url(updatedUser.botConfig?.btn2Url || "");
        setUserBotBtn3Text(updatedUser.botConfig?.btn3Text || "");
        setUserBotBtn3Url(updatedUser.botConfig?.btn3Url || "");

        setUserBotWhatsappEnabled(!!updatedUser.botConfig?.whatsappEnabled);
        setUserBotWhatsappNewsletter(updatedUser.botConfig?.whatsappNewsletter || "");
        setUserBotWhatsappNumberChannel(updatedUser.botConfig?.whatsappNumberChannel || "");
        setUserBotWhatsappMainChannel(updatedUser.botConfig?.whatsappMainChannel || "");
        setUserBotWhatsappPoweredBy(updatedUser.botConfig?.whatsappPoweredBy || "");
        setUserBotWhatsappPhone(updatedUser.botConfig?.whatsappPhone || "");
        setUserBotWhatsappStatus(updatedUser.botConfig?.whatsappStatus || "offline");
      }
    } catch (err) {
      // silently ignore failures on automatic sync
    }
  };

  // SMS Polling State and Controls
  const [smsPollingInterval, setSmsPollingInterval] = useState<number>(5000);
  const [isSmsPollingPaused, setIsSmsPollingPaused] = useState<boolean>(false);
  const [systemStatus, setSystemStatus] = useState<any>(null);

  const fetchSystemStatus = async () => {
    try {
      const res = await secureFetch("/api/admin/system-status");
      const data = await res.json();
      if (data.success) {
        setSystemStatus(data);
      }
    } catch (err) {
      console.error("Error loading system status:", err);
    }
  };

  // Initialization & pollers
  useEffect(() => {
    fetchNumbers();
    fetchSms();
    fetchSystemStatus();

    const numTimer = setInterval(fetchNumbers, 5000);
    return () => {
      clearInterval(numTimer);
    };
  }, []);

  useEffect(() => {
    if (isSmsPollingPaused) return;

    const smsTimer = setInterval(() => fetchSms(true), smsPollingInterval);
    return () => {
      clearInterval(smsTimer);
    };
  }, [smsPollingInterval, isSmsPollingPaused]);

  // Poller status states
  const [apiStats, setApiStats] = useState<any>(null);
  const [backgroundApiStats, setBackgroundApiStats] = useState<any>(null);
  const [bgSearch, setBgSearch] = useState("");
  const [bgFilter, setBgFilter] = useState("ALL");
  const [backendPollingPaused, setBackendPollingPaused] = useState<boolean>(false);
  const [targetApiSms, setTargetApiSms] = useState<any[]>([]);

  const fetchPollingStats = async () => {
    try {
      fetchSystemStatus();
      const res = await secureFetch("/api/admin/polling-stats");
      const data = await res.json();
      if (data.success) {
        setApiStats(data.stats);
        setBackgroundApiStats(data.backgroundStats || null);
        setBackendPollingPaused(data.isPollingPaused);
      }

      const resSms = await secureFetch("/api/admin/target-sms");
      const dataSms = await resSms.json();
      if (dataSms.success) {
        // Apply automatic 24-hour cleanup to UI state immediately
        const ONE_DAY_MS = 24 * 60 * 60 * 1000;
        const now = Date.now();
        const freshTargetSms = (dataSms.sms || []).filter((sms: any) => {
          const t = new Date(sms.timestamp).getTime();
          return isNaN(t) || (now - t < ONE_DAY_MS);
        });
        setTargetApiSms(freshTargetSms);
      }
    } catch (err) {
      console.error("Error loading polling stats:", err);
    }
  };

  useEffect(() => {
    fetchPollingStats();
    const statsTimer = setInterval(fetchPollingStats, 5000);
    
    // Set up standard periodic 24-hour logs cleanup function for console optimization
    const cleanupTimer = setInterval(cleanupOldSmsLogsInUI, 60000); // Check and prune every 1 minute
    
    return () => {
      clearInterval(statsTimer);
      clearInterval(cleanupTimer);
    };
  }, []);

  // Poll logged-in state details
  useEffect(() => {
    if (userSession) {
      syncUserSession();
      const userSyncTimer = setInterval(syncUserSession, 5000);
      return () => clearInterval(userSyncTimer);
    }
  }, [userSession?.id]);

  useEffect(() => {
    if (isAdminAuthenticated) {
      fetchAdminUsers();
      fetchAdminNumbers();
      const adminSyncTimer = setInterval(() => {
        fetchAdminUsers();
        fetchAdminNumbers();
      }, 5000);
      return () => clearInterval(adminSyncTimer);
    }
  }, [isAdminAuthenticated]);

  // ==========================================
  // USER AUTHENTICATION ACTIONS
  // ==========================================
  const handleUserAuth = async (e: FormEvent) => {
    e.preventDefault();
    setAuthError(null);
    setAuthLoading(true);

    const url = userAuthMode === "register" ? "/api/users/register" : "/api/users/login";
    const payload = userAuthMode === "register" 
      ? { username: regUsername, email: regEmail, password: regPassword }
      : { email: regEmail, password: regPassword };

    try {
      const res = await secureFetch(url, {
        method: "POST",
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (data.success) {
        // Save session locally
        const sessionObj = { ...data.user, password: regPassword };
        setUserSession(sessionObj);
        localStorage.setItem("team_zero_user_session", JSON.stringify(sessionObj));
        showToast(`Welcome, ${sessionObj.username}!`);
        
        // Reset state inputs
        setUserBotToken(sessionObj.botConfig?.token || "");
        setUserBotGroupId(sessionObj.botConfig?.groupId || "");
        setUserBotOwnerChatId(sessionObj.botConfig?.ownerChatId || "");
        setUserBotLink(sessionObj.botConfig?.botLink || "");
        setUserBotOtpGroupUrl(sessionObj.botConfig?.otpGroupUrl || "");

        setUserBotBtn1Text(sessionObj.botConfig?.btn1Text || "");
        setUserBotBtn1Url(sessionObj.botConfig?.btn1Url || "");
        setUserBotBtn2Text(sessionObj.botConfig?.btn2Text || "");
        setUserBotBtn2Url(sessionObj.botConfig?.btn2Url || "");
        setUserBotBtn3Text(sessionObj.botConfig?.btn3Text || "");
        setUserBotBtn3Url(sessionObj.botConfig?.btn3Url || "");

        setUserBotWhatsappEnabled(!!sessionObj.botConfig?.whatsappEnabled);
        setUserBotWhatsappNewsletter(sessionObj.botConfig?.whatsappNewsletter || "");
        setUserBotWhatsappNumberChannel(sessionObj.botConfig?.whatsappNumberChannel || "");
        setUserBotWhatsappMainChannel(sessionObj.botConfig?.whatsappMainChannel || "");
        setUserBotWhatsappPoweredBy(sessionObj.botConfig?.whatsappPoweredBy || "");
        setUserBotWhatsappPhone(sessionObj.botConfig?.whatsappPhone || "");
        setUserBotWhatsappStatus(sessionObj.botConfig?.whatsappStatus || "offline");
        
        // Reset form controls
        setRegUsername("");
        setRegEmail("");
        setRegPassword("");
      } else {
        setAuthError(data.error || "Authentication failed.");
      }
    } catch (err) {
      setAuthError("Network error. Try again.");
    } finally {
      setAuthLoading(false);
    }
  };

  const handleUserLogout = () => {
    setUserSession(null);
    localStorage.removeItem("team_zero_user_session");
    showToast("Logged out of your bot configuration panel.");
  };

  // ==========================================
  // USER BOT CONFIGURATION ACTIONS
  // ==========================================
  const handleUpdateUserBot = async (e: FormEvent) => {
    e.preventDefault();
    if (!userSession) return;
    setUserBotUpdating(true);

    try {
      const res = await secureFetch("/api/users/bot/config", {
        method: "POST",
        body: JSON.stringify({
          userId: userSession.id,
          token: userBotToken,
          groupId: userBotGroupId,
          ownerChatId: userBotOwnerChatId,
          botLink: userBotLink,
          otpGroupUrl: userBotOtpGroupUrl,
          btn1Text: userBotBtn1Text,
          btn1Url: userBotBtn1Url,
          btn2Text: userBotBtn2Text,
          btn2Url: userBotBtn2Url,
          btn3Text: userBotBtn3Text,
          btn3Url: userBotBtn3Url,
          whatsappEnabled: userBotWhatsappEnabled,
          whatsappNewsletter: userBotWhatsappNewsletter,
          whatsappNumberChannel: userBotWhatsappNumberChannel,
          whatsappMainChannel: userBotWhatsappMainChannel,
          whatsappPoweredBy: userBotWhatsappPoweredBy,
          whatsappPhone: userBotWhatsappPhone,
          whatsappStatus: userBotWhatsappStatus
        }),
      });
      const data = await res.json();
      if (data.success) {
        showToast("Your bot token and group settings are updated!");
        const updatedSession = { ...userSession, botConfig: data.botConfig };
        setUserSession(updatedSession);
        localStorage.setItem("team_zero_user_session", JSON.stringify(updatedSession));
      } else {
        showToast(`Error: ${data.error}`);
      }
    } catch (err) {
      showToast("Network failure updating bot.");
    } finally {
      setUserBotUpdating(false);
    }
  };

  const runTelegramDiagnostic = async () => {
    if (!userBotToken) {
      showToast("Please enter a bot token first!");
      return;
    }
    setTgDiagnosticStatus("checking");
    setTgDiagnosticResult(null);
    try {
      const url = `https://api.telegram.org/bot${userBotToken}/getMe`;
      const res = await fetch(url);
      const data = await res.json();
      if (data && data.ok) {
        setTgDiagnosticStatus("success");
        setTgDiagnosticResult({
          botName: data.result.first_name,
          username: data.result.username
        });
        showToast(`Success! Connected to @${data.result.username}`);
      } else {
        setTgDiagnosticStatus("failed");
        setTgDiagnosticResult({
          error: data.description || "Invalid token / unauthorized"
        });
        showToast("Connection failed. Check token.");
      }
    } catch (err: any) {
      setTgDiagnosticStatus("failed");
      setTgDiagnosticResult({
        error: err.message || "Network error. Failed to reach api.telegram.org"
      });
      showToast("Network error testing token.");
    }
  };

  const toggleMyBotStatus = async () => {
    if (!userSession) return;
    try {
      const res = await secureFetch("/api/users/bot/toggle-status", {
        method: "POST",
        body: JSON.stringify({ userId: userSession.id })
      });
      const data = await res.json();
      if (data.success) {
        showToast(data.status === "paused" ? "⏸️ Your Telegram bot polling paused" : "▶️ Your Telegram bot polling is active!");
        const updatedSession = { ...userSession, botConfig: { ...userSession.botConfig, status: data.status } };
        setUserSession(updatedSession);
        localStorage.setItem("team_zero_user_session", JSON.stringify(updatedSession));
      } else {
        showToast(`Error: ${data.error}`);
      }
    } catch (err) {
      showToast("Network failure toggling bot status.");
    }
  };

  // Simulate telegram subscriber join (manual testing tool)
  const handleSimulateSubJoin = async (e: FormEvent) => {
    e.preventDefault();
    if (!userSession || !simUserChatId || !simUserPhone) return;
    setSimUserLoading(true);

    try {
      const res = await secureFetch("/api/telegram/subscribers/register", {
        method: "POST",
        body: JSON.stringify({
          userId: userSession.id,
          chatId: simUserChatId,
          number: simUserPhone,
          country: simUserCountry,
        }),
      });
      const data = await res.json();
      if (data.success) {
        showToast("Successfully simulated bot subscription!");
        setSimUserChatId("");
        setSimUserPhone("");
        syncUserSession();
      }
    } catch (err) {
      console.error(err);
    } finally {
      setSimUserLoading(false);
    }
  };

  const prevWhatsappStatusRef = useRef(userBotWhatsappStatus);

  useEffect(() => {
    if (userBotWhatsappStatus === "active" && prevWhatsappStatusRef.current !== "active") {
      playNotificationSound("link");
      showToast("WhatsApp device linked successfully! Status: ACTIVE. ✅");
      setWhatsappConnecting(false);
      setWhatsappPairingCode("");
    }
    prevWhatsappStatusRef.current = userBotWhatsappStatus;
  }, [userBotWhatsappStatus]);

  // Real WhatsApp device pairing code linkage via Baileys API
  const handlePairWhatsapp = async () => {
    if (!userBotWhatsappPhone.trim()) {
      showToast("Please enter your WhatsApp phone number first!");
      return;
    }
    setWhatsappConnecting(true);
    setWhatsappVerifying(false);
    setWhatsappPairingCode("");
    setEnteredPairingCode("");
    setPairingLogs(["Initializing secure connection...", "Requesting real WhatsApp pairing code from server..."]);
    
    try {
      const res = await secureFetch("/api/whatsapp/pair", {
        method: "POST",
        body: JSON.stringify({
          userId: userSession.id,
          phoneNumber: userBotWhatsappPhone
        })
      });
      const data = await res.json();
      if (data.success && data.pairingCode) {
        setWhatsappPairingCode(data.pairingCode);
        setPairingLogs([
          "Real WhatsApp pairing code generated!",
          `Pairing Code: ${data.pairingCode}`,
          "Please open WhatsApp on your mobile phone.",
          "Go to Linked Devices -> Link with Phone Number, and enter this code.",
          "Waiting for connection automatically..."
        ]);
        showToast(`WhatsApp Pairing Code generated: ${data.pairingCode}`);
      } else {
        showToast(`Error: ${data.error || "Failed to generate pairing code"}`);
        setWhatsappConnecting(false);
      }
    } catch (err) {
      showToast("Failed to connect to backend for WhatsApp pairing.");
      setWhatsappConnecting(false);
    }
  };

  const confirmPairingWhatsapp = async () => {
    // Manual confirm is no longer strictly required because linkage is fully automatic.
    // However, if the user manually triggers it, we sync the session status.
    setWhatsappVerifying(true);
    setPairingLogs((prev) => [...prev, "Manually checking with server for active session..."]);
    try {
      await syncUserSession();
      setTimeout(() => {
        setWhatsappVerifying(false);
        if (userBotWhatsappStatus === "active") {
          showToast("WhatsApp device is ACTIVE! ✅");
          setWhatsappConnecting(false);
        } else {
          showToast("Still waiting for pairing on your mobile device. ⏳");
        }
      }, 1000);
    } catch {
      setWhatsappVerifying(false);
    }
  };

  const handleDisconnectWhatsapp = async () => {
    if (!userSession) return;
    if (!confirm("Are you sure you want to disconnect WhatsApp and log out of this session?")) return;
    
    try {
      const res = await secureFetch("/api/whatsapp/disconnect", {
        method: "POST",
        body: JSON.stringify({ userId: userSession.id })
      });
      const data = await res.json();
      if (data.success) {
        setUserBotWhatsappStatus("offline");
        setUserBotWhatsappEnabled(false);
        setWhatsappPairingCode("");
        setEnteredPairingCode("");
        setWhatsappConnecting(false);
        setPairingLogs([]);
        showToast("WhatsApp disconnected successfully. 🔌");
        syncUserSession();
      } else {
        showToast(`Error: ${data.error}`);
      }
    } catch (err) {
      showToast("Network failure disconnecting WhatsApp.");
    }
  };


  // ==========================================
  // ADMIN AUTHENTICATION ACTIONS
  // ==========================================
  const handleAdminLogin = async (e: FormEvent) => {
    e.preventDefault();
    setAdminError(null);
    try {
      const res = await secureFetch("/api/admin/login", {
        method: "POST",
        body: JSON.stringify({ password: adminPassword }),
      });
      const data = await res.json();
      if (data.success) {
        setIsAdminAuthenticated(true);
        localStorage.setItem("team_zero_admin_auth", "true");
        showToast("Authenticated as Super Admin.");
        fetchAdminUsers();
      } else {
        setAdminError("Access Denied. Invalid admin password.");
      }
    } catch (err) {
      setAdminError("Unauthorized request.");
    }
  };

  const handleAdminLogout = () => {
    setIsAdminAuthenticated(false);
    localStorage.removeItem("team_zero_admin_auth");
    setAdminPassword("");
    setAdminUsersList([]);
    showToast("Admin session cleared.");
  };

  // Admin global broadcast trigger
  const handleAdminGlobalBroadcast = async (e: FormEvent) => {
    e.preventDefault();
    if (!adminBroadcastMessage.trim()) return;
    setAdminBroadcastLoading(true);
    setAdminBroadcastStatus(null);

    try {
      const res = await secureFetch("/api/admin/broadcast", {
        method: "POST",
        body: JSON.stringify({
          password: "ranausman094",
          message: adminBroadcastMessage,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setAdminBroadcastStatus(`✅ Broadcast success! Sent to ${data.sentCount} users across ${data.totalBots} bots.`);
        setAdminBroadcastMessage("");
        setTimeout(() => setAdminBroadcastStatus(null), 7000);
      } else {
        setAdminBroadcastStatus(`❌ Broadcast error: ${data.error}`);
      }
    } catch (err) {
      setAdminBroadcastStatus("❌ Network error during broadcast dispatch.");
    } finally {
      setAdminBroadcastLoading(false);
    }
  };

  // Manual Numbers Management actions
  const fetchAdminNumbers = async () => {
    if (!isAdminAuthenticated) return;
    setLoadingAdminNumbers(true);
    try {
      const res = await secureFetch("/api/admin/numbers", {
        method: "POST",
        body: JSON.stringify({ password: "ranausman094" }),
      });
      const data = await res.json();
      if (data.success) {
        setAdminNumbersList(data.numbers || []);
      }
    } catch (err) {
      console.error("Admin numbers fetch error:", err);
    } finally {
      setLoadingAdminNumbers(false);
    }
  };

  const handleAddAdminNumbers = async (e: FormEvent) => {
    e.preventDefault();
    if (!adminCountry.trim() || !adminServer.trim() || !adminNumbersText.trim()) {
      showToast("Please fill all fields to add numbers.");
      return;
    }
    setAddingNumbers(true);
    try {
      const res = await secureFetch("/api/admin/numbers/add", {
        method: "POST",
        body: JSON.stringify({
          password: "ranausman094",
          country: adminCountry.trim(),
          server: adminServer.trim(),
          numbersText: adminNumbersText.trim()
        })
      });
      const data = await res.json();
      if (data.success) {
        showToast(`✅ Added ${data.addedCount} new numbers!`);
        setAdminNumbersText("");
        fetchAdminNumbers();
        fetchNumbers(); // Sync main page list
      } else {
        showToast(`❌ Error: ${data.error}`);
      }
    } catch (err) {
      showToast("❌ Network error adding numbers.");
    } finally {
      setAddingNumbers(false);
    }
  };

  const toggleBackendPolling = async () => {
    try {
      const res = await secureFetch("/api/admin/polling-control", {
        method: "POST",
        body: JSON.stringify({ paused: !backendPollingPaused })
      });
      const data = await res.json();
      if (data.success) {
        showToast(data.isPollingPaused ? "⏸️ Global background pollers paused!" : "▶️ Global background pollers resumed!");
        setBackendPollingPaused(data.isPollingPaused);
      } else {
        showToast(`❌ Error: ${data.error}`);
      }
    } catch (err) {
      showToast("❌ Network error updating polling controls.");
    }
  };

  const handleDeleteAdminNumber = async (numId: string) => {
    try {
      const res = await secureFetch("/api/admin/numbers/delete", {
        method: "POST",
        body: JSON.stringify({ password: "ranausman094", numberId: numId })
      });
      const data = await res.json();
      if (data.success) {
        showToast("Number deleted successfully!");
        fetchAdminNumbers();
        fetchNumbers(); // Sync main page list
      } else {
        showToast(`❌ Error: ${data.error}`);
      }
    } catch (err) {
      showToast("❌ Network error deleting number.");
    }
  };

  const handleInjectAdminSms = async (e: FormEvent) => {
    e.preventDefault();
    if (!adminInjectNumber.trim() || !adminInjectServer.trim() || !adminInjectMessage.trim()) {
      showToast("Please fill phone number, server, and message to inject.");
      return;
    }
    setInjectingSms(true);
    try {
      const res = await secureFetch("/api/admin/sms/send", {
        method: "POST",
        body: JSON.stringify({
          password: "ranausman094",
          number: adminInjectNumber.trim(),
          country: adminInjectCountry.trim() || "Manual Injection",
          server: adminInjectServer.trim(),
          message: adminInjectMessage.trim()
        })
      });
      const data = await res.json();
      if (data.success) {
        showToast("✅ OTP Injected successfully!");
        setAdminInjectMessage("");
        fetchSms(); // Refresh main live logs stream
      } else {
        showToast(`❌ Error: ${data.error}`);
      }
    } catch (err) {
      showToast("❌ Network error injecting OTP.");
    } finally {
      setInjectingSms(false);
    }
  };

  const handleClearAdminSms = async () => {
    if (!window.confirm("Are you sure you want to clear all manual OTP logs?")) return;
    try {
      const res = await secureFetch("/api/admin/sms/clear", {
        method: "POST",
        body: JSON.stringify({ password: "ranausman094" })
      });
      const data = await res.json();
      if (data.success) {
        showToast("✅ Cleared all manual SMS logs!");
        fetchSms();
      }
    } catch (err) {
      showToast("❌ Network error clearing SMS logs.");
    }
  };

  // ==========================================
  // OTHER ACTIONS & DISCARD LINES
  // ==========================================
  const generateNewNumber = () => {
    let pool = numbers;
    if (selectedCountry !== "all") {
      pool = numbers.filter((n) => n.country === selectedCountry);
    }

    if (pool.length === 0) {
      showToast("No lines available in this queue selection");
      return;
    }

    if (activeNumber) {
      setPreviousNumbers((prev) => [activeNumber, ...prev.slice(0, 3)]);
    }

    const nextNum = pool[Math.floor(Math.random() * pool.length)];
    setActiveNumber(nextNum);
    showToast(`Loaded live line: ${nextNum.number}`);
    
    // Save to myGeneratedNumbers
    setMyGeneratedNumbers(prev => {
      const cleanNew = nextNum.number.replace(/[\s\-\+]/g, "");
      if (!prev.includes(cleanNew)) {
        return [...prev, cleanNew];
      }
      return prev;
    });
    
    // Claim and delete it instantly so it is not shown to any subsequent sessions!
    claimAndRemoveNumber(nextNum.number, nextNum.country);
  };

  const showToast = (msg: string) => {
    setCopyToast(msg);
    setTimeout(() => setCopyToast(null), 3000);
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    showToast(`📋 Copy successful: ${text}`);
  };

  const handleAnalyzeSms = async (messageText: string) => {
    setSelectedSmsForAnalysis(messageText);
    setAiAnalysis(null);
    setAnalyzingSms(true);
    try {
      const res = await secureFetch("/api/gemini/analyze", {
        method: "POST",
        body: JSON.stringify({ message: messageText }),
      });
      const data = await res.json();
      if (data.success) {
        setAiAnalysis(data.analysis);
      } else {
        setAiAnalysis(`❌ AI analysis was unable to parse: ${data.error}`);
      }
    } catch (err: any) {
      setAiAnalysis(`❌ Could not run intelligence scan. Confirm server API keys.`);
    } finally {
      setAnalyzingSms(false);
    }
  };

  // Filtered live logs list
  const filteredSmsLogs = smsLogs.filter((log) => {
    const q = smsSearchQuery.toLowerCase();
    const matchesSearch = (
      log.number.toLowerCase().includes(q) ||
      log.message.toLowerCase().includes(q) ||
      log.service.toLowerCase().includes(q) ||
      log.country.toLowerCase().includes(q)
    );

    if (!matchesSearch) return false;

    if (showOnlyMySms) {
      const cleanLogNum = log.number.replace(/[\s\-\+]/g, "");
      return myGeneratedNumbers.includes(cleanLogNum);
    }

    return true;
  });

  return (
    <div className="min-h-screen bg-[#060609] text-gray-200 selection:bg-[#00ff99] selection:text-black font-sans pb-16">
      
      {/* Top Banner with Official Support Telegram/WhatsApp link info */}
      <div className="bg-gradient-to-r from-[#0d0f1a] via-[#14182e] to-[#0d0f1a] border-b border-[#00ff99]/15 text-center py-2 px-4 text-xs font-medium text-gray-400 flex items-center justify-center gap-3 flex-wrap">
        <span className="flex items-center gap-1.5 text-[#00ff99]">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#00ff99] opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-[#00ff99]"></span>
          </span>
          📢 Official Team Zero:
        </span>
        <a
          href="https://t.me/teamzerotrace"
          target="_blank"
          rel="noopener noreferrer"
          className="text-[#00ff99] hover:underline font-bold transition flex items-center gap-0.5"
        >
          @teamzerotrace <ExternalLink className="h-3 w-3 inline" />
        </a>
        <span className="text-gray-600">|</span>
        <span className="text-gray-300 font-semibold">Join channel:</span>
        <a
          href="https://whatsapp.com/channel/0029Vb7CHRO96H4QS1ynKI1J"
          target="_blank"
          rel="noopener noreferrer"
          className="bg-[#00ff99]/10 text-[#00ff99] hover:bg-[#00ff99]/20 transition border border-[#00ff99]/20 px-2.5 py-0.5 rounded-full text-[11px] font-bold"
        >
          WhatsApp Channel
        </a>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-6 space-y-8">
        
        {/* Vercel KV Connection Warning/Success Banners */}
        {systemStatus?.isVercel && !systemStatus?.isKvConfigured && (
          <div className="bg-amber-500/10 border border-amber-500/30 rounded-2xl p-4 md:p-5 text-amber-200 text-sm space-y-2 shadow-lg shadow-amber-950/10">
            <div className="flex items-center gap-2 font-bold text-amber-400">
              <span className="text-lg">⚠️</span>
              <span>Vercel Database Config Required! (ڈیٹا بیس کنفیگریشن ضروری ہے)</span>
            </div>
            <p className="text-xs leading-relaxed text-amber-300/90 font-sans">
              Since you deployed this application on Vercel (serverless), local file updates (like user registrations, logins, claimed numbers, and OTP histories) will reset on every server spin-down or cold start. 
              To make your accounts, logins, and OTPs <strong>100% persistent and active 24/7</strong>, please connect a free <strong>Vercel KV (Redis) database</strong> in your Vercel Dashboard with 1-click. Vercel will automatically inject the required credentials.
            </p>
            <div className="text-xs text-amber-400/80 font-mono">
              Missing: <code className="bg-amber-950/40 px-1 py-0.5 rounded text-red-400">KV_REST_API_URL</code> and <code className="bg-amber-950/40 px-1 py-0.5 rounded text-red-400">KV_REST_API_TOKEN</code>
            </div>
          </div>
        )}

        {systemStatus?.isVercel && systemStatus?.isKvConfigured && (
          <div className="bg-[#00ff99]/5 border border-[#00ff99]/20 rounded-2xl p-4 text-[#00ff99] text-xs flex items-center justify-between gap-3 shadow-md shadow-emerald-950/10">
            <div className="flex items-center gap-2">
              <span className="text-sm">⚡</span>
              <div>
                <span className="font-bold">Vercel KV Database Active! (ڈیٹا بیس فعال ہے)</span>
                <p className="text-gray-400 mt-0.5 font-sans">Your logins, user accounts, and 24/7 background cron OTPs are completely secure and persistent.</p>
              </div>
            </div>
            <span className="bg-[#00ff99]/10 text-[#00ff99] border border-[#00ff99]/20 px-2.5 py-0.5 rounded-full font-mono font-bold text-[10px] tracking-wider shrink-0">ACTIVE</span>
          </div>
        )}


        {/* Header Branding */}
        <header className="flex flex-col md:flex-row items-center justify-between gap-4 py-4 border-b border-gray-800/40">
          <div className="flex items-center gap-4">
            <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-[#00ff99] to-[#008b45] flex items-center justify-center shadow-lg shadow-[#00ff99]/20 border border-[#00ff99]/30">
              <span className="text-black font-black text-2xl font-mono">0</span>
            </div>
            <div>
              <h1 className="text-3xl font-black tracking-tight text-white flex items-center gap-2">
                𝗧𝗘𝗔𝗠 𝗭𝗘𝗥𝗢 <span className="text-xs bg-[#00ff99]/10 text-[#00ff99] px-2 py-0.5 rounded border border-[#00ff99]/20 font-mono tracking-wider font-bold">SMS GROUP</span>
              </h1>
              <p className="text-xs text-gray-400">Secure Live Aggregator & Personalized Bot Deployer</p>
            </div>
          </div>

          {/* Navigation Tabs bar */}
          <nav className="flex items-center bg-[#11121a] p-1 rounded-xl border border-gray-800/80 gap-1">
            <button
              onClick={() => setActiveTab("public")}
              className={`px-4 py-2 text-xs font-bold rounded-lg transition-all flex items-center gap-1.5 ${
                activeTab === "public"
                  ? "bg-[#00ff99] text-black shadow-md"
                  : "text-gray-400 hover:text-white"
              }`}
            >
              <Smartphone className="h-3.5 w-3.5" />
              <span>Public Live Lines</span>
            </button>
            <button
              onClick={() => setActiveTab("bot")}
              className={`px-4 py-2 text-xs font-bold rounded-lg transition-all flex items-center gap-1.5 ${
                activeTab === "bot"
                  ? "bg-[#00ff99] text-black shadow-md"
                  : "text-gray-400 hover:text-white"
              }`}
            >
              <Settings className="h-3.5 w-3.5" />
              <span>Deploy My Bot</span>
            </button>
            <button
              onClick={() => setActiveTab("admin")}
              className={`px-4 py-2 text-xs font-bold rounded-lg transition-all flex items-center gap-1.5 ${
                activeTab === "admin"
                  ? "bg-[#00ff99] text-black shadow-md"
                  : "text-gray-400 hover:text-white"
              }`}
            >
              <Lock className="h-3.5 w-3.5" />
              <span>Admin Portal</span>
            </button>
          </nav>
        </header>

        {/* ========================================================
            TAB 1: PUBLIC SMS PANEL
            "Sab ko na dikha on ko bas panel dikha jaha number generate ho our live otp dikha"
            ======================================================== */}
        {activeTab === "public" && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="space-y-8"
          >
            {/* Global Stats */}
            <section className="bg-gradient-to-b from-[#0d0f17] to-[#07080d] rounded-2xl p-6 border border-gray-800/50 shadow-xl space-y-4">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center gap-2.5">
                  <Globe className="h-5 w-5 text-[#00ff99]" />
                  <h2 className="text-lg font-bold text-white">Aggregated Country Queues ({stats.totalNumbers})</h2>
                </div>
                <div className="text-xs text-gray-400 bg-black/40 px-3 py-1 rounded-full border border-gray-800">
                  Status: <span className="text-[#00ff99] font-bold font-mono">Receiving OTP Live</span>
                </div>
              </div>

              {loadingNumbers ? (
                <div className="py-6 text-center text-gray-500 flex items-center justify-center gap-2">
                  <RefreshCw className="h-4 w-4 animate-spin text-[#00ff99]" />
                  <span>Loading country pools...</span>
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
                  {Object.entries(stats.countryBreakdown).map(([country, count]) => (
                    <div
                      key={country}
                      onClick={() => {
                        setSelectedCountry(country);
                        showToast(`Filtered queue to ${country}`);
                      }}
                      className={`bg-[#11121a] rounded-xl p-3 border cursor-pointer flex items-center justify-between hover:border-[#00ff99]/20 transition group ${
                        selectedCountry === country ? "border-[#00ff99]/40 bg-[#00ff99]/5" : "border-gray-800/60"
                      }`}
                    >
                      <div className="flex items-center gap-2 overflow-hidden">
                        <span className="text-xl shrink-0">{getFlag(country)}</span>
                        <span className="text-xs font-bold text-yellow-500 truncate group-hover:text-yellow-400 font-mono">
                          {country}
                        </span>
                      </div>
                      <span className="text-xs font-bold text-[#00ff99] bg-[#00ff99]/5 px-2 py-0.5 rounded border border-[#00ff99]/10 font-mono">
                        {count}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </section>

            {/* Real-time Polling Control Center */}
            <section className="bg-gradient-to-r from-[#0a0c14] to-[#0e111d] rounded-2xl p-5 border border-gray-800/60 shadow-xl flex flex-col md:flex-row items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className={`h-10 w-10 rounded-xl flex items-center justify-center border transition-all duration-300 ${isSmsPollingPaused ? "bg-amber-500/10 border-amber-500/30 text-amber-500" : "bg-[#00ff99]/10 border-[#00ff99]/30 text-[#00ff99]"}`}>
                  <Radio className={`h-5 w-5 ${isSmsPollingPaused ? "" : "animate-pulse"}`} />
                </div>
                <div>
                  <h3 className="text-sm font-black text-white flex items-center gap-2">
                    Console Feed Control
                    {isSmsPollingPaused ? (
                      <span className="text-[10px] bg-amber-500/10 text-amber-500 px-2 py-0.5 rounded border border-amber-500/20 font-bold font-mono">PAUSED</span>
                    ) : (
                      <span className="text-[10px] bg-[#00ff99]/10 text-[#00ff99] px-2 py-0.5 rounded border border-[#00ff99]/20 font-bold font-mono">LIVE ({smsPollingInterval / 1000}s)</span>
                    )}
                  </h3>
                  <p className="text-xs text-gray-400 font-sans">Manage client-side refresh state & resource consumption parameters.</p>
                </div>
              </div>

              <div className="flex items-center gap-3 flex-wrap sm:flex-nowrap">
                {userSession && userSession.botConfig?.token && (
                  <button
                    onClick={toggleMyBotStatus}
                    className={`px-4 py-2 text-xs font-bold rounded-xl border transition-all duration-200 flex items-center gap-1.5 cursor-pointer ${
                      userSession.botConfig?.status === "paused"
                        ? "bg-amber-500 text-black border-amber-400 hover:bg-amber-400 animate-pulse"
                        : "bg-[#00ff99]/10 text-[#00ff99] border-[#00ff99]/30 hover:bg-[#00ff99]/20"
                    }`}
                  >
                    {userSession.botConfig?.status === "paused" ? "▶️ Resume My Bot Polling" : "⏸️ Pause My Bot Polling"}
                  </button>
                )}
                {/* Pause/Resume Toggle */}
                <button
                  onClick={() => {
                    setIsSmsPollingPaused(!isSmsPollingPaused);
                    showToast(isSmsPollingPaused ? "▶️ Client-side SMS polling resumed" : "⏸️ Client-side SMS polling paused");
                  }}
                  className={`px-4 py-2 text-xs font-bold rounded-xl border transition-all duration-200 flex items-center gap-1.5 cursor-pointer ${
                    isSmsPollingPaused
                      ? "bg-amber-500 text-black border-amber-400 hover:bg-amber-400"
                      : "bg-[#161a2b] text-gray-300 border-gray-800 hover:text-white hover:border-gray-700"
                  }`}
                >
                  {isSmsPollingPaused ? "▶️ Resume Polling" : "⏸️ Pause Polling"}
                </button>
              </div>
            </section>

            {/* Layout section */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
              
              {/* Left Side: Number box */}
              <div className="lg:col-span-4 space-y-6">
                
                <div className="bg-[#0e0f16] rounded-2xl p-6 border border-gray-800/60 shadow-xl relative overflow-hidden space-y-6">
                  <div className="absolute top-0 right-0 p-8 opacity-5">
                    <Smartphone className="h-32 w-32 text-[#00ff99]" />
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-bold text-gray-400 uppercase tracking-widest flex items-center gap-2">
                      <Smartphone className="h-4 w-4 text-[#00ff99]" />
                      Virtual Line Generator
                    </h3>
                    <div className="flex items-center gap-1.5 text-[10px] text-[#00ff99] bg-[#00ff99]/10 px-2 py-0.5 rounded-full font-semibold border border-[#00ff99]/20">
                      <span className="h-1.5 w-1.5 rounded-full bg-[#00ff99] animate-pulse"></span>
                      ONLINE
                    </div>
                  </div>

                  {activeNumber ? (
                    <div className="space-y-4">
                      <div className="text-center bg-black/50 rounded-xl p-5 border border-gray-800/80">
                        <div className="flex items-center justify-center gap-1.5 text-xs text-gray-400 mb-1">
                          <span>{getFlag(activeNumber.country)}</span>
                          <span className="font-mono text-yellow-500 font-bold">{activeNumber.country}</span>
                        </div>
                        <div className="text-2xl sm:text-3xl font-black font-mono tracking-wider text-white select-all">
                          {activeNumber.number}
                        </div>
                        <p className="text-[10px] text-gray-500 mt-2">
                          Queue origin: <span className="text-[#00ff99] font-semibold">{activeNumber.source}</span>
                        </p>
                      </div>

                      <div className="flex gap-2">
                        <button
                          onClick={() => copyToClipboard(activeNumber.number)}
                          className="flex-1 py-3 px-4 rounded-xl bg-gray-800 hover:bg-gray-750 border border-gray-700/60 transition flex items-center justify-center gap-2 text-xs font-semibold text-white"
                        >
                          <Copy className="h-4 w-4 text-[#00ff99]" />
                          <span>Copy Number</span>
                        </button>
                        
                        <button
                          onClick={generateNewNumber}
                          className="flex-1 py-3 px-4 rounded-xl bg-gradient-to-r from-[#00ff99] to-[#00a365] hover:opacity-95 transition flex items-center justify-center gap-2 text-xs font-semibold text-black shadow-lg shadow-[#00ff99]/10"
                        >
                          <RefreshCw className="h-4 w-4" />
                          <span>Generate Number</span>
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="py-8 text-center bg-black/40 border border-gray-800/50 rounded-xl px-4 space-y-4">
                      <div className="text-xs text-gray-500 font-mono">
                        No active virtual line claimed yet. Select a country queue below and click generate!
                      </div>
                      <button
                        onClick={generateNewNumber}
                        className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-[#00ff99] to-[#00a365] hover:opacity-95 transition flex items-center justify-center gap-2 text-xs font-bold text-black shadow-lg shadow-[#00ff99]/10 animate-pulse"
                      >
                        <RefreshCw className="h-4 w-4" />
                        <span>Generate Virtual Line</span>
                      </button>
                    </div>
                  )}

                  {/* Filter Select country */}
                  <div className="space-y-2 border-t border-gray-800/40 pt-4">
                    <label className="text-xs text-gray-400 font-semibold block">Country Queue Filter:</label>
                    <select
                      value={selectedCountry}
                      onChange={(e) => {
                        setSelectedCountry(e.target.value);
                      }}
                      className="w-full bg-black/60 border border-gray-800 rounded-xl px-3 py-2.5 text-sm font-semibold text-gray-300 focus:outline-none focus:border-[#00ff99] transition font-mono"
                    >
                      <option value="all">🌍 All Available Countries</option>
                      {Object.keys(stats.countryBreakdown).map((c) => (
                        <option key={c} value={c}>
                          {getFlag(c)} {c}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Released Discard List */}
                  {previousNumbers.length > 0 && (
                    <div className="space-y-2 border-t border-gray-800/40 pt-4">
                      <div className="flex justify-between items-center text-xs text-gray-500">
                        <span>Released Numbers (Removed)</span>
                        <button
                          onClick={() => setPreviousNumbers([])}
                          className="text-[#00ff99] hover:underline"
                        >
                          Clear
                        </button>
                      </div>
                      <div className="space-y-1.5">
                        {previousNumbers.map((num, idx) => (
                          <div
                            key={idx}
                            className="bg-black/30 border border-gray-800/30 px-3 py-1.5 rounded-lg text-xs flex justify-between items-center opacity-50 hover:opacity-85 transition"
                          >
                            <span className="font-mono text-gray-400">{num.number}</span>
                            <span className="text-[10px] text-yellow-600 font-mono font-bold">{num.country}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                </div>

                {/* Bot Promotion / Information Help Card */}
                <div className="bg-[#0e0f16]/90 p-5 rounded-2xl border border-gray-800/50 space-y-3.5">
                  <h4 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
                    <Sparkles className="h-4 w-4 text-[#00ff99]" />
                    Deploy Your Bot Instantly
                  </h4>
                  <p className="text-xs text-gray-400 leading-relaxed">
                    Want your own private virtual number bot? Switch to the <strong className="text-white">"Deploy My Bot"</strong> tab above, register an account, and paste your Telegram Bot Token. Your bot will instantly forward codes to your custom OTP group ID!
                  </p>
                </div>

              </div>

              {/* Right Side: Live forward console */}
              <div className="lg:col-span-8 space-y-4">
                
                <div className="flex items-center justify-between flex-wrap gap-4">
                  <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                    <div className="flex items-center gap-2.5">
                      <div className="relative flex h-3 w-3">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500"></span>
                      </div>
                      <h2 className="text-lg font-bold text-white flex items-center gap-2">
                        Live Forwarding OTP Stream
                      </h2>
                    </div>

                    {/* Filter Mode Buttons */}
                    <div className="flex bg-[#11121a] p-0.5 rounded-xl border border-gray-800 gap-0.5">
                      <button
                        onClick={() => setShowOnlyMySms(false)}
                        className={`px-3 py-1.5 text-[11px] font-bold rounded-lg transition-all flex items-center gap-1.5 ${
                          !showOnlyMySms
                            ? "bg-[#00ff99] text-black shadow-sm"
                            : "text-gray-400 hover:text-white"
                        }`}
                      >
                        <Globe className="h-3.5 w-3.5" />
                        <span>All SMS Stream</span>
                      </button>
                      <button
                        onClick={() => setShowOnlyMySms(true)}
                        className={`px-3 py-1.5 text-[11px] font-bold rounded-lg transition-all flex items-center gap-1.5 ${
                          showOnlyMySms
                            ? "bg-[#00ff99] text-black shadow-sm"
                            : "text-gray-400 hover:text-white"
                        }`}
                        title="Show only SMS sent to your generated virtual lines"
                      >
                        <Smartphone className="h-3.5 w-3.5" />
                        <span>My SMS ({myGeneratedNumbers.length})</span>
                      </button>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      placeholder="Search live SMS records..."
                      value={smsSearchQuery}
                      onChange={(e) => setSmsSearchQuery(e.target.value)}
                      className="bg-black/60 border border-gray-800 rounded-xl px-3 py-1.5 text-xs focus:outline-none focus:border-[#00ff99] transition w-44 sm:w-64"
                    />
                    
                    <button
                      onClick={() => fetchSms()}
                      disabled={isRefreshingSms}
                      className="p-2 rounded-xl bg-gray-800 border border-gray-700 text-gray-300 hover:text-white transition disabled:opacity-50"
                      title="Force Refresh Logs"
                    >
                      <RefreshCw className={`h-3.5 w-3.5 ${isRefreshingSms ? "animate-spin text-[#00ff99]" : ""}`} />
                    </button>
                  </div>
                </div>

                {loadingSms ? (
                  <div className="text-center py-16 bg-[#0e0f16] rounded-2xl border border-gray-800/40 text-gray-500 flex flex-col items-center justify-center gap-3">
                    <RefreshCw className="h-8 w-8 animate-spin text-[#00ff99]" />
                    <span>Loading active OTP queues from API aggregators...</span>
                  </div>
                ) : filteredSmsLogs.length === 0 ? (
                  <div className="text-center py-16 bg-[#0e0f16] rounded-2xl border border-gray-800/40 text-gray-500 text-xs">
                    No matching logs found in active pipeline.
                  </div>
                ) : (
                  <div className="overflow-x-auto rounded-2xl border border-gray-800/40 shadow-xl bg-[#0e0f16]">
                    <table className="min-w-full divide-y divide-gray-800/40">
                      <thead className="bg-black/60">
                        <tr>
                          <th className="px-4 py-3 text-left text-[10px] font-bold text-gray-400 uppercase tracking-wider">Line Info</th>
                          <th className="px-4 py-3 text-left text-[10px] font-bold text-gray-400 uppercase tracking-wider hidden sm:table-cell">Brand</th>
                          <th className="px-4 py-3 text-left text-[10px] font-bold text-gray-400 uppercase tracking-wider">SMS Message</th>
                          <th className="px-4 py-3 text-center text-[10px] font-bold text-gray-400 uppercase tracking-wider">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-800/30">
                        <AnimatePresence initial={false}>
                          {filteredSmsLogs.map((log, index) => {
                            const otpMatch = log.message.match(/(\b\d{3}-\d{3}\b|\b\d{3} \d{3}\b|\b\d{3,8}\b)/);
                            const otpCode = otpMatch ? otpMatch[0] : null;

                            return (
                              <motion.tr
                                key={log.timestamp + "_" + log.number + "_" + index}
                                initial={{ opacity: 0, y: 15 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, scale: 0.98 }}
                                transition={{
                                  type: "spring",
                                  stiffness: 120,
                                  damping: 15,
                                  delay: Math.min(index * 0.04, 0.4)
                                }}
                                className="hover:bg-black/45 transition"
                              >
                                {/* Line Info */}
                                <td className="px-4 py-3.5 whitespace-nowrap">
                                  <div className="space-y-1">
                                    <div className="flex items-center gap-1.5 flex-wrap">
                                      <div className="flex items-center gap-1">
                                        <span>{getFlag(log.country)}</span>
                                        <span className="text-[10px] text-yellow-500 font-bold uppercase tracking-wider font-mono">
                                          {log.country}
                                        </span>
                                      </div>
                                      <span className="text-gray-600 font-sans text-[10px] hidden sm:inline">•</span>
                                      <span className="text-[9px] font-bold text-[#00ff99] bg-[#00ff99]/10 border border-[#00ff99]/15 px-1.5 py-0.5 rounded-md shrink-0 uppercase tracking-wider font-mono">
                                        {log.service}
                                      </span>
                                    </div>
                                    <div className="text-xs font-bold font-mono text-white select-all">
                                      {maskNumber(log.number)}
                                    </div>
                                    <div className="text-[9px] text-gray-500 font-mono">
                                      {log.timestamp}
                                    </div>
                                  </div>
                                </td>

                                {/* Brand */}
                                <td className="px-4 py-3.5 whitespace-nowrap hidden sm:table-cell">
                                  <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-[#141520] border border-gray-800 text-gray-300">
                                    {log.service}
                                  </span>
                                </td>

                                {/* Message block */}
                                <td className="px-4 py-3.5">
                                  <div className="space-y-1">
                                    <p className="text-xs text-gray-200 leading-relaxed font-mono whitespace-pre-line select-text">
                                      {log.message}
                                    </p>
                                    <div className="flex flex-wrap items-center gap-1.5 pt-1">
                                      {otpCode && (
                                        <div className="inline-flex items-center gap-1.5 bg-[#00ff99]/5 text-[#00ff99] border border-[#00ff99]/15 px-2.5 py-0.5 rounded-full text-[10px] font-bold font-mono">
                                          <Bell className="h-3 w-3" />
                                          <span>OTP Code: {otpCode}</span>
                                        </div>
                                      )}
                                      
                                      {/* Associated Bot and clickable Custom Buttons */}
                                      {(log.btn1Text || log.btn2Text || log.btn3Text) && (
                                        <>
                                          {log.botUsername && (
                                            <span className="text-[9px] text-gray-400 font-mono bg-gray-900 border border-gray-800/80 px-2 py-0.5 rounded-md flex items-center gap-1">
                                              🤖 @{log.botUsername}
                                            </span>
                                          )}
                                          {log.btn1Text && log.btn1Url && (
                                            <a
                                              href={log.btn1Url}
                                              target="_blank"
                                              rel="noopener noreferrer"
                                              className="inline-flex items-center gap-1 bg-[#00ff99]/10 text-[#00ff99] hover:bg-[#00ff99]/25 border border-[#00ff99]/30 px-2 py-0.5 rounded-md text-[9px] font-bold font-mono transition duration-150"
                                            >
                                              🔗 {log.btn1Text}
                                            </a>
                                          )}
                                          {log.btn2Text && log.btn2Url && (
                                            <a
                                              href={log.btn2Url}
                                              target="_blank"
                                              rel="noopener noreferrer"
                                              className="inline-flex items-center gap-1 bg-blue-500/10 text-blue-400 hover:bg-blue-500/25 border border-blue-500/30 px-2 py-0.5 rounded-md text-[9px] font-bold font-mono transition duration-150"
                                            >
                                              🔗 {log.btn2Text}
                                            </a>
                                          )}
                                          {log.btn3Text && log.btn3Url && (
                                            <a
                                              href={log.btn3Url}
                                              target="_blank"
                                              rel="noopener noreferrer"
                                              className="inline-flex items-center gap-1 bg-purple-500/10 text-purple-400 hover:bg-purple-500/25 border border-purple-500/30 px-2 py-0.5 rounded-md text-[9px] font-bold font-mono transition duration-150"
                                            >
                                              🔗 {log.btn3Text}
                                            </a>
                                          )}
                                        </>
                                      )}
                                    </div>
                                  </div>
                                </td>

                                {/* Action button controls */}
                                <td className="px-4 py-3.5 text-center">
                                  <div className="flex items-center justify-center gap-1.5">
                                    
                                    {otpCode && (
                                      <button
                                        onClick={() => copyToClipboard(otpCode)}
                                        className="p-1.5 rounded-lg bg-gray-800/80 hover:bg-[#00ff99]/15 hover:text-[#00ff99] border border-gray-700/50 transition text-gray-400"
                                        title="Copy OTP Code Only"
                                      >
                                        <Copy className="h-3.5 w-3.5" />
                                      </button>
                                    )}

                                    <button
                                      onClick={() => handleAnalyzeSms(log.message)}
                                      className="p-1.5 rounded-lg bg-gray-800/80 hover:bg-[#00ff99]/15 hover:text-[#00ff99] border border-gray-700/50 transition text-gray-400"
                                      title="Gemini AI Analysis"
                                    >
                                      <Cpu className="h-3.5 w-3.5" />
                                    </button>

                                  </div>
                                </td>
                              </motion.tr>
                            );
                          })}
                        </AnimatePresence>
                      </tbody>
                    </table>
                  </div>
                )}

              </div>

            </div>
          </motion.div>
        )}

        {/* ========================================================
            TAB 2: DEPLOY MY BOT (USER SYSTEM)
            Users registers with email, password, username and sets up their token
            ======================================================== */}
        {activeTab === "bot" && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="max-w-4xl mx-auto space-y-8"
          >
            {!userSession ? (
              // Auth panel (Login/Register)
              <div className="bg-[#0e0f16] border border-gray-800 rounded-2xl p-8 max-w-lg mx-auto shadow-2xl space-y-6">
                <div className="text-center space-y-2">
                  <div className="h-12 w-12 rounded-xl bg-[#00ff99]/10 text-[#00ff99] border border-[#00ff99]/30 flex items-center justify-center mx-auto mb-3">
                    <LogIn className="h-6 w-6" />
                  </div>
                  <h2 className="text-xl font-bold text-white">Configure & Deploy Your Bot</h2>
                  <p className="text-xs text-gray-400">
                    Create a free account to bind virtual numbers to your own Telegram Bot.
                  </p>
                </div>

                <div className="flex bg-[#11121a] p-1 rounded-xl border border-gray-800 gap-1">
                  <button
                    type="button"
                    onClick={() => { setUserAuthMode("login"); setAuthError(null); }}
                    className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${
                      userAuthMode === "login" ? "bg-[#00ff99] text-black" : "text-gray-400 hover:text-white"
                    }`}
                  >
                    Login Account
                  </button>
                  <button
                    type="button"
                    onClick={() => { setUserAuthMode("register"); setAuthError(null); }}
                    className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${
                      userAuthMode === "register" ? "bg-[#00ff99] text-black" : "text-gray-400 hover:text-white"
                    }`}
                  >
                    Register Account
                  </button>
                </div>

                <form onSubmit={handleUserAuth} className="space-y-4">
                  {userAuthMode === "register" && (
                    <div>
                      <label className="text-[10px] text-gray-400 uppercase font-semibold">Username / Brand Name:</label>
                      <input
                        type="text"
                        required
                        placeholder="e.g. JattBots"
                        value={regUsername}
                        onChange={(e) => setRegUsername(e.target.value)}
                        className="w-full bg-black border border-gray-800 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-[#00ff99] transition font-mono"
                      />
                    </div>
                  )}

                  <div>
                    <label className="text-[10px] text-gray-400 uppercase font-semibold">Email Address:</label>
                    <input
                      type="email"
                      required
                      placeholder="e.g. user@example.com"
                      value={regEmail}
                      onChange={(e) => setRegEmail(e.target.value)}
                      className="w-full bg-black border border-gray-800 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-[#00ff99] transition font-mono"
                    />
                  </div>

                  <div>
                    <label className="text-[10px] text-gray-400 uppercase font-semibold">Password:</label>
                    <div className="relative">
                      <input
                        type={showPass ? "text" : "password"}
                        required
                        placeholder="••••••••"
                        value={regPassword}
                        onChange={(e) => setRegPassword(e.target.value)}
                        className="w-full bg-black border border-gray-800 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-[#00ff99] transition font-mono"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPass(!showPass)}
                        className="absolute right-3 top-2.5 text-gray-500 hover:text-gray-300"
                      >
                        {showPass ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                  </div>

                  {authError && (
                    <p className="text-xs text-red-400 bg-red-950/20 border border-red-900/30 p-2.5 rounded-lg text-center font-mono">
                      {authError}
                    </p>
                  )}

                  <button
                    type="submit"
                    disabled={authLoading}
                    className="w-full py-2.5 rounded-xl bg-gradient-to-r from-[#00ff99] to-[#008b45] hover:opacity-95 text-black font-bold text-xs transition"
                  >
                    {authLoading ? "Verifying..." : userAuthMode === "register" ? "Register & Access" : "Login & Access"}
                  </button>
                </form>
              </div>
            ) : (
              // Dashboard once logged in
              <div className="space-y-8">
                
                {/* Welcome header */}
                <div className="bg-[#0e0f16] border border-gray-800 rounded-2xl p-6 flex flex-col sm:flex-row items-center justify-between gap-4 shadow-xl">
                  <div>
                    <span className="text-xs font-semibold text-[#00ff99] uppercase tracking-wider font-mono">Connected Session</span>
                    <h2 className="text-2xl font-black text-white flex items-center gap-2">
                      {userSession.username} Bot Command Center
                    </h2>
                    <p className="text-xs text-gray-400">Manage your private API webhook connections and sub lists.</p>
                  </div>
                  <div className="flex items-center gap-3 flex-wrap sm:flex-nowrap">
                    {userSession.botConfig?.token && (
                      <button
                        onClick={toggleMyBotStatus}
                        className={`px-4 py-2 text-xs font-bold rounded-xl border transition flex items-center gap-1.5 ${
                          userSession.botConfig?.status === "paused"
                            ? "bg-amber-500 hover:bg-amber-400 text-black border-amber-400"
                            : "bg-[#11121a] hover:bg-[#1c1e2d] text-[#00ff99] border-[#00ff99]/30"
                        }`}
                      >
                        {userSession.botConfig?.status === "paused" ? "▶️ Resume Bot" : "⏸️ Pause Bot"}
                      </button>
                    )}
                    <button
                      onClick={handleUserLogout}
                      className="px-4 py-2 bg-red-950/30 text-red-400 hover:bg-red-900/20 border border-red-900/30 rounded-xl text-xs font-bold transition flex items-center gap-1.5"
                    >
                      <LogOut className="h-3.5 w-3.5" />
                      <span>Logout Account</span>
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  
                  {/* Bot settings form */}
                  <div className="bg-[#0e0f16] border border-gray-800 rounded-2xl p-6 space-y-6 shadow-xl flex flex-col justify-between">
                    <div>
                      {/* Telegram Configuration View */}
                      <form onSubmit={handleUpdateUserBot} className="space-y-4">
                        <h3 className="text-sm font-bold text-gray-300 uppercase tracking-wider flex items-center gap-2">
                          <Send className="h-4 w-4 text-[#00ff99]" />
                          Telegram API Configuration
                        </h3>

                        <div>
                          <label className="text-[10px] text-gray-400 uppercase font-semibold block mb-1">🤖 Bot Token (from @BotFather):</label>
                          <div className="flex gap-2">
                            <input
                              type="password"
                              required
                              placeholder="Paste your private bot token"
                              value={userBotToken}
                              onChange={(e) => {
                                setUserBotToken(e.target.value);
                                if (tgDiagnosticStatus !== "idle") setTgDiagnosticStatus("idle");
                              }}
                              className="flex-1 bg-black border border-gray-800 rounded-xl px-3 py-2 text-xs font-mono focus:outline-none focus:border-[#00ff99] transition text-gray-300"
                            />
                            <button
                              type="button"
                              onClick={runTelegramDiagnostic}
                              disabled={tgDiagnosticStatus === "checking"}
                              className="px-3 py-2 bg-gray-900 hover:bg-gray-800 border border-gray-800 text-[11px] font-bold rounded-xl transition shrink-0 text-gray-300 hover:text-white"
                            >
                              {tgDiagnosticStatus === "checking" ? "Checking..." : "🔍 Test"}
                            </button>
                          </div>

                          {tgDiagnosticStatus !== "idle" && (
                            <div className="mt-2 text-[10px] flex items-center gap-2">
                              {tgDiagnosticStatus === "success" && (
                                <div className="inline-flex items-center gap-1 bg-[#00ff99]/10 text-[#00ff99] border border-[#00ff99]/20 px-2 py-0.5 rounded-md font-bold">
                                  <span className="h-1.5 w-1.5 rounded-full bg-[#00ff99] animate-pulse"></span>
                                  Connected: {tgDiagnosticResult?.botName ? `${tgDiagnosticResult.botName} (@${tgDiagnosticResult.username})` : "Token Valid"}
                                </div>
                              )}
                              {tgDiagnosticStatus === "failed" && (
                                <div className="inline-flex items-center gap-1 bg-red-500/10 text-red-400 border border-red-500/20 px-2 py-0.5 rounded-md font-bold">
                                  <span className="h-1.5 w-1.5 rounded-full bg-red-400"></span>
                                  Failed: {tgDiagnosticResult?.error || "Invalid Token"}
                                </div>
                              )}
                            </div>
                          )}
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          <div>
                            <label className="text-[10px] text-gray-400 uppercase font-semibold block">👥 Group Chat ID:</label>
                            <input
                              type="text"
                              required
                              placeholder="e.g. -1001928472"
                              value={userBotGroupId}
                              onChange={(e) => setUserBotGroupId(e.target.value)}
                              className="w-full bg-black border border-gray-800 rounded-xl px-3 py-2 text-xs font-mono focus:outline-none focus:border-[#00ff99] transition text-gray-300"
                            />
                          </div>
                          <div>
                            <label className="text-[10px] text-gray-400 uppercase font-semibold block">👤 Owner Chat ID:</label>
                            <input
                              type="text"
                              required
                              placeholder="e.g. 58392182"
                              value={userBotOwnerChatId}
                              onChange={(e) => setUserBotOwnerChatId(e.target.value)}
                              className="w-full bg-black border border-gray-800 rounded-xl px-3 py-2 text-xs font-mono focus:outline-none focus:border-[#00ff99] transition text-gray-300"
                            />
                          </div>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          <div>
                            <label className="text-[10px] text-gray-400 uppercase font-semibold block">🔗 Bot Link / Username (Optional):</label>
                            <input
                              type="text"
                              placeholder="e.g. https://t.me/MyAwesomeBot"
                              value={userBotLink}
                              onChange={(e) => setUserBotLink(e.target.value)}
                              className="w-full bg-black border border-gray-800 rounded-xl px-3 py-2 text-xs font-mono focus:outline-none focus:border-[#00ff99] transition text-gray-300"
                            />
                          </div>
                          <div>
                            <label className="text-[10px] text-gray-400 uppercase font-semibold block">🔗 OTP Group / Channel URL (Optional):</label>
                            <input
                              type="text"
                              placeholder="e.g. https://t.me/MyOtpGroup"
                              value={userBotOtpGroupUrl}
                              onChange={(e) => setUserBotOtpGroupUrl(e.target.value)}
                              className="w-full bg-black border border-gray-800 rounded-xl px-3 py-2 text-xs font-mono focus:outline-none focus:border-[#00ff99] transition text-gray-300"
                            />
                          </div>
                        </div>

                        {/* Collapsible / Elegant Inline Buttons Configuration */}
                        <div className="border-t border-gray-800/80 pt-4 mt-4 space-y-4">
                          <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider">
                            🔘 Forwarded SMS Custom Buttons Config
                          </h4>
                          <p className="text-[10px] text-gray-500 leading-relaxed">
                            Configure up to 3 custom inline buttons to attach underneath your forwarded OTP messages on Telegram. Perfect for branding and ease of navigation!
                          </p>

                          <div className="space-y-3">
                            <div className="grid grid-cols-2 gap-3">
                              <div>
                                <label className="text-[9px] text-gray-500 uppercase font-semibold">Button 1 Text:</label>
                                <input
                                  type="text"
                                  placeholder="e.g. 🤖 Bot Panel"
                                  value={userBotBtn1Text}
                                  onChange={(e) => setUserBotBtn1Text(e.target.value)}
                                  className="w-full bg-black border border-gray-800 rounded-lg px-2 py-1 text-xs focus:outline-none focus:border-[#00ff99] transition text-gray-300"
                                />
                              </div>
                              <div>
                                <label className="text-[9px] text-gray-500 uppercase font-semibold">Button 1 Destination URL:</label>
                                <input
                                  type="text"
                                  placeholder="e.g. https://t.me/MyAwesomeBot"
                                  value={userBotBtn1Url}
                                  onChange={(e) => setUserBotBtn1Url(e.target.value)}
                                  className="w-full bg-black border border-gray-800 rounded-lg px-2 py-1 text-xs focus:outline-none focus:border-[#00ff99] transition text-gray-300 font-mono"
                                />
                              </div>
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                              <div>
                                <label className="text-[9px] text-gray-500 uppercase font-semibold">Button 2 Text:</label>
                                <input
                                  type="text"
                                  placeholder="e.g. ⚡ See OTP"
                                  value={userBotBtn2Text}
                                  onChange={(e) => setUserBotBtn2Text(e.target.value)}
                                  className="w-full bg-black border border-gray-800 rounded-lg px-2 py-1 text-xs focus:outline-none focus:border-[#00ff99] transition text-gray-300"
                                />
                              </div>
                              <div>
                                <label className="text-[9px] text-gray-500 uppercase font-semibold">Button 2 Destination URL:</label>
                                <input
                                  type="text"
                                  placeholder="e.g. https://t.me/MyOtpGroup"
                                  value={userBotBtn2Url}
                                  onChange={(e) => setUserBotBtn2Url(e.target.value)}
                                  className="w-full bg-black border border-gray-800 rounded-lg px-2 py-1 text-xs focus:outline-none focus:border-[#00ff99] transition text-gray-300 font-mono"
                                />
                              </div>
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                              <div>
                                <label className="text-[9px] text-gray-500 uppercase font-semibold">Button 3 Text (Optional):</label>
                                <input
                                  type="text"
                                  placeholder="e.g. 📢 Main Channel"
                                  value={userBotBtn3Text}
                                  onChange={(e) => setUserBotBtn3Text(e.target.value)}
                                  className="w-full bg-black border border-gray-800 rounded-lg px-2 py-1 text-xs focus:outline-none focus:border-[#00ff99] transition text-gray-300"
                                />
                              </div>
                              <div>
                                <label className="text-[9px] text-gray-500 uppercase font-semibold">Button 3 Destination URL (Optional):</label>
                                <input
                                  type="text"
                                  placeholder="e.g. https://t.me/MainPromoChannel"
                                  value={userBotBtn3Url}
                                  onChange={(e) => setUserBotBtn3Url(e.target.value)}
                                  className="w-full bg-black border border-gray-800 rounded-lg px-2 py-1 text-xs focus:outline-none focus:border-[#00ff99] transition text-gray-300 font-mono"
                                />
                              </div>
                            </div>
                          </div>
                        </div>

                        <button
                          type="submit"
                          disabled={userBotUpdating}
                          className="w-full py-2.5 rounded-xl bg-gradient-to-r from-[#00ff99] to-[#008b45] hover:opacity-95 text-black font-bold text-xs transition"
                        >
                          {userBotUpdating ? "Saving Configuration..." : "Activate Telegram Bot Engine"}
                        </button>
                      </form>
                    </div>

                    <div className="text-xs text-gray-500 bg-black/40 border border-gray-800/80 p-3.5 rounded-xl leading-relaxed font-mono mt-6">
                      <span className="text-[#00ff99] font-bold block mb-1">💡 BOT DIRECTIVE COMMANDS:</span>
                      • Send <code className="text-[#00ff99] font-bold">/broadcast &lt;message&gt;</code> in your bot as the owner to announce changes to subscribers!
                    </div>
                  </div>

                  {/* Subscriptions log & simulation join */}
                  <div className="space-y-6">
                    
                    {/* Bot stats */}
                    <div className="bg-[#0e0f16] border border-gray-800 rounded-2xl p-6 space-y-4 shadow-xl">
                      <h3 className="text-sm font-bold text-gray-300 uppercase tracking-wider flex items-center gap-2">
                        <Users className="h-4 w-4 text-[#00ff99]" />
                        Active Subscribers ({(userSession.subscribers || []).length})
                      </h3>

                      {(userSession.subscribers || []).length === 0 ? (
                        <p className="text-xs text-gray-500 py-6 text-center">
                          No users have joined your bot yet. Try simulating a user subscription below!
                        </p>
                      ) : (
                        <div className="max-h-48 overflow-y-auto border border-gray-800/60 rounded-xl divide-y divide-gray-800/40">
                          {userSession.subscribers.map((sub: any, idx: number) => (
                            <div key={idx} className="p-3 bg-black/20 hover:bg-black/40 transition flex items-center justify-between text-xs">
                              <div>
                                <p className="font-bold text-white">{sub.firstName || "User"}</p>
                                {sub.username && <p className="text-[10px] text-gray-500">@{sub.username}</p>}
                              </div>
                              <div className="font-mono text-right">
                                <p className="text-[10px] text-gray-500">ID: {sub.chatId}</p>
                                {sub.numbers && sub.numbers.map((n: any, i: number) => (
                                  <span key={i} className="inline-block bg-[#00ff99]/10 text-[#00ff99] text-[9px] px-1.5 py-0.5 rounded ml-1 border border-[#00ff99]/15 font-bold">
                                    {n.number}
                                  </span>
                                ))}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Simulation join tool */}
                    <div className="bg-[#0e0f16] border border-gray-800 rounded-2xl p-6 space-y-4 shadow-xl">
                      <h3 className="text-sm font-bold text-gray-300 uppercase tracking-wider flex items-center gap-2">
                        <PlusCircle className="h-4 w-4 text-[#00ff99]" />
                        Subscriber Join Simulator
                      </h3>
                      <p className="text-[11px] text-gray-500">
                        Test and verify your database structure locally. Fill this form to bind a simulated user to your database immediately.
                      </p>

                      <form onSubmit={handleSimulateSubJoin} className="space-y-3">
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <label className="text-[10px] text-gray-400 font-semibold block">Chat ID:</label>
                            <input
                              type="number"
                              required
                              placeholder="e.g. 5839123"
                              value={simUserChatId}
                              onChange={(e) => setSimUserChatId(e.target.value)}
                              className="w-full bg-black border border-gray-800 rounded-xl px-2.5 py-1.5 text-xs focus:outline-none focus:border-[#00ff99] transition font-mono"
                            />
                          </div>
                          <div>
                            <label className="text-[10px] text-gray-400 font-semibold block">Phone Number:</label>
                            <input
                              type="text"
                              required
                              placeholder="e.g. +923192..."
                              value={simUserPhone}
                              onChange={(e) => setSimUserPhone(e.target.value)}
                              className="w-full bg-black border border-gray-800 rounded-xl px-2.5 py-1.5 text-xs focus:outline-none focus:border-[#00ff99] transition font-mono"
                            />
                          </div>
                        </div>

                        <div className="flex gap-2">
                          <div className="flex-1">
                            <select
                              value={simUserCountry}
                              onChange={(e) => setSimUserCountry(e.target.value)}
                              className="w-full bg-black border border-gray-800 rounded-xl px-2.5 py-1.5 text-xs focus:outline-none focus:border-[#00ff99] transition font-mono text-gray-300"
                            >
                              <option value="Pakistan">🇵🇰 Pakistan</option>
                              <option value="India">🇮🇳 India</option>
                              <option value="Venezuela">🇻🇪 Venezuela</option>
                              <option value="USA">🇺🇸 USA</option>
                              <option value="UK">🇬🇧 UK</option>
                            </select>
                          </div>
                          <button
                            type="submit"
                            disabled={simUserLoading}
                            className="bg-[#00ff99]/10 text-[#00ff99] hover:bg-[#00ff99]/20 transition border border-[#00ff99]/20 px-4 rounded-xl text-xs font-semibold"
                          >
                            Simulate Join
                          </button>
                        </div>
                      </form>
                    </div>

                  </div>

                </div>

                {/* Private Bot OTP History Panel */}
                <div className="bg-[#0e0f16] border border-gray-800 rounded-2xl p-6 shadow-xl space-y-4">
                  <div className="flex items-center justify-between flex-wrap gap-4 border-b border-gray-800/60 pb-4">
                    <div>
                      <h3 className="text-sm font-bold text-gray-300 uppercase tracking-wider flex items-center gap-2">
                        <Database className="h-4 w-4 text-[#00ff99]" />
                        Private Bot OTP History (Last 10 Codes)
                      </h3>
                      <p className="text-[11px] text-gray-500 mt-0.5">
                        Verified SMS records captured and dispatched specifically by your @{userSession.username} Bot
                      </p>
                    </div>
                    <div className="text-xs font-mono text-gray-400 bg-black/40 border border-gray-800/80 px-3 py-1.5 rounded-xl flex items-center gap-2">
                      <span className="inline-block h-1.5 w-1.5 rounded-full bg-[#00ff99] animate-pulse"></span>
                      Auto-refreshing (12s)
                    </div>
                  </div>

                  {(!userSession.otpHistory || userSession.otpHistory.length === 0) ? (
                    <div className="text-center py-12 text-gray-500 text-xs border border-dashed border-gray-800 rounded-xl">
                      No OTPs captured for your bot yet. Generate virtual lines on the main screen to receive codes here instantly!
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-left border-collapse text-xs">
                        <thead>
                          <tr className="border-b border-gray-800 text-gray-400 font-semibold uppercase text-[10px] tracking-wider">
                            <th className="py-3 px-4">Line Number</th>
                            <th className="py-3 px-4">Service</th>
                            <th className="py-3 px-4">Captured OTP Message</th>
                            <th className="py-3 px-4 text-right">Time Captured</th>
                            <th className="py-3 px-4 text-center">Action</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-800/40">
                          {userSession.otpHistory.map((historyItem: any, idx: number) => {
                            // Simple regex to extract code for quick action
                            const otpMatch = historyItem.message.match(/\b\d{4,8}\b/);
                            const extractedOtp = otpMatch ? otpMatch[0] : "";

                            return (
                              <tr key={idx} className="bg-black/10 hover:bg-black/30 transition">
                                <td className="py-3.5 px-4 font-mono font-bold text-white whitespace-nowrap flex items-center gap-2">
                                  <span className="text-base leading-none">{getFlag(historyItem.country)}</span>
                                  <span>{historyItem.number}</span>
                                </td>
                                <td className="py-3.5 px-4 whitespace-nowrap">
                                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#00ff99]/10 text-[#00ff99] border border-[#00ff99]/20">
                                    {historyItem.service}
                                  </span>
                                </td>
                                <td className="py-3.5 px-4 leading-relaxed max-w-sm text-gray-300">
                                  {historyItem.message}
                                </td>
                                <td className="py-3.5 px-4 text-right text-gray-500 font-mono whitespace-nowrap">
                                  {new Date(historyItem.timestamp).toLocaleString()}
                                </td>
                                <td className="py-3.5 px-4 text-center whitespace-nowrap">
                                  <div className="flex items-center justify-center gap-2">
                                    {extractedOtp && (
                                      <button
                                        onClick={() => copyToClipboard(extractedOtp)}
                                        className="px-2.5 py-1 text-[10px] font-bold bg-[#00ff99] hover:bg-[#00cc7a] text-black rounded transition flex items-center gap-1"
                                        title={`Copy Code: ${extractedOtp}`}
                                      >
                                        <Check className="h-3 w-3" />
                                        <span>Code: {extractedOtp}</span>
                                      </button>
                                    )}
                                    <button
                                      onClick={() => copyToClipboard(historyItem.message)}
                                      className="p-1 text-gray-400 hover:text-white hover:bg-gray-800 rounded transition"
                                      title="Copy Full Message"
                                    >
                                      <Copy className="h-3 w-3" />
                                    </button>
                                  </div>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>

              </div>
            )}
          </motion.div>
        )}

        {/* ========================================================
            TAB 3: SUPER ADMIN PORTAL (ranausman094)
            Allows super-admin to view all users, total bots, emails, passwords,
            and push global broadcast message to ALL subscribers of ALL bots.
            ======================================================== */}
        {activeTab === "admin" && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="max-w-5xl mx-auto space-y-8"
          >
            {!isAdminAuthenticated ? (
              // Admin login gate
              <div className="bg-[#0e0f16] border border-gray-800 rounded-2xl p-8 max-w-md mx-auto shadow-2xl space-y-6">
                <div className="text-center space-y-2">
                  <div className="h-12 w-12 rounded-xl bg-red-500/10 text-red-500 border border-red-500/30 flex items-center justify-center mx-auto mb-3">
                    <Lock className="h-6 w-6 animate-pulse" />
                  </div>
                  <h2 className="text-xl font-bold text-white">Super Admin Verification</h2>
                  <p className="text-xs text-gray-400">Enter your secure panel password to unlock system controls.</p>
                </div>

                <form onSubmit={handleAdminLogin} className="space-y-4">
                  <div>
                    <label className="text-[10px] text-gray-400 uppercase font-semibold">Admin Panel Password:</label>
                    <input
                      type="password"
                      required
                      placeholder="Enter Password"
                      value={adminPassword}
                      onChange={(e) => setAdminPassword(e.target.value)}
                      className="w-full bg-black border border-gray-800 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-red-500 transition text-center font-mono"
                    />
                  </div>

                  {adminError && (
                    <p className="text-xs text-red-400 bg-red-950/20 border border-red-900/30 p-2.5 rounded-lg text-center font-mono">
                      {adminError}
                    </p>
                  )}

                  <button
                    type="submit"
                    className="w-full py-2.5 rounded-xl bg-gradient-to-r from-red-600 to-red-800 hover:opacity-95 text-white font-bold text-xs transition"
                  >
                    Unlock Super Admin Dashboard
                  </button>
                </form>
              </div>
            ) : (
              // Admin authorized command center
              <div className="space-y-8">
                
                {/* Header */}
                <div className="bg-[#0e0f16] border border-gray-800 rounded-2xl p-6 flex flex-col sm:flex-row items-center justify-between gap-4 shadow-xl border-l-4 border-l-red-500">
                  <div className="space-y-1">
                    <span className="text-xs font-semibold text-red-500 uppercase tracking-widest font-mono flex items-center gap-1.5">
                      <Unlock className="h-3.5 w-3.5" /> SECURE CONTROL MODE (ranausman094)
                    </span>
                    <h2 className="text-2xl font-black text-white">Super Admin Command Center</h2>
                    <p className="text-xs text-gray-400">View user logins, active bot counts, and execute global mass broadcasts.</p>
                  </div>
                  <button
                    onClick={handleAdminLogout}
                    className="px-4 py-2 bg-gray-800 hover:bg-gray-700 border border-gray-700 rounded-xl text-xs font-bold transition flex items-center gap-1.5 text-white"
                  >
                    <LogOut className="h-3.5 w-3.5" />
                    <span>Lock Panel</span>
                  </button>
                </div>

                {/* Overview stats */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
                  <div className="bg-[#11121a] p-5 rounded-xl border border-gray-800/80">
                    <p className="text-xs text-gray-500 uppercase tracking-wider font-semibold">Total Registered Users</p>
                    <p className="text-3xl font-black text-white font-mono mt-1">{adminUsersList.length}</p>
                  </div>
                  <div className="bg-[#11121a] p-5 rounded-xl border border-gray-800/80">
                    <p className="text-xs text-gray-500 uppercase tracking-wider font-semibold">Total Active Bot Engines</p>
                    <p className="text-3xl font-black text-[#00ff99] font-mono mt-1">
                      {adminUsersList.filter(u => u.botConfig?.token).length}
                    </p>
                  </div>
                  <div className="bg-[#11121a] p-5 rounded-xl border border-gray-800/80">
                    <p className="text-xs text-gray-500 uppercase tracking-wider font-semibold">Total Global Subscribers</p>
                    <p className="text-3xl font-black text-yellow-500 font-mono mt-1">
                      {adminUsersList.reduce((sum, u) => sum + (u.subscribers || []).length, 0)}
                    </p>
                  </div>
                </div>

                {/* Capture Success Rate & API Health Monitor Widget */}
                <div className="bg-[#0e0f16] border border-gray-800 rounded-2xl p-6 shadow-xl space-y-6">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-gray-800/60 pb-4">
                    <div className="flex items-center gap-2.5">
                      <div className="h-10 w-10 bg-[#00ff99]/10 rounded-xl flex items-center justify-center text-[#00ff99] border border-[#00ff99]/20 shadow-inner">
                        <Cpu className="h-5 w-5 animate-pulse" />
                      </div>
                      <div>
                        <h3 className="text-sm font-black text-white uppercase tracking-wider">SMS Ingestion & API Telemetry Monitor</h3>
                        <p className="text-[11px] text-gray-400">Real-time health status, endpoints configurations, and credential verification of the 4 background target APIs</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 flex-wrap">
                      {backendPollingPaused ? (
                        <span className="text-xs bg-amber-500/10 text-amber-500 border border-amber-500/20 px-3.5 py-1.5 rounded-xl font-bold font-mono uppercase tracking-wider flex items-center gap-1.5 shadow-lg shadow-amber-950/25">
                          ⏸️ Pollers Paused
                        </span>
                      ) : (
                        <span className="text-xs bg-[#00ff99]/10 text-[#00ff99] border border-[#00ff99]/20 px-3.5 py-1.5 rounded-xl font-bold font-mono uppercase tracking-wider flex items-center gap-1.5 shadow-lg shadow-green-950/25">
                          <span className="h-2 w-2 rounded-full bg-[#00ff99] animate-ping"></span>
                          Active Pollers (2s)
                        </span>
                      )}
                      <button
                        onClick={toggleBackendPolling}
                        className={`px-3.5 py-1.5 text-xs font-bold rounded-xl border transition-all flex items-center gap-1.5 cursor-pointer ${
                          backendPollingPaused
                            ? "bg-[#00ff99] text-black border-[#00ff99] hover:opacity-90"
                            : "bg-red-950/30 text-red-400 border-red-900/30 hover:bg-red-900/20"
                        }`}
                      >
                        {backendPollingPaused ? "▶️ Resume All Pollers" : "⏸️ Pause All Pollers"}
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 xl:grid-cols-4 lg:grid-cols-2 gap-5">
                    {apiStats ? (
                      Object.entries(apiStats).map(([label, info]: any) => {
                        const total = info.success + info.fail;
                        const rate = total > 0 ? ((info.success / total) * 100).toFixed(1) : "100.0";
                        const isOffline = info.lastStatus === "Offline";

                        // Map URLs and tokens for pristine UI display
                        const apiMeta: { [key: string]: { url: string; token: string; format: string } } = {
                          "API 1": {
                            url: "http://147.135.212.197/crapi/st/viewstats",
                            token: "SE5XREZBUzRfTpVnX2dQh3NQcYB2dZBWQ4JpXVxmblp2alCDi25oZg==",
                            format: "Sender, Number, Message, Date"
                          },
                          "API 2": {
                            url: "http://147.135.212.197/crapi/st/viewstats",
                            token: "RVdWRElBUzRGcW9WeneNcmd2cGV9ZJd8e29PVlyPcFxeamxSgWVXfw==",
                            format: "Sender, Number, Message, Date"
                          },
                          "API 3": {
                            url: "https://pscall.net/restapi/smsreport",
                            token: "SFNYSj1SS16DgYdyf4KIgA==",
                            format: "pscall {result, data:[...]}"
                          },
                          "API 4": {
                            url: "http://147.135.212.197/crapi/time/viewstats",
                            token: "RldRNEVBYIFbkYpaY19udX53hX1DZnZhiI9iRkGEjGGFdXZKfmw",
                            format: "Sender, Number, Message, Date"
                          }
                        };

                        const meta = apiMeta[label] || { url: "N/A", token: "N/A", format: "N/A" };
                        const shortToken = meta.token !== "N/A" ? `${meta.token.substring(0, 10)}...${meta.token.substring(meta.token.length - 8)}` : "N/A";

                        return (
                          <div key={label} className="bg-[#11121a] rounded-xl p-5 border border-gray-800/80 space-y-4 relative overflow-hidden flex flex-col justify-between shadow-md hover:border-gray-700/80 transition-all duration-300">
                            <div className="space-y-3">
                              <div className="flex items-center justify-between">
                                <span className="text-xs font-black text-gray-200 tracking-wider uppercase font-mono">{label}</span>
                                <span className={`text-[9px] font-black uppercase tracking-widest px-2.5 py-0.5 rounded border font-mono ${
                                  isOffline 
                                    ? "bg-red-500/10 text-red-400 border-red-500/20" 
                                    : "bg-[#00ff99]/10 text-[#00ff99] border-[#00ff99]/20"
                                }`}>
                                  {info.lastStatus}
                                </span>
                              </div>

                              {/* Endpoint Metadata */}
                              <div className="bg-black/40 border border-gray-800/60 rounded-lg p-2.5 space-y-1.5 text-[10px] font-mono leading-tight">
                                <div className="truncate text-gray-400" title={meta.url}>
                                  <span className="text-gray-600 font-bold">URL:</span> {meta.url}
                                </div>
                                <div className="flex items-center justify-between gap-1 text-gray-400">
                                  <span className="truncate" title={meta.token}>
                                    <span className="text-gray-600 font-bold">KEY:</span> {shortToken}
                                  </span>
                                  <button
                                    onClick={() => {
                                      navigator.clipboard.writeText(meta.token);
                                      setCopyToast("Copied API Token!");
                                      setTimeout(() => setCopyToast(null), 2500);
                                    }}
                                    className="hover:text-white transition p-0.5"
                                    title="Copy API Token"
                                  >
                                    <Copy className="h-3 w-3" />
                                  </button>
                                </div>
                                <div className="text-yellow-600/90 text-[9px] truncate">
                                  <span className="text-gray-600 font-bold">FMT:</span> {meta.format}
                                </div>
                              </div>

                              <div className="space-y-1.5">
                                <div className="flex items-end justify-between">
                                  <span className="text-2xl font-black text-white font-mono">{rate}%</span>
                                  <span className="text-[10px] text-gray-500 font-mono">Success Rate</span>
                                </div>
                                {/* Progress Bar */}
                                <div className="w-full bg-gray-950 h-1.5 rounded-full overflow-hidden border border-gray-900">
                                  <div 
                                    className={`h-full transition-all duration-500 ${isOffline ? "bg-red-500/80" : "bg-gradient-to-r from-emerald-500 to-[#00ff99]"}`}
                                    style={{ width: `${rate}%` }}
                                  ></div>
                                </div>
                              </div>
                            </div>

                            <div className="border-t border-gray-800/50 pt-3 mt-1 space-y-2">
                              <div className="grid grid-cols-2 gap-1 text-[10px] font-mono text-gray-500">
                                <div>
                                  Ingested: <span className="text-white font-bold">{info.success}</span>
                                </div>
                                <div>
                                  Failed: <span className="text-red-400 font-bold">{info.fail}</span>
                                </div>
                              </div>

                              {info.lastError && (
                                <p className="text-[9px] text-red-400 bg-red-950/10 px-2 py-1 rounded font-mono truncate border border-red-500/10" title={info.lastError}>
                                  Error: {info.lastError}
                                </p>
                              )}
                            </div>
                          </div>
                        );
                      })
                    ) : (
                      <div className="col-span-4 text-center text-gray-500 text-xs py-4 font-mono">
                        Loading API Poller telemetry stats...
                      </div>
                    )}
                  </div>

                  {/* Background APIs Health Monitor Table */}
                  <div className="bg-[#11121a] rounded-xl border border-gray-800/80 p-5 space-y-4">
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-gray-800/60 pb-4">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="h-2 w-2 rounded-full bg-[#00ff99] animate-pulse"></span>
                          <h4 className="text-xs font-bold text-gray-200 uppercase tracking-wider font-mono">Team Zero System APIs Health Monitor</h4>
                        </div>
                        <p className="text-[11px] text-gray-500 font-sans">
                          Real-time success rates and online statuses of all background SMS/number integration nodes.
                        </p>
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        {/* Search input */}
                        <div className="relative">
                          <input
                            type="text"
                            placeholder="Search API..."
                            value={bgSearch}
                            onChange={(e) => setBgSearch(e.target.value)}
                            className="bg-black/50 border border-gray-800 rounded-lg px-3 py-1 text-xs text-white placeholder-gray-600 focus:outline-none focus:border-gray-700 w-44 font-mono"
                          />
                        </div>
                        {/* Status Filter buttons */}
                        <div className="flex bg-black/40 border border-gray-800 rounded-lg p-0.5 font-mono text-[10px]">
                          {["ALL", "ONLINE", "OFFLINE"].map((f) => (
                            <button
                              key={f}
                              onClick={() => setBgFilter(f)}
                              className={`px-2.5 py-1 rounded-md transition font-bold ${
                                bgFilter === f
                                  ? "bg-gray-800 text-[#00ff99]"
                                  : "text-gray-400 hover:text-white"
                              }`}
                            >
                              {f}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>

                    <div className="overflow-x-auto max-h-[350px] overflow-y-auto custom-scrollbar">
                      <table className="w-full text-left border-collapse text-xs font-mono">
                        <thead>
                          <tr className="border-b border-gray-800/40 text-gray-500 text-[10px] uppercase tracking-wider bg-black/20">
                            <th className="py-2.5 px-4">Node Label</th>
                            <th className="py-2.5 px-4">API URL</th>
                            <th className="py-2.5 px-4">Status</th>
                            <th className="py-2.5 px-4 text-center">Success</th>
                            <th className="py-2.5 px-4 text-center">Fail</th>
                            <th className="py-2.5 px-4 text-center">Success Rate</th>
                            <th className="py-2.5 px-4 text-right">Last Success</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-900/50">
                          {backgroundApiStats ? (
                            (() => {
                              const filteredList = Object.entries(backgroundApiStats).filter(([label, info]: any) => {
                                const matchesSearch = label.toLowerCase().includes(bgSearch.toLowerCase()) || 
                                                      (info.url && info.url.toLowerCase().includes(bgSearch.toLowerCase()));
                                if (!matchesSearch) return false;
                                if (bgFilter === "ONLINE") return info.lastStatus === "Online";
                                if (bgFilter === "OFFLINE") return info.lastStatus === "Offline";
                                return true;
                              });

                              if (filteredList.length === 0) {
                                return (
                                  <tr>
                                    <td colSpan={7} className="text-center py-8 text-gray-500 text-xs">
                                      No matching background APIs found.
                                    </td>
                                  </tr>
                                );
                              }

                              return filteredList.map(([label, info]: any) => {
                                const total = info.success + info.fail;
                                const rate = total > 0 ? ((info.success / total) * 100).toFixed(1) : "100.0";
                                const isOffline = info.lastStatus === "Offline";
                                const isPending = info.lastStatus === "Pending";
                                const formattedTime = info.lastSuccessTime
                                  ? new Date(info.lastSuccessTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
                                  : "Never";

                                return (
                                  <tr key={label} className="hover:bg-gray-900/20 transition-colors duration-150">
                                    <td className="py-2 px-4 font-bold text-gray-200">{label}</td>
                                    <td className="py-2 px-4 text-gray-500 max-w-xs truncate" title={info.url}>
                                      {info.url}
                                    </td>
                                    <td className="py-2 px-4">
                                      <span className={`text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded border ${
                                        isOffline
                                          ? "bg-red-500/10 text-red-400 border-red-500/20"
                                          : isPending
                                          ? "bg-yellow-500/10 text-yellow-500 border-yellow-500/20"
                                          : "bg-[#00ff99]/10 text-[#00ff99] border-[#00ff99]/20"
                                      }`}>
                                        {info.lastStatus}
                                      </span>
                                    </td>
                                    <td className="py-2 px-4 text-center text-emerald-400 font-bold">{info.success}</td>
                                    <td className="py-2 px-4 text-center text-red-400 font-bold">{info.fail}</td>
                                    <td className="py-2 px-4 text-center">
                                      <div className="flex items-center justify-center gap-1.5">
                                        <span className={`font-bold ${isOffline ? "text-red-400" : "text-white"}`}>{rate}%</span>
                                        <div className="w-12 bg-gray-950 h-1 rounded-full overflow-hidden border border-gray-900/30 hidden sm:block">
                                          <div
                                            className={`h-full ${isOffline ? "bg-red-500" : "bg-[#00ff99]"}`}
                                            style={{ width: `${rate}%` }}
                                          ></div>
                                        </div>
                                      </div>
                                    </td>
                                    <td className="py-2 px-4 text-right text-gray-400 text-[10px]">{formattedTime}</td>
                                  </tr>
                                );
                              });
                            })()
                          ) : (
                            <tr>
                              <td colSpan={7} className="text-center py-8 text-gray-500 text-xs">
                                Polling telemetry stats in progress...
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* Target API Live Stream Ingestion Logs Panel */}
                  <div className="bg-[#11121a] rounded-xl border border-gray-800/80 p-5 space-y-3.5">
                    <div className="flex justify-between items-center border-b border-gray-800/60 pb-3">
                      <div className="flex items-center gap-2">
                        <span className="h-2 w-2 rounded-full bg-[#00ff99] animate-pulse"></span>
                        <h4 className="text-xs font-bold text-gray-200 uppercase tracking-wider font-mono">Live Target APIs Ingested Stream</h4>
                      </div>
                      <span className="text-[10px] bg-black/40 text-gray-400 px-2 py-0.5 rounded border border-gray-800 font-mono">
                        Showing last {targetApiSms.length} captures
                      </span>
                    </div>

                    {targetApiSms.length === 0 ? (
                      <div className="text-center py-12 border border-dashed border-gray-800/60 rounded-xl bg-black/20 text-xs text-gray-500 font-mono">
                        Waiting for new incoming captures. Background API pollers are running in real-time...
                      </div>
                    ) : (
                      <div className="space-y-2 max-h-[300px] overflow-y-auto pr-1">
                        {targetApiSms.map((sms: any, idx: number) => {
                          return (
                            <div key={idx} className="bg-black/30 hover:bg-black/50 border border-gray-800/60 p-3 rounded-xl flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs transition duration-200">
                              <div className="flex items-start md:items-center gap-2.5 flex-1 min-w-0">
                                <span className="bg-[#00ff99]/15 text-[#00ff99] border border-[#00ff99]/30 font-mono font-bold px-2 py-0.5 rounded text-[10px] shrink-0 uppercase tracking-wider">
                                  {sms.source}
                                </span>
                                <span className="text-gray-300 font-bold shrink-0 font-mono flex items-center gap-1 bg-gray-900 border border-gray-800 px-2 py-0.5 rounded-lg">
                                  {getFlag(sms.country)} {sms.number}
                                </span>
                                <p className="text-gray-400 truncate flex-1 leading-normal font-mono">
                                  {sms.message}
                                </p>
                              </div>
                              <span className="text-[10px] text-gray-500 font-mono shrink-0 bg-gray-900/60 border border-gray-800/40 px-2 py-0.5 rounded">
                                {new Date(sms.timestamp).toLocaleTimeString()}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>

                {/* Manual Numbers Management Section */}
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                  {/* Left Column: Add Numbers */}
                  <div className="lg:col-span-5 bg-[#0e0f16] border border-gray-800 rounded-2xl p-6 space-y-4 shadow-xl">
                    <h3 className="text-sm font-bold text-gray-300 uppercase tracking-wider flex items-center gap-2">
                      <PlusCircle className="h-4 w-4 text-[#00ff99]" />
                      Add Manual Numbers
                    </h3>
                    <p className="text-[11px] text-gray-500 leading-relaxed">
                      Add custom numbers directly to the active queue. Paste multiple numbers, separated by newlines or commas. They will automatically sync with all active Telegram Bots and the main dashboard panel.
                    </p>

                    <form onSubmit={handleAddAdminNumbers} className="space-y-4">
                      <div>
                        <label className="text-[10px] text-gray-400 uppercase font-semibold block">🌍 Country:</label>
                        <input
                          type="text"
                          required
                          placeholder="e.g. India, Venezuela, Pakistan"
                          value={adminCountry}
                          onChange={(e) => setAdminCountry(e.target.value)}
                          className="w-full bg-black border border-gray-800 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-[#00ff99] transition font-mono"
                        />
                      </div>

                      <div>
                        <label className="text-[10px] text-gray-400 uppercase font-semibold block">🖥️ Source Server / App:</label>
                        <input
                          type="text"
                          required
                          placeholder="e.g. Rednote, Imo, Telegram"
                          value={adminServer}
                          onChange={(e) => setAdminServer(e.target.value)}
                          className="w-full bg-black border border-gray-800 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-[#00ff99] transition font-mono"
                        />
                      </div>

                      <div>
                        <label className="text-[10px] text-gray-400 uppercase font-semibold block">📱 Phone Numbers List:</label>
                        <textarea
                          rows={6}
                          required
                          placeholder="Paste numbers here (one per line or separated by commas)...&#10;e.g.&#10;+919876543210&#10;+918765432109"
                          value={adminNumbersText}
                          onChange={(e) => setAdminNumbersText(e.target.value)}
                          className="w-full bg-black border border-gray-800 rounded-xl p-3 text-xs focus:outline-none focus:border-[#00ff99] transition text-gray-200 font-mono resize-none leading-normal"
                        />
                      </div>

                      <button
                        type="submit"
                        disabled={addingNumbers}
                        className="w-full py-2.5 rounded-xl bg-gradient-to-r from-[#00ff99] to-[#008b45] hover:opacity-95 text-black font-bold text-xs transition"
                      >
                        {addingNumbers ? "Adding Numbers..." : "Save Numbers to Bot Queue"}
                      </button>
                    </form>
                  </div>

                  {/* Right Column: Inventory View */}
                  <div className="lg:col-span-7 bg-[#0e0f16] border border-gray-800 rounded-2xl p-6 space-y-4 shadow-xl flex flex-col justify-between">
                    <div>
                      <div className="flex justify-between items-center border-b border-gray-800/60 pb-3">
                        <h3 className="text-sm font-bold text-gray-300 uppercase tracking-wider flex items-center gap-2">
                          <Database className="h-4 w-4 text-[#00ff99]" />
                          Active Numbers Inventory ({adminNumbersList.length})
                        </h3>
                        <button
                          onClick={fetchAdminNumbers}
                          className="p-1 hover:bg-gray-800 rounded text-gray-400 hover:text-white transition"
                          title="Sync active inventory"
                        >
                          <RefreshCw className={`h-3.5 w-3.5 ${loadingAdminNumbers ? "animate-spin" : ""}`} />
                        </button>
                      </div>

                      {adminNumbersList.length === 0 ? (
                        <div className="text-center py-16 text-gray-500 text-xs border border-dashed border-gray-800 rounded-xl mt-4">
                          No manual numbers currently registered. Use the left form to inject fresh inventory!
                        </div>
                      ) : (
                        <div className="overflow-y-auto max-h-[360px] border border-gray-800/40 rounded-xl mt-4">
                          <table className="w-full text-left border-collapse text-xs">
                            <thead>
                              <tr className="border-b border-gray-800 bg-black/40 text-gray-400 font-semibold uppercase text-[10px] tracking-wider">
                                <th className="py-2.5 px-3">Phone Number</th>
                                <th className="py-2.5 px-3">Country</th>
                                <th className="py-2.5 px-3">Server</th>
                                <th className="py-2.5 px-3 text-center">Action</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-800/30">
                              {adminNumbersList.map((num: any, idx: number) => (
                                <tr key={num.id || `admin_num_${idx}_${num.number}`} className="hover:bg-black/20 font-mono">
                                  <td className="py-2 px-3 text-white font-bold">{num.number}</td>
                                  <td className="py-2 px-3 text-gray-300">
                                    <span className="mr-1">{getFlag(num.country)}</span>
                                    {num.country}
                                  </td>
                                  <td className="py-2 px-3 text-yellow-500 font-semibold">{num.server}</td>
                                  <td className="py-2 px-3 text-center">
                                    <button
                                      onClick={() => handleDeleteAdminNumber(num.id)}
                                      className="px-2 py-1 text-[10px] font-bold bg-red-950/40 text-red-400 border border-red-900/30 rounded hover:bg-red-900/20 transition"
                                    >
                                      Delete
                                    </button>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Manual SMS/OTP Injection Section */}
                <div className="bg-[#0e0f16] border border-gray-800 rounded-2xl p-6 space-y-4 shadow-xl">
                  <div className="flex justify-between items-center border-b border-gray-800/60 pb-3">
                    <h3 className="text-sm font-bold text-gray-300 uppercase tracking-wider flex items-center gap-2">
                      <PlusCircle className="h-4 w-4 text-[#00ff99]" />
                      Manual SMS / OTP Injector
                    </h3>
                    <button
                      type="button"
                      onClick={handleClearAdminSms}
                      className="px-2.5 py-1 text-[10px] font-bold bg-red-950/30 text-red-400 hover:bg-red-900/20 border border-red-900/30 rounded transition"
                    >
                      Clear OTP Logs
                    </button>
                  </div>
                  <p className="text-[11px] text-gray-500 leading-relaxed">
                    Instantly inject custom SMS OTP codes to any virtual number. This is useful for manual testing or manually pushing specific codes to active Telegram Bot group/channel targets and client-side streams.
                  </p>

                  <form onSubmit={handleInjectAdminSms} className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
                    <div>
                      <label className="text-[10px] text-gray-400 uppercase font-semibold block mb-1">📱 Phone Number:</label>
                      <input
                        type="text"
                        required
                        placeholder="e.g. +919876543210"
                        value={adminInjectNumber}
                        onChange={(e) => setAdminInjectNumber(e.target.value)}
                        className="w-full bg-black border border-gray-800 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-[#00ff99] transition font-mono text-white"
                      />
                    </div>

                    <div>
                      <label className="text-[10px] text-gray-400 uppercase font-semibold block mb-1">🌍 Country Name:</label>
                      <input
                        type="text"
                        placeholder="e.g. India (Optional)"
                        value={adminInjectCountry}
                        onChange={(e) => setAdminInjectCountry(e.target.value)}
                        className="w-full bg-black border border-gray-800 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-[#00ff99] transition font-mono text-white"
                      />
                    </div>

                    <div>
                      <label className="text-[10px] text-gray-400 uppercase font-semibold block mb-1">🖥️ Service / App:</label>
                      <input
                        type="text"
                        required
                        placeholder="e.g. Rednote, Telegram, Imo"
                        value={adminInjectServer}
                        onChange={(e) => setAdminInjectServer(e.target.value)}
                        className="w-full bg-black border border-gray-800 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-[#00ff99] transition font-mono text-white"
                      />
                    </div>

                    <div>
                      <button
                        type="submit"
                        disabled={injectingSms}
                        className="w-full py-2 px-4 rounded-xl bg-gradient-to-r from-[#00ff99] to-[#008b45] hover:opacity-95 text-black font-bold text-xs transition h-9 flex items-center justify-center gap-1.5"
                      >
                        {injectingSms ? "Injecting..." : "Inject OTP Code"}
                      </button>
                    </div>

                    <div className="md:col-span-4">
                      <label className="text-[10px] text-gray-400 uppercase font-semibold block mb-1">💬 Custom SMS Message Content:</label>
                      <input
                        type="text"
                        required
                        placeholder="e.g. Use code 543192 to verify your Rednote account."
                        value={adminInjectMessage}
                        onChange={(e) => setAdminInjectMessage(e.target.value)}
                        className="w-full bg-black border border-gray-800 rounded-xl px-3 py-2.5 text-xs focus:outline-none focus:border-[#00ff99] transition text-white"
                      />
                    </div>
                  </form>
                </div>

                {/* Table of User Account credentials & bot status */}
                <div className="bg-[#0e0f16] border border-gray-800 rounded-2xl shadow-xl overflow-hidden space-y-4 p-6">
                  <div className="flex justify-between items-center border-b border-gray-800 pb-4">
                    <h3 className="text-sm font-bold text-gray-300 uppercase tracking-wider flex items-center gap-2">
                      <Database className="h-4 w-4 text-[#00ff99]" />
                      User Registry Logs (Credentials &amp; Tokens)
                    </h3>
                    <button
                      onClick={fetchAdminUsers}
                      className="p-1.5 hover:bg-gray-800 rounded text-gray-400 hover:text-white transition"
                      title="Sync system database"
                    >
                      <RefreshCw className={`h-4 w-4 ${loadingAdminUsers ? "animate-spin" : ""}`} />
                    </button>
                  </div>

                  {adminUsersList.length === 0 ? (
                    <p className="text-xs text-gray-500 py-8 text-center font-mono">No users registered in database.</p>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="min-w-full divide-y divide-gray-800/40 text-xs">
                        <thead>
                          <tr className="bg-black/30">
                            <th className="px-4 py-2.5 text-left text-[10px] font-bold text-gray-400 uppercase">Username</th>
                            <th className="px-4 py-2.5 text-left text-[10px] font-bold text-gray-400 uppercase">Email / Contact</th>
                            <th className="px-4 py-2.5 text-left text-[10px] font-bold text-gray-400 uppercase">Password</th>
                            <th className="px-4 py-2.5 text-left text-[10px] font-bold text-gray-400 uppercase">Bot Token</th>
                            <th className="px-4 py-2.5 text-center text-[10px] font-bold text-gray-400 uppercase">Subscribers</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-800/30">
                          {adminUsersList.map((usr) => (
                            <tr key={usr.id} className="hover:bg-black/20 font-mono">
                              <td className="px-4 py-3 text-white font-bold">{usr.username}</td>
                              <td className="px-4 py-3 text-gray-300">{usr.email}</td>
                              <td className="px-4 py-3 text-yellow-500 select-all font-semibold">{usr.password || "N/A"}</td>
                              <td className="px-4 py-3 text-gray-400 select-all max-w-[200px] truncate" title={usr.botConfig?.token}>
                                {usr.botConfig?.token ? usr.botConfig.token : <span className="text-red-500 text-[10px]">No Token Set</span>}
                              </td>
                              <td className="px-4 py-3 text-center">
                                <span className="bg-[#00ff99]/10 text-[#00ff99] border border-[#00ff99]/20 font-bold px-2.5 py-0.5 rounded text-[10px]">
                                  {(usr.subscribers || []).length}
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>

                {/* WhatsApp OTP Forwarding Bot Guide and Architecture Section */}
                <div className="bg-[#0e0f16] border border-gray-800 rounded-2xl p-6 shadow-xl space-y-4">
                  <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
                    <Smartphone className="h-4 w-4 text-[#00ff99]" />
                    WhatsApp OTP Forwarding integration guide
                  </h3>
                  <div className="text-xs text-gray-300 space-y-3 leading-relaxed">
                    <p>
                      You asked: <strong>"Can I create a WhatsApp OTP forwarding bot, link my newsletters, and automate instant line-deletions?"</strong>
                    </p>
                    <div className="bg-black/40 border border-gray-800/80 rounded-xl p-4 space-y-2.5 font-mono">
                      <p className="text-[#00ff99] font-bold">🚀 YES, YOU CAN! HERE IS THE BLUEPRINT:</p>
                      <ul className="list-decimal list-inside space-y-2 text-gray-400">
                        <li>
                          <strong className="text-white">API Integration:</strong> Connect a virtual WhatsApp Cloud API account (via Twilio, Baileys, or official Meta Cloud API) to the backend of this panel.
                        </li>
                        <li>
                          <strong className="text-white">Newsletter Sync:</strong> Embed your custom newsletter trigger hooks so that when a subscriber launches or joins the newsletter, a WhatsApp message with their unique generated OTP is sent to your registered target group.
                        </li>
                        <li>
                          <strong className="text-white">Auto-Delete Mechanism:</strong> We have already built-in a secure auto-deletion system. Once a virtual number is claimed or generated on the website panel or Telegram bot, it is marked as claimed in <code className="text-[#00ff99]">db.json</code>, filtered out of active pools, and completely deleted from subsequent sessions so that it cannot be shown or reused again!
                        </li>
                      </ul>
                    </div>
                  </div>
                </div>

                {/* Admin Global Broadcast Button */}
                <div className="bg-[#0e0f16] border border-gray-800 rounded-2xl p-6 shadow-xl space-y-4">
                  <div className="flex items-center gap-2">
                    <Bell className="h-5 w-5 text-red-500 animate-bounce" />
                    <div>
                      <h3 className="text-sm font-bold text-white uppercase tracking-wider">Mass Global Broadcast Announcement</h3>
                      <p className="text-xs text-gray-400">Push an announcement message to every subscriber across all bots simultaneously!</p>
                    </div>
                  </div>

                  <form onSubmit={handleAdminGlobalBroadcast} className="space-y-4">
                    <textarea
                      rows={3}
                      required
                      placeholder="Write your announcement message here. It will instantly loop through every bot token and message all users..."
                      value={adminBroadcastMessage}
                      onChange={(e) => setAdminBroadcastMessage(e.target.value)}
                      className="w-full bg-black border border-gray-800 rounded-xl p-3 text-xs focus:outline-none focus:border-red-500 transition text-gray-200 font-mono resize-none"
                    />

                    <button
                      type="submit"
                      disabled={adminBroadcastLoading || !adminBroadcastMessage.trim() || adminUsersList.length === 0}
                      className="w-full py-2.5 rounded-xl bg-gradient-to-r from-red-600 to-red-800 hover:opacity-95 text-white font-bold text-xs transition flex items-center justify-center gap-2"
                    >
                      <Send className="h-4 w-4" />
                      <span>{adminBroadcastLoading ? "Broadcasting globally..." : "Broadcast Globally Across All Bots"}</span>
                    </button>

                    {adminBroadcastStatus && (
                      <p className="text-xs font-mono font-semibold text-center text-yellow-500 mt-2 bg-yellow-950/10 p-2.5 rounded-lg border border-yellow-900/20">
                        {adminBroadcastStatus}
                      </p>
                    )}
                  </form>
                </div>

              </div>
            )}
          </motion.div>
        )}

      </div>

      {/* Floating notifications toast */}
      <AnimatePresence>
        {copyToast && (
          <motion.div
            initial={{ opacity: 0, y: 40, x: "-50%" }}
            animate={{ opacity: 1, y: 0, x: "-50%" }}
            exit={{ opacity: 0, y: 10, x: "-50%" }}
            className="fixed bottom-8 left-1/2 -translate-x-1/2 z-50 bg-[#00ff99] text-black px-6 py-3 rounded-xl font-bold text-xs shadow-2xl shadow-[#00ff99]/20 border border-[#00ff99]/40 flex items-center gap-2 whitespace-nowrap"
          >
            <Check className="h-4 w-4" />
            <span>{copyToast}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Gemini SMS Intelligence Scan Modal */}
      <AnimatePresence>
        {selectedSmsForAnalysis !== null && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-[#0e0f16] border border-gray-800 rounded-2xl max-w-lg w-full overflow-hidden shadow-2xl relative"
            >
              
              <div className="border-b border-gray-800/40 p-4 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 rounded-lg bg-[#00ff99]/10 text-[#00ff99] border border-[#00ff99]/20">
                    <Cpu className="h-4 w-4" />
                  </div>
                  <h3 className="text-sm font-bold text-white">Gemini SMS Security Intelligence</h3>
                </div>
                <button
                  onClick={() => setSelectedSmsForAnalysis(null)}
                  className="text-gray-400 hover:text-white transition p-1 rounded-lg"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
                <div className="space-y-1.5">
                  <p className="text-[10px] text-gray-500 uppercase tracking-widest font-bold">Original Message:</p>
                  <blockquote className="p-3.5 rounded-xl bg-black border border-gray-800 text-xs font-mono text-gray-300 select-text">
                    {selectedSmsForAnalysis}
                  </blockquote>
                </div>

                <div className="space-y-1.5 border-t border-gray-800/40 pt-4">
                  <p className="text-[10px] text-[#00ff99] uppercase tracking-widest font-bold">Intelligence Scan Report:</p>
                  
                  {analyzingSms ? (
                    <div className="py-8 text-center flex flex-col items-center gap-2">
                      <RefreshCw className="h-6 w-6 animate-spin text-[#00ff99]" />
                      <span className="text-xs text-gray-500 font-mono">Analyzing credentials security context...</span>
                    </div>
                  ) : aiAnalysis ? (
                    <div className="bg-black/30 border border-gray-800 rounded-xl p-4 text-xs leading-relaxed space-y-2 text-gray-300 font-mono select-text">
                      {aiAnalysis.split("\n").map((line, i) => (
                        <p key={i}>{line}</p>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-gray-500">Security scan returned empty.</p>
                  )}
                </div>
              </div>

              <div className="border-t border-gray-800/40 p-4 bg-black/40 flex justify-end">
                <button
                  onClick={() => setSelectedSmsForAnalysis(null)}
                  className="px-4 py-2 rounded-xl bg-gray-800 hover:bg-gray-700 transition text-xs font-bold text-white"
                >
                  Dismiss Scan
                </button>
              </div>

            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Footer copyright */}
      <footer className="text-center text-xs text-gray-600 border-t border-gray-800/30 pt-8 mt-12 space-y-2">
        <p>⚡ Powered by <span className="text-[#00ff99] font-bold">𝗧𝗘𝗔𝗠 𝗭𝗘𝗥𝗢 𝗖𝗢𝗡𝗦𝗢𝗟𝗘</span> &bull; All APIs aggregated</p>
        <p className="text-[10px]">Support Telegram: t.me/teamzerotrace | Official Channel: whatsapp.com</p>
      </footer>

    </div>
  );
}
