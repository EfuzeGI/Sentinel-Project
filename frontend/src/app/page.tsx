"use client";

import { useState, useEffect } from "react";
import { Header, TabId } from "@/components/Header";
import { HeroSection } from "@/components/HeroSection";
import { CreateVault } from "@/components/CreateVault";
import { BeneficiaryView } from "@/components/BeneficiaryView";
import { Dashboard } from "@/components/Dashboard";
import { ArchitecturePage } from "@/components/ArchitecturePage";
import { AboutPage } from "@/components/AboutPage";
import { useNear } from "@/contexts/NearContext";
import { Loader2 } from "lucide-react";

export default function Home() {
  const { isConnected, vaultStatus, isSyncing, isLoading } = useNear();
  const [activeTab, setActiveTab] = useState<TabId>("protocol");

  const hasVault = vaultStatus !== null && vaultStatus.is_initialized;

  // Listen for navigation events from HeroSection
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (detail === "dashboard") {
        setActiveTab(hasVault ? "dashboard" : "create");
      }
    };
    window.addEventListener("sentinel:navigate", handler);
    return () => window.removeEventListener("sentinel:navigate", handler);
  }, [hasVault]);

  // Auto-navigate when connection/vault state changes
  useEffect(() => {
    if (isConnected && hasVault && activeTab === "protocol") {
      setActiveTab("dashboard");
    }
    if (isConnected && !hasVault && activeTab === "protocol") {
      setActiveTab("create");
    }
  }, [isConnected, hasVault]);

  // Redirect if viewing a tab that requires auth/vault
  useEffect(() => {
    if (!isConnected && (activeTab === "dashboard" || activeTab === "create" || activeTab === "access")) {
      setActiveTab("protocol");
    }
    if (activeTab === "dashboard" && !hasVault) {
      setActiveTab("create");
    }
    if (activeTab === "create" && hasVault) {
      setActiveTab("dashboard");
    }
  }, [isConnected, hasVault, activeTab]);

  const showLoading = isConnected && (isLoading || (isSyncing && !vaultStatus));

  const renderTab = () => {
    if (activeTab === "architecture") return <ArchitecturePage />;
    if (activeTab === "about") return <AboutPage />;

    if (showLoading) {
      return (
        <div className="min-h-[70vh] flex items-center justify-center">
          <div className="flex flex-col items-center gap-3">
            <Loader2 className="w-4 h-4 text-[var(--text-dim)] animate-spin" />
            <p className="text-[var(--text-dim)] text-[11px] font-mono">Syncing vault data...</p>
          </div>
        </div>
      );
    }

    switch (activeTab) {
      case "protocol":
        return <HeroSection />;
      case "dashboard":
        return <Dashboard />;
      case "create":
        return (
          <div>
            <CreateVault />
            <div className="max-w-[500px] mx-auto px-6 py-3">
              <div className="flex items-center gap-4">
                <div className="flex-1 h-px bg-[var(--border)]" />
                <span className="text-[var(--text-dim)] text-[10px] font-mono">or check inherited vault</span>
                <div className="flex-1 h-px bg-[var(--border)]" />
              </div>
            </div>
            <BeneficiaryView />
          </div>
        );
      case "access":
        return <BeneficiaryView />;
      default:
        return <HeroSection />;
    }
  };

  return (
    <div className="min-h-screen flex flex-col" style={{ backgroundColor: 'var(--bg)' }}>
      <Header activeTab={activeTab} onTabChange={setActiveTab} />
      <main className="flex-1">{renderTab()}</main>
    </div>
  );
}
