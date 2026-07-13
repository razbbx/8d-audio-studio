import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "8D Audio Converter",
  description:
    "Convert any MP3 to immersive 8D audio with auto-panning, reverb, and spatial widening. Processes entirely in your browser.",
};

import { ThemeProvider } from "@/components/theme-provider";

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full antialiased" suppressHydrationWarning>
      <body className="min-h-full transition-colors duration-300">
        <ThemeProvider
          attribute="class"
          defaultTheme="dark"
          enableSystem={false}
          disableTransitionOnChange={false}
        >
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}
