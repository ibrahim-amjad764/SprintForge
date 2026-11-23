import MainLayout from '@/components/layout/MainLayout';
import ProfileContent from '@/components/profile/ProfileContent';

export default function ProfilePage() {
  return (
    <MainLayout>
      <div>
        <p className="font-mono text-xs font-medium uppercase tracking-[0.2em] text-primary">
          Account
        </p>
        <h1 className="mt-1 text-2xl font-bold tracking-tight sm:text-3xl">Profile</h1>
        <p className="mt-1.5 text-sm text-muted-foreground">
          Your account information and preferences.
        </p>
        <div className="mt-6">
          <ProfileContent />
        </div>
      </div>
    </MainLayout>
  );
}
