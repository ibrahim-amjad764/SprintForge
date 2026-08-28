// app/layout.tsx


import type { Metadata } from 'next';
import './globals.css';

import { AuthProvider } from '@/context/AuthContext';
import { WorkspaceProvider } from '@/context/WorkspaceContext';
import { seo } from '@/lib/seo';

export const metadata: Metadata = {
  title: seo.title,
  description: seo.description,
  keywords: seo.keywords,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <AuthProvider>
          <WorkspaceProvider>{children}</WorkspaceProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
// import type { Metadata } from "next";
// import { Geist, Geist_Mono } from "next/font/google";
// import { AuthProvider } from "../context/AuthContext";
// import "./globals.css";

// const geistSans = Geist({
//   variable: "--font-geist-sans",
//   subsets: ["latin"],
// });

// const geistMono = Geist_Mono({
//   variable: "--font-geist-mono",
//   subsets: ["latin"],
// });

// export const metadata: Metadata = {
//   title: "SprintForge",
//   description: "Streamline your project management tasks efficiently with SprintForge.",
// };

// export default function RootLayout({
//   children,
// }: Readonly<{
//   children: React.ReactNode;
// }>) {
//   return (
//     <html
//       lang="en"
//       className={`${geistSans.variable} ${geistMono.variable} h-full antialiased bg-gray-100 text-gray-900`}
//     >
//       <body className="min-h-full flex flex-col">
//         <AuthProvider>
//           <header className="bg-white shadow-md p-4">
//             <nav>
//               <ul className="flex space-x-4">
//                 <li><a href="/" className="text-blue-600">Home</a></li>
//                 <li><a href="/tasks" className="text-blue-600">Tasks</a></li>
//                 <li><a href="/about" className="text-blue-600">About</a></li>
//               </ul>
//             </nav>
//           </header>
//           <main className="flex-1 container mx-auto p-4">{children}</main>
//           <footer className="bg-white shadow-inner p-4 text-center">
//             <p>© 2023 SprintForge. All rights reserved.</p>
//           </footer>
//         </AuthProvider>
//       </body>
//     </html>
//   );
// }
