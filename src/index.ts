#!/usr/bin/env node
/**
 * SMSTunnel MCP Server
 *
 * Allows AI assistants like Claude to send SMS via SMSTunnel
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  Tool,
} from '@modelcontextprotocol/sdk/types.js';

import { SMSTunnelClient } from './smstunnel-client.js';
import { validatePhone, validateMessage, sanitizeForLLM } from './validation.js';
import type { SendSmsInput, SendBulkSmsInput, CheckStatusInput } from './types.js';

function errorResult(text: string) {
  return { content: [{ type: 'text' as const, text }], isError: true };
}

// Get API key from environment — REQUIRED, no hardcoded fallback
const API_KEY = process.env.SMSTUNNEL_API_KEY;
const API_URL = process.env.SMSTUNNEL_API_URL || 'https://smstunnel.io/api/v1';

if (!API_KEY) {
  console.error('FATAL: SMSTUNNEL_API_KEY environment variable is required.');
  console.error('Set it in your MCP client config or .env before starting the server.');
  process.exit(1);
}

// Initialize client
const client = new SMSTunnelClient(API_KEY, API_URL);

// Define tools
const TOOLS: Tool[] = [
  {
    name: 'send_sms',
    description: 'Send an SMS message to a phone number. Use E.164 format for phone numbers (e.g., +40712345678).',
    inputSchema: {
      type: 'object',
      properties: {
        to: {
          type: 'string',
          description: 'Recipient phone number in E.164 format (e.g., +40712345678)',
        },
        message: {
          type: 'string',
          description: 'SMS message content (max 1600 characters for concatenated SMS)',
        },
        deviceId: {
          type: 'string',
          description: 'Optional: Specific device ID to send from. If not provided, uses the first available online device.',
        },
      },
      required: ['to', 'message'],
    },
  },
  {
    name: 'send_bulk_sms',
    description: 'Send the same SMS message to multiple recipients (up to 100 phone numbers).',
    inputSchema: {
      type: 'object',
      properties: {
        to: {
          type: 'array',
          items: { type: 'string' },
          description: 'Array of phone numbers in E.164 format (max 100 numbers)',
        },
        message: {
          type: 'string',
          description: 'SMS message content',
        },
        deviceId: {
          type: 'string',
          description: 'Optional: Specific device ID to send from',
        },
      },
      required: ['to', 'message'],
    },
  },
  {
    name: 'check_sms_status',
    description: 'Check the delivery status of a previously sent SMS message.',
    inputSchema: {
      type: 'object',
      properties: {
        messageId: {
          type: 'string',
          description: 'The message ID returned when the SMS was sent',
        },
      },
      required: ['messageId'],
    },
  },
  {
    name: 'get_usage',
    description: 'Get your current SMS usage statistics and remaining quota for today.',
    inputSchema: {
      type: 'object',
      properties: {},
    },
  },
  {
    name: 'list_devices',
    description: 'List all available SMS devices and their online status.',
    inputSchema: {
      type: 'object',
      properties: {},
    },
  },
];

// Create server
const server = new Server(
  {
    name: 'smstunnel',
    version: '1.0.0',
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// Handle list tools request
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return { tools: TOOLS };
});

// Handle tool calls
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    switch (name) {
      case 'send_sms': {
        const input = args as unknown as SendSmsInput;

        const phoneError = validatePhone(input.to);
        if (phoneError) return errorResult(phoneError);
        const msgError = validateMessage(input.message);
        if (msgError) return errorResult(msgError);

        const result = await client.sendSms({
          to: input.to,
          message: input.message,
          deviceId: input.deviceId,
        });

        if (!result.success) {
          return {
            content: [
              {
                type: 'text',
                text: `Failed to send SMS: ${result.error}`,
              },
            ],
            isError: true,
          };
        }

        return {
          content: [
            {
              type: 'text',
              text: `SMS sent successfully!\n\nMessage ID: ${sanitizeForLLM(result.data!.messageId)}\nBranded: ${result.data!.branded ? 'Yes' : 'No'}\nRemaining today: ${sanitizeForLLM(result.data!.remaining.clean)}`,
            },
          ],
        };
      }

      case 'send_bulk_sms': {
        const input = args as unknown as SendBulkSmsInput;

        if (!Array.isArray(input.to) || input.to.length === 0) {
          return errorResult('Error: "to" must be a non-empty array of phone numbers.');
        }
        if (input.to.length > 100) {
          return errorResult('Error: Maximum 100 recipients allowed per bulk request.');
        }
        for (const recipient of input.to) {
          const phoneError = validatePhone(recipient);
          if (phoneError) return errorResult(phoneError);
        }
        const msgError = validateMessage(input.message);
        if (msgError) return errorResult(msgError);

        const result = await client.sendBulkSms({
          to: input.to,
          message: input.message,
          deviceId: input.deviceId,
        });

        if (!result.success) {
          return {
            content: [
              {
                type: 'text',
                text: `Failed to send bulk SMS: ${result.error}`,
              },
            ],
            isError: true,
          };
        }

        return {
          content: [
            {
              type: 'text',
              text: `Bulk SMS sent successfully!\n\nMessages sent: ${sanitizeForLLM(result.data!.count)}\nMessage IDs: ${sanitizeForLLM(result.data!.messageIds.join(', '))}\nRemaining today: ${sanitizeForLLM(result.data!.remaining.clean)}`,
            },
          ],
        };
      }

      case 'check_sms_status': {
        const input = args as unknown as CheckStatusInput;
        const result = await client.getMessageStatus(input.messageId);

        if (!result.success) {
          return {
            content: [
              {
                type: 'text',
                text: `Failed to get status: ${result.error}`,
              },
            ],
            isError: true,
          };
        }

        const status = result.data!;
        let statusText = `Message Status: ${sanitizeForLLM(status.status).toUpperCase()}\n`;
        statusText += `Phone: ${sanitizeForLLM(status.phoneNumber)}\n`;
        if (status.sentAt) statusText += `Sent at: ${sanitizeForLLM(status.sentAt)}\n`;
        if (status.deliveredAt) statusText += `Delivered at: ${sanitizeForLLM(status.deliveredAt)}\n`;
        if (status.errorMessage) statusText += `Error: ${sanitizeForLLM(status.errorMessage)}`;

        return {
          content: [
            {
              type: 'text',
              text: statusText,
            },
          ],
        };
      }

      case 'get_usage': {
        const result = await client.getUsage();

        if (!result.success) {
          return {
            content: [
              {
                type: 'text',
                text: `Failed to get usage: ${result.error}`,
              },
            ],
            isError: true,
          };
        }

        const usage = result.data!;
        let usageText = `Account Usage\n`;
        usageText += `═══════════════════════════\n`;
        usageText += `Plan: ${sanitizeForLLM(usage.plan).toUpperCase()}\n\n`;
        usageText += `Today's Usage:\n`;
        usageText += `  • SMS sent: ${sanitizeForLLM(usage.usage.smsClean)}\n`;
        usageText += `  • 2FA sent: ${sanitizeForLLM(usage.usage.twoFaClean)}\n\n`;
        usageText += `Remaining:\n`;
        usageText += `  • SMS: ${sanitizeForLLM(usage.remaining.smsClean)}\n`;
        usageText += `  • 2FA: ${sanitizeForLLM(usage.remaining.twoFaClean)}`;

        return {
          content: [
            {
              type: 'text',
              text: usageText,
            },
          ],
        };
      }

      case 'list_devices': {
        const result = await client.getDevices();

        if (!result.success) {
          return {
            content: [
              {
                type: 'text',
                text: `Failed to list devices: ${result.error}`,
              },
            ],
            isError: true,
          };
        }

        const devices = result.data!;
        let devicesText = `Devices (${devices.online} online / ${devices.total} total)\n`;
        devicesText += `═══════════════════════════\n`;

        for (const device of devices.devices) {
          const status = device.isOnline ? '🟢' : '🔴';
          devicesText += `${status} ${sanitizeForLLM(device.name)}\n`;
          devicesText += `   ID: ${sanitizeForLLM(device.id)}\n`;
          if (device.lastSeenAt) {
            devicesText += `   Last seen: ${sanitizeForLLM(device.lastSeenAt)}\n`;
          }
        }

        if (devices.devices.length === 0) {
          devicesText += 'No devices registered.';
        }

        return {
          content: [
            {
              type: 'text',
              text: devicesText,
            },
          ],
        };
      }

      default:
        return {
          content: [
            {
              type: 'text',
              text: `Unknown tool: ${name}`,
            },
          ],
          isError: true,
        };
    }
  } catch (error) {
    return {
      content: [
        {
          type: 'text',
          text: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
        },
      ],
      isError: true,
    };
  }
});

// Start server
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('SMSTunnel MCP Server running on stdio');
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
