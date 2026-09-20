/**
 * Centralized error mapping and user-friendly French localization layer.
 * Guarantees zero raw technical codes (e.g. AUTH_REQUIRED, ECONNREFUSED) leak to the UI.
 */

import { ApiError } from "./api";

export type ErrorType =
  | "auth"
  | "forbidden"
  | "notFound"
  | "conflict"
  | "rateLimit"
  | "server"
  | "serviceUnavailable"
  | "network"
  | "offline"
  | "maintenance"
  | "validation"
  | "unknown";

export interface MappedError {
  type: ErrorType;
  title: string;
  description: string;
  actionLabel?: string;
  action?: "login" | "retry" | "dashboard" | "support" | "back" | "none";
  actionHref?: string;
  retryable: boolean;
  status?: number;
  code?: string;
}

/**
 * Maps any error (ApiError, network Error, HTTP status, or unknown)
 * into a structured, accessible, user-friendly French error definition.
 */
export function mapApiError(error: unknown): MappedError {
  // 1. Check navigator offline status
  if (typeof navigator !== "undefined" && !navigator.onLine) {
    return {
      type: "offline",
      title: "Vous êtes hors ligne",
      description: "Votre connexion Internet semble interrompue. Vérifiez votre réseau pour continuer.",
      actionLabel: "Réessayer",
      action: "retry",
      retryable: true,
    };
  }

  // 2. ApiError instance check
  if (error instanceof ApiError) {
    return mapStatusAndCode(error.status, error.code, error.message);
  }

  // 3. Standard JS Error check
  if (error instanceof Error) {
    const msg = error.message || "";
    const name = error.name || "";

    // Network / fetch failures
    if (
      msg.includes("Failed to fetch") ||
      msg.includes("NetworkError") ||
      msg.includes("Network request failed") ||
      msg.includes("ECONNREFUSED") ||
      msg.includes("net::ERR") ||
      name === "TypeError" && msg.includes("fetch")
    ) {
      return {
        type: "network",
        title: "Connexion au serveur impossible",
        description: "Nous ne parvenons pas à joindre le serveur. Vérifiez votre connexion Internet et réessayez.",
        actionLabel: "Réessayer",
        action: "retry",
        retryable: true,
      };
    }

    if (name === "AbortError" || msg.includes("aborted") || msg.includes("timeout")) {
      return {
        type: "network",
        title: "Délai d'attente dépassé",
        description: "Le serveur a mis trop de temps à répondre. Veuillez réessayer dans un instant.",
        actionLabel: "Réessayer",
        action: "retry",
        retryable: true,
      };
    }

    // Machine auth codes in message
    if (
      msg === "AUTH_REQUIRED" ||
      msg.includes("AUTH_REQUIRED") ||
      name === "AuthRequiredError" ||
      msg.includes("401")
    ) {
      return mapStatusAndCode(401, "AUTH_REQUIRED");
    }

    // 403 or permission codes
    if (msg.includes("403") || msg.includes("FORBIDDEN") || msg.includes("PERMISSION_DENIED")) {
      return mapStatusAndCode(403, "FORBIDDEN");
    }

    // 404
    if (msg.includes("404") || msg.includes("NOT_FOUND")) {
      return mapStatusAndCode(404, "NOT_FOUND");
    }

    // 429
    if (msg.includes("429") || msg.includes("RATE_LIMITED") || msg.includes("TOO_MANY_REQUESTS")) {
      return mapStatusAndCode(429, "RATE_LIMITED");
    }

    // 503 / Maintenance
    if (msg.includes("503") || msg.includes("MAINTENANCE") || msg.includes("SERVICE_UNAVAILABLE")) {
      return mapStatusAndCode(503, "SERVICE_UNAVAILABLE");
    }

    // 500
    if (msg.includes("500") || msg.includes("INTERNAL_SERVER_ERROR")) {
      return mapStatusAndCode(500, "INTERNAL_SERVER_ERROR");
    }

    // Fallback error with generic safe message
    return {
      type: "unknown",
      title: "Une erreur est survenue",
      description: "Une anomalie inattendue est survenue lors du traitement. Veuillez réessayer.",
      actionLabel: "Réessayer",
      action: "retry",
      retryable: true,
    };
  }

  // 4. Fallback for non-Error types (string, object, null)
  if (typeof error === "string") {
    if (error === "AUTH_REQUIRED" || error.includes("AUTH_REQUIRED")) {
      return mapStatusAndCode(401, "AUTH_REQUIRED");
    }
    if (error.includes("403") || error.includes("FORBIDDEN")) {
      return mapStatusAndCode(403, "FORBIDDEN");
    }
    if (error.includes("404") || error.includes("NOT_FOUND")) {
      return mapStatusAndCode(404, "NOT_FOUND");
    }
  }

  return {
    type: "unknown",
    title: "Une erreur est survenue",
    description: "Une difficulté temporaire empêche l'affichage de ces données. Veuillez actualiser la page ou réessayer.",
    actionLabel: "Réessayer",
    action: "retry",
    retryable: true,
  };
}

