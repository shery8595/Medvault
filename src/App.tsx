/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { BrowserRouter as Router, Routes, Route, Navigate, Outlet } from "react-router-dom";
import { LandingLayout } from "./components/layout/LandingLayout";
import { DashboardLayout } from "./components/layout/DashboardLayout";
import { LandingPage } from "./pages/LandingPage";
import { PatientDashboard } from "./pages/PatientDashboard";
import { PatientVaultPage } from "./pages/PatientVaultPage";
import { PatientTrialsPage } from "./pages/PatientTrialsPage";
import { PatientAppliedTrialsPage } from "./pages/PatientAppliedTrialsPage";
import { PatientResultsPage } from "./pages/PatientResultsPage";
import { PatientPrivacyTourPage } from "./pages/PatientPrivacyTourPage";
import { PatientIdentityPage } from "./pages/PatientIdentityPage";
import { PatientSettingsPage } from "./pages/PatientSettingsPage";
import { SponsorDashboard } from "./pages/SponsorDashboard";
import { SponsorTrialsPage } from "./pages/SponsorTrialsPage";
import { SponsorCreateTrialPage } from "./pages/SponsorCreateTrialPage";
import { SponsorTrialDetailsPage } from "./pages/SponsorTrialDetailsPage";
import { SponsorMatchesPage } from "./pages/SponsorMatchesPage";
import { SponsorAnalyticsPage } from "./pages/SponsorAnalyticsPage";
import { SponsorSettingsPage } from "./pages/SponsorSettingsPage";
import { SponsorVerificationPage } from "./pages/SponsorVerificationPage";
import { SponsorAuditLogPage } from './pages/SponsorAuditLogPage';
import { ConsentLogPage } from "./pages/ConsentLogPage";
import { TechnologyPage } from "./pages/TechnologyPage";
import { SecurityPage } from "./pages/SecurityPage";
import { PrivacyPage } from "./pages/PrivacyPage";
import { HowItWorksPage } from "./pages/HowItWorksPage";
import AdminSponsorsPage from "./pages/AdminSponsorsPage";
import AdminWiringPage from "./pages/AdminWiringPage";
import { SponsorGuard } from "./components/layout/SponsorGuard";
import { DocsLayout } from "./pages/docs/DocsLayout";
import { IntroductionDoc } from "./pages/docs/IntroductionDoc";
import { ArchitectureDoc } from "./pages/docs/ArchitectureDoc";
import { FhePrimitivesDoc } from "./pages/docs/FhePrimitivesDoc";
import { EligibilityEngineDoc } from "./pages/docs/EligibilityEngineDoc";
import { SmartContractsDoc } from "./pages/docs/SmartContractsDoc";
import { SponsorSystemDoc } from "./pages/docs/SponsorSystemDoc";
import { ClientEncryptionDoc } from "./pages/docs/ClientEncryptionDoc";
import { SubgraphIndexingDoc } from "./pages/docs/SubgraphIndexingDoc";
import { FrontendArchitectureDoc } from "./pages/docs/FrontendArchitectureDoc";
import { UserGuideDoc } from "./pages/docs/UserGuideDoc";
import { DeploymentGuideDoc } from "./pages/docs/DeploymentGuideDoc";
import { TimelockWiringDoc } from "./pages/docs/TimelockWiringDoc";
import { AndroidApkDoc } from "./pages/docs/AndroidApkDoc";
import { PrivateStakingDoc } from "./pages/docs/PrivateStakingDoc";
import { PrivateWithdrawalsDoc } from "./pages/docs/PrivateWithdrawalsDoc";
import { TestingOverviewDoc } from "./pages/docs/testing/TestingOverviewDoc";
import { TestingMatrixDoc } from "./pages/docs/testing/TestingMatrixDoc";
import { TestingInfrastructureDoc } from "./pages/docs/testing/TestingInfrastructureDoc";
import { TestingCiDoc } from "./pages/docs/testing/TestingCiDoc";
import { SecurityModelDoc } from "./pages/docs/SecurityModelDoc";
import { TrustArchitectureDoc } from "./pages/docs/TrustArchitectureDoc";
import { GlossaryDoc } from "./pages/docs/GlossaryDoc";
import { JudgeBriefDoc } from "./pages/docs/JudgeBriefDoc";
import { RelayerTrustBoundariesDoc } from "./pages/docs/RelayerTrustBoundariesDoc";
import { P33ThresholdAttestationDoc } from "./pages/docs/P33ThresholdAttestationDoc";
import { ComplianceDoc } from "./pages/docs/ComplianceDoc";
import { FaqDoc } from "./pages/docs/FaqDoc";
import { ChangelogDoc } from "./pages/docs/ChangelogDoc";
import { IdentityPrivacyDoc } from "./pages/docs/IdentityPrivacyDoc";
import { SemaphoreDoc } from "./pages/docs/SemaphoreDoc";
import { NoirDoc } from "./pages/docs/NoirDoc";
import { ZamaFheDoc } from "./pages/docs/ZamaFheDoc";
import { ChainlinkAutomationDoc } from "./pages/docs/ChainlinkAutomationDoc";
import { McpServerDoc } from "./pages/docs/McpServerDoc";
import { McpSetupDoc } from "./pages/docs/McpSetupDoc";
import { McpToolsDoc } from "./pages/docs/McpToolsDoc";
import { SdkDoc } from "./pages/docs/SdkDoc";
import { MarkdownDocPage } from "./pages/docs/MarkdownDocPage";
import { MARKDOWN_DOC_ROUTES } from "./lib/docsMarkdownSources";

