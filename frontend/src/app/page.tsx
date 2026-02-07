"use client";

import { Header } from "@/components/Header";
import { HeroSection } from "@/components/HeroSection";
import { VaultStatus } from "@/components/VaultStatus";
import { VaultActions } from "@/components/VaultActions";
import { useNear } from "@/contexts/NearContext";
import { Shield, Github, Twitter, FileText } from "lucide-react";

export default function Home() {
  const { isConnected } = useNear();

  return (
    <div className="min-h-screen flex flex-col">
      {/* Background effects */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 left-1/4 w-[600px] h-[600px] bg-emerald-500/5 rounded-full blur-[150px]" />
        <div className="absolute bottom-0 right-1/4 w-[400px] h-[400px] bg-cyan-500/5 rounded-full blur-[120px]" />
        {/* Grid pattern */}
        <div
          className="absolute inset-0 opacity-[0.02]"
          style={{
            backgroundImage: `linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px),
                            linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)`,
            backgroundSize: '50px 50px'
          }}
        />
      </div>

      {/* Header */}
      <Header />

      {/* Main Content */}
      <main className="relative flex-1">
        {!isConnected ? (
          <HeroSection />
        ) : (
          <div id="dashboard" className="container mx-auto px-4 py-12">
            <div className="mb-8">
              <h1 className="text-3xl font-bold text-white mb-2">
                Your Sentinel Vault
              </h1>
              <p className="text-slate-400">
                Manage your vault and monitor status.
              </p>
            </div>

            <div className="grid lg:grid-cols-2 gap-8">
              {/* Left Column - Status */}
              <div className="space-y-6">
                <VaultStatus />
              </div>

              {/* Right Column - Actions */}
              <div className="space-y-6">
                <VaultActions />
              </div>
            </div>

            {/* Info Cards */}
            <div className="grid md:grid-cols-3 gap-6 mt-12">
              <div className="p-6 rounded-2xl bg-slate-900/30 border border-slate-800/30">
                <div className="flex items-center gap-3 mb-4">
                  <div className="p-2 rounded-lg bg-emerald-500/10">
                    <Shield className="h-5 w-5 text-emerald-400" />
                  </div>
                  <h3 className="font-semibold text-white">Self-Custody</h3>
                </div>
                <p className="text-sm text-slate-400">
                  Your funds are secured by the NEAR blockchain. Only you can access them during normal operation.
                </p>
              </div>

              <div className="p-6 rounded-2xl bg-slate-900/30 border border-slate-800/30">
                <div className="flex items-center gap-3 mb-4">
                  <div className="p-2 rounded-lg bg-cyan-500/10">
                    <FileText className="h-5 w-5 text-cyan-400" />
                  </div>
                  <h3 className="font-semibold text-white">Smart Contract</h3>
                </div>
                <p className="text-sm text-slate-400">
                  Open-source and auditable. The contract logic is transparent and immutable once deployed.
                </p>
              </div>

              <div className="p-6 rounded-2xl bg-slate-900/30 border border-slate-800/30">
                <div className="flex items-center gap-3 mb-4">
                  <div className="p-2 rounded-lg bg-purple-500/10">
                    <Shield className="h-5 w-5 text-purple-400" />
                  </div>
                  <h3 className="font-semibold text-white">Automated</h3>
                </div>
                <p className="text-sm text-slate-400">
                  Anyone can call check_pulse to trigger the switch when heartbeat expires.
                </p>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="relative border-t border-white/5 py-8">
        <div className="container mx-auto px-4">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <Shield className="h-6 w-6 text-emerald-400" />
              <span className="font-semibold text-white">Sentinel</span>
              <span className="text-slate-500">|</span>
              <span className="text-sm text-slate-500">NEAR Protocol</span>
            </div>

            <div className="flex items-center gap-6">
              <a href="#" className="text-slate-400 hover:text-white transition-colors">
                <Github className="h-5 w-5" />
              </a>
              <a href="#" className="text-slate-400 hover:text-white transition-colors">
                <Twitter className="h-5 w-5" />
              </a>
              <a href="#" className="text-slate-400 hover:text-white transition-colors">
                <FileText className="h-5 w-5" />
              </a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
