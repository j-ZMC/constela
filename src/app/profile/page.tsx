import { PageSky } from "@/components/page-sky";
import { ProfileHub } from "@/components/profile/profile-hub";

export default function ProfilePage() {
  return (
    <main className="flex flex-col">
      <PageSky width="max-w-3xl">
        <h1 id="profile-heading" className="text-3xl font-bold tracking-tight text-balance sm:text-4xl">Your profile</h1>
        <p className="text-pretty text-white/80">What helps you, what to watch for in a job, and your CV. It stays on this device.</p>
      </PageSky>
      <div className="mx-auto w-full max-w-3xl px-4 py-8">
        <ProfileHub />
      </div>
    </main>
  );
}
