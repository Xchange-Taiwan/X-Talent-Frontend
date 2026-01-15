// import { useEffect, useState } from 'react';

// import { fetchUserById } from '@/services/profile/user';
// import { UserDTO  } from '@/services/profile/user';

// const useUserData = (userId: number, language: string) => {

//   const [isLoading, setIsLoading] = useState(false);
//   const [error, setError] = useState<string | null>(null);

//   const loadUserData = async () => {
//     setIsLoading(true);
//     setError(null);

//     try {
//       const userData: UserDTO  = await fetchUserById(userId, language);

//     } catch (err) {
//       console.error('Failed to fetch countries:', err);
//       setError('Failed to load location options');
//     } finally {
//       setIsLoading(false);
//     }
//   };

//   useEffect(() => {
//     loadUserData();
//   }, []);

//   return { , isLoading, error };
// };

// export default useUserData;
