import './globals.css';
import type { Metadata } from 'next';
import { Shell } from '@/components/site-shell';
import { MissionLoader } from '@/components/mission-loader';

export const metadata: Metadata = {
  title: 'MISSION UNIFORM OP | Free Exam Preparation',
  description:
    'Free Odisha Police and government exam preparation in Hindi, Odia and English.',
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
        <StudentPresenceTracker />
        <Shell>{children}</Shell>
      </body>
    </html>
  );
}