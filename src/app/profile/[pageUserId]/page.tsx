import ProfilePageContainer from './container';

export default function Page({
  params: { pageUserId },
}: {
  params: { pageUserId: string };
}) {
  return <ProfilePageContainer pageUserId={pageUserId} />;
}
