# Guide de Déploiement Gratuit sur Koyeb — TEF Platform

Ce guide explique comment héberger le backend complet de la plateforme TEF (FastAPI, Celery Worker, Migrations Alembic, WebSockets audio) **100% gratuitement à vie** sur **[Koyeb](https://www.koyeb.com)**, combiné avec **Supabase** (PostgreSQL) et **Upstash** (Redis).

---

## 1. Pourquoi Koyeb est la meilleure alternative gratuite à Render ?

| Caractéristique | Render (Plan Gratuit) | Koyeb (Plan Gratuit Eco) |
| :--- | :--- | :--- |
| **Mise en veille** | ❌ S'endort après 15 min d'inactivité (*cold start* > 50s) | ✅ **Toujours actif (Always-On)**, aucune mise en veille |
| **Durée de vie PostgreSQL** | ❌ Détruit au bout de 30 jours | ✅ Délégué à Supabase (**persistant à vie**) |
| **Worker Celery** | ❌ Payant obligatoire ($7/mois) | ✅ **Inclus dans le même conteneur** via `start.sh` |
| **WebSockets (Examinateur Live)** | ⚠️ Déconnexions lors des mises en veille | ✅ **Connexions WSS stables et continues** |
| **Carte bancaire requise** | Non | Non pour démarrer |

---

## 2. Architecture Gratuite (0 € / mois)

```mermaid
flowchart TD
    subgraph Frontend ["Frontend (Vercel)"]
        VercelApp["Application Web React (Hobby Gratuit)"]
    end

    subgraph KoyebCloud ["Koyeb Cloud (Compute Gratuit - 512 Mo)"]
        subgraph Container ["Conteneur Docker tef-api"]
            Uvicorn["FastAPI (HTTP & WebSockets - Port 8000)"]
            Celery["Celery Worker + Beat Scheduler (Background)"]
            Alembic["Alembic Auto-Migrations (au démarrage)"]
        end
    end

    subgraph DataStores ["Bases de données Managées Gratuites"]
        Supabase[("Supabase\nPostgreSQL 16\n(500 Mo Gratuit)")]
        Upstash[("Upstash Redis\n(10 000 requêtes/jour Gratuit)")]
        R2[("Cloudflare R2\nStockage S3 Audio\n(10 Go Gratuit, 0€ egress)")]
    end

    VercelApp -->|"REST HTTPS /api/v1"| Uvicorn
    VercelApp -->|"WSS Duplex Audio"| Uvicorn
    Uvicorn -->|"asyncpg"| Supabase
    Uvicorn -->|"Cache / State"| Upstash
    Uvicorn -->|"Uploads Audio"| R2
    Celery -->|"Async Tasks"| Upstash
    Celery -->|"Results"| Supabase
```

---

## 3. Pré-requis : Créer les 3 services gratuits (5 minutes)

### A. Base de données PostgreSQL sur Supabase (Gratuit)
1. Créez un compte sur [supabase.com](https://supabase.com).
2. Cliquez sur **New Project**, donnez un nom (ex: `tef-platform`) et définissez un mot de passe fort pour la base.
3. Allez dans **Project Settings** $\rightarrow$ **Database** $\rightarrow$ **Connection String**.
4. Sélectionnez l'onglet **URI** (mode *Session* ou *Direct*, port 5432).
5. Copiez l'URL :
   ```text
   postgresql://postgres:[VOTRE-MOT-DE-PASSE]@db.[VOTRE-REF].supabase.co:5432/postgres
   ```
   *(Le backend TEF convertit automatiquement cette URL en `postgresql+asyncpg://`).*

### B. Redis Serverless sur Upstash (Gratuit)
1. Créez un compte sur [upstash.com](https://upstash.com).
2. Cliquez sur **Create Database**, nommez-la `tef-redis`, choisissez la région la plus proche (ex: `eu-central-1` ou `us-east-1`).
3. Dans l'onglet **Details**, faites défiler jusqu'à **REST API & Connect** et copiez l'URL **Redis (rediss://)** :
   ```text
   rediss://default:[TOKEN]@[ENDPOINT].upstash.io:6379
   ```

### C. Stockage Audio S3 : Supabase Storage (100% S3-compatible, Inclus !)
Vous pouvez utiliser **directement le stockage Supabase** sans avoir besoin de créer un compte supplémentaire sur Cloudflare :

1. Dans votre projet Supabase, allez dans **Storage** $\rightarrow$ **New bucket** :
   - Nom : `tef-private`
   - Visibilité : **Private bucket**
2. Allez dans **Project Settings** $\rightarrow$ **Storage** $\rightarrow$ **S3 Access Keys** :
   - Cliquez sur **Create new access key**.
   - Notez précieusement :
     - **Endpoint S3** : `<VOTRE-PROJECT-REF>.supabase.co/storage/v1/s3`
     - **Access Key ID**
     - **Secret Access Key**
     - **Region** : la région de votre projet Supabase (ex: `eu-central-1` ou `us-east-1`).

*(Alternative : Cloudflare R2 peut également être utilisé si vous avez besoin de 10 Go gratuits au lieu de 1 Go).*

---

## 4. Déploiement sur Koyeb (Pas-à-pas)

### Étape 1 : Créer une Application sur Koyeb
1. Connectez-vous sur [app.koyeb.com](https://app.koyeb.com).
2. Cliquez sur **Create Service**.
3. Choisissez **GitHub** comme méthode de déploiement et autorisez l'accès à votre dépôt `tef-platform`.

### Étape 2 : Configurer le Build Docker
1. Dans la section **Builder**, sélectionnez **Dockerfile**.
2. Renseignez :
   - **Dockerfile location** : `apps/api/Dockerfile`
   - **Docker context** : `apps/api`
3. Koyeb utilisera automatiquement [`apps/api/start.sh`](file:///c:/Users/MSI/Documents/GitHub/tef-platform/apps/api/start.sh) pour :
   - Exécuter les migrations de schéma (`alembic upgrade head`).
   - Démarrer le worker Celery et le planificateur Beat en arrière-plan.
   - Démarrer le serveur FastAPI Uvicorn au premier plan sur le port défini par Koyeb.

### Étape 3 : Type d'Instance
1. Dans **Instance**, sélectionnez **Nano** (Gratuit avec 512 Mo de RAM, 0.1 vCPU).
2. Choisissez la région la plus proche de votre base Supabase (ex: Francfort `fra` ou Washington `was`).

### Étape 4 : Ports & Sondes de Santé
1. Dans **Ports** :
   - Port interne : `8000`
   - Protocole : `HTTP` (Koyeb gère automatiquement le routage HTTPS et les WebSockets).
2. Dans **Health checks** :
   - Type : `HTTP`
   - Path : `/health/live`
   - Port : `8000`

### Étape 5 : Variables d'Environnement
Ajoutez les variables suivantes dans la console Koyeb :

| Clé | Valeur | Description |
| :--- | :--- | :--- |
| `ENVIRONMENT` | `production` | Active le mode production. |
| `DATABASE_URL` | `postgresql://postgres:[PWD]@db.[REF].supabase.co:5432/postgres` | URL de la base Supabase. |
| `REDIS_URL` | `rediss://default:[TOKEN]@[ENDPOINT].upstash.io:6379` | URL Redis Upstash (avec double `s` pour TLS). |
| `SECRET_KEY` | *(Chaîne aléatoire $\ge 32$ caractères)* | Signature JWT et sessions. |
| `CORS_ORIGINS` | `["https://votre-app.vercel.app"]` | Origine de votre frontend Vercel. |
| `COOKIE_SAMESITE` | `lax` *(ou `none` si domaines séparés sans proxy)* | Politique de cookie. |
| `STORAGE_ENDPOINT` | `<VOTRE-REF>.supabase.co/storage/v1/s3` | Endpoint S3 Supabase Storage. |
| `STORAGE_ACCESS_KEY` | `<access-key-id>` | Clé S3 Supabase. |
| `STORAGE_SECRET_KEY` | `<secret-access-key>` | Clé secrète S3 Supabase. |
| `STORAGE_BUCKET_NAME` | `tef-private` | Nom du bucket Supabase. |
| `STORAGE_REGION` | `eu-central-1` (ou région du projet) | Région de votre projet Supabase. |
| `STORAGE_USE_SSL` | `true` | Active HTTPS/TLS pour le stockage. |
| `GEMINI_API_KEY` | `<votre-cle-gemini>` | Clé pour l'examinateur virtuel et l'audio. |

### Étape 6 : Lancer le Déploiement
Cliquez sur **Deploy**. Koyeb compile l'image Docker, applique les migrations, démarre l'API et affiche votre URL publique (ex: `https://tef-api-[user].koyeb.app`).

---

## 5. Raccorder le Frontend Vercel à Koyeb

Une fois votre API Koyeb en ligne :

1. Ouvrez votre projet sur **Vercel** $\rightarrow$ **Settings** $\rightarrow$ **Environment Variables**.
2. Configurez :
   - **`VITE_API_URL`** = `https://tef-api-[user].koyeb.app/api/v1`
   - **`VITE_WS_URL`** = `wss://tef-api-[user].koyeb.app/api/v1`
3. Déclenchez un redéploiement sur Vercel.

Votre plateforme TEF est désormais **100% opérationnelle en production, sans interruption de service et à coût zéro**.
