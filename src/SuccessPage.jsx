// /open (React/Next/CRA) — resume-last-screen only
import { useEffect, useRef, useState } from "react";
import './App.css';

const IOS_STORE = "https://apps.apple.com/us/app/haulzy/id6749022857";
const ANDROID_STORE = "https://play.google.com/store/apps/details?id=com.swnelson5.haulzymobile";
const APP_SCHEME = "haulzy://";
const ANDROID_INTENT =
  `intent://open#Intent;scheme=haulzy;package=com.swnelson5.haulzymobile;` +
  `S.browser_fallback_url=${encodeURIComponent(ANDROID_STORE)};end`;

const DELAY_BEFORE_OPENING = 3000; // 3 seconds delay

export default function SuccessPage() {
  const [opening, setOpening] = useState(false);
  const [countdown, setCountdown] = useState(3); // Countdown timer
  const timer = useRef(null);
  const opened = useRef(false);
  const countdownTimer = useRef(null);
  const delayTimer = useRef(null);

  const isAndroid = /android/i.test(navigator.userAgent || "");
  const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent || "");

  const stop = () => { 
    if (timer.current) clearTimeout(timer.current); 
    if (countdownTimer.current) clearInterval(countdownTimer.current);
    if (delayTimer.current) clearTimeout(delayTimer.current);
    timer.current = null; 
    countdownTimer.current = null;
    delayTimer.current = null;
    setOpening(false); 
  };
  const markOpened = () => { opened.current = true; stop(); };

  useEffect(() => {
    const onHidden = () => document.hidden && markOpened();
    const onBlur = () => markOpened();
    const onPageHide = () => markOpened();

    document.addEventListener("visibilitychange", onHidden);
    window.addEventListener("blur", onBlur);
    window.addEventListener("pagehide", onPageHide);

    // Start countdown
    let count = 3;
    countdownTimer.current = setInterval(() => {
      count--;
      setCountdown(count);
      if (count <= 0) {
        clearInterval(countdownTimer.current);
      }
    }, 1000);

    // Delay automatic opening by 3 seconds
    delayTimer.current = setTimeout(() => {
      openApp();
    }, DELAY_BEFORE_OPENING);

    return () => {
      document.removeEventListener("visibilitychange", onHidden);
      window.removeEventListener("blur", onBlur);
      window.removeEventListener("pagehide", onPageHide);
      stop();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function openApp() {
    if (opening) return;
    setOpening(true);
    opened.current = false;

    if (isAndroid) {
      window.location.href = ANDROID_INTENT;
      timer.current = window.setTimeout(() => {
        if (!opened.current && !document.hidden) window.location.href = ANDROID_STORE;
      }, 1200);
      return;
    }

    if (isIOS) {
      const t0 = Date.now();
      window.location.href = APP_SCHEME;
      timer.current = window.setTimeout(() => {
        if (!opened.current && !document.hidden && Date.now() - t0 < 2000) {
          window.location.href = IOS_STORE;
        }
      }, 1200);
      return;
    }

    // desktop/unknown → send to iOS store (or your web landing)
    window.location.href = IOS_STORE;
  }

  return (
    <div style={{
      minHeight: "100vh",
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      padding: "2rem",
      background: "var(--background-light)"
    }}>
      <div style={{
        background: "white",
        padding: "2rem",
        borderRadius: "16px",
        boxShadow: "0 4px 24px rgba(0, 45, 71, 0.1)",
        textAlign: "center",
        maxWidth: "600px",
        width: "100%"
      }}>
        <div style={{
          width: "80px",
          height: "80px",
          background: "var(--primary-color)",
          borderRadius: "50%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          margin: "0 auto 1.5rem"
        }}>
          <span style={{ fontSize: "40px", color: "white" }}>✓</span>
        </div>

        <h1 style={{
          color: "var(--text-dark)",
          fontFamily: "var(--font-heading)",
          fontSize: "2.5rem",
          margin: "0 0 1rem"
        }}>
          Success!
        </h1>

        <h2 style={{
          color: "var(--primary-color)",
          fontFamily: "var(--font-heading)",
          fontSize: "1.75rem",
          margin: "0 0 1.5rem",
          fontWeight: 600
        }}>
          Welcome to Haulzy
        </h2>

        <p style={{
          color: "var(--text-dark)",
          fontSize: "1.1rem",
          opacity: 0.8,
          margin: "0 0 2rem"
        }}>
          {!opening && countdown > 0 
            ? `Opening your app in ${countdown} second${countdown !== 1 ? 's' : ''}...`
            : opening 
              ? "Opening Haulzy..." 
              : "We're opening your app. If nothing happens, tap below."}
        </p>

        <button 
          onClick={openApp} 
          disabled={opening}
          style={{
            background: "var(--primary-color)",
            color: "white",
            border: "none",
            padding: "1rem 2rem",
            borderRadius: "8px",
            fontSize: "1.1rem",
            fontWeight: 600,
            cursor: opening ? "default" : "pointer",
            transition: "all 0.2s ease",
            boxShadow: "0 2px 8px rgba(0, 191, 179, 0.2)",
            opacity: opening ? 0.7 : 1,
            width: "100%"
          }}>
          {opening ? "Opening Haulzy..." : countdown > 0 ? "Open Now" : "Open Haulzy App"}
        </button>

        <p style={{
          color: "var(--text-dark)",
          fontSize: "0.9rem",
          opacity: 0.6,
          margin: "1.5rem 0 0"
        }}>
          Don't have it? Get it on{" "}
          <a 
            href={isAndroid ? ANDROID_STORE : IOS_STORE} 
            target="_blank" 
            rel="noreferrer"
            style={{
              color: "var(--primary-color)",
              textDecoration: "underline"
            }}
          >
            the {isAndroid ? "Play Store" : "App Store"}
          </a>.
        </p>
      </div>
    </div>
  );
}
