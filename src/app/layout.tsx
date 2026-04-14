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
        <meta http-equiv="Cache-Control" content="no-cache, no-store, must-revalidate" />
        <meta http-equiv="Pragma" content="no-cache" />
        <meta http-equiv="Expires" content="0" />
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){
              // === NUCLEAR CACHE-BUST v6 ===
              var BUILD_ID="mq-build-v7";
              // 0. Check if user has stale cached page — force reload
              var prevBuild=localStorage.getItem('mq-build-id');
              if(prevBuild && prevBuild!==BUILD_ID){
                // Stale build detected! Nuke everything and force fresh load
                try{localStorage.clear()}catch(e){}
                try{sessionStorage.clear()}catch(e){}
                window.location.replace(window.location.pathname+'?_fresh='+Date.now());
                return; // stop execution
              }
              localStorage.setItem('mq-build-id',BUILD_ID);
              // 1. Clear ALL mq/zustand keys from any old format
              try{
                var keysToRemove=[];
                for(var i=0;i<localStorage.length;i++){
                  var k=localStorage.key(i);
                  if(k && (k.indexOf('mq-store')>=0 || k.indexOf('mq-player-store')>=0 || k.indexOf('zustand')>=0)){
                    keysToRemove.push(k);
                  }
                }
                for(var j=0;j<keysToRemove.length;j++){
                  try{localStorage.removeItem(keysToRemove[j])}catch(x){}
                }
              }catch(e){}
              // 2. Clear sessionStorage
              try{sessionStorage.clear()}catch(e){}
              // 3. Unregister ALL service workers
              if(navigator.serviceWorker){
                navigator.serviceWorker.getRegistrations().then(function(regs){
                  regs.forEach(function(r){r.unregister()});
                });
              }
              // 4. Clear Cache API
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
