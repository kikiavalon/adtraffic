import { describe, it, expect } from 'vitest';
import { parseQuickReplies, generateConversationId } from '../utils/chat-utils.js';

describe('parseQuickReplies', () => {
  it('returns empty options for plain text with no list', () => {
    const result = parseQuickReplies('Hello, how can I help you today?');
    expect(result.options).toEqual([]);
    expect(result.cleanContent).toBe('Hello, how can I help you today?');
  });

  it('returns empty options for a single-item list (< 2 items needed)', () => {
    const result = parseQuickReplies('Here is one option:\n1. Only one');
    expect(result.options).toEqual([]);
  });

  it('parses a numbered list into options', () => {
    const content = 'Choose an option:\n1. Create a campaign\n2. List advertisers\n3. Generate tags';
    const result = parseQuickReplies(content);
    expect(result.options).toHaveLength(3);
    expect(result.options[0]!.label).toBe('Create a campaign');
    expect(result.options[1]!.label).toBe('List advertisers');
    expect(result.options[2]!.label).toBe('Generate tags');
  });

  it('parses a bulleted list with dash markers', () => {
    const content = 'Options:\n- Option A\n- Option B';
    const result = parseQuickReplies(content);
    expect(result.options).toHaveLength(2);
    expect(result.options[0]!.label).toBe('Option A');
    expect(result.options[1]!.label).toBe('Option B');
  });

  it('parses a bulleted list with asterisk markers', () => {
    const content = 'Options:\n* First\n* Second';
    const result = parseQuickReplies(content);
    expect(result.options).toHaveLength(2);
    expect(result.options[0]!.label).toBe('First');
  });

  it('strips the list from cleanContent', () => {
    const content = 'Here is some context.\n\n1. Alpha\n2. Beta';
    const result = parseQuickReplies(content);
    expect(result.cleanContent).toBe('Here is some context.');
    expect(result.options).toHaveLength(2);
  });

  it('detects "something else" as open-ended', () => {
    const content = 'Pick one:\n1. Campaign A\n2. Something else';
    const result = parseQuickReplies(content);
    expect(result.options[0]!.isOpenEnded).toBe(false);
    expect(result.options[1]!.isOpenEnded).toBe(true);
  });

  it('detects "other" as open-ended', () => {
    const content = 'Choose:\n1. Option 1\n2. Other';
    const result = parseQuickReplies(content);
    expect(result.options[1]!.isOpenEnded).toBe(true);
  });

  it('detects "none of the above" as open-ended', () => {
    const content = 'Choose:\n1. A\n2. None of the above';
    const result = parseQuickReplies(content);
    expect(result.options[1]!.isOpenEnded).toBe(true);
  });

  it('detects "none of these" as open-ended', () => {
    const content = 'Choose:\n1. A\n2. None of these';
    const result = parseQuickReplies(content);
    expect(result.options[1]!.isOpenEnded).toBe(true);
  });

  it('detects "tell me more" as open-ended', () => {
    const content = 'Options:\n1. Proceed\n2. Tell me more';
    const result = parseQuickReplies(content);
    expect(result.options[1]!.isOpenEnded).toBe(true);
  });

  it('marks non-open-ended items correctly', () => {
    const content = 'Which:\n1. Create campaign\n2. List placements';
    const result = parseQuickReplies(content);
    expect(result.options[0]!.isOpenEnded).toBe(false);
    expect(result.options[1]!.isOpenEnded).toBe(false);
  });

  it('handles blank lines between content and list', () => {
    const content = 'Some text here.\n\n\n1. First option\n2. Second option';
    const result = parseQuickReplies(content);
    expect(result.options).toHaveLength(2);
    expect(result.cleanContent).toBe('Some text here.');
  });

  it('handles mixed list with some open-ended and some not', () => {
    const content = 'What would you like?\n1. View campaigns\n2. Create placement\n3. Something else';
    const result = parseQuickReplies(content);
    expect(result.options).toHaveLength(3);
    expect(result.options[0]!.isOpenEnded).toBe(false);
    expect(result.options[1]!.isOpenEnded).toBe(false);
    expect(result.options[2]!.isOpenEnded).toBe(true);
  });

  it('returns original content when list is in the middle (not trailing)', () => {
    const content = 'Here is a list:\n1. Item A\n2. Item B\n\nAnd some more text after.';
    const result = parseQuickReplies(content);
    // The list is not trailing, so no quick replies
    expect(result.options).toEqual([]);
    expect(result.cleanContent).toBe(content);
  });
});

describe('generateConversationId', () => {
  it('returns a string starting with "conv-"', () => {
    const id = generateConversationId();
    expect(id).toMatch(/^conv-/);
  });

  it('contains a UUID format after the prefix', () => {
    const id = generateConversationId();
    const uuid = id.replace('conv-', '');
    expect(uuid).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
  });

  it('returns unique values on successive calls', () => {
    const id1 = generateConversationId();
    const id2 = generateConversationId();
    expect(id1).not.toBe(id2);
  });

  it('uses crypto.randomUUID internally', () => {
    const id = generateConversationId();
    // Our mock generates deterministic UUIDs
    expect(id).toBe('conv-00000000-0000-4000-8000-000000000001');
  });
});
