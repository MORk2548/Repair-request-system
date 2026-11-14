import type { MetadataRoute } from 'next';

// iPhone shows web push only for a site added to the Home Screen as an app, which needs display: standalone
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'ระบบแจ้งซ่อม',
    short_name: 'แจ้งซ่อม',
    start_url: '/tickets',
    display: 'standalone',
    background_color: '#f3f7fd',
    theme_color: '#12346f',
    icons: [{ src: '/icon.svg', sizes: 'any', type: 'image/svg+xml' }],
  };
}
