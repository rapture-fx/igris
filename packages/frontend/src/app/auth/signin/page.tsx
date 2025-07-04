/**
 * Elegant Sign In Page
 */
import { Metadata } from 'next';
import { SignInForm } from '@/components/auth/SignInForm';
import { AuthLayout } from '@/components/auth/AuthLayout';

export const metadata: Metadata = {
  title: 'Sign In | Schlep-engine Platform',
  description: 'Sign in to your Schlep-engine Platform account',
};

export default function SignInPage() {
  return (
    <AuthLayout
      title="Welcome Back"
      subtitle="Sign in to your Schlep-engine account"
    >
      <SignInForm />
    </AuthLayout>
  );
} 