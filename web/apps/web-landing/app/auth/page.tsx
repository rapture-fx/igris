'use client';

import { AuthWrapper } from '../../src/components/AuthWrapper';
import AuthForm from '../../src/components/auth/AuthForm';

export default function AuthPage() {
  return (
    <AuthWrapper>
      <AuthForm />
    </AuthWrapper>
  );
}