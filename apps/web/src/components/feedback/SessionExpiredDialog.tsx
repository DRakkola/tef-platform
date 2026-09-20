/**
 * SessionExpiredDialog: Centralized modal for auth expiration and 401 interception.
 * Prevents modal duplication and ensures smooth re-authentication without data loss.
 */

import React, { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Lock, LogIn } from "lucide-react";

export const SessionExpiredDialog: React.FC = () => {
  const [isOpen, setIsOpen] = useState<boolean>(false);

  useEffect(() => {
    const handleAuthExpired = () => {
      // Don't open if already on login or register page
      if (
        typeof window !== "undefined" &&
        (window.location.pathname.startsWith("/login") ||
          window.location.pathname.startsWith("/register"))
      ) {
        return;
      }
      setIsOpen(true);
    };

    window.addEventListener("tef:auth-expired", handleAuthExpired);
    return () => {
      window.removeEventListener("tef:auth-expired", handleAuthExpired);
    };
  }, []);

  const handleLogin = () => {
    setIsOpen(false);
    const currentPath =
      typeof window !== "undefined"
        ? window.location.pathname + window.location.search
        : "/dashboard";
    window.location.href = `/login?redirect=${encodeURIComponent(currentPath)}`;
  };

  const handleClose = () => {
    setIsOpen(false);
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && handleClose()}>
      <DialogContent className="sm:max-w-md" hideClose>
        <DialogHeader className="space-y-3">
          <div className="flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-full bg-primary/10 text-primary shrink-0">
              <Lock className="size-5" aria-hidden="true" />
            </div>
            <DialogTitle className="text-left text-base sm:text-lg font-semibold text-foreground">
              Session expirée
            </DialogTitle>
          </div>
          <DialogDescription className="text-left text-sm text-muted-foreground leading-relaxed">
            Votre session de connexion a expiré ou une authentification est requise pour continuer.
            Veuillez vous reconnecter pour poursuivre votre préparation TEF en toute sécurité.
          </DialogDescription>
        </DialogHeader>

        <DialogFooter className="mt-4 sm:space-x-2">
          <Button
            type="button"
            variant="outline"
            onClick={handleClose}
            className="cursor-pointer"
          >
            Fermer
          </Button>
          <Button
            type="button"
            variant="default"
            onClick={handleLogin}
            className="cursor-pointer gap-2"
          >
            <LogIn className="size-4" />
            Se reconnecter
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
