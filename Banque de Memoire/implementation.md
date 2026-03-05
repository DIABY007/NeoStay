Voici un plan de mise en œuvre détaillé, conçu spécifiquement pour guider des développeurs (ou des agents d'IA) dans la construction de **NeoStay**.

J'ai découpé le projet en petites étapes logiques, sans aucun code, en me basant strictement sur votre PRD.

## Decisions Fonctionnelles Validees (MVP)

* **Document de reference :** `implementation.md` est la base d'execution, tant que cela n'introduit pas de contradiction logique ou bug metier.
* **OTP :** Authentification par **WhatsApp uniquement** (pas de fallback SMS au MVP).
* **Paiement :** Paiement hors plateforme via **Mobile Money** avec **upload de capture d'ecran** comme preuve.
* **Inventaire :** Gestion au niveau **`room_type`** avec `total_quantity`.
* **Statuts de reservation MVP :** `pending`, `confirmed`, `cancelled`, `expired`.
* **Tarifs :** L'**Admin Hotel** peut modifier ses tarifs (Super Admin conserve tous les droits).
* **Page publique :** Rendu **SSR dynamique** pour des disponibilites a jour.
* **Preuves de paiement :** Stockage dans **Supabase Storage prive** avec **URL signee**.
* **Branding MVP :** `logo`, `description`, `theme_color`, `hero_title`, `hero_subtitle`, `theme_template` (2 options predefinies).
* **Langue MVP :** **Francais uniquement** (preparation i18n possible sans activation multilingue).

## Parametres Operationnels Verrouilles

* **Expiration `pending` :** 2 heures apres creation (`expires_at = created_at + 2h`).
* **Preuve de paiement :** Facultative a la soumission initiale (upload possible plus tard).
* **Validation d'une reservation :** Autorisee pour `hotel_admin` et `super_admin`.
* **Timezone de reference :** `Africa/Abidjan` (UTC+0) pour toutes les regles metier de dates/heures.
* **Contraintes upload preuve :** `jpg`, `png`, `pdf`, taille maximale 5 Mo.
* **Notification automatique a l'expiration :** Non incluse au MVP.

---

# 🗺️ Plan de Mise en Œuvre : NeoStay

## Phase 1 : Initialisation du Projet & Configuration

**Étape 1.1 : Initialiser l'application front-end**

* **Action :** Créer un nouveau projet Next.js avec l'App Router, configurer Tailwind CSS, et initialiser shadcn/ui.
* **Test de validation :** Lancer le serveur de développement. La page d'accueil par défaut de Next.js doit s'afficher sans erreur de style.

**Étape 1.2 : Configurer le projet Supabase**

* **Action :** Créer un projet sur Supabase. Récupérer l'URL de l'API et la clé anonyme, puis les configurer dans les variables d'environnement du projet Next.js.
* **Test de validation :** Exécuter une requête simple depuis l'application Next.js (ex: récupérer la date du serveur Supabase) et vérifier que la connexion est établie.

---

## Phase 2 : Modélisation de la Base de Données (Single Database, Multi-Tenant)

**Étape 2.1 : Créer la table des Hôtels (Tenants)**

* **Action :** Créer la table `hotels` avec les colonnes : `id`, `name`, `slug` (unique), `whatsapp_number`, `theme_color`, `description`, `hero_title`, `hero_subtitle`, `theme_template` (`classic`/`modern`), `status`.
* **Test de validation :** Insérer manuellement une ligne de test via le dashboard Supabase et vérifier qu'elle s'enregistre correctement.

**Étape 2.2 : Créer la table des Utilisateurs et Rôles**

* **Action :** Créer une table `profiles` (liée à l'authentification Supabase) avec les colonnes : `id`, `phone_number`, `role` (super_admin ou hotel_admin), et `hotel_id` (clé étrangère vers `hotels`, nullable pour le super admin).
* **Test de validation :** Créer un utilisateur fictif avec le rôle `hotel_admin` et vérifier que la contrainte de clé étrangère vers `hotels` fonctionne.

**Étape 2.3 : Créer les tables du Catalogue et des Réservations**

* **Action :** Créer la table `room_types` (`id`, `hotel_id`, `name`, `description`, `price_per_night`, `total_quantity`). Créer la table `bookings` (`id`, `hotel_id`, `room_type_id`, `guest_name`, `guest_phone`, `check_in_date`, `check_out_date`, `status`, `payment_proof_path`, `expires_at`).
* **Test de validation :** Insérer une chambre et une réservation fictive liées à un `hotel_id` spécifique via le dashboard Supabase.

**Étape 2.4 : Mettre en place les politiques de sécurité (RLS - Row Level Security)**

* **Action :** Activer la RLS sur les tables `hotels`, `room_types`, et `bookings`. Créer une politique stipulant qu'un utilisateur avec le rôle `hotel_admin` ne peut lire, insérer, ou modifier que les lignes où le `hotel_id` correspond à son propre `hotel_id`.
* **Test de validation :** Écrire deux requêtes de test en simulant l'identité de l'Administrateur de l'Hôtel A. Vérifier qu'il peut lire les chambres de l'Hôtel A, mais que la requête retourne "0 résultat" s'il tente de lire les chambres de l'Hôtel B.

---

## Phase 3 : Authentification (Zéro-Mot-de-Passe)

**Étape 3.1 : Configurer l'authentification par téléphone**

* **Action :** Activer le fournisseur d'authentification par téléphone dans Supabase (Phone Auth). Connecter l'API Wasender pour l'envoi de l'OTP via WhatsApp uniquement.
* **Test de validation :** Déclencher l'envoi d'un OTP depuis l'interface d'administration Supabase vers un numéro de test et vérifier la réception du message.

**Étape 3.2 : Créer l'interface de connexion**

* **Action :** Créer une page `/login` avec un champ pour le numéro de téléphone et un bouton "Envoyer le code". Créer l'état suivant avec un champ pour saisir le code OTP à 6 chiffres.
* **Test de validation :** Saisir un numéro, recevoir le code, saisir le code sur la page, et vérifier que l'utilisateur est bien connecté (session active).

**Étape 3.3 : Implémenter le routage basé sur les rôles**

* **Action :** Créer un middleware Next.js. Si l'utilisateur est connecté et a le rôle `super_admin`, le rediriger vers `/super-admin`. S'il a le rôle `hotel_admin`, le rediriger vers `/admin/[hotel_slug]`.
* **Test de validation :** Se connecter avec un compte `hotel_admin` et vérifier la redirection automatique vers le bon dashboard.

---

## Phase 4 : Dashboard Super Admin

**Étape 4.1 : Interface de création d'un Hôtel**

* **Action :** Sur `/super-admin`, créer un formulaire pour ajouter un nouvel hôtel (Nom, Slug, Numéro WhatsApp de l'hôtel). Soumettre les données vers la table `hotels`.
* **Test de validation :** Remplir le formulaire, soumettre, et vérifier que le nouvel hôtel apparaît dans la liste des hôtels du Super Admin.

**Étape 4.2 : Interface de gestion des accès Hôteliers**

* **Action :** Ajouter une fonctionnalité permettant au Super Admin d'assigner un numéro de téléphone à un hôtel spécifique (création d'un profil `hotel_admin` lié au `hotel_id`).
* **Test de validation :** Assigner un numéro, se déconnecter du Super Admin, se connecter avec ce nouveau numéro via OTP, et vérifier l'accès au dashboard de l'hôtel assigné.

---

## Phase 5 : Dashboard Admin Hôtel (Configuration)

**Étape 5.1 : Interface de gestion du Catalogue de Chambres**

* **Action :** Sur `/admin/[slug]/rooms`, créer un tableau listant les types de chambres de cet hôtel. Ajouter un formulaire permettant de créer/modifier un type de chambre (Nom, prix, quantité physique disponible).
* **Test de validation :** Créer un type "Suite Royale" avec une quantité de "2". Rafraîchir la page et vérifier que la donnée persiste.

**Étape 5.2 : Personnalisation de l'Hôtel**

* **Action :** Créer une page `/admin/[slug]/settings` pour permettre à l'hôtelier de modifier son logo, sa description, sa couleur principale, son titre/sous-titre hero, et son template (`classic` ou `modern`) dans la table `hotels`.
* **Test de validation :** Changer la couleur principale et le template, sauvegarder, et vérifier que la mise à jour est effective en base de données et visible sur la page publique.

---

## Phase 6 : Page Publique de Réservation (Espace Client)

**Étape 6.1 : Créer la page vitrine dynamique**

* **Action :** Créer la route dynamique publique `/h/[slug]` en **SSR dynamique**. Récupérer les informations de l'hôtel et la liste de ses chambres depuis la base de données en fonction du slug.
* **Test de validation :** Visiter `/h/mon-hotel-test`. Vérifier que le nom, la description et les types de chambres créés à l'étape 5.1 s'affichent correctement.

**Étape 6.2 : Moteur de sélection de dates (Nuitées)**

* **Action :** Ajouter un sélecteur de dates (Date Picker) permettant de choisir une date de Check-in et une date de Check-out. Calculer automatiquement le nombre de nuits.
* **Test de validation :** Sélectionner le 10 mars en Check-in et le 12 mars en Check-out. Vérifier que le système affiche "2 nuits" et met à jour le prix total affiché pour chaque chambre.

---

## Phase 7 : Moteur de Réservation et Disponibilité

**Étape 7.1 : Logique de vérification des disponibilités**

* **Action :** Créer une route API qui prend en entrée des dates et un `hotel_id`. L'API doit compter combien de réservations `confirmed` et `pending` non expirées chevauchent ces dates pour chaque type de chambre, et soustraire ce nombre de la `total_quantity`.
* **Test de validation :** Bloquer artificiellement toutes les quantités d'une "Suite Royale" pour les dates du 15 au 20. Sur la page publique, chercher ces dates et vérifier que la "Suite Royale" est marquée comme "Indisponible".

**Étape 7.2 : Soumission du formulaire de réservation**

* **Action :** Créer le formulaire de collecte d'informations du client (Nom, Téléphone, demande spéciale, upload optionnel de preuve de paiement Mobile Money). À la soumission, créer une entrée dans `bookings` avec le statut `pending` et `expires_at` fixé à +2h (timezone `Africa/Abidjan`). Si un fichier est fourni, l'uploader en stockage privé et renseigner `payment_proof_path`.
* **Test de validation :** Soumettre une réservation sans preuve puis une réservation avec preuve. Vérifier que les deux lignes sont créées en base et que `payment_proof_path` est rempli uniquement quand un fichier est uploadé.

**Étape 7.2.b : Upload de preuve après soumission**

* **Action :** Ajouter une action sécurisée permettant d'attacher une preuve à une réservation `pending` déjà créée (formats `jpg/png/pdf`, max 5 Mo), depuis un lien de suivi ou depuis le dashboard admin.
* **Test de validation :** Créer une réservation sans preuve, puis uploader une preuve plus tard et vérifier la mise à jour de `payment_proof_path`.

**Étape 7.3 : Expiration automatique des réservations en attente**

* **Action :** Mettre en place une tâche planifiée (cron/edge function) qui passe les réservations `pending` en `expired` après 2 heures si elles ne sont pas validées. Aucune notification WhatsApp automatique n'est envoyée au MVP.
* **Test de validation :** Créer une réservation `pending` avec un `expires_at` court. Laisser expirer et vérifier le passage automatique en `expired` ainsi que la liberation de disponibilité.

---

## Phase 8 : Intégration WhatsApp

**Étape 8.1 : Redirection Client vers WhatsApp (Post-réservation)**

* **Action :** Juste après la création de la réservation en base (Étape 7.2), générer une URL `wa.me` contenant le numéro WhatsApp de l'hôtel et un texte pré-rempli (ex: "Bonjour, je viens de réserver..."). Rediriger le client vers cette URL.
* **Test de validation :** Faire une réservation de bout en bout sur un smartphone (ou navigateur simulé). Vérifier que l'application WhatsApp s'ouvre avec le bon message.

---

## Phase 9 : Dashboard Admin Hôtel (Gestion Quotidienne)

**Étape 9.1 : Tableau de bord des réservations**

* **Action :** Sur la page d'accueil du dashboard Admin Hôtel, lister les réservations (`pending`, `confirmed`, `cancelled`, `expired`).
* **Test de validation :** Se connecter en tant qu'admin de l'hôtel, vérifier que la réservation effectuée à l'étape 7.2 est visible.

**Étape 9.2 : Validation des réservations et Bouton Contact**

* **Action :** Ajouter des boutons d'action sur chaque réservation pour modifier le statut (Passer de `pending` à `confirmed` ou `cancelled`; `expired` est géré automatiquement). Cette action est disponible pour `hotel_admin` et `super_admin`. Ajouter un bouton "Contacter le client" qui génère un lien WhatsApp pré-rempli vers le numéro du client.
* **Test de validation :** Confirmer une réservation depuis un compte `hotel_admin`, puis depuis un compte `super_admin` (sur un autre cas). Vérifier que les droits fonctionnent et que les disponibilités sont impactées (refaire le test de l'Étape 7.1).

---

**Comment souhaitez-vous procéder ?** Voulez-vous que l'on détaille une phase spécifique en premier (comme la logique complexe de la base de données et des disponibilités) avant de passer le relais à vos développeurs ?