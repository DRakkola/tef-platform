import React from "react";
import { User, Target, Bell, Shield, Lock, CreditCard } from "lucide-react";
import { cn } from "@/lib/utils";
import type { SettingsSection } from "../types";

interface SettingsNavProps {
  activeSection: SettingsSection;
  onSelectSection: (section: SettingsSection) => void;
}

interface NavItem {
  id: SettingsSection;
  label: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
}

const NAV_ITEMS: NavItem[] = [
  {
    id: "profile",
    label: "Profil",
    description: "Informations personnelles et compte",
    icon: User,
  },
  {
    id: "tef",
    label: "Préparation TEF",
    description: "Objectifs, examens et temps d'étude",
    icon: Target,
  },
  {
    id: "notifications",
    label: "Notifications",
    description: "Canaux et alertes par catégorie",
    icon: Bell,
  },
  {
    id: "security",
    label: "Sécurité",
    description: "Mot de passe et authentification",
    icon: Shield,
  },
  {
    id: "privacy",
    label: "Confidentialité",
    description: "Données, export et suppression",
    icon: Lock,
  },
  {
    id: "billing",
    label: "Facturation",
    description: "Abonnement, crédits et reçus",
    icon: CreditCard,
  },
];

export const SettingsNav: React.FC<SettingsNavProps> = ({
  activeSection,
  onSelectSection,
}) => {
  return (
    <>
      {/* Mobile Selector */}
      <div className="md:hidden w-full mb-6">
        <label
          htmlFor="mobile-settings-nav"
          className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2"
        >
          Section des paramètres
        </label>
        <select
          id="mobile-settings-nav"
          value={activeSection}
          onChange={(e) => onSelectSection(e.target.value as SettingsSection)}
          className="w-full h-11 rounded-lg border border-input bg-card px-3 text-sm font-medium text-foreground shadow-xs focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-primary"
        >
          {NAV_ITEMS.map((item) => (
            <option key={item.id} value={item.id}>
              {item.label} — {item.description}
            </option>
          ))}
        </select>
      </div>

      {/* Desktop Vertical Nav */}
      <nav
        aria-label="Navigation des paramètres"
        className="hidden md:flex flex-col space-y-1 w-64 shrink-0"
      >
        <div className="px-3 pb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Paramètres
        </div>
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          const isActive = activeSection === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onSelectSection(item.id)}
              className={cn(
                "group flex items-center gap-3 w-full rounded-lg px-3 py-2.5 text-left text-sm font-medium transition-colors",
                isActive
                  ? "bg-muted text-foreground font-semibold shadow-xs"
                  : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
              )}
              aria-current={isActive ? "page" : undefined}
            >
              <div
                className={cn(
                  "flex size-7 shrink-0 items-center justify-center rounded-md border transition-colors",
                  isActive
                    ? "border-primary/20 bg-primary/10 text-primary"
                    : "border-border/60 bg-card text-muted-foreground group-hover:text-foreground"
                )}
              >
                <Icon className="size-4" />
              </div>
              <div className="flex flex-col min-w-0">
                <span className="truncate">{item.label}</span>
                <span className="text-[11px] text-muted-foreground font-normal truncate">
                  {item.description}
                </span>
              </div>
            </button>
          );
        })}
      </nav>
    </>
  );
};
