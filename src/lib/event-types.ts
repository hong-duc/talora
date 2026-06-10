/**
 * Event types — mirrors the public.notification_type ENUM in the database.
 * Kept identical so events map 1:1 to notification rows.
 */
export type EventType =
  | 'post_like'
  | 'post_comment'
  | 'comment_like'
  | 'comment_reply'
  | 'post_repost'
  | 'new_follower'
  | 'story_comment'
  | 'story_rating';

/**
 * Payload for every event fired by the EventHub after a successful use-case.
 *
 * @property type         — The kind of action that happened.
 * @property actorId      — Who performed the action (the person triggering the event).
 * @property recipientId  — Who should be notified (the target user).
 * @property entityId     — The primary related resource ID. Its meaning depends on type:
 *                          - post_like / post_comment / comment_reply / post_repost → post_id
 *                          - story_comment / story_rating → story_id
 * @property meta         — Optional extra fields used to fill notification columns
 *                          (e.g. comment_id, body snippet).
 */
export interface AppEvent {
  type: EventType;
  actorId: string;
  recipientId: string;
  entityId: string;
  meta?: {
    /** comment_id for comment_like, comment_reply, or the newly created comment */
    commentId?: string;
    /** story_id when entityId is a comment (for story_comment notifications) */
    storyId?: string;
    /** Used as the notification body text */
    contentSnippet?: string;
    /** When set, this is a reply (parent comment id) — used to distinguish reply from top-level */
    parentId?: string;
  };
}