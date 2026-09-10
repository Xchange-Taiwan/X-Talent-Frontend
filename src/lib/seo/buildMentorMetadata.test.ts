import { fromPartial } from '@total-typescript/shoehorn';
import { describe, expect, it } from 'vitest';

import { buildMentorMetadata } from './buildMentorMetadata';
import type { PublicMentorProfile } from './sanitizePublicProfile';

describe('buildMentorMetadata', () => {
  it('should generate complete SEO metadata for a valid mentor profile', () => {
    const profile = fromPartial<PublicMentorProfile>({
      userId: 123,
      name: '張華恩',
      avatar: 'https://example.com/avatar.jpg',
      jobTitle: '資深前端工程師',
      company: '技術核心科技',
      about: '這是一個完整的導師簡介，提供前端開發技術與職涯諮詢。',
      isMentor: true,
    });

    const metadata = buildMentorMetadata(profile);

    expect(metadata.title).toBe('張華恩 - 導師專業背景');
    expect(metadata.description).toBe(
      '這是一個完整的導師簡介，提供前端開發技術與職涯諮詢。'
    );
    expect(metadata.alternates).toEqual({ canonical: '/profile/123' });
    expect(metadata.openGraph).toEqual({
      type: 'profile',
      title: '張華恩',
      description: '這是一個完整的導師簡介，提供前端開發技術與職涯諮詢。',
      url: '/profile/123',
      images: [{ url: 'https://example.com/avatar.jpg' }],
    });
    expect(metadata.twitter).toEqual({
      card: 'summary_large_image',
      title: '張華恩',
      description: '這是一個完整的導師簡介，提供前端開發技術與職涯諮詢。',
      images: ['https://example.com/avatar.jpg'],
    });
  });

  it('should fallback correctly when name is missing', () => {
    const profile = fromPartial<PublicMentorProfile>({
      userId: 123,
      name: '',
      isMentor: true,
      about: '簡介',
    });

    const metadata = buildMentorMetadata(profile);

    expect(metadata.title).toBe('XChange Talent Pool');
    expect(metadata.description).toBe('簡介');
    expect(metadata.robots).toEqual({ index: false, follow: false });
  });

  it('should handle profiles where isMentor is false', () => {
    const profile = fromPartial<PublicMentorProfile>({
      userId: 123,
      name: '張華恩',
      isMentor: false,
      about: '我不是導師，但我是一位開發者。',
    });

    const metadata = buildMentorMetadata(profile);

    expect(metadata.title).toBe('張華恩');
    expect(metadata.description).toBe('我不是導師，但我是一位開發者。');
    expect(metadata.robots).toEqual({ index: false, follow: false });
    expect(metadata.openGraph).toBeUndefined();
  });

  it('should avoid empty or "null" text fallbacks when avatar, bio, or jobTitle are missing', () => {
    // Case 1: Missing avatar
    const profileNoAvatar = fromPartial<PublicMentorProfile>({
      userId: 123,
      name: '林小明',
      avatar: null,
      jobTitle: '產品經理',
      company: '創新公司',
      about: '林小明的簡介。',
      isMentor: true,
    });
    const metaNoAvatar = buildMentorMetadata(profileNoAvatar);
    expect(metaNoAvatar.openGraph?.images).toEqual([]);
    expect(metaNoAvatar.twitter?.images).toEqual([]);

    // Case 2: Missing bio (about) but having jobTitle and company
    const profileNoBio = fromPartial<PublicMentorProfile>({
      userId: 123,
      name: '王大同',
      avatar: 'https://example.com/avatar.jpg',
      jobTitle: '設計師',
      company: '美學設計',
      about: '',
      isMentor: true,
    });
    const metaNoBio = buildMentorMetadata(profileNoBio);
    expect(metaNoBio.description).toBe(
      '王大同｜設計師 @ 美學設計 查看導師資歷與預約方式'
    );

    // Case 3: Missing bio, missing company but having jobTitle
    const profileNoCompany = fromPartial<PublicMentorProfile>({
      userId: 123,
      name: '李四',
      avatar: null,
      jobTitle: '架構師',
      company: '',
      about: '',
      isMentor: true,
    });
    const metaNoCompany = buildMentorMetadata(profileNoCompany);
    expect(metaNoCompany.description).toBe(
      '李四｜架構師 查看導師資歷與預約方式'
    );

    // Case 4: Missing bio, missing jobTitle but having company
    const profileNoJobTitle = fromPartial<PublicMentorProfile>({
      userId: 123,
      name: '李四',
      avatar: null,
      jobTitle: '',
      company: '技術部',
      about: '',
      isMentor: true,
    });
    const metaNoJobTitle = buildMentorMetadata(profileNoJobTitle);
    expect(metaNoJobTitle.description).toBe(
      '李四｜@ 技術部 查看導師資歷與預約方式'
    );

    // Case 5: Missing bio, missing jobTitle, missing company
    const profileIncomplete = fromPartial<PublicMentorProfile>({
      userId: 123,
      name: '李四',
      avatar: null,
      jobTitle: '',
      company: '',
      about: '',
      isMentor: true,
    });
    const metaIncomplete = buildMentorMetadata(profileIncomplete);
    expect(metaIncomplete.description).toBe('查看 李四 的導師資歷與預約方式');

    // Case 6: Missing everything
    const profileEmpty = fromPartial<PublicMentorProfile>({
      userId: 123,
      name: '',
      avatar: null,
      jobTitle: '',
      company: '',
      about: '',
      isMentor: true,
    });
    const metaEmpty = buildMentorMetadata(profileEmpty);
    expect(metaEmpty.description).toBe(
      '查看 XChange Talent Pool 導師資歷與預約方式'
    );
  });

  describe('bio truncation and markdown stripping', () => {
    it('should strip markdown tags correctly', () => {
      const profile = fromPartial<PublicMentorProfile>({
        userId: 123,
        name: '張華恩',
        about:
          '# 標題\n**粗體** 與 *斜體* 以及 [連結](https://example.com)還有 ![圖片](https://example.com/img.png) `代碼` <p>HTML段落</p>',
        isMentor: true,
      });
      const metadata = buildMentorMetadata(profile);
      expect(metadata.description).toBe(
        '標題 粗體 與 斜體 以及 連結還有 圖片 代碼 HTML段落'
      );
    });

    it('should not truncate bios that are shorter than 160 characters', () => {
      const bio = '這是一個長度適中的簡介。共三十字。';
      const profile = fromPartial<PublicMentorProfile>({
        userId: 123,
        name: '張華恩',
        about: bio,
        isMentor: true,
      });
      const metadata = buildMentorMetadata(profile);
      expect(metadata.description).toBe(bio);
    });

    it('should truncate overly long bios and prefer breaking at sentence/phrase boundaries if within range', () => {
      // Create a bio > 160 characters with a Chinese period (。) at index 120
      const padding = '這是填充文字'.repeat(20); // 120 characters
      const bioWithBoundary =
        padding +
        '。後面還有非常多的文字總長度一定會超過一百六十個字所以我們要在這一個句號後面做截斷否則會破壞單字的完整性。';

      const profile = fromPartial<PublicMentorProfile>({
        userId: 123,
        name: '張華恩',
        about: bioWithBoundary,
        isMentor: true,
      });

      const metadata = buildMentorMetadata(profile);
      expect(metadata.description?.endsWith('…')).toBe(true);
      // It should cut right after the boundary (index 120 + 1 = 121)
      expect(metadata.description?.length).toBe(122); // 121 chars + '…' (which is 1 char)
      expect(metadata.description?.slice(-2)).toBe('。…');
    });

    it('should fallback to hard truncation at max length if no boundary is found in the upper 40% of the slice', () => {
      // 170 characters of pure text with no boundary characters at all
      const pureText = '一'.repeat(170);
      const profile = fromPartial<PublicMentorProfile>({
        userId: 123,
        name: '張華恩',
        about: pureText,
        isMentor: true,
      });

      const metadata = buildMentorMetadata(profile);
      expect(metadata.description).toBe('一'.repeat(160) + '…');
    });
  });
});
