import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Sign in | Igris Inertial',
  description: 'Sign in or create an account to run governed actions with Igris.',
};

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return children;
}