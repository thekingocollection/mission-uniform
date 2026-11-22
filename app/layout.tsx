import './globals.css';
import type { Metadata } from 'next';
import { Shell } from '@/components/site-shell';
import { MissionLoader } from '@/components/mission-loader';

export const metadata: Metadata = {
  title: 'MISSION UNIFORM OP | Free Exam Preparation',
  description:
    'Free Odisha Police and government exam preparation in Hindi, Odia and English.',
  icons: { icon: '/mission-uniform-logo.png', shortcut: '/mission-uniform-logo.png', apple: '/mission-uniform-logo.png' },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <MissionLoader />
        <Shell>{children}</Shell>
      </body>
    </html>
  );
}