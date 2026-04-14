import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "MQ Player — Музыкальный плеер",
  description: "MQ Player — современный музыкальный плеер с зашифрованным мессенджером, таймером сна и кастомизацией",
  keywords: ["MQ Player", "music", "player", "мессенджер", "шифрование"],
  authors: [{ name: "MQ Player Team" }],
  icons: {
    icon: "/favicon.ico",
  },
};

// Force this page to never be cached by CDN / browser
export const revalidate = 0;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ru" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){
              // === NUCLEAR CACHE-BUST v4 ===
              // This script runs BEFORE React. Kills ALL old store keys.
              var oldKeys=["mq-player-store","mq-store-v4","mq-store"];
              var cleared=false;
              try{
                for(var i=0;i<oldKeys.length;i++){
                  try{localStorage.removeItem(oldKeys[i])}catch(x){}
                }
                cleared=true;
              }catch(e){}
              // Also clear sessionStorage and Cache API
              try{sessionStorage.clear()}catch(e){}
              if(window.caches){
                window.caches.keys().then(function(ks){
                  ks.forEach(function(k){window.caches.delete(k)});
                });
              }
            })()`,
          }}
        />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
        style={{ backgroundColor: "var(--mq-bg, #0e0e0e)" }}
      >
        {children}
        <Toaster />
      </body>
    </html>
  );
}
