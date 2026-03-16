import Image from 'next/image';
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
    <footer className="flex h-auto w-full bg-dark pb-[50px] md:h-[534px] xl:h-[290px]">
      <div className="flex w-full flex-col px-[70px] pt-[50px] xl:flex-row xl:items-start xl:justify-between">
        <Image src={logoImgUrl} className="h-[39px] w-[146px]" alt="logo" />

        <div className="mr-[150px] mt-[60px] flex flex-col gap-[58px] text-[#FFFFFF] md:flex-row md:gap-x-4 xl:mt-0 xl:flex-row">
          <div className="mr-[140px] flex flex-col ">
            <p className="mb-5 text-xl font-bold tracking-[0.085em]">
              相關連結
            </p>

            <div className="flex flex-col gap-3">
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

          <div className="flex flex-col">
            <p className="mb-5 text-xl font-bold tracking-[0.085em]">
              XChange 社群連結
            </p>

            <div className="flex flex-col gap-3">
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
