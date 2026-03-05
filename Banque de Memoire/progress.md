## Journal d'avancement - NeoStay

### Date

- 2026-03-05

### Phase 1 terminee

Le socle technique de la plateforme a ete initialise et valide localement.

### Travaux realises

- Creation du frontend Next.js (App Router + TypeScript + Tailwind + ESLint).
- Initialisation de shadcn/ui.
- Ajout du client Supabase JS (`@supabase/supabase-js`).
- Ajout d'un fichier d'exemple d'environnement: `neostay-web/.env.example`.
- Configuration runtime Supabase (server utility): `neostay-web/lib/supabase/server.ts`.
- Creation d'une route de verification de connectivite: `neostay-web/app/api/health/supabase/route.ts`.
- Remplacement de la page d'accueil starter par une page de verification projet: `neostay-web/app/page.tsx`.
- Mise a jour de la documentation de demarrage: `neostay-web/README.md`.

### Verification effectuee

- `npm run lint`: OK.
- `npm run build`: OK.
- `GET /api/health/supabase`: OK (`ok: true`) avec variables Supabase renseignees.

### Decisions techniques importantes

- L'application est dans `neostay-web/` (et non a la racine) car le dossier racine `NeoHotel` contient des majuscules et ne respecte pas les regles de nommage npm.
- La cle `SUPABASE_SERVICE_ROLE_KEY` est definie en variable serveur (non `NEXT_PUBLIC_`), donc non exposee au client.

### Prochaine etape

- Phase 2: modelisation de la base de donnees multi-tenant et politiques RLS.

## Mise a jour - Phase 2 (demarree)

### Livrable ajoute

- Fichier de migration SQL: `neostay-web/supabase/migrations/202603050330_phase2_schema_rls.sql`

### Contenu du livrable

- Creation des tables coeur: `hotels`, `profiles`, `room_types`, `bookings`.
- Contraintes metier MVP (roles, statuts de reservation, quantite, dates).
- Triggers `updated_at` sur tables mutables.
- Index de base pour les recherches hotel/chambres/reservations.
- Activation RLS sur les 4 tables.
- Policies RLS pour `super_admin` (acces global) et `hotel_admin` (acces scope `hotel_id`).
- Fonctions helpers RLS: `is_super_admin()` et `current_hotel_id()`.

### Validation attendue (par vous)

1. Executer la migration SQL dans Supabase SQL Editor.
2. Verifier la creation des tables et policies.
3. Tester les droits RLS avec un `hotel_admin` et un `super_admin`.

### Limite volontaire (hors Phase 2)

- Aucune logique OTP/WhatsApp n'est implementee ici (Phase 3+).
- Aucun moteur de disponibilite (Phase 7).

## Mise a jour - Phase 3 (terminee)

### Livrables ajoutes

- `neostay-web/app/login/page.tsx`
- `neostay-web/app/login/login-form.tsx`
- `neostay-web/app/super-admin/page.tsx`
- `neostay-web/app/admin/[hotelSlug]/page.tsx`
- `neostay-web/lib/supabase/browser.ts`
- `neostay-web/lib/supabase/middleware.ts`
- `neostay-web/proxy.ts`

### Implementation

- Interface de connexion OTP (`/login`) en 2 etapes: saisie numero puis verification code.
- Envoi OTP via `supabase.auth.signInWithOtp` avec canal `whatsapp`.
- Verification OTP via `supabase.auth.verifyOtp`.
- Routage role-based centralise dans `proxy.ts`:
	- `super_admin` -> `/super-admin`
	- `hotel_admin` -> `/admin/[hotelSlug]`
	- blocage d'acces cross-role.
- Creation de pages dashboard placeholder pour valider le flux de redirection de la phase 3.

### Verification effectuee

- `npm run lint`: OK.
- `npm run build`: OK.

### Notes importantes

- Next.js 16 utilise `proxy.ts` (et non `middleware.ts`).
- Le branchement exact du provider WhatsApp (Wasender) depend de la configuration OTP cote Supabase/provider.

## Mise a jour - OTP inspire de NeoCare

### Ajustements appliques

- Formulaire OTP remanie en flow 2 etapes proche du modele NeoCare:
	- etape numero
	- etape code OTP
