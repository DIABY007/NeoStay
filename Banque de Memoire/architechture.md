## Architecture actuelle (MVP - etat apres Phase 1)

### Vue d'ensemble

Le repository est separe en deux zones:

- `Banque de Memoire/`: documentation produit, plan de mise en oeuvre et suivi.
- `neostay-web/`: application Next.js qui contient le code executable.

## Role de chaque fichier (documentation)

### `Banque de Memoire/prd.md`

- Source produit (vision, personas, fonctionnalites, regles metier).

### `Banque de Memoire/implementation.md`

- Plan d'implementation detaille par phases.
- Contient les decisions MVP verrouillees (OTP WhatsApp only, statuts, inventaire, etc.).

### `Banque de Memoire/progress.md`

- Journal d'execution technique.
- Sert a transmettre ce qui a ete fait, valide et ce qui reste a faire.

### `Banque de Memoire/architechture.md`

- Cartographie de l'architecture et role des fichiers pour onboarding rapide des futurs devs.

## Role de chaque fichier (application)

### `neostay-web/package.json`

- Definition des dependances et scripts (`dev`, `build`, `start`, `lint`).

### `neostay-web/.env.example`

- Template des variables d'environnement requises (Supabase URL + anon key).

### `neostay-web/.env.local`

- Valeurs locales reelles de configuration (non versionnees).
- Contient aussi `SUPABASE_SERVICE_ROLE_KEY` pour les operations serveur privilegiees futures.

### `neostay-web/app/page.tsx`

- Page d'accueil provisoire de verification de setup (Phase 1).

### `neostay-web/app/api/health/supabase/route.ts`

- Endpoint de sante pour valider la configuration env et l'accessibilite de Supabase.

### `neostay-web/lib/supabase/server.ts`

- Point central pour creer le client Supabase cote serveur et valider les variables d'environnement.
- Expose aussi:
	- client serveur avec cookies (session user)
	- client `service_role` pour operations admin securisees.

### `neostay-web/lib/supabase/browser.ts`

- Client Supabase cote navigateur pour les flux auth interactifs (OTP).

### `neostay-web/lib/supabase/middleware.ts`

- Fabrique du client Supabase utilise par `proxy.ts` avec gestion cookies.

### `neostay-web/README.md`

- Guide d'installation, configuration env, lancement et verification de la Phase 1.

### `neostay-web/components.json`

- Configuration de shadcn/ui.

### `neostay-web/proxy.ts`

- Garde d'acces global (ancien middleware) pour proteger les routes et gerer les redirections par role.

### `neostay-web/lib/auth/super-admin.ts`

- Garde d'autorisation cote serveur pour les endpoints super admin.
- Verifie session utilisateur et role `super_admin`.

### `neostay-web/lib/auth/hotel-admin.ts`

- Garde d'autorisation cote serveur pour routes admin hotel.
- Verifie:
	- session utilisateur
	- role `hotel_admin`
	- correspondance `hotel_id` <-> `hotelSlug`.

### `neostay-web/lib/auth/hotel-operator.ts`

- Garde d'autorisation pour operations reservation hotel.
- Autorise `hotel_admin` (sur son hotel) et `super_admin` (sur tout hotel cible).

### `neostay-web/app/login/page.tsx` et `neostay-web/app/login/login-form.tsx`

- Interface de connexion OTP (numero + verification code).
- `login-form.tsx` suit un pattern inspire de NeoCare: flow en 2 etapes, validation stricte, retour, renvoi OTP, expiration locale du code.

### `neostay-web/app/super-admin/page.tsx`

- Ecran de destination du role `super_admin` (placeholder phase 3).

### `neostay-web/app/admin/[hotelSlug]/page.tsx`

- Ecran de destination du role `hotel_admin` scope par slug hotel (placeholder phase 3).
- Point d'entree dashboard admin avec liens vers `rooms` et `settings` (phase 5).
- En phase 9: integre le module de gestion quotidienne des reservations.

### `neostay-web/app/admin/[hotelSlug]/bookings-manager.tsx`

- UI de gestion reservations:
	- listing + filtre status
	- actions confirmer/annuler
	- bouton contact client via WhatsApp.

### `neostay-web/app/admin/[hotelSlug]/rooms/page.tsx` et `rooms-manager.tsx`

- Interface de gestion du catalogue de types de chambres.
- Creation et visualisation des `room_types`.

### `neostay-web/app/admin/[hotelSlug]/settings/page.tsx` et `settings-form.tsx`

- Interface de personnalisation hotel (description, couleur, hero, template, logo_url).

### `neostay-web/app/h/[slug]/page.tsx`

