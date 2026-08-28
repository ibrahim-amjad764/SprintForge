import MainLayout from '@/components/layout/MainLayout';
import ProfileContent from '@/components/profile/ProfileContent';

export default function ProfilePage() {
  return (
    <MainLayout>
      <div>
        <h1 className="mb-8 text-3xl font-bold">Profile</h1>
        <ProfileContent />
      </div>
    </MainLayout>
  );
}