- Validation stricte du numero local (digits only, longueur fixe) avec prefixe visuel pays.
- Validation stricte du code OTP (6 chiffres).
- Ajout gestion expiration OTP locale (10 min) pour feedback utilisateur.
- Ajout actions "Retour" et "Renvoyer OTP".
- Conservation de l'auth Supabase (`signInWithOtp` + `verifyOtp`) pour rester compatible avec le routage par roles deja en place.

## Mise a jour - Phase 4 (terminee)

### Livrables ajoutes

- `neostay-web/app/api/super-admin/hotels/route.ts`
- `neostay-web/app/api/super-admin/hotel-admins/route.ts`
- `neostay-web/app/super-admin/super-admin-console.tsx`
- `neostay-web/lib/auth/super-admin.ts`

### Livrables modifies

- `neostay-web/app/super-admin/page.tsx`
- `neostay-web/lib/supabase/server.ts`

### Fonctions implementees

- Super Admin: creation d'un hotel (tenant) via formulaire et API dediee.
- Super Admin: consultation de la liste des hotels existants.
- Super Admin: assignation d'un numero de telephone a un hotel admin:
	- creation user `auth.users` si inexistant
	- upsert dans `profiles` avec role `hotel_admin` + `hotel_id`.
- Securisation des endpoints super admin par verification session + role (`ensureSuperAdmin`).

### Verification effectuee

- `npm run lint`: OK.
- `npm run build`: OK.

### Limite volontaire

- Pas encore de suspension/reactivation hotel (hors phase 4 actuelle, a ajouter ensuite si necessaire).

## Mise a jour - Phase 5 (terminee)

### Livrables ajoutes

- `neostay-web/lib/auth/hotel-admin.ts`
- `neostay-web/supabase/migrations/202603050430_phase5_hotel_logo.sql`
- `neostay-web/app/api/admin/hotels/[hotelSlug]/room-types/route.ts`
- `neostay-web/app/api/admin/hotels/[hotelSlug]/room-types/[roomTypeId]/route.ts`
- `neostay-web/app/api/admin/hotels/[hotelSlug]/settings/route.ts`
- `neostay-web/app/admin/[hotelSlug]/rooms/page.tsx`
- `neostay-web/app/admin/[hotelSlug]/rooms/rooms-manager.tsx`
- `neostay-web/app/admin/[hotelSlug]/settings/page.tsx`
- `neostay-web/app/admin/[hotelSlug]/settings/settings-form.tsx`

### Livrables modifies

- `neostay-web/app/admin/[hotelSlug]/page.tsx`

### Fonctions implementees

- Dashboard admin hotel: gestion des types de chambres (creation + listing + maj rapide quantite).
- Dashboard admin hotel: personnalisation hotel (description, couleur, hero, template, logo_url).
- APIs admin securisees par verification `hotel_admin` + controle du slug hotel.
- Extension schema branding: ajout `logo_url` sur `hotels` (migration phase 5).

### Verification effectuee

- `npm run lint`: OK.
- `npm run build`: OK.

### Limite volontaire

- Upload physique du logo non implemente (seule URL logo est geree ici).

## Mise a jour - Phase 6 (terminee)

### Livrables ajoutes

- `neostay-web/app/h/[slug]/page.tsx`
- `neostay-web/app/h/[slug]/booking-catalog.tsx`

### Fonctions implementees

- Page publique dynamique `/h/[slug]` en SSR (`dynamic = force-dynamic`).
- Affichage vitrine hotel:
	- nom/hero
	- description
	- logo (si present)
	- couleur branding.
- Affichage catalogue `room_types`.
- Selecteur dates check-in/check-out avec logique nuitee.
- Calcul automatique du total par type de chambre (`nights * price_per_night`).

### Verification effectuee

- `npm run lint`: OK.
- `npm run build`: OK.

### Limite volontaire

- Verification de disponibilite temps reel non incluse ici (phase 7).

## Mise a jour - Phase 7 (terminee)

### Livrables ajoutes

- `neostay-web/lib/bookings/availability.ts`
- `neostay-web/app/api/public/hotels/[slug]/availability/route.ts`
- `neostay-web/app/api/public/hotels/[slug]/bookings/route.ts`
- `neostay-web/app/api/admin/hotels/[hotelSlug]/bookings/[bookingId]/proof/route.ts`
- `neostay-web/app/api/cron/expire-pending-bookings/route.ts`
- `neostay-web/supabase/migrations/202603050500_phase7_storage.sql`

