import { revalidateProfilePathAfterDelete } from '@/actions/auth';
import { captureFlowFailure } from '@/lib/monitoring';

/**
 * Best-effort dispatch of the delete-account cache revalidation, shared by
 * both delete-account flows (email/password and Google reauth).
 *
 * Never throws: `revalidateProfilePathAfterDelete` is a Server Action call
 * over the network, so a blip or 5xx while dispatching it would otherwise
 * throw client-side. By the time this runs the account is already deleted
 * server-side, so a dispatch failure here must not block the `signOut`
 * that follows it — that would strand the user in a "deleted but still
 * logged in" state (or, in a caller with its own broader try/catch, get
 * swallowed by an unrelated generic error path).
 */
export async function dispatchDeleteAccountRevalidate(): Promise<void> {
  try {
    await revalidateProfilePathAfterDelete();
  } catch (e) {
    captureFlowFailure({
      flow: 'delete_account',
      step: 'revalidate_dispatch',
      message: e instanceof Error ? e.message : String(e),
      level: 'warning',
    });
  }
}
