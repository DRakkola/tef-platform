"""Anonymous pseudonym generator for student-to-student audio speaking practice.

Strictly protects student privacy by never revealing real names, emails,
or platform identities.
"""

import hashlib
import secrets
import uuid

FRENCH_ADJECTIVES = [
    "Audacieux",
    "Bienveillant",
    "Boréal",
    "Brillant",
    "Calme",
    "Captivant",
    "Céleste",
    "Courageux",
    "Créatif",
    "Curieux",
    "Discret",
    "Dynamique",
    "Éclairé",
    "Éloquent",
    "Éphémère",
    "Flamboyant",
    "Harmonieux",
    "Ingénieux",
    "Intrépide",
    "Lumineux",
    "Méthodique",
    "Nocturne",
    "Paisible",
    "Passionné",
    "Patient",
    "Pensif",
    "Prévoyant",
    "Serein",
    "Solaire",
    "Spontané",
    "Subtil",
    "Tenace",
    "Vaillant",
    "Vigilant",
    "Visionnaire",
]

FRENCH_NOUNS = [
    "Aigle",
    "Alpin",
    "Artisan",
    "Astronaute",
    "Aventurier",
    "Bâtisseur",
    "Castor",
    "Chamois",
    "Chevalier",
    "Colibri",
    "Condor",
    "Dauphin",
    "Écureuil",
    "Épervier",
    "Érudit",
    "Explorateur",
    "Faucon",
    "Flâneur",
    "Guide",
    "Hirondelle",
    "Lynx",
    "Marin",
    "Messager",
    "Navigateur",
    "Observateur",
    "Orateur",
    "Pèlerin",
    "Penseur",
    "Phénix",
    "Pionnier",
    "Renard",
    "Sentinelle",
    "Voyageur",
]


def generate_anonymous_alias(seed_key: uuid.UUID | str | None = None) -> str:
    """Generate a neutral French pseudonym with a numeric discriminator (e.g. 'Voyageur Boréal #482').

    If seed_key is provided, generates pseudo-random identifier based on hash.
    """
    if seed_key:
        digest = hashlib.sha256(str(seed_key).encode()).hexdigest()
        n_idx = int(digest[0:4], 16) % len(FRENCH_NOUNS)
        adj_idx = int(digest[4:8], 16) % len(FRENCH_ADJECTIVES)
        code = int(digest[8:12], 16) % 900 + 100
        noun = FRENCH_NOUNS[n_idx]
        adj = FRENCH_ADJECTIVES[adj_idx]
        return f"{noun} {adj} #{code}"

    noun = secrets.choice(FRENCH_NOUNS)
    adj = secrets.choice(FRENCH_ADJECTIVES)
    code = secrets.randbelow(900) + 100
    return f"{noun} {adj} #{code}"
