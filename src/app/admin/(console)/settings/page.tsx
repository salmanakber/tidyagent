import { getPlatformSettingsView } from "@/app/actions/settings";
import { PageHeader } from "@/components/ui/PageHeader";
import { PlatformSettingsForm } from "@/components/admin/PlatformSettingsForm";

export default async function AdminSettingsPage() {
  const settings = await getPlatformSettingsView();

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Platform"
        title="API & login settings"
        description="Operator login, AI keys, Google OAuth, Cloudinary, and voice. The console password lives here — not in .env."
      />
      <PlatformSettingsForm
        failoverEnabled={settings.failoverEnabled}
        order={settings.order}
        configured={settings.configured}
        googleClientId={settings.googleClientId}
        cloudinaryCloudName={settings.cloudinaryCloudName}
        operatorEmail={settings.operatorEmail}
        extraEmails={settings.extraEmails}
        models={settings.models}
        modelOptions={settings.modelOptions}
        planPriceStarter={settings.planPriceStarter}
        planPriceBusiness={settings.planPriceBusiness}
        planPricePro={settings.planPricePro}
        planPriceCurrency={settings.planPriceCurrency}
        planTrialDays={settings.planTrialDays}
        googleTtsVoice={settings.googleTtsVoice}
      />
    </div>
  );
}