- Page publique hotel (SSR dynamique).
- Charge les donnees hotel + catalogue de chambres par slug.

### `neostay-web/app/h/[slug]/booking-catalog.tsx`

- Composant client pour:
	- selection check-in/check-out
	- calcul du nombre de nuitees
	- calcul du prix total par type de chambre.
- En phase 7:
	- interroge l'API de disponibilite
	- propose la creation de reservation `pending`
	- permet upload optionnel de preuve.
- En phase 8:
	- redirige automatiquement le client vers WhatsApp apres reservation reussie.

### `neostay-web/lib/bookings/availability.ts`

- Service metier disponibilite (serveur):
	- validation dates de sejour
	- calcul stock restant par `room_type`
	- prise en compte des `pending` non expirees.

### `neostay-web/app/super-admin/super-admin-console.tsx`

- Interface fonctionnelle Phase 4:
	- creation hotel
	- chargement liste hotels
	- assignation admin hotel.

### `neostay-web/app/api/super-admin/hotels/route.ts`

- API super admin pour:
	- `GET`: lister les hotels
	- `POST`: creer un hotel.

### `neostay-web/app/api/super-admin/hotel-admins/route.ts`

- API super admin pour assigner un numero de telephone a un hotel admin.
- Cree l'utilisateur auth si necessaire puis met a jour `profiles`.

### `neostay-web/app/api/admin/hotels/[hotelSlug]/room-types/route.ts`

- API admin hotel pour lister et creer les types de chambres de son hotel.

### `neostay-web/app/api/admin/hotels/[hotelSlug]/room-types/[roomTypeId]/route.ts`

- API admin hotel pour modifier un type de chambre existant.

### `neostay-web/app/api/admin/hotels/[hotelSlug]/settings/route.ts`

- API admin hotel pour lire/modifier les parametres branding de son hotel.

### `neostay-web/app/api/public/hotels/[slug]/availability/route.ts`

- API publique de disponibilite par dates (`checkIn`, `checkOut`).

### `neostay-web/app/api/public/hotels/[slug]/bookings/route.ts`

- API publique de creation de reservation `pending` avec preuve optionnelle.
- En phase 8:
	- construit une URL `wa.me` avec message pre-rempli
	- renvoie `whatsappUrl` au front.
- En stabilisation:
	- s'appuie sur une fonction SQL atomique pour reduire les surbookings en concurrence.

### `neostay-web/app/api/admin/hotels/[hotelSlug]/bookings/[bookingId]/proof/route.ts`

- API admin hotel pour attacher une preuve de paiement apres la soumission initiale.

### `neostay-web/app/api/admin/hotels/[hotelSlug]/bookings/route.ts`

- API operateur hotel pour lister les reservations (filtrables par status).

### `neostay-web/app/api/admin/hotels/[hotelSlug]/bookings/[bookingId]/status/route.ts`

- API operateur hotel pour modifier le statut d'une reservation (`confirmed`/`cancelled`).

### `neostay-web/app/api/cron/expire-pending-bookings/route.ts`

- Endpoint technique pour automatiser l'expiration des reservations `pending` via cron securise.

### `neostay-web/supabase/migrations/202603050430_phase5_hotel_logo.sql`

- Migration schema phase 5: ajout de `logo_url` a la table `hotels`.

### `neostay-web/supabase/migrations/202603050500_phase7_storage.sql`

- Migration stockage phase 7:
	- creation/configuration du bucket prive `payment-proofs`
	- limite taille 5 Mo
	- formats autorises: jpg/png/pdf.

### `neostay-web/supabase/migrations/202603050545_phase9_booking_atomic.sql`

- Fonction SQL `create_pending_booking_atomic(...)`:
	- verrouille le `room_type` cible
	- recalcule la disponibilite en base
	- cree la reservation `pending` de maniere atomique.

### `neostay-web/next.config.ts`

- Configuration `images.remotePatterns` pour supporter les logos distants avec `next/image`.

### `neostay-web/lib/utils.ts`

- Utilitaires front standard (fusion de classes CSS avec `clsx`/`tailwind-merge`).

### `neostay-web/supabase/migrations/202603050330_phase2_schema_rls.sql`

- Migration SQL versionnee pour la Phase 2.
- Definit le schema relationnel multi-tenant et les politiques RLS initiales.
- Point d'entree pour la creation de la base avant d'attaquer les phases applicatives.

## Convention de structure recommandee (suite)

- `app/`: routes publiques et dashboards (App Router).
- `lib/`: clients, services et utilitaires techniques.
- `supabase/migrations/`: scripts SQL versionnes (schema, RLS, evolutions).