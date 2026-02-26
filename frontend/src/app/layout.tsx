import type { Metadata } from "next";
import { AuthProvider } from "@/context/AuthContext";
import { DM_Sans, JetBrains_Mono } from "next/font/google";
import "./globals.css";

// Configure DM Sans (Main UI Font)
const dmSans = DM_Sans({
  subsets: ["latin"],
  variable: "--font-dm-sans", // We will use this in Tailwind
});

// Configure JetBrains Mono (Code/Credentials Font)
const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-jetbrains-mono",
});

export const metadata: Metadata = {
  title: "Zuvo — Focus flows forward",
  description: "Invite-only task management platform",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="en"
      // Inject the font variables into the HTML tag
      className={`${dmSans.variable} ${jetbrainsMono.variable}`}
      suppressHydrationWarning
    >
      {/* We no longer need the <head> font links here! */}
      <body className="bg-background text-foreground font-sans antialiased transition-colors duration-200">
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
