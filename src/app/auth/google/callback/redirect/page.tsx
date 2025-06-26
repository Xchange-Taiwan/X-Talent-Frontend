'use client';

// import {userRouter} from 'next/navigation';
import { useSearchParams } from 'next/navigation';
import { signIn } from 'next-auth/react';
import { useEffect, useState } from 'react';

import { useToast } from '@/components/ui/use-toast';

export default function Page() {
  const searchParams = useSearchParams();
  // const router = useRouter();
  const { toast } = useToast();

  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const code = searchParams.get('code');
    const state = searchParams.get('state');

    console.log('Extracted code:', code);
    console.log('Extracted state:', state);

    if (!code || !state) {
      toast({
        variant: 'destructive',
        title: 'Missing Google OAuth parameters',
        description: 'Authorization failed. Please try again.',
      });
      // router.push('/auth/signin'); // temporarily disabled
      return;
    }

    const handleGoogleOAuth = async () => {
      try {
        console.log('Sending request to backend with code and state...');

        const response = await fetch(
          `${process.env.NEXT_PUBLIC_API_URL}/v2/oauth/google/callback`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ code, state }),
          },
        );

        console.log('Backend response status:', response.status);

        if (!response.ok) {
          const errorText = await response.text();
          console.error('Backend error response:', errorText);
          throw new Error('Failed to exchange Google token');
        }

        const data = await response.json();
        console.log('Backend returned data:', data);

        // Optional: Use returned token with next-auth
        const signInResponse = await signIn('credentials', {
          redirect: false,
          accessToken: data.accessToken,
        });

        console.log('signIn result:', signInResponse);

        toast({
          title: 'Login successful!',
        });

        // router.push('/dashboard'); // temporarily disabled
      } catch (error) {
        console.error('OAuth error:', error);
        toast({
          variant: 'destructive',
          title: 'Login failed',
          description: 'Something went wrong during login.',
        });
        // router.push('/auth/signin'); // temporarily disabled
      } finally {
        setLoading(false);
      }
    };

    handleGoogleOAuth();
  }, [searchParams]);

  return (
    <div>
      {loading
        ? 'Signing you in with Google...'
        : 'Done. Check the console logs.'}
    </div>
  );
}
