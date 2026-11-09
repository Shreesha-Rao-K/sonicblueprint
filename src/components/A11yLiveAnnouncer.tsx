"use client";

import { useEffect, useState } from "react";
import { subscribeAnnouncer, type A11yMessage } from "@/lib/a11y-announcer";

export function A11yLiveAnnouncer() {
  const [politeMessage, setPoliteMessage] = useState("");
  const [assertiveMessage, setAssertiveMessage] = useState("");

  useEffect(() => {
    return subscribeAnnouncer((msg: A11yMessage) => {
      if (msg.priority === "assertive") {
        setAssertiveMessage(msg.message);
      } else {
        setPoliteMessage(msg.message);
      }
    });
  }, []);

  return (
    <div className="sr-only" aria-hidden="false">
      <div
        role="status"
        aria-live="polite"
        aria-atomic="true"
        data-testid="a11y-polite-region"
      >
        {politeMessage}
      </div>
      <div
        role="alert"
        aria-live="assertive"
        aria-atomic="true"
        data-testid="a11y-assertive-region"
      >
        {assertiveMessage}
      </div>
    </div>
  );
}
