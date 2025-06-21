/**
 * Elegant Sign Up Page
 */
import { Metadata } from 'next';
import { SignUpForm } from '@/components/auth/SignUpForm';
import { AuthLayout } from '@/components/auth/AuthLayout';

export const metadata: Metadata = {
  title: 'Sign Up | Pollarbase Platform',
  description: 'Create your Pollarbase Platform account',
};

export default function SignUpPage() {
  return (
    <AuthLayout
      title="Join Pollarbase"
      subtitle="Create your account and start transforming data"
    >
      <SignUpForm />
    </AuthLayout>
  );
} 