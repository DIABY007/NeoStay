# 📋 Product Requirements Document (PRD) : NeoStay

## 1. 🚀 Résumé Exécutif & Vision

**NeoStay** est une plateforme SaaS multi-tenant permettant de générer et de gérer des pages de réservation sur-mesure pour des hôtels, maisons d'hôtes et résidences indépendantes.
La plateforme offre aux hôteliers un outil "clé en main" pour recevoir des réservations directes (sans les commissions de Booking/Airbnb), gérer leurs disponibilités via un tableau de bord sécurisé (OTP), et communiquer instantanément avec leurs clients via WhatsApp.

**Objectif principal :** Démocratiser la réservation en ligne pour les petits et moyens hébergements grâce à une interface simple, sans mot de passe, et centrée sur la communication WhatsApp.

---

## 2. 👥 Personas et Rôles Utilisateurs

### 👑 Super Admin (Le Propriétaire de la Plateforme / Vous)

* **Objectif :** Gérer les abonnements des hôtels, configurer de nouvelles pages, et surveiller l'activité globale.
* **Besoins :** Vue centralisée de tous les hôtels (tenants), création rapide d'un nouvel hôtel, gestion des accès.

### 🏨 Admin Hôtel (Le Gérant ou Réceptionniste)

* **Objectif :** Recevoir les réservations, gérer les disponibilités des chambres, contacter les clients.
* **Besoins :** Connexion très rapide (OTP mobile), vue calendrier/liste des arrivées, bouton d'action rapide vers WhatsApp.

### 🧳 Client (Le Voyageur)

* **Objectif :** Réserver une chambre facilement depuis son smartphone.
* **Besoins :** Interface fluide, photos claires, sélection intuitive des dates (Check-in / Check-out), confirmation immédiate et rassurante sur WhatsApp.

---

## 3. ✨ Fonctionnalités Principales (MVP - Minimum Viable Product)

### 3.1. Espace Client (Page Publique de l'Hôtel)

* **URL Personnalisée :** `neostay.com/h/[nom-hotel]`
* **Page Vitrine :** Affichage du nom, logo, description, et photos de l'établissement.
* **Moteur de recherche de dates :** Sélecteur Check-in / Check-out.
* **Catalogue de Chambres :** Liste des types de chambres (ex: Standard, Suite) avec description, capacité, prix par nuit et photos.
* **Formulaire de Réservation :** Nom, Prénom, Téléphone, Demande spéciale, et option d'upload de preuve de paiement (Capture d'écran transfert mobile).
* **Redirection WhatsApp :** À la validation, ouverture de WhatsApp avec un message pré-généré résumant la demande de réservation, envoyé directement au numéro de l'hôtel.

### 3.2. Dashboard Admin Hôtel

* **Authentification Zéro-Mot-de-Passe :** Connexion via numéro de téléphone + OTP envoyé par WhatsApp ou SMS.
* **Gestion des Réservations :** * Liste des demandes (En attente, Confirmée, Annulée).
* Bouton "Contacter le client" (ouvre un chat WhatsApp pré-rempli).
* Validation ou refus d'une réservation (met à jour le calendrier).


* **Gestion du Catalogue :** Création/modification des types de chambres, ajout de photos, définition des tarifs.
* **Calendrier des disponibilités :** Vue globale pour bloquer ou débloquer manuellement des dates (ex: maintenance d'une chambre).

### 3.3. Dashboard Super Admin

* **Gestion des Tenants (Hôtels) :** Créer, modifier, suspendre un hôtel.
* **Configuration Hôtelier :** Assigner le slug (URL), le numéro WhatsApp de réception, les couleurs de la page (branding).
* **Gestion des Administrateurs :** Ajouter le numéro de téléphone du gérant autorisé à se connecter à un hôtel spécifique.
* **Statistiques Globales :** Nombre de réservations totales, hôtels les plus actifs.

---

## 4. 🏗️ Architecture Technique et Sécurité

### Stack Technologique Recommandée

* **Frontend :** Next.js (App Router), Tailwind CSS, shadcn/ui.
* **Backend & Base de données :** Supabase (PostgreSQL).
* **Messagerie & OTP :** WasenderAPI (ou équivalent type Twilio/Meta API) pour l'envoi des codes et messages transactionnels WhatsApp.
* **Hébergement :** Vercel.

### Sécurité et Multi-Tenancy

* **Single Database, Multi-Tenant :** Tous les hôtels sont sur la même base de données.
* **Row Level Security (RLS) :** Politique stricte sur PostgreSQL pour garantir que `hotel_id` filtre toutes les requêtes. Un Admin Hôtel ne peut techniquement pas requêter les réservations d'un autre `hotel_id`.
* **Validation des dates :** Logique côté serveur pour empêcher la surréservation (double-booking) sur les mêmes dates pour une même chambre physique.

---

## 5. 📅 Règles Métier Spécifiques à l'Hôtellerie

* **Logique de Nuitée (vs Créneau) :** Une réservation du 10 au 12 signifie 2 nuits (Check-in le 10, Check-out le 12). La chambre est à nouveau disponible pour un Check-in le 12.
* **Inventaire :** Un "Type de chambre" (ex: Chambre Double) peut avoir une "Quantité" (ex: 3 chambres identiques disponibles). Le système doit vérifier que les réservations confirmées ne dépassent pas cette quantité pour des dates données.

