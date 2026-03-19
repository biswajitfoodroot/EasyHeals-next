"use client";

/**
 * MSG91 Hello — Live Chat Widget
 *
 * Loads the MSG91 Hello (live chat) widget script on the client.
 * Shown on all public-facing pages for patient support.
 *
 * Env var required (public):
 *   NEXT_PUBLIC_MSG91_HELLO_WIDGET_TOKEN — token from MSG91 Hello dashboard
 *
 * Optional: if a patient session is active, call window.HelloInboxSDK.identify()
 * after the widget loads to pre-fill name + phone in the chat.
 *
 * Usage: <MSG91HelloChat /> in root layout (rendered client-side only).
 */

import { useEffect } from "react";

declare global {
  interface Window {
    helloBotConfig?: {
      hello: string;
      widgetToken: string;
    };
    HelloInboxSDK?: {
      identify: (data: { name?: string; number?: string; mail?: string }) => void;
    };
  }
}

interface Props {
  /** Pre-fill patient name in the chat widget (from OTP session) */
  patientName?: string;
  /** Pre-fill patient phone in the chat widget */
  patientPhone?: string;
}

export function MSG91HelloChat({ patientName, patientPhone }: Props) {
  const widgetToken = process.env.NEXT_PUBLIC_MSG91_HELLO_WIDGET_TOKEN;

  useEffect(() => {
    if (!widgetToken) return;

    // Already loaded
    if (document.getElementById("msg91-hello-script")) return;

    window.helloBotConfig = {
      hello: "msgbot",
      widgetToken,
    };

    const script = document.createElement("script");
    script.id = "msg91-hello-script";
    script.src = "https://static.msg91.com/hello/hello-widget.min.js";
    script.async = true;

    script.onload = () => {
      // Pre-fill identity if patient is logged in
      if (window.HelloInboxSDK && (patientName || patientPhone)) {
        window.HelloInboxSDK.identify({
          name: patientName,
          number: patientPhone,
        });
      }
    };

    document.head.appendChild(script);

    return () => {
      // Do not remove on unmount — widget should persist across navigations
    };
  }, [widgetToken, patientName, patientPhone]);

  // No visible DOM — widget renders its own bubble
  return null;
}
