#!/bin/bash
# ----------------------------------------------------------------------------
# publiceer.sh — de app testen en publiceren in één commando
# ----------------------------------------------------------------------------
# Gebruik (in Terminal, in de projectmap):
#   ./publiceer.sh "Korte omschrijving van de aanpassing"
#
# Wat het doet, en waar het stopt:
#   1. iCloud: haalt de .git-map volledig binnen (enkel zolang het project in iCloud staat).
#   2. Haalt de laatste versie van GitHub binnen, zodat er nooit werk overschreven wordt.
#   3. Draait alle tests (npm test). Faalt er één, dan wordt er NIETS gepubliceerd.
#   4. Bouwt de app (npm run build). Lukt dat niet, dan wordt er NIETS gepubliceerd.
#   5. Toont welke bestanden mee gaan en vraagt om bevestiging.
#   6. Commit en push — Vercel zet de nieuwe versie daarna automatisch online.
#
# Bewust geen "git add -A": enkel de app-mappen en de gekende projectbestanden gaan mee, zodat
# bv. een .env-bestand met sleutels of een dossierbackup nooit per ongeluk op GitHub belandt.
# Tests overslaan kan enkel bewust: ./publiceer.sh --zonder-tests "omschrijving"
set -u
cd "$(dirname "$0")" || exit 1

ZONDER_TESTS=0
if [ "${1:-}" = "--zonder-tests" ]; then ZONDER_TESTS=1; shift; fi
BERICHT="${1:-}"
if [ -z "$BERICHT" ]; then
  echo "Geef een omschrijving mee, bv.:  ./publiceer.sh \"Verslag: kopregel aangepast\""
  exit 1
fi

rood() { printf "\033[31m%s\033[0m\n" "$1"; }
groen() { printf "\033[32m%s\033[0m\n" "$1"; }

# 1. iCloud
if command -v brctl >/dev/null 2>&1 && [[ "$PWD" == *"/Desktop/"* || "$PWD" == *"Mobile Documents"* ]]; then
  brctl download .git >/dev/null 2>&1
fi
# een achtergebleven vergrendeling van een vorige, afgebroken git-opdracht
if [ -f .git/index.lock ] && ! pgrep -x git >/dev/null; then
  echo "Oude git-vergrendeling gevonden — wordt opgeruimd."
  rm -f .git/index.lock
fi

# 2. laatste versie
echo "→ Laatste versie ophalen…"
if ! git pull --ff-only --quiet; then
  rood "Kon de laatste versie niet ophalen (git pull). Er staan waarschijnlijk wijzigingen op GitHub die botsen."
  rood "Niets gepubliceerd. Vraag Claude om hulp met de melding hierboven."
  exit 1
fi

if ! command -v npm >/dev/null 2>&1; then
  rood "npm is niet geïnstalleerd — installeer Node.js (nodejs.org) of publiceer met --zonder-tests."
  exit 1
fi
[ -d node_modules ] || { echo "→ Pakketten installeren (eenmalig)…"; npm install --no-audit --no-fund || exit 1; }

# 3. tests
if [ "$ZONDER_TESTS" = "0" ]; then
  echo "→ Tests draaien…"
  if ! npm test --silent; then
    rood "Er faalt een test — niets gepubliceerd. Stuur de melding hierboven naar Claude."
    exit 1
  fi
  groen "Alle tests geslaagd."
else
  rood "Tests overgeslagen (--zonder-tests)."
fi

# 4. build
echo "→ App bouwen…"
if ! npm run build --silent >/tmp/taxatie-build.log 2>&1; then
  tail -20 /tmp/taxatie-build.log
  rood "De app bouwt niet — niets gepubliceerd. Stuur de melding hierboven naar Claude."
  exit 1
fi
groen "Bouwen gelukt."

# 5. bestanden kiezen
git add -u
for pad in src api supabase docs public .github index.html package.json package-lock.json vercel.json \
           vite.config.js tailwind.config.js postcss.config.js README.md .gitignore publiceer.sh .puppeteerrc.cjs \
           handleiding-taxatie-app-huyzen.pdf; do
  [ -e "$pad" ] && git add "$pad"
done
if git diff --cached --quiet; then
  echo "Niets te publiceren — alles staat al online."
  exit 0
fi
echo
echo "Deze bestanden gaan mee:"
git diff --cached --name-status | sed 's/^/   /'
echo
read -r -p "Publiceren met omschrijving \"$BERICHT\"? (j/N) " ANTWOORD
if [ "$ANTWOORD" != "j" ] && [ "$ANTWOORD" != "J" ]; then
  git reset --quiet
  echo "Afgebroken — er is niets gewijzigd."
  exit 0
fi

# 6. commit en push
git commit --quiet -m "$BERICHT" || exit 1
if git push --quiet; then
  groen "Gepubliceerd. Vercel zet de nieuwe versie binnen 1 à 2 minuten online."
else
  rood "Push mislukt — de commit staat wel lokaal klaar. Probeer later opnieuw: git push"
  exit 1
fi
