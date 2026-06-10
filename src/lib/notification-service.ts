/**
 * NotificationService — subscribes to the EventHub and inserts a notification
 * row into the `notifications` table for every notification-related event.
 *
 * This module registers its handler as a side-effect when imported, so it must
 * be imported at least once at app startup (e.g. from event-hub.ts or a layout).
 */

import type { EventHub } from './event-hub';
import { supabase } from './supabase';
import type { AppEvent } from './event-types';

// ─── Mapping: AppEvent → notifications table columns ────────────────────────

interface NotificationPayload {
  recipient_id: string;
  actor_id: string;
  type: string;
  post_id?: string | null;
  comment_id?: string | null;
  story_id?: string | null;
  story_comment_id?: string | null;
  body?: string | null;
}

function mapEventToPayload(event: AppEvent): NotificationPayload {
  const base: NotificationPayload = {
    recipient_id: event.recipientId,
    actor_id: event.actorId,
    type: event.type,
  };

  const meta = event.meta;

  switch (event.type) {
    case 'post_like':
      base.post_id = event.entityId;
      break;

    case 'post_comment':
      base.post_id = event.entityId;
      base.comment_id = meta?.commentId ?? null;
      break;

    case 'comment_reply':
      base.post_id = event.entityId;
      base.comment_id = meta?.commentId ?? null;
      break;

    case 'comment_like':
      base.post_id = event.entityId;
      base.comment_id = meta?.commentId ?? null;
      break;

    case 'post_repost':
      base.post_id = event.entityId;
      break;

    case 'new_follower':
      // No entity FK — just actor → recipient
      break;

    case 'story_comment':
      base.story_id = event.entityId;       // story_id is the primary entity
      base.story_comment_id = meta?.commentId ?? null;
      break;

    case 'story_rating':
      base.story_id = event.entityId;
      break;
  }

  // Use a content snippet for the notification body if provided
  if (meta?.contentSnippet) {
    base.body = meta.contentSnippet.length > 200
      ? meta.contentSnippet.slice(0, 197) + '...'
      : meta.contentSnippet;
  }

  return base;
}

// ─── Handler ────────────────────────────────────────────────────────────────

async function handleNotificationEvent(event: AppEvent): Promise<void> {
  // Never notify users about their own actions
  if (event.actorId === event.recipientId) return;

  const payload = mapEventToPayload(event);

  const { error } = await supabase
    .from('notifications')
    .insert(payload);

  if (error) {
    console.error('[NotificationService] failed to insert notification:', error, payload);
  }
}

// ─── Registration (called from event-hub.ts after the singleton is created) ─

export function register(eventHub: EventHub): void {
    eventHub.on('*', handleNotificationEvent);
}
