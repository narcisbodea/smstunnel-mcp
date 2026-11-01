/**
 * SMSTunnel API Client
 */

import type {
  ApiResponse,
  SendSmsRequest,
  SendSmsResponse,
  SendBulkSmsRequest,
  SendBulkSmsResponse,
  MessageStatus,
  AccountUsage,
  DevicesResponse,
} from './types.js';

export class SMSTunnelClient {
  private apiKey: string;
  private baseUrl: string;

  constructor(apiKey: string, baseUrl: string = 'https://smstunnel.io/api/v1') {
    this.apiKey = apiKey;
    this.baseUrl = baseUrl;
  }

  private async request<T>(
    method: string,
    endpoint: string,
    body?: unknown
  ): Promise<ApiResponse<T>> {
    const url = `${this.baseUrl}${endpoint}`;

    try {
      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': this.apiKey,
        },
        body: body ? JSON.stringify(body) : undefined,
      });

      const data = await response.json();

      if (!response.ok) {
        return {
          success: false,
          error: data.error || `HTTP ${response.status}`,
          statusCode: response.status,
        };
      }

      return data as ApiResponse<T>;
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Network error',
      };
    }
  }

  /**
   * Send a single SMS
   */
  async sendSms(params: SendSmsRequest): Promise<ApiResponse<SendSmsResponse>> {
    return this.request<SendSmsResponse>('POST', '/sms/send', params);
  }

  /**
   * Send bulk SMS (up to 100 recipients)
   */
  async sendBulkSms(params: SendBulkSmsRequest): Promise<ApiResponse<SendBulkSmsResponse>> {
    return this.request<SendBulkSmsResponse>('POST', '/sms/send-bulk', params);
  }

  /**
   * Check SMS delivery status
   */
  async getMessageStatus(messageId: string): Promise<ApiResponse<MessageStatus>> {
    return this.request<MessageStatus>('GET', `/sms/status/${encodeURIComponent(messageId)}`);
  }

  /**
   * Get account usage and remaining quota
   */
  async getUsage(): Promise<ApiResponse<AccountUsage>> {
    return this.request<AccountUsage>('GET', '/account/usage');
  }

  /**
   * List available devices
   */
  async getDevices(): Promise<ApiResponse<DevicesResponse>> {
    return this.request<DevicesResponse>('GET', '/devices');
  }
}
