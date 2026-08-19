"use client";

import { useTransition } from "react";
import { openSiteAsOwner, restoreSite, suspendSite, syncSiteBilling } from "@/app/actions/admin";

export function SiteAdminActions({
  siteId,
  suspended,
}: {
  siteId: string;
  suspended: boolean;
}) {
  const [pending, startTransition] = useTransition();

  return (
    <div className="flex flex-wrap gap-2">
      <button
        className="btn-primary"
        disabled={pending}
        onClick={() => startTransition(() => openSiteAsOwner(siteId))}
      >
        Open owner workspace
      </button>
      <button
        className="btn-secondary"
        disabled={pending}
        onClick={() => startTransition(() => syncSiteBilling(siteId))}
      >
        Sync Wix billing
      </button>
      {suspended ? (
        <button className="btn-secondary" disabled={pending} onClick={() => startTransition(() => restoreSite(siteId))}>
          Restore access
        </button>
      ) : (
        <button
          className="btn-secondary"
          disabled={pending}
          onClick={() =>
            startTransition(() => suspendSite(siteId, "Suspended by platform owner"))
          }
        >
          Suspend site
        </button>
      )}
    </div>
  );
}
