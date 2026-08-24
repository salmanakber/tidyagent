"use client";

export function WebflowConnect({ installHref }: { installHref: string }) {
  function connect() {
    const target = window.top ?? window;
    target.location.href = installHref;
  }

  return (
    <div className="flex min-h-dvh items-center justify-center bg-brand-gradient p-6 text-center">
      <div className="panel max-w-md p-8">
        <p className="text-xs uppercase tracking-[0.2em] text-amber-300">Webflow</p>
        <h1 className="mt-3 font-display text-2xl text-white">Open your AI employee</h1>
        <p className="mt-3 text-sm leading-6 text-navy-300">
          Connect this site to open the dashboard inside Webflow. If a browser popup is blocked, use
          the button again.
        </p>
        <button type="button" onClick={connect} className="btn-primary mt-6 w-full">
          Open dashboard
        </button>
      </div>
    </div>
  );
}
