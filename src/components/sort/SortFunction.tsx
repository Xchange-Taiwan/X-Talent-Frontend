import { UserDTO } from '@/services/profile/user';
export type SortMethod = 'a-z' | 'z-a';

export function sortUsersByName(
  users: UserDTO[],
  method: SortMethod
): UserDTO[] {
  return [...users].sort((a, b) => {
    const nameA = a.name || '';
    const nameB = b.name || '';
    const compareResult = nameA.localeCompare(nameB, 'zh-Hant');

    if (method === 'a-z') {
      return compareResult;
    } else if (method === 'z-a') {
      return -compareResult;
    }

    return 0;
  });
}
