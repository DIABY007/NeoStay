# Guide OTP Reutilisable (Scan complet + Playbook)

## 1) Objectif du document
Ce document explique, de facon operationnelle et transferable, comment integrer une authentification OTP WhatsApp/SMS dans un projet web (Next.js + API routes + Supabase), en s'appuyant sur l'implementation reelle observee dans ce workspace.

But final: pouvoir reprendre ce guide sur un nouveau projet et reconstruire le flux OTP sans ambiguite.

---

## 2) Scan minutieux: ce qui existe deja dans ce workspace

### 2.1 Projet `neostay-web` (implementation principale)
Flux observe:
1. L'utilisateur saisit son numero dans l'UI login.
2. Front appelle `POST /api/auth/send-otp`.
3. Le serveur valide le format E.164, verifie que le numero existe dans `profiles`.
4. Le serveur genere un code OTP (6 chiffres), envoie via Wasender API.
5. Le serveur cree un token OTP signe (HMAC), stocke en cookie httpOnly `neostay_otp_state`.
6. Front affiche l'etape de saisie OTP.
7. Front appelle `POST /api/auth/verify-otp` avec le code.
8. Le serveur verifie le cookie OTP signe + expiration + hash du code.
9. Si OK, le serveur charge le profil (`profiles`), cree la session applicative (cookies custom), supprime le cookie OTP.
10. Front redirige selon role (`super_admin` / `hotel_admin`).

Fichiers cles:
- `neostay-web/app/login/login-form.tsx`
- `neostay-web/app/api/auth/send-otp/route.ts`
- `neostay-web/app/api/auth/verify-otp/route.ts`
- `neostay-web/lib/otp.ts`
- `neostay-web/lib/wasender.ts`
- `neostay-web/proxy.ts`
- `neostay-web/lib/auth/super-admin.ts`
- `neostay-web/lib/auth/hotel-admin.ts`
- `neostay-web/lib/supabase/server.ts`

### 2.2 Projet `NeoCare` (pattern proche)
- Meme architecture OTP signee cote serveur (`lib/otp.ts`, routes send/verify).
- Meme principe cookie OTP httpOnly + verification serveur.
- Confirmation que le pattern retenu est reutilisable sur plusieurs domaines metier.

---

## 3) Architecture OTP recommandee (reutilisable)

### 3.1 Composants obligatoires
1. **UI Login** (2 etapes): numero -> OTP.
2. **Route send-otp**: validation input, verification compte, generation code, envoi provider, emission cookie OTP.
3. **Route verify-otp**: verification code + token signe + expiration, creation session, nettoyage cookie OTP.
4. **Store utilisateur**: table metier liant telephone et role (ex: `profiles`, `users`).
5. **Middleware/guards**: protection routes selon role.
6. **Provider de transport OTP**: Wasender, Twilio, provider SMS/WhatsApp, etc.

### 3.2 Regles de securite minimales
1. Le code OTP ne doit jamais etre valide uniquement cote client.
2. Le code OTP ne doit jamais etre stocke en clair en cookie/localStorage.
3. Le token OTP doit etre signe (HMAC) et expire.
4. Le cookie OTP doit etre `httpOnly`, `sameSite=lax`, `secure` en prod.
5. La session post-OTP doit etre verifiee cote serveur sur chaque route protegee.
6. Ajouter rate limit sur `send-otp` et `verify-otp` (IP + telephone).

---

## 4) Prerequis Data Model

Exemple minimal de table metier utilisateur:

```sql
create table if not exists public.profiles (
  id uuid primary key,
  phone_number text not null unique,
  role text not null check (role in ('super_admin', 'hotel_admin')),
  hotel_id uuid null
);
```

Regle critique:
- Le numero utilise pour OTP doit deja exister en base si vous faites un login admin ferme (`shouldCreateUser=false` equivalent metier).

---

## 5) Variables d'environnement standard

```dotenv
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
OTP_SIGNING_SECRET=
WASENDER_API_URL=
WASENDER_API_KEY=
```

Bonnes pratiques:
1. `OTP_SIGNING_SECRET` dedie (ne pas dependre du service role key).
2. Rotation immediate de toute cle exposee accidentellement.
3. Ne jamais commiter des cles reelles.

---

## 6) Implementation technique pas a pas

### Etape A - Helper OTP signe (`lib/otp.ts`)
A implementer:
1. `generateOtpCode()` -> 6 chiffres.
2. `createOtpStateToken(phone, code)`:
   - hash du code (`sha256(code:secret)`),
   - payload `{ phone, codeHash, expiresAt }`,
   - signature HMAC du payload encode,
   - retour `payload.signature`.
3. `verifyOtpStateToken(token, code)`:
   - verifier format,
   - verifier signature,
   - decoder payload,
   - verifier expiration,
   - comparer hash du code recu.

Pourquoi ce design:
- Pas de stockage OTP en base obligatoire.
- Verification stateless, rapide, solide contre manipulation client.

### Etape B - Route `send-otp`
Contrat:
- Input JSON: `{ phone: string }`
- Output success: `{ success: true, message }`
- Output error: `{ success: false, error }`

Pipeline serveur:
1. Nettoyer le numero (`cleanPhone`).
2. Valider E.164 (`/^\+[1-9]\d{6,14}$/`).
3. Verifier existence utilisateur en base (ex: `profiles.phone_number`).
4. Generer code OTP.
5. Envoyer OTP via provider (`sendOtpWhatsApp(phone, code)`).
6. Generer token OTP signe.
7. Poser cookie httpOnly `OTP_STATE_COOKIE` avec `maxAge = OTP_TTL`.

