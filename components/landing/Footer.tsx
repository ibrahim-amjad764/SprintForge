// components/landing/Footer.tsx
import Link from 'next/link';

export default function Footer() {
  return (
    <footer className="mt-20 border-t p-5">
      <div className="mx-auto max-w-6xl flex justify-between items-center px-6">
        <p>© 2026 SprintForge</p>
        <div className="flex gap-6">
          <Link href="#" className="text-sm text-gray-600 hover:text-gray-900">
            Privacy Policy
          </Link>
          <Link href="#" className="text-sm text-gray-600 hover:text-gray-900">
            Terms of Service
          </Link>
        </div>
      </div>
    </footer>
  );
}
