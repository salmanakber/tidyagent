"use client";

import { useState } from "react";

export function WidgetInstallCard({
  instanceId,
  appOrigin,
}: {
  instanceId: string;
  appOrigin: string;
}) {
  const snippet = `<script src="${appOrigin}/widget.js" data-instance="${instanceId}" async></script>`;
  const [copied, setCopied] = useState(false);

  return (
    <div className="panel p-6">
      <h2 className="font-display text-xl text-white">Customer-site widget</h2>
      <p className="mt-2 text-sm leading-6 text-navy-300">
        Auto-install injects this on every page after Wix has an Embedded Script extension. If the bubble is missing,
        add the snippet in Wix Editor → Settings → Custom Code, or publish the site so the script can run.
      </p>
      <pre className="mt-4 overflow-x-auto rounded-2xl bg-navy-950/60 p-4 text-xs text-navy-100">{snippet}</pre>
      <button
        className="btn-secondary mt-4"
        onClick={async () => {
          await navigator.clipboard.writeText(snippet);
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        }}
      >
        {copied ? "Copied" : "Copy snippet"}
      </button>
    </div>
  );
}
