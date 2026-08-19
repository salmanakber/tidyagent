export default async function WixMissingPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const params = await searchParams;
  const invalid = params.error === "invalid";

  return (
    <div className="flex min-h-dvh items-center justify-center bg-brand-gradient p-6 text-center">
      <div className="panel max-w-md p-8">
        <h1 className="font-display text-2xl text-white">
          {invalid ? "Could not verify this Wix site" : "Wix signature missing"}
        </h1>
        <p className="mt-3 text-sm text-navy-300">
          {invalid
            ? "The instance token did not match WIX_APP_SECRET. Confirm App ID / App Secret in .env belong to this Wix app, then open tidyAgent again from the Wix dashboard."
            : "Open tidyAgent from your Wix dashboard so we can verify the site instance. We never trust an unsigned site ID."}
        </p>
      </div>
    </div>
  );
}
