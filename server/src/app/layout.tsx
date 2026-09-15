import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";

export const metadata: Metadata = {
  title: "Opinion Meter",
  description: "What people actually think of the thing you are about to click.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <head>
        {/* Google Sans, the face of Google's own pills, for the drawer; Arial stands in where it is not served. */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Google+Sans:wght@400;500;700&display=swap" />
      </head>
      <body>
        <div className="ground" aria-hidden="true" />
        {children}
      </body>
    </html>
  );
}