### Livrables modifies

- `neostay-web/app/h/[slug]/booking-catalog.tsx`
- `neostay-web/app/h/[slug]/page.tsx`
- `neostay-web/.env.example`

### Fonctions implementees

- API disponibilite par date:
	- compte les reservations `confirmed`
	- inclut les `pending` non expirees
	- retourne stock restant par `room_type`.
- Creation reservation publique `pending` avec:
	- validation dates et disponibilite
	- `expires_at` a +2h
	- upload optionnel preuve (jpg/png/pdf, max 5 Mo) en bucket prive `payment-proofs`.
- Endpoint admin hotel pour upload preuve apres soumission (`booking pending`).
- Endpoint cron securise (`CRON_SECRET`) pour passage auto `pending` -> `expired`.
- UI publique enrichie:
	- verification disponibilite live
	- formulaire reservation client
	- message de confirmation avec reference reservation.

### Verification effectuee

- `npm run lint`: OK.
- `npm run build`: OK.

### Limites connues

- Le controle anti-course est applicatif (verification puis insertion), pas encore transactionnel verrouille SQL.
- Le lien de suivi client pour upload preuve n'est pas encore implemente (upload admin disponible).

## Mise a jour - Phase 8 (terminee)

### Livrables modifies

- `neostay-web/app/api/public/hotels/[slug]/bookings/route.ts`
- `neostay-web/lib/bookings/availability.ts`
- `neostay-web/app/h/[slug]/booking-catalog.tsx`

### Fonctions implementees

- Apres creation d'une reservation `pending`, l'API genere une URL `wa.me` avec message pre-rempli.
- Le message WhatsApp resume la demande client:
	- reference reservation
	- hotel
	- type de chambre
	- dates
	- client/telephone.
- L'UI publique redirige automatiquement le client vers WhatsApp apres succes de reservation.

### Verification effectuee

- `npm run lint`: OK.
- `npm run build`: OK.

## Mise a jour - Phase 9 (terminee)

### Livrables ajoutes

- `neostay-web/lib/auth/hotel-operator.ts`
- `neostay-web/app/api/admin/hotels/[hotelSlug]/bookings/route.ts`
- `neostay-web/app/api/admin/hotels/[hotelSlug]/bookings/[bookingId]/status/route.ts`
- `neostay-web/app/admin/[hotelSlug]/bookings-manager.tsx`

### Livrables modifies

- `neostay-web/app/admin/[hotelSlug]/page.tsx`

### Fonctions implementees

- Dashboard admin hotel: liste des reservations avec filtre par status.
- Statuts affiches: `pending`, `confirmed`, `cancelled`, `expired`.
- Actions sur reservation:
	- `Confirmer`
	- `Annuler`
	- `Contacter client` (lien WhatsApp pre-rempli).
- API de changement de statut (`confirmed`/`cancelled`) securisee.
- Autorisation etendue: operateur hotel = `hotel_admin` ou `super_admin` (cote API).

### Verification effectuee

- `npm run lint`: OK.
- `npm run build`: OK.

## Mise a jour - Stabilisation Production (option 1)

### Livrables ajoutes

- `neostay-web/supabase/migrations/202603050545_phase9_booking_atomic.sql`

### Livrables modifies

- `neostay-web/app/api/public/hotels/[slug]/bookings/route.ts`
- `neostay-web/app/h/[slug]/booking-catalog.tsx`
- `neostay-web/next.config.ts`

### Renforcements appliques

- Anti-concurrence reservation:
	- creation reservation `pending` passe par une fonction SQL atomique
	- verifie disponibilite et insere dans la meme transaction logique (`FOR UPDATE` sur `room_types`).
- Gestion d'erreurs API plus robuste pour creation reservation:
	- mapping explicite des erreurs metier (`NO_AVAILABILITY`, `ROOM_TYPE_NOT_FOUND`, `INVALID_STAY_DATES`).
- UX formulaire reservation:
	- remonte un warning si upload preuve echoue mais reservation deja creee
	- redirection WhatsApp apres court delai pour laisser le feedback visible.
- Runtime image durci:
	- configuration `next/image` pour logos distants (`remotePatterns`).

### Verification effectuee

- `npm run lint`: OK.
- `npm run build`: OK.

