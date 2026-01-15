// import { useEffect, useState } from 'react';

// import { fetchUserById } from '@/services/profile/user';
// import { UserDTO  } from '@/services/profile/user';

// export interface UserType {
//   user_id: number;
//   name: string;
//   avatar: string;
//   job_title: string;
//   company: string;
//   years_of_experience: string;
//   location: string;
//   interested_positions: {
//     interests: InterestDTO[];
//     language: string | null;
//   };
//   skills: {
//     interests: InterestDTO[];
//     language: string | null;
//   };
//   topics: {
//     interests: InterestDTO[];
//     language: string | null;
//   };
//   industry: IndustryDTO;
//   onboarding: boolean;
//   is_mentor: boolean;
//   language: string;
//   personal_statement?: string;
//   about?: string;
//   seniority_level?: string;
//   expertises?: {
//     professions: ExpertiseType[];
//     language: string | null;
//   };
//   experiences?: ExperienceType[];
// }

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
