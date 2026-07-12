export interface NumberInfo {
  number: string;
  raw?: string;
  e164?: string;
  country: string;
  source: string;
}

export interface SmsInfo {
  timestamp: string;
  number: string;
  service: string;
  message: string;
  country: string;
  source: string;
}

export interface BotConfig {
  token: string;
  groupId: string;
  ownerChatId: string;
  botLink?: string;
  otpGroupUrl?: string;
  status?: 'active' | 'offline';
  // Custom Telegram OTP buttons
  btn1Text?: string;
  btn1Url?: string;
  btn2Text?: string;
  btn2Url?: string;
  btn3Text?: string;
  btn3Url?: string;
  // WhatsApp OTP Bot Config
  whatsappEnabled?: boolean;
  whatsappNewsletter?: string;
  whatsappNumberChannel?: string;
  whatsappMainChannel?: string;
  whatsappPoweredBy?: string;
  whatsappPhone?: string;
  whatsappStatus?: 'active' | 'offline';
}

export interface Subscriber {
  chatId: number;
  username?: string;
  firstName?: string;
  registeredAt: string;
  numbers?: { number: string; country: string; registeredAt: string; messageId?: number }[];
}

export interface UserAccount {
  id: string;
  username: string;
  email: string;
  password?: string; // Only returned if authenticated or to super-admin
  botConfig: BotConfig;
  subscribers: Subscriber[];
  createdAt?: string;
  expiryDate?: string;
}

export interface PanelStats {
  totalNumbers: number;
  countryBreakdown: { [key: string]: number };
}
