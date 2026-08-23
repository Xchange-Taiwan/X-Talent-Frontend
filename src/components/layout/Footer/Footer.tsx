import Image from 'next/image';
import Link from 'next/link';
import { FC } from 'react';

import logoImgUrl from './assets/logo.png';

type FooterLink = {
  label: string;
  href: string;
};

type FooterLinksConfig = {
  relatedLinks: FooterLink[];
  socialLinks: FooterLink[];
};

const LEGAL_LINKS: FooterLink[] = [
  { label: '隱私權政策', href: '/privacy' },
  { label: '服務條款', href: '/terms' },
];

const FOOTER_LINKS: FooterLinksConfig = {
  relatedLinks: [
    { label: 'XChange Website', href: 'https://xchange.com.tw/' },
    {
      label: 'X-IMPACT Podcast',
      href: 'https://podcasts.apple.com/us/podcast/x-impact/id1514930493?l=zh-Hant-TW',
    },
    { label: 'XChange Medium', href: 'https://xchange-taiwan.medium.com/' },
  ],
  socialLinks: [
    {
      label: 'Facebook 粉絲專頁',
      href: 'https://www.facebook.com/XChange.tw/?locale=zh_TW',
    },
    {
      label: 'Instagram 商業檔案',
      href: 'https://www.instagram.com/xchange.tw/',
    },
  ],
};

export const Footer: FC = () => {
  return (
    <footer className="bg-dark flex w-full pb-[50px] md:min-h-[290px]">
      <div className="flex w-full flex-col items-center px-5 pt-[50px] md:flex-row md:items-start md:justify-between md:px-[70px]">
        <div className="flex flex-col items-center md:items-start">
          <Image
            src={logoImgUrl}
            alt="logo"
            sizes="146px"
            className="h-[39px] w-[146px]"
          />
        </div>

        <div className="text-text-white mt-8 flex flex-col gap-8 md:mt-0 md:flex-row md:gap-x-16">
          <div className="flex flex-col items-center md:items-start">
            <p className="mb-5 text-xl font-bold tracking-[0.085em]">關於</p>

            <div className="flex flex-col items-center gap-3 md:items-start">
              {LEGAL_LINKS.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className="block font-normal hover:underline"
                >
                  {link.label}
                </Link>
              ))}
            </div>
          </div>

          <div className="flex flex-col items-center md:items-start">
            <p className="mb-5 text-xl font-bold tracking-[0.085em]">
              相關連結
            </p>

            <div className="flex flex-col items-center gap-3 md:items-start">
              {FOOTER_LINKS.relatedLinks.map((link) => (
                <a
                  key={link.href}
                  href={link.href}
                  target="_blank"
                  rel="noreferrer"
                  className="block font-normal hover:underline"
                >
                  {link.label}
                </a>
              ))}
            </div>
          </div>

          <div className="flex flex-col items-center md:items-start">
            <p className="mb-5 text-xl font-bold tracking-[0.085em]">
              XChange 社群連結
            </p>

            <div className="flex flex-col items-center gap-3 md:items-start">
              {FOOTER_LINKS.socialLinks.map((link) => (
                <a
                  key={link.href}
                  href={link.href}
                  target="_blank"
                  rel="noreferrer"
                  className="block font-normal hover:underline"
                >
                  {link.label}
                </a>
              ))}
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
};