function mapStatusAndCode(status: number, code?: string, rawMessage?: string): MappedError {
  switch (status) {
    case 401:
      return {
        type: "auth",
        status: 401,
        code: code || "AUTH_REQUIRED",
        title: "Session expirée ou connexion requise",
        description: "Votre session a expiré ou une authentification est requise pour continuer. Veuillez vous reconnecter.",
        actionLabel: "Se connecter",
        action: "login",
        actionHref: "/login",
        retryable: false,
      };

    case 403:
      return {
        type: "forbidden",
        status: 403,
        code: code || "FORBIDDEN",
        title: "Accès restreint",
        description: "Vous n'avez pas les autorisations nécessaires pour accéder à cette ressource ou effectuer cette action.",
        actionLabel: "Retour au tableau de bord",
        action: "dashboard",
        actionHref: "/dashboard",
        retryable: false,
      };

    case 404:
      return {
        type: "notFound",
        status: 404,
        code: code || "NOT_FOUND",
        title: "Élément introuvable",
        description: "La ressource ou la page que vous recherchez n'existe pas, a été supprimée ou a été déplacée.",
        actionLabel: "Retour à l'accueil",
        action: "dashboard",
        actionHref: "/dashboard",
        retryable: false,
      };

    case 409:
      return {
        type: "conflict",
        status: 409,
        code: code || "CONFLICT",
        title: "Conflit de données",
        description: "Cette action ne peut pas être effectuée car l'état des données a changé entre-temps (ex: déjà soumis ou réservé).",
        actionLabel: "Actualiser",
        action: "retry",
        retryable: true,
      };

    case 422:
      return {
        type: "validation",
        status: 422,
        code: code || "VALIDATION_ERROR",
        title: "Données invalides",
        description: rawMessage && !rawMessage.startsWith("Request failed")
          ? rawMessage
          : "Les informations transmises comportent des erreurs ou sont incomplètes. Veuillez vérifier vos saisies.",
        actionLabel: "Corriger",
        action: "none",
        retryable: false,
      };

    case 429:
      return {
        type: "rateLimit",
        status: 429,
        code: code || "RATE_LIMITED",
        title: "Trop de requêtes",
        description: "Vous avez effectué trop de requêtes en peu de temps. Veuillez patienter quelques instants avant de réessayer.",
        actionLabel: "Réessayer",
        action: "retry",
        retryable: true,
      };

    case 503:
      return {
        type: "serviceUnavailable",
        status: 503,
        code: code || "SERVICE_UNAVAILABLE",
        title: "Service temporairement indisponible",
        description: "La plateforme fait l'objet d'une opération de maintenance ou d'une forte charge temporaire. Nous rétablissons l'accès au plus vite.",
        actionLabel: "Réessayer",
        action: "retry",
        retryable: true,
      };

    case 500:
    case 502:
    case 504:
      return {
        type: "server",
        status,
        code: code || "INTERNAL_SERVER_ERROR",
        title: "Erreur serveur temporaire",
        description: "Un problème inattendu est survenu sur nos serveurs. Notre équipe technique a été informée et résout la situation.",
        actionLabel: "Réessayer",
        action: "retry",
        retryable: true,
      };

    default:
      return {
        type: "unknown",
        status,
        code: code || "UNKNOWN_ERROR",
        title: "Une erreur est survenue",
        description: rawMessage && !rawMessage.startsWith("Request failed")
          ? rawMessage
          : "Une difficulté est survenue lors du traitement de votre demande. Veuillez réessayer.",
        actionLabel: "Réessayer",
        action: "retry",
        retryable: true,
      };
  }
}
