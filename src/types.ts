/**
 * SMSTunnel MCP Server - Type Definitions
 */

// API Response wrapper
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  statusCode?: number;
}

// Send SMS
export interface SendSmsRequest {
  to: string;
  message: string;
  deviceId?: string;
  is2FA?: boolean;
}

export interface SendSmsResponse {
  messageId: string;
  branded: boolean;
  remaining: {
    clean: number | string;
    total: number | string;
  };
}

// Bulk SMS
export interface SendBulkSmsRequest {
  to: string[];
  message: string;
  deviceId?: string;
}

export interface SendBulkSmsResponse {
  messageIds: string[];
  branded: boolean;
  count: number;
  remaining: {
    clean: number | string;
    total: number | string;
  };
}

// Message Status
export interface MessageStatus {
  id: string;
  phoneNumber: string;
  status: 'pending' | 'sent' | 'delivered' | 'failed';
  sentAt?: string;
  deliveredAt?: string;
  errorMessage?: string;
}

// Account Usage
export interface AccountUsage {
  plan: 'free' | 'standard' | 'pro';
  usage: {
    smsClean: number;
    smsBranded: number;
    twoFaClean: number;
  };
  limits: {
    smsClean: number | string;
    twoFaClean: number | string;
  };
  remaining: {
    smsClean: number | string;
    twoFaClean: number | string;
  };
}

// Device
export interface Device {
  id: string;
  name: string;
  isOnline: boolean;
  lastSeenAt?: string;
}

export interface DevicesResponse {
  devices: Device[];
  online: number;
  total: number;
}

// Tool input schemas
export interface SendSmsInput {
  to: string;
  message: string;
  deviceId?: string;
}

export interface SendBulkSmsInput {
  to: string[];
  message: string;
  deviceId?: string;
}

export interface CheckStatusInput {
  messageId: string;
}
