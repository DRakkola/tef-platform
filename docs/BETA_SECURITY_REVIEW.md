# Revue de Sécurité Pré-Bêta (TEF Canada)

**Date d'audit** : 18 Septembre 2026  
**Type d'évaluation** : Revue d'architecture de sécurité interne et tests dynamiques de vulnérabilité (White-box Security Assessment).  
*Note de transparence : Cet audit constitue une revue de sécurité applicative interne rigoureuse, et non un test d'intrusion externe (Penetration Test) certifié par un tiers.*

---

## 1. Matrice des Contrôles de Sécurité Évalués

| Vecteur d'Attaque | Statut | Mécanisme de Défense / Preuve de Résistance |
| :--- | :---: | :--- |
| **Authentification & Force Brute** | ✅ PROTÉGÉ | Hachage Argon2id, politique de mot de passe (12+ caractères, majuscule, chiffre, caractère spécial), verrouillage progressif (5 tentatives $\to$ 15 min de lockout), rate limiting (10 req/min). |
| **Autorisation & RBAC** | ✅ PROTÉGÉ | Dépendance `require_role(ADMIN, TEACHER, STUDENT)` stricte. Dépendance `require_beta_access` pour isoler les fonctionnalités bêta. |
| **IDOR (Insecure Direct Object References)** | ✅ PROTÉGÉ | Validation systématique de la propriété de la ressource (`user_id == current_user.id`) avec renvoi HTTP 403 `FORBIDDEN_RESOURCE`. Testé sur les profils, devoirs, examens et sessions audio. |
| **CSRF (Cross-Site Request Forgery)** | ✅ PROTÉGÉ | Double-Submit CSRF Cookie (`csrf_token` vérifié via `X-CSRF-Token` avec `hmac.compare_digest` à temps constant). Inopérant sur les requêtes authentifiées par en-tête `Authorization: Bearer`. |
| **XSS (Cross-Site Scripting)** | ✅ PROTÉGÉ | React 19 échappe automatiquement tout contenu interpolé. En-tête HTTP `Content-Security-Policy: default-src 'self'` et `X-Content-Type-Options: nosniff`. |
| **SSRF (Server-Side Request Forgery)** | ✅ PROTÉGÉ | Aucune URL utilisateur arbitraire n'est résolue ou téléchargée côté serveur. Les appels externes sont restreints aux endpoints statiques configurés (`STORAGE_ENDPOINT`, `STRIPE_API`, LLM Providers). |
| **Injections SQL** | ✅ PROTÉGÉ | 100% des requêtes utilisent l'ORM SQLAlchemy 2.0 avec requêtes paramétrées compilées (`select()`, `where()`). Aucune concaténation de chaînes SQL brutes. |
| **Abus d'Upload & Path Traversal** | ✅ PROTÉGÉ | Génération de clés d'objets opaques aléatoires côté serveur (`uuid4().hex`). Le nom de fichier original est assaini et stocké uniquement comme métadonnée. Quota serveur de 10 uploads/jour. |
| **Rate Limiting Distribué** | ✅ PROTÉGÉ | Compteurs atomiques Redis (`INCR` + `EXPIRE`) avec fallback en mémoire. Fenêtres d'étranglement par catégorie d'API. |
| **Autorisation WebSockets & Salles** | ✅ PROTÉGÉ | Handshake WebSocket exigeant un token JWT valide. Le `room_id` est aléatoire (64 bits d'entropie) et le serveur vérifie que l'utilisateur figure parmi les participants autorisés de la session. |
| **Contournement des Droits (Entitlements)**| ✅ PROTÉGÉ | Vérification en base de données de la possession active d'un produit (`UserEntitlementGrant`) ou d'un solde de crédits suffisant (`CreditAccount`) avant toute action payante. |
| **Manipulation de Prix** | ✅ PROTÉGÉ | Les montants des articles (`OrderItem.price_cents`) sont extraits des enregistrements officiels en base (`ProductPrice`), ignorant tout montant soumis par le client. |
| **Usurpation de Webhook (Webhook Spoofing)** | ✅ PROTÉGÉ | Vérification cryptographique de la signature Stripe (`stripe.Webhook.construct_event`) avec horodatage pour prévenir les attaques par rejeu. |
| **Élévation de Privilèges** | ✅ PROTÉGÉ | L'auto-inscription via l'API publique force le rôle `STUDENT` même si un payload tente de spécifier `role: "admin"`. Seuls les admins authentifiés peuvent modifier un rôle. |
| **Abus de Session & Déconnexion** | ✅ PROTÉGÉ | Révocation immédiate du token d'accès (`jti` mis en liste noire Redis) et révocation en base du `RefreshToken`. |

---

## 2. Dépendances et Analyse de Vulnérabilités (SCA)

- **Scanner d'audit Python** : `pip-audit` exécuté sur l'ensemble du verrou `uv.lock`.
- **Scanner d'audit JavaScript** : `pnpm audit` sur les dépendances du frontend web.
- **Résultat** : Zéro vulnérabilité critique (CVSS $\ge 9.0$) ou haute (CVSS $\ge 7.0$) active dans l'arbre d'exécution de production.

---

## 3. Recommandations de Durcissement Post-Bêta

1. **2FA / Authentification Multi-Facteurs** : Implémenter TOTP (Google Authenticator / YubiKey) pour tous les comptes administrateurs avant l'ouverture générale au public.
2. **WAF Cloud Dédié** : Interposer un pare-feu applicatif (Cloudflare WAF / AWS WAF) pour le filtrage DDoS volumétrique lors de la montée en charge.
3. **Pentest Externe Indépendant** : Mandater un cabinet d'audit externe certifié PASSI avant la commercialisation publique à grande échelle.
