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
              // === NUCLEAR CACHE-BUST ===
              // This script runs BEFORE React. It ensures no stale data can crash the app.
              
              // 1. Clear stale persisted store
              try{
                var d=localStorage.getItem("mq-player-store");
                if(d){
                  var p=JSON.parse(d);
                  var v=p&&p.version?p.version:0;
                  if(v<3){
                    localStorage.removeItem("mq-player-store");
                    // Force fresh page load after clearing stale data
                    window.location.replace(window.location.pathname+"?_f="+(Date.now()));
                    return;
                  }
                }
              }catch(e){
                try{localStorage.removeItem("mq-player-store")}catch(x){}
                window.location.replace(window.location.pathname+"?_f="+(Date.now()));
                return;
              }
              
              // 2. If we are running with a cache-bust param, clear ALL browser caches
              if(window.location.search.indexOf("_f=")>-1){
                try{sessionStorage.clear()}catch(e){}
                if(window.caches){
                  window.caches.keys().then(function(ks){
                    ks.forEach(function(k){window.caches.delete(k)});
                  });
                }
                // Clean up the URL (remove _f param) without creating a history entry
                var cleanUrl=window.location.pathname+window.location.hash;
                window.history.replaceState(null,"",cleanUrl);
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