import { PrivyProvider } from "@privy-io/react-auth";
import { sepolia } from "viem/chains";
import { Web3Provider } from "./lib/Web3Context";
import { ZamaSDKProvider } from "./lib/ZamaSDKProvider";
import { EncryptedDataProvider } from "./lib/EncryptedDataContext";
import { ScrollToTop } from "./components/ui/ScrollToTop";
import { MobileAppShell } from "./components/mobile/MobileAppShell";
import { MobileLaunchRedirect } from "./components/mobile/MobileLaunchRedirect";
import { isNativeApp } from "./lib/mobile";

const PRIVY_APP_ID = import.meta.env.VITE_PRIVY_APP_ID;

export default function App() {
  if (!PRIVY_APP_ID) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-900 text-slate-200 p-8">
        <p className="text-center max-w-md text-sm leading-relaxed">
          Set <code className="text-teal-400">VITE_PRIVY_APP_ID</code> in <code className="text-slate-400">.env</code> (from
          the{" "}
          <a href="https://dashboard.privy.io" className="text-teal-400 underline" target="_blank" rel="noreferrer">
            Privy dashboard
          </a>
          ). The app uses Privy for sign-in and embedded Ethereum Sepolia wallets.
        </p>
      </div>
    );
  }

  return (
    <PrivyProvider
      appId={PRIVY_APP_ID}
      config={{
        defaultChain: sepolia,
        supportedChains: [sepolia],
        // Nested `ethereum` is required; a top-level `createOnLogin` is ignored and breaks auto-creation.
        embeddedWallets: {
          ethereum: {
            createOnLogin: "all-users",
          },
        },
        // Capacitor WebView uses https://localhost — add this origin in the Privy dashboard.
        ...(isNativeApp()
          ? {
              legal: {
                termsAndConditionsUrl: "https://med-vault.xyz/privacy",
                privacyPolicyUrl: "https://med-vault.xyz/privacy",
              },
            }
          : {}),
      }}
    >
      <MedVaultRoutes />
    </PrivyProvider>
  );
}