### Etape C - Route `verify-otp`
Contrat:
- Input JSON: `{ code: string }`
- Output success: `{ success: true, user: { id, role, ... } }`

Pipeline serveur:
1. Valider format code (`6 chiffres`).
2. Lire cookie OTP.
3. Verifier token OTP + code (`verifyOtpStateToken`).
4. Charger profil metier en base via telephone.
5. Creer session applicative (cookies serveur).
6. Supprimer cookie OTP.
7. Retourner role + infos minimales au front.

### Etape D - UI Login 2 etapes
Pattern front:
1. Etape `phone`: numero local + prefix pays.
2. Bouton `Envoyer code` -> `send-otp`.
3. Etape `otp`: saisie 6 chiffres.
4. Bouton `Verifier` -> `verify-otp`.
5. Redirection selon role.

### Etape E - AuthZ et middleware
1. Middleware lit la session (Supabase session ou cookies custom verifies).
2. Charge role + scope (ex: `hotel_id`, `hotel_slug`).
3. Applique les redirections de securite:
   - super_admin hors `/admin/[slug]`
   - hotel_admin limite a son slug
4. APIs sensibles reutilisent des guards serveur (`ensureSuperAdmin`, `ensureHotelAdminForSlug`).

---

## 7) Sequence complete (reference)

1. `POST /api/auth/send-otp` avec telephone.
2. Validation + lookup user.
3. Envoi OTP provider.
4. Cookie OTP signe pose.
5. `POST /api/auth/verify-otp` avec code.
6. Verification signature + hash + expiration.
7. Lookup profil + role.
8. Creation cookies session.
9. Suppression cookie OTP.
10. Redirection metier.

---

## 8) Checklists de qualite (obligatoire)

### 8.1 Securite
1. OTP verifie uniquement cote serveur.
2. Cookie OTP httpOnly + expire.
3. Session invalidee a logout.
4. Rate limit send/verify.
5. Anti brute-force (max tentatives par OTP).
6. Logs sans fuite de code OTP ni secrets.

### 8.2 Robustesse
1. Validation stricte telephone/code.
2. Messages d'erreur utilisateur propres.
3. Gestion provider down (retry/backoff message clair).
4. Monitoring envoi OTP (succes/echec).

### 8.3 Produit
1. UX claire: etat d'envoi, erreur, renvoi OTP.
2. Timer de renvoi OTP (cooldown 30-60s).
3. Accessibilite input OTP (numeric input + autocomplete).

---

## 9) Plan d'integration sur un nouveau projet (copier-coller process)

1. Creer `lib/otp.ts` avec token signe HMAC + TTL.
2. Creer `app/api/auth/send-otp/route.ts`.
3. Creer `app/api/auth/verify-otp/route.ts`.
4. Brancher provider OTP (`lib/wasender.ts` ou autre).
5. Definir table metier utilisateur (`profiles`/`users`) + role.
6. Creer composant login 2 etapes.
7. Ajouter cookies session + middleware.
8. Ajouter guards serveur pour APIs privees.
9. Ajouter rate-limit + tentative max.
10. Ecrire tests manuels/E2E (happy path + erreurs).

Temps moyen:
- MVP OTP securise: 1 a 2 jours.
- Version production durcie (rate-limit, audit, tests): 3 a 5 jours.

---

## 10) Gabarits de tests manuels (a reutiliser)

### Test 1 - Happy path
1. Numero connu.
2. OTP recu.
3. OTP correct.
4. Session creee.
5. Redirection role OK.

### Test 2 - Numero inconnu
1. send-otp avec numero absent.
2. Reponse 404 metier attendue.

### Test 3 - OTP invalide
1. send-otp OK.
2. verify-otp avec mauvais code.
3. Reponse 401 attendue.

### Test 4 - OTP expire
1. send-otp.
2. Attendre TTL depasse.
3. verify-otp -> echec expiration.

### Test 5 - Abuse
1. 10 requetes send-otp rapides.
2. Le systeme doit throttler/refuser proprement.

---

## 11) Erreurs frequentes a eviter

1. Valider OTP cote client uniquement.
2. Laisser le front envoyer le `phone` a `verify-otp` sans verifier le contexte serveur.
3. Utiliser un cookie session non signe.
4. Melanger role/slug sans controle centralise.
5. Exposer des secrets dans docs ou logs.

---

## 12) Decision rapide: OTP provider vs Supabase natif

### Option A - Provider externe (Wasender/Twilio)
A choisir si:
1. Besoin WhatsApp direct hors canaux natifs.
2. Controler contenu des messages.
3. Besoin multi-provider.

### Option B - Supabase Auth OTP natif
A choisir si:
1. Vouloir session Supabase standard de bout en bout.
2. Reduire code custom auth.
3. Accepter limites du canal/provider configure.

Recommandation pratique:
- Si architecture multi-roles metier complexe + exigences custom messaging: Option A.
- Si time-to-market court et auth standard: Option B.

---

## 13) Resume executif

Le pattern OTP le plus robuste et reutilisable vu ici est:
1. OTP genere/verifie exclusivement cote serveur.
2. Etat OTP stocke dans un token signe et expire en cookie httpOnly.
3. Session applicative creee seulement apres verification OTP.
4. Autorisation centralisee via middleware + guards serveur.
5. Rate-limit et hygiene secrets obligatoires pour la prod.

Ce schema est deja prouve dans ce workspace sur plusieurs projets et peut etre porte tel quel vers un nouveau codebase avec adaptation des entites metier (`profiles/users`, `hotel/clinic`, roles).
