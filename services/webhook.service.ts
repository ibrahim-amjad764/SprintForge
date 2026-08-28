// services/webhook.service.ts
import Organization from '@/models/Organization';
import Workspace from '@/models/Workspace';

export interface WebhookEvent {
  eventType: string;
  eventData: any;
  timestamp: Date;
  workspaceId?: string;
  organizationId?: string;
}

export interface WebhookEndpoint {
  url: string;
  events: string[];
  secret: string;
  active: boolean;
}

// Dispatch webhook event to organization endpoints
export async function dispatchWebhookEvent(params: {
  eventType: string;
  eventData: any;
  workspaceId?: string;
  organizationId?: string;
}): Promise<{ success: boolean; failures: string[] }> {
  const { eventType, eventData, workspaceId, organizationId } = params;
  
  const failures: string[] = [];
  let endpoints: WebhookEndpoint[] = [];

  // Get endpoints from organization if specified
  if (organizationId) {
    const org = await Organization.findById(organizationId);
    if (org?.webhookEndpoints) {
      endpoints = org.webhookEndpoints.filter(ep => ep.active && ep.events.includes(eventType));
    }
  }

  // Also get endpoints from workspace if specified
  if (workspaceId) {
    const workspace = await Workspace.findById(workspaceId).populate('organization');
    if (workspace?.organization && (workspace.organization as any).webhookEndpoints) {
      const orgEndpoints = (workspace.organization as any).webhookEndpoints.filter(
        (ep: WebhookEndpoint) => ep.active && ep.events.includes(eventType)
      );
      endpoints = [...endpoints, ...orgEndpoints];
    }
  }

  const eventPayload: WebhookEvent = {
    eventType,
    eventData,
    timestamp: new Date(),
    workspaceId,
    organizationId,
  };

  // Dispatch to all matching endpoints
  for (const endpoint of endpoints) {
    try {
      await sendWebhook(endpoint.url, endpoint.secret, eventPayload);
    } catch (error) {
      console.error(`Webhook delivery failed to ${endpoint.url}:`, error);
      failures.push(endpoint.url);
    }
  }

  return {
    success: failures.length === 0,
    failures,
  };
}

// Send webhook to a single endpoint
async function sendWebhook(url: string, secret: string, payload: WebhookEvent): Promise<void> {
  const signature = generateSignature(payload, secret);

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Webhook-Signature': signature,
      'X-Webhook-Timestamp': payload.timestamp.toISOString(),
      'X-Webhook-Event': payload.eventType,
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error(`Webhook returned status ${response.status}`);
  }
}

// Generate HMAC signature for webhook
function generateSignature(payload: any, secret: string): string {
  const crypto = require('crypto');
  const payloadString = JSON.stringify(payload);
  return crypto.createHmac('sha256', secret).update(payloadString).digest('hex');
}

// Specific event dispatchers
export async function dispatchWorkspaceCreatedEvent(workspaceData: any): Promise<void> {
  await dispatchWebhookEvent({
    eventType: 'workspace.created.v1',
    eventData: {
      workspaceId: workspaceData._id,
      name: workspaceData.name,
      slug: workspaceData.slug,
      owner: workspaceData.owner,
      createdAt: workspaceData.createdAt,
    },
    workspaceId: workspaceData._id,
    organizationId: workspaceData.organization,
  });
}

export async function dispatchWorkspaceDeletedEvent(workspaceId: string, organizationId?: string): Promise<void> {
  await dispatchWebhookEvent({
    eventType: 'workspace.deleted.v1',
    eventData: {
      workspaceId,
      deletedAt: new Date(),
    },
    workspaceId,
    organizationId,
  });
}

export async function dispatchMemberAddedEvent(workspaceId: string, userId: string, role: string): Promise<void> {
  const workspace = await Workspace.findById(workspaceId);
  await dispatchWebhookEvent({
    eventType: 'workspace.member_added.v1',
    eventData: {
      workspaceId,
      userId,
      role,
      addedAt: new Date(),
    },
    workspaceId,
    organizationId: workspace?.organization?.toString(),
  });
}

export async function dispatchMemberRemovedEvent(workspaceId: string, userId: string): Promise<void> {
  const workspace = await Workspace.findById(workspaceId);
  await dispatchWebhookEvent({
    eventType: 'workspace.member_removed.v1',
    eventData: {
      workspaceId,
      userId,
      removedAt: new Date(),
    },
    workspaceId,
    organizationId: workspace?.organization?.toString(),
  });
}

// Retry failed webhook deliveries
export async function retryFailedWebhooks(failedUrls: string[], payload: WebhookEvent): Promise<void> {
  const Organization = (await import('@/models/Organization')).default;
  const Workspace = (await import('@/models/Workspace')).default;

  for (const url of failedUrls) {
    // Find the endpoint with this URL
    const org = await Organization.findOne({ 'webhookEndpoints.url': url });
    const endpoint = org?.webhookEndpoints?.find((ep: WebhookEndpoint) => ep.url === url);

    if (endpoint) {
      try {
        await sendWebhook(url, endpoint.secret, payload);
      } catch (error) {
        console.error(`Retry failed for webhook ${url}:`, error);
      }
    }
  }
}
