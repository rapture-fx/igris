/**
 * Elegant Sign Up Page
 */
import { Metadata } from 'next';
import { SignUpForm } from '@/components/auth/SignUpForm';
import { AuthLayout } from '@/components/auth/AuthLayout';

export const metadata: Metadata = {
  title: 'Sign Up | Igris-engine Platform',
  description: 'Create your Igris-engine Platform account',
};

export default function SignUpPage() {
  return (
    <AuthLayout
      title="Join Igris-engine"
      subtitle="Create your account and start transforming data"
    >
      <SignUpForm />
    </AuthLayout>
  );
} 