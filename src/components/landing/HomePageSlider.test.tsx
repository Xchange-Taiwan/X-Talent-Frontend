import { fireEvent, render, screen } from '@testing-library/react';
import React from 'react';
import { describe, expect, it, vi } from 'vitest';

import {
  defaultSliderAvatars,
  getSlideAvatar,
  SlideItem,
  sliderList,
} from './data';
import { HomePageSlider } from './HomePageSlider';

vi.mock('next/image', () => ({
  default: ({
    src,
    alt,
    className,
    onError,
  }: {
    src: string;
    alt: string;
    className?: string;
    onError?: React.ReactEventHandler<HTMLImageElement>;
  }) => (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src} alt={alt} className={className} onError={onError} />
  ),
}));

vi.mock('swiper/react', () => ({
  Swiper: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="swiper">{children}</div>
  ),
  SwiperSlide: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="swiper-slide">{children}</div>
  ),
}));

vi.mock('swiper/modules', () => ({
  Autoplay: {},
  Pagination: {},
}));

vi.mock('@/hooks/useWindowSize', () => ({
  default: () => ({ width: 1280, height: 800 }),
}));

describe('HomePageSlider & sliderList data', () => {
  it('contains 6 unique testimonials with distinct names and texts', () => {
    expect(sliderList).toHaveLength(6);

    const names = sliderList.map((item) => item.name);
    const texts = sliderList.map((item) => item.text);

    expect(new Set(names).size).toBe(6);
    expect(new Set(texts).size).toBe(6);
    expect(names).toEqual([
      'Carolina',
      'Leona',
      'Amy',
      'Stacy',
      'Tommy',
      'Roger',
    ]);

    for (const text of texts) {
      expect(text).not.toMatch(/謝謝XChange/);
      expect(text).toContain('XChange');
    }
  });

  it('preserves real person avatars when present and falls back to mock avatars otherwise', () => {
    expect(
      getSlideAvatar(
        { name: 'Carolina', avatar: '/landing/slider_carolina.webp' },
        0
      )
    ).toBe('/landing/slider_carolina.webp');

    expect(getSlideAvatar({ name: 'Pin-Hua Chen' }, 1)).toBe(
      '/landing/slider_pin_hua.webp'
    );

    expect(getSlideAvatar({ name: 'Leona' }, 1)).toBe(defaultSliderAvatars[1]);
    expect(getSlideAvatar({ name: 'Amy', avatar: '   ' }, 2)).toBe(
      defaultSliderAvatars[2]
    );
    expect(getSlideAvatar({ name: 'Roger' }, 5)).toBe(defaultSliderAvatars[5]);
  });

  it('renders all 6 testimonials with Carolina keeping her real avatar and others using fallback mock avatars', () => {
    render(<HomePageSlider />);

    expect(screen.getAllByTestId('swiper-slide')).toHaveLength(6);

    const carolinaImg = screen.getByAltText('avatar_Carolina');
    expect(carolinaImg).toHaveAttribute('src', '/landing/slider_carolina.webp');

    const leonaImg = screen.getByAltText('avatar_Leona');
    expect(leonaImg).toHaveAttribute('src', '/landing/slider_default_2.webp');

    const amyImg = screen.getByAltText('avatar_Amy');
    expect(amyImg).toHaveAttribute('src', '/landing/slider_default_3.webp');

    const stacyImg = screen.getByAltText('avatar_Stacy');
    expect(stacyImg).toHaveAttribute('src', '/landing/slider_default_4.webp');

    const tommyImg = screen.getByAltText('avatar_Tommy');
    expect(tommyImg).toHaveAttribute('src', '/landing/slider_default_5.webp');

    const rogerImg = screen.getByAltText('avatar_Roger');
    expect(rogerImg).toHaveAttribute('src', '/landing/slider_default_6.webp');
  });

  it('supports custom items with explicit and fallback avatars', () => {
    const customItems: SlideItem[] = [
      {
        name: 'Pin-Hua Chen',
        text: '自訂真實使用者推薦語',
        avatar: '/landing/slider_pin_hua.webp',
      },
      {
        name: 'Guest User',
        text: '無頭像時自動使用預設插畫頭像',
      },
    ];

    render(<HomePageSlider items={customItems} />);

    expect(screen.getByAltText('avatar_Pin-Hua Chen')).toHaveAttribute(
      'src',
      '/landing/slider_pin_hua.webp'
    );
    expect(screen.getByAltText('avatar_Guest User')).toHaveAttribute(
      'src',
      '/landing/slider_default_2.webp'
    );
  });

  it('falls back to mock avatar if an explicit avatar fails to load', () => {
    const customItems: SlideItem[] = [
      {
        name: 'Broken Avatar User',
        text: '當圖片載入失敗時應退回預設插畫頭像',
        avatar: '/landing/non_existent_avatar.webp',
      },
    ];

    render(<HomePageSlider items={customItems} />);

    const img = screen.getByAltText('avatar_Broken Avatar User');
    expect(img).toHaveAttribute('src', '/landing/non_existent_avatar.webp');

    fireEvent.error(img);

    expect(img).toHaveAttribute('src', '/landing/slider_default_1.webp');
  });
});