function MedVaultRoutes() {
  const PatientShell = () => (
    <DashboardLayout role="patient">
      <Outlet />
    </DashboardLayout>
  );

  const SponsorShell = () => (
    <SponsorGuard>
      <DashboardLayout role="sponsor">
        <Outlet />
      </DashboardLayout>
    </SponsorGuard>
  );

  return (
    <Web3Provider>
      <ZamaSDKProvider>
      <EncryptedDataProvider>
        <Router>
          <MobileAppShell>
          <ScrollToTop />
          <Routes>
            {/* Landing Page Route */}
            <Route
              path="/"
              element={
                <LandingLayout>
                  <MobileLaunchRedirect />
                  <LandingPage />
                </LandingLayout>
              }
            />

            <Route
              path="/how-it-works"
              element={
                <LandingLayout>
                  <HowItWorksPage />
                </LandingLayout>
              }
            />
            <Route
              path="/technology"
              element={
                <LandingLayout>
                  <TechnologyPage />
                </LandingLayout>
              }
            />
            <Route
              path="/security"
              element={
                <LandingLayout>
                  <SecurityPage />
                </LandingLayout>
              }
            />
            <Route
              path="/privacy"
              element={
                <LandingLayout>
                  <PrivacyPage />
                </LandingLayout>
              }
            />

            {/* Patient Routes (reference-style nested routing + compatibility aliases) */}
            <Route path="/patient" element={<PatientShell />}>
              <Route index element={<Navigate to="/patient/dashboard" replace />} />
              <Route path="dashboard" element={<PatientDashboard />} />
              <Route path="medical-vault" element={<PatientVaultPage />} />
              <Route path="find-trials" element={<PatientTrialsPage />} />
              <Route path="consent-logs" element={<ConsentLogPage />} />
              <Route path="applications" element={<PatientAppliedTrialsPage />} />
              <Route path="results" element={<PatientResultsPage />} />
              <Route path="identity" element={<PatientIdentityPage />} />
              <Route path="privacy-tour" element={<PatientPrivacyTourPage />} />
              <Route path="settings" element={<PatientSettingsPage />} />
              {/* Legacy aliases */}
              <Route path="vault" element={<Navigate to="/patient/medical-vault" replace />} />
              <Route path="trials" element={<Navigate to="/patient/find-trials" replace />} />
              <Route path="applied" element={<Navigate to="/patient/applications" replace />} />
              <Route path="consent" element={<Navigate to="/patient/consent-logs" replace />} />
            </Route>

            {/* Sponsor Routes (reference-style nested routing + compatibility aliases) */}
            <Route path="/sponsor" element={<SponsorShell />}>
              <Route index element={<Navigate to="/sponsor/dashboard" replace />} />
              <Route path="dashboard" element={<SponsorDashboard />} />
              <Route path="active-trials" element={<SponsorTrialsPage />} />
              <Route path="patient-matches" element={<SponsorMatchesPage />} />
              <Route path="analytics" element={<SponsorAnalyticsPage />} />
              <Route path="audit-logs" element={<SponsorAuditLogPage />} />
              <Route path="profile-settings" element={<SponsorSettingsPage />} />
              <Route path="verification" element={<SponsorVerificationPage />} />
              <Route path="trials/create" element={<SponsorCreateTrialPage />} />
              <Route path="trials/:id" element={<SponsorTrialDetailsPage />} />
              {/* Legacy aliases */}
              <Route path="trials" element={<Navigate to="/sponsor/active-trials" replace />} />
              <Route path="matches" element={<Navigate to="/sponsor/patient-matches" replace />} />
              <Route path="audit" element={<Navigate to="/sponsor/audit-logs" replace />} />
              <Route path="settings" element={<Navigate to="/sponsor/profile-settings" replace />} />
            </Route>
            {/* Admin sponsors page intentionally left open — allows unverified wallets to apply */}
            <Route
              path="/admin/sponsors"
              element={
                <DashboardLayout role="sponsor">
                  <AdminSponsorsPage />
                </DashboardLayout>
              }
            />
            <Route
              path="/admin/wiring"
              element={
                <DashboardLayout role="sponsor">
                  <AdminWiringPage />
                </DashboardLayout>
              }
            />

            {/* Documentation Routes */}
            <Route
              path="/docs"
              element={
                <DocsLayout>
                  <IntroductionDoc />
                </DocsLayout>
              }
            />
            <Route
              path="/docs/architecture"
              element={
                <DocsLayout>
                  <ArchitectureDoc />
                </DocsLayout>
              }
            />
            <Route
              path="/docs/fhe-primitives"
              element={
                <DocsLayout>
                  <FhePrimitivesDoc />
                </DocsLayout>
              }
            />
            <Route
              path="/docs/engine"
              element={
                <DocsLayout>
                  <EligibilityEngineDoc />
                </DocsLayout>
              }
            />
            <Route
              path="/docs/contracts"
              element={
                <DocsLayout>
                  <SmartContractsDoc />
                </DocsLayout>
              }
            />
            <Route
              path="/docs/sponsor-system"
              element={
                <DocsLayout>
                  <SponsorSystemDoc />
                </DocsLayout>
              }
            />
            <Route
              path="/docs/automation"
              element={
                <DocsLayout>
                  <ChainlinkAutomationDoc />
                </DocsLayout>
              }
            />
            <Route
              path="/docs/client-encryption"
              element={
                <DocsLayout>
                  <ClientEncryptionDoc />
                </DocsLayout>
              }
            />
            <Route
              path="/docs/subgraph"
              element={
                <DocsLayout>
                  <SubgraphIndexingDoc />
                </DocsLayout>
              }
            />
            <Route
              path="/docs/frontend"
              element={
                <DocsLayout>
                  <FrontendArchitectureDoc />
                </DocsLayout>
              }
            />
            <Route
              path="/docs/guides"
              element={
                <DocsLayout>
                  <UserGuideDoc />
                </DocsLayout>
              }
            />
            <Route
              path="/docs/staking"
              element={
                <DocsLayout>
                  <PrivateStakingDoc />
                </DocsLayout>
              }
            />
            <Route
              path="/docs/private-withdrawals"
              element={
                <DocsLayout>
                  <PrivateWithdrawalsDoc />
                </DocsLayout>
              }
            />
            <Route
              path="/docs/deployment"
              element={
                <DocsLayout>
                  <DeploymentGuideDoc />
                </DocsLayout>
              }
            />
            <Route
              path="/docs/timelock-wiring"
              element={
                <DocsLayout>
                  <TimelockWiringDoc />
                </DocsLayout>
              }
            />
            <Route
              path="/docs/mobile/android-apk"
              element={
                <DocsLayout>
                  <AndroidApkDoc />
                </DocsLayout>
              }
            />
            <Route
              path="/docs/mcp"
              element={
                <DocsLayout>
                  <McpServerDoc />
                </DocsLayout>
              }
            />
            <Route
              path="/docs/mcp/sdk"
              element={
                <DocsLayout>
                  <SdkDoc />
                </DocsLayout>
              }
            />
            <Route
              path="/docs/mcp/setup"
              element={
                <DocsLayout>
                  <McpSetupDoc />
                </DocsLayout>
              }
            />
            <Route
              path="/docs/mcp/tools"
              element={
                <DocsLayout>
                  <McpToolsDoc />
                </DocsLayout>
              }
            />
            <Route
              path="/docs/testing"
              element={
                <DocsLayout>
                  <TestingOverviewDoc />
                </DocsLayout>
              }
            />
            <Route
              path="/docs/testing/matrix"
              element={
                <DocsLayout>
                  <TestingMatrixDoc />
                </DocsLayout>
              }
            />
            <Route
              path="/docs/testing/infrastructure"
              element={
                <DocsLayout>
                  <TestingInfrastructureDoc />
                </DocsLayout>
              }
            />
            <Route
              path="/docs/testing/ci"
              element={
                <DocsLayout>
                  <TestingCiDoc />
                </DocsLayout>
              }
            />
            <Route
              path="/docs/relayer-trust-boundaries"
              element={
                <DocsLayout>
                  <RelayerTrustBoundariesDoc />
                </DocsLayout>
              }
            />
            <Route
              path="/docs/p3-3-threshold-attestation"
              element={
                <DocsLayout>
                  <P33ThresholdAttestationDoc />
                </DocsLayout>
              }
            />
            <Route
              path="/docs/security-model"
              element={
                <DocsLayout>
                  <SecurityModelDoc />
                </DocsLayout>
              }
            />
            <Route
              path="/docs/trust-architecture"
              element={
                <DocsLayout>
                  <TrustArchitectureDoc />
                </DocsLayout>
              }
            />
            <Route
              path="/docs/glossary"
              element={
                <DocsLayout>
                  <GlossaryDoc />
                </DocsLayout>
              }
            />
            <Route
              path="/docs/judge-brief"
              element={
                <DocsLayout>
                  <JudgeBriefDoc />
                </DocsLayout>
              }
            />
            <Route
              path="/docs/compliance"
              element={
                <DocsLayout>
                  <ComplianceDoc />
                </DocsLayout>
              }
            />
            <Route
              path="/docs/faq"
              element={
                <DocsLayout>
                  <FaqDoc />
                </DocsLayout>
              }
            />
            <Route
              path="/docs/changelog"
              element={
                <DocsLayout>
                  <ChangelogDoc />
                </DocsLayout>
              }
            />
            <Route
              path="/docs/identity-privacy"
              element={
                <DocsLayout>
                  <IdentityPrivacyDoc />
                </DocsLayout>
              }
            />
            <Route
              path="/docs/zama-fhe"
              element={
                <DocsLayout>
                  <ZamaFheDoc />
                </DocsLayout>
              }
            />
            <Route
              path="/docs/semaphore"
              element={
                <DocsLayout>
                  <SemaphoreDoc />
                </DocsLayout>
              }
            />
            <Route
              path="/docs/noir"
              element={
                <DocsLayout>
                  <NoirDoc />
                </DocsLayout>
              }
            />
            {MARKDOWN_DOC_ROUTES.map((path) => (
              <Route
                key={path}
                path={path}
                element={
                  <DocsLayout>
                    <MarkdownDocPage />
                  </DocsLayout>
                }
              />
            ))}

            {/* Legacy global redirects */}
            <Route path="/consent" element={<Navigate to="/patient/consent-logs" replace />} />
          </Routes>
          </MobileAppShell>
        </Router>
      </EncryptedDataProvider>
      </ZamaSDKProvider>
    </Web3Provider>
  );
}
