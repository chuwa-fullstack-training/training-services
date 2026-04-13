import { describe, it, expect } from 'bun:test';
import { canReadPost } from '../../src/lib/access';

const published = { published: true, authorId: 'user-1' };
const draft = { published: false, authorId: 'user-1' };

describe('canReadPost', () => {
  it('admin can read any post regardless of state', () => {
    expect(canReadPost(draft, 'anyone', 'ADMIN')).toBe(true);
    expect(canReadPost(published, null, 'ADMIN')).toBe(true);
    expect(canReadPost(draft, null, 'ADMIN')).toBe(true);
  });

  it('any user can read a published post', () => {
    expect(canReadPost(published, null, null)).toBe(true);
    expect(canReadPost(published, 'user-2', 'USER')).toBe(true);
    expect(canReadPost(published, undefined, undefined)).toBe(true);
  });

  it('the owner can read their own draft', () => {
    expect(canReadPost(draft, 'user-1', 'USER')).toBe(true);
  });

  it('non-owner cannot read a draft', () => {
    expect(canReadPost(draft, 'user-2', 'USER')).toBe(false);
    expect(canReadPost(draft, null, null)).toBe(false);
    expect(canReadPost(draft, undefined, undefined)).toBe(false);
  });
});
