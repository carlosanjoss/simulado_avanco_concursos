import { SignUp } from '@clerk/nextjs';

export default function SignUpPage() {
  return (
    <main className="min-h-screen bg-background flex items-center justify-center p-4">
      <SignUp />
    </main>
  );
}
