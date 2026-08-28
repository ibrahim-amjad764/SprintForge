// app/sitemap.ts
import { MetadataRoute } from 'next';

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    {
      url: 'https://your-domain.com',

      lastModified: new Date(),
    },

    {
      url: 'https://your-domain.com/pricing',

      lastModified: new Date(),
    },
  ];
}
