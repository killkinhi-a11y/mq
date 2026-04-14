"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useAppStore } from "@/store/useAppStore";
import { Play, Pause, Music, X } from "lucide-react";

// Type declaration for Document Picture-in-Picture API
declare global {
  interface Window {
    documentPictureInPicture?: {
      requestWindow: (options?: {
        width?: number;
        height?: number;
      }) => Promise<Window>;
    };
  }
}

export default function PiPPlayer() {
  const {
    currentTrack, isPlaying, togglePlay, isPiPActive, setPiPActive,
    setFullTrackViewOpen, volume, progress, duration,
  } = useAppStore();

  const pipWindowRef = useRef<Window | null>(null);
  const cleanupRef = useRef<(() => void) | null>(null);

  const formatDuration = (seconds: number): string => {
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${s.toString().padStart(2, "0")}`;
  };

  // Close PiP window
  const closePiP = useCallback(() => {
    if (pipWindowRef.current) {
      try {
        pipWindowRef.current.close();
      } catch {
        // Window may already be closed
      }
      pipWindowRef.current = null;
    }
    if (cleanupRef.current) {
      cleanupRef.current();
      cleanupRef.current = null;
    }
    setPiPActive(false);
  }, [setPiPActive]);

  // Open PiP window using Document Picture-in-Picture API
  const openPiPWindow = useCallback(async () => {
    // Check if Document PiP API is available
    if (!window.documentPictureInPicture) {
      // Fallback: use regular popup window
      openFallbackPiP();
      return;
    }

    try {
      const pipWindow = await window.documentPictureInPicture.requestWindow({
        width: 340,
        height: 100,
      });

      pipWindowRef.current = pipWindow;

      // Style the PiP window
      const style = pipWindow.document.createElement("style");
      style.textContent = `
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          background: #1a1a2e;
          color: #fff;
          overflow: hidden;
          user-select: none;
        }
        .pip-container {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 10px 14px;
          height: 100vh;
        }
        .pip-cover {
          width: 56px;
          height: 56px;
          border-radius: 8px;
          object-fit: cover;
          cursor: pointer;
          flex-shrink: 0;
        }
        .pip-cover-placeholder {
          width: 56px;
          height: 56px;
          border-radius: 8px;
          background: rgba(255,0,80,0.3);
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
          cursor: pointer;
        }
        .pip-info {
          flex: 1;
          min-width: 0;
          cursor: pointer;
        }
        .pip-title {
          font-size: 13px;
          font-weight: 600;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .pip-artist {
          font-size: 11px;
          color: #888;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          margin-top: 2px;
        }
        .pip-controls {
          display: flex;
          align-items: center;
          gap: 6px;
          flex-shrink: 0;
        }
        .pip-btn {
          width: 32px;
          height: 32px;
          border-radius: 50%;
          border: none;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          color: white;
        }
        .pip-btn-play {
          background: #ff0050;
        }
        .pip-btn-close {
          background: rgba(255,255,255,0.1);
        }
        .pip-btn-close:hover {
          background: rgba(255,255,255,0.2);
        }
        .pip-progress {
          position: fixed;
          bottom: 0;
          left: 0;
          right: 0;
          height: 3px;
          background: rgba(255,255,255,0.1);
        }
        .pip-progress-bar {
          height: 100%;
          background: #ff0050;
          transition: width 0.3s linear;
        }
        .pip-time {
          position: fixed;
          bottom: 5px;
          right: 8px;
          font-size: 9px;
          color: #666;
        }
        .pip-badge {
          position: fixed;
          bottom: 5px;
          left: 8px;
          font-size: 9px;
          color: #4ade80;
        }
      `;
      pipWindow.document.head.appendChild(style);

      // Create the body content
      const renderPiPContent = () => {
        const state = useAppStore.getState();
        const track = state.currentTrack;
        const playing = state.isPlaying;
        const prog = state.progress;
        const dur = state.duration;

        pipWindow.document.body.innerHTML = "";

        const container = pipWindow.document.createElement("div");
        container.className = "pip-container";

        // Cover
        const coverDiv = pipWindow.document.createElement("div");
        coverDiv.className = track?.cover ? "" : "pip-cover-placeholder";
        if (track?.cover) {
          const img = pipWindow.document.createElement("img");
          img.className = "pip-cover";
          img.src = track.cover;
          img.alt = "";
          coverDiv.appendChild(img);
        } else {
          coverDiv.innerHTML = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg>`;
        }
        coverDiv.onclick = () => {
          // Click cover to expand (navigate main window)
          if (window.document.hidden) {
            window.focus();
          }
          setPiPActive(false);
          setFullTrackViewOpen(true);
        };
        container.appendChild(coverDiv);

        // Info
        const info = pipWindow.document.createElement("div");
        info.className = "pip-info";
        info.onclick = coverDiv.onclick;
        info.innerHTML = `
          <div class="pip-title">${track?.title || "Нет трека"}</div>
          <div class="pip-artist">${track?.artist || ""}</div>
        `;
        container.appendChild(info);

        // Controls
        const controls = pipWindow.document.createElement("div");
        controls.className = "pip-controls";

        const playBtn = pipWindow.document.createElement("button");
        playBtn.className = "pip-btn pip-btn-play";
        playBtn.innerHTML = playing
          ? `<svg width="14" height="14" viewBox="0 0 24 24" fill="white"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>`
          : `<svg width="14" height="14" viewBox="0 0 24 24" fill="white"><polygon points="5,3 19,12 5,21"/></svg>`;
        playBtn.onclick = (e) => {
          e.stopPropagation();
          useAppStore.getState().togglePlay();
        };
        controls.appendChild(playBtn);

        const closeBtn = pipWindow.document.createElement("button");
        closeBtn.className = "pip-btn pip-btn-close";
        closeBtn.innerHTML = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>`;
        closeBtn.onclick = (e) => {
          e.stopPropagation();
          closePiP();
        };
        controls.appendChild(closeBtn);

        container.appendChild(controls);
        pipWindow.document.body.appendChild(container);

        // Progress bar
        const progressContainer = pipWindow.document.createElement("div");
        progressContainer.className = "pip-progress";
        const progressBar = pipWindow.document.createElement("div");
        progressBar.className = "pip-progress-bar";
        const pct = dur > 0 ? (prog / dur) * 100 : 0;
        progressBar.style.width = `${pct}%`;
        progressContainer.appendChild(progressBar);
        pipWindow.document.body.appendChild(progressContainer);

        // Time
        const timeEl = pipWindow.document.createElement("div");
        timeEl.className = "pip-time";
        timeEl.textContent = `${formatDuration(prog)} / ${formatDuration(dur)}`;
        pipWindow.document.body.appendChild(timeEl);

        // Badge
        const badgeEl = pipWindow.document.createElement("div");
        badgeEl.className = "pip-badge";
        badgeEl.textContent = "\u25CF MQ Player";
        pipWindow.document.body.appendChild(badgeEl);
      };

      // Initial render
      renderPiPContent();

      // Subscribe to store changes and update PiP window
      const unsub = useAppStore.subscribe(() => {
        if (!pipWindowRef.current || pipWindowRef.current.closed) {
          unsub();
          setPiPActive(false);
          return;
        }
        renderPiPContent();
      });

      // Close handler
      pipWindow.addEventListener("pagehide", () => {
        unsub();
        pipWindowRef.current = null;
        setPiPActive(false);
      });

      cleanupRef.current = unsub;

    } catch (err) {
      console.warn("[PiP] Document PiP failed, falling back:", err);
      openFallbackPiP();
    }
  }, [closePiP, setPiPActive, setFullTrackViewOpen]);

  // Fallback: regular popup window
  const openFallbackPiP = useCallback(() => {
    const pipWin = window.open(
      "",
      "mq-pip",
      "width=340,height=100,left=100,top=100,toolbar=no,location=no,menubar=no,status=no"
    );

    if (!pipWin) {
      console.warn("[PiP] Popup blocked by browser");
      setPiPActive(false);
      return;
    }

    pipWindowRef.current = pipWin;

    const style = pipWin.document.createElement("style");
    style.textContent = `
      * { margin: 0; padding: 0; box-sizing: border-box; }
      body {
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        background: #1a1a2e;
        color: #fff;
        overflow: hidden;
        user-select: none;
      }
      .pip-container { display: flex; align-items: center; gap: 10px; padding: 10px 14px; height: 100vh; }
      .pip-cover { width: 56px; height: 56px; border-radius: 8px; object-fit: cover; cursor: pointer; flex-shrink: 0; }
      .pip-cover-placeholder { width: 56px; height: 56px; border-radius: 8px; background: rgba(255,0,80,0.3); display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
      .pip-info { flex: 1; min-width: 0; cursor: pointer; }
      .pip-title { font-size: 13px; font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
      .pip-artist { font-size: 11px; color: #888; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; margin-top: 2px; }
      .pip-controls { display: flex; align-items: center; gap: 6px; flex-shrink: 0; }
      .pip-btn { width: 32px; height: 32px; border-radius: 50%; border: none; cursor: pointer; display: flex; align-items: center; justify-content: center; color: white; }
      .pip-btn-play { background: #ff0050; }
      .pip-btn-close { background: rgba(255,255,255,0.1); }
      .pip-progress { position: fixed; bottom: 0; left: 0; right: 0; height: 3px; background: rgba(255,255,255,0.1); }
      .pip-progress-bar { height: 100%; background: #ff0050; transition: width 0.3s linear; }
      .pip-time { position: fixed; bottom: 5px; right: 8px; font-size: 9px; color: #666; }
      .pip-badge { position: fixed; bottom: 5px; left: 8px; font-size: 9px; color: #4ade80; }
    `;
    pipWin.document.head.appendChild(style);

    const renderPiPContent = () => {
      const state = useAppStore.getState();
      const track = state.currentTrack;
      const playing = state.isPlaying;
      const prog = state.progress;
      const dur = state.duration;

      if (pipWin.closed) return;

      pipWin.document.body.innerHTML = "";

      const container = pipWin.document.createElement("div");
      container.className = "pip-container";

      const coverDiv = pipWin.document.createElement("div");
      if (track?.cover) {
        coverDiv.innerHTML = `<img class="pip-cover" src="${track.cover}" alt="">`;
      } else {
        coverDiv.className = "pip-cover-placeholder";
        coverDiv.innerHTML = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg>`;
      }
      coverDiv.onclick = () => {
        if (window.document.hidden) window.focus();
        closePiP();
        setFullTrackViewOpen(true);
      };
      container.appendChild(coverDiv);

      const info = pipWin.document.createElement("div");
      info.className = "pip-info";
      info.onclick = coverDiv.onclick;
      info.innerHTML = `
        <div class="pip-title">${track?.title || "Нет трека"}</div>
        <div class="pip-artist">${track?.artist || ""}</div>
      `;
      container.appendChild(info);

      const controls = pipWin.document.createElement("div");
      controls.className = "pip-controls";

      const playBtn = pipWin.document.createElement("button");
      playBtn.className = "pip-btn pip-btn-play";
      playBtn.innerHTML = playing
        ? `<svg width="14" height="14" viewBox="0 0 24 24" fill="white"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>`
        : `<svg width="14" height="14" viewBox="0 0 24 24" fill="white"><polygon points="5,3 19,12 5,21"/></svg>`;
      playBtn.onclick = (e) => {
        e.stopPropagation();
        useAppStore.getState().togglePlay();
      };
      controls.appendChild(playBtn);

      const closeBtn = pipWin.document.createElement("button");
      closeBtn.className = "pip-btn pip-btn-close";
      closeBtn.innerHTML = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>`;
      closeBtn.onclick = (e) => {
        e.stopPropagation();
        closePiP();
      };
      controls.appendChild(closeBtn);

      container.appendChild(controls);
      pipWin.document.body.appendChild(container);

      const progressContainer = pipWin.document.createElement("div");
      progressContainer.className = "pip-progress";
      const progressBar = pipWin.document.createElement("div");
      progressBar.className = "pip-progress-bar";
      const pct = dur > 0 ? (prog / dur) * 100 : 0;
      progressBar.style.width = `${pct}%`;
      progressContainer.appendChild(progressBar);
      pipWin.document.body.appendChild(progressContainer);

      const timeEl = pipWin.document.createElement("div");
      timeEl.className = "pip-time";
      timeEl.textContent = `${formatDuration(prog)} / ${formatDuration(dur)}`;
      pipWin.document.body.appendChild(timeEl);

      const badgeEl = pipWin.document.createElement("div");
      badgeEl.className = "pip-badge";
      badgeEl.textContent = "\u25CF MQ Player";
      pipWin.document.body.appendChild(badgeEl);
    };

    renderPiPContent();

    const unsub = useAppStore.subscribe(() => {
      if (pipWin.closed) {
        unsub();
        pipWindowRef.current = null;
        setPiPActive(false);
        return;
      }
      renderPiPContent();
    });

    const checkClosed = setInterval(() => {
      if (pipWin.closed) {
        clearInterval(checkClosed);
        unsub();
        pipWindowRef.current = null;
        setPiPActive(false);
      }
    }, 1000);

    cleanupRef.current = () => {
      unsub();
      clearInterval(checkClosed);
    };
  }, [closePiP, setPiPActive, setFullTrackViewOpen]);

  // Handle PiP toggle
  useEffect(() => {
    if (isPiPActive && currentTrack) {
      openPiPWindow();
    } else if (!isPiPActive) {
      closePiP();
    }

    return () => {
      if (cleanupRef.current) {
        cleanupRef.current();
        cleanupRef.current = null;
      }
      if (pipWindowRef.current) {
        try { pipWindowRef.current.close(); } catch { /* already closed */ }
        pipWindowRef.current = null;
      }
    };
  }, [isPiPActive]); // eslint-disable-line react-hooks/exhaustive-deps

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (pipWindowRef.current) {
        try { pipWindowRef.current.close(); } catch { /* already closed */ }
        pipWindowRef.current = null;
      }
    };
  }, []);

  // This component no longer renders inline UI
  // PiP is a separate window now
  return null;
}
