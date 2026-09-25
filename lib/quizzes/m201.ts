import type { QuizDefinition } from "../quizzes";

export const M201_QUIZ: QuizDefinition = {
  moduleId: "M201",
  title: "Quiz M201 — Les activités du module",
  description:
    "20 questions basées sur l'ensemble des activités M201 : PSSI, rançongiciels, attaques Web OWASP/CWE, protection des applications, référentiels réglementaires, risques Cloud et cas pratiques.",
  questions: [
    {
      id: "m201-q1",
      question: "Quelle est la fonction principale d'un PSSI ?",
      options: [
        "Définir les règles, procédures et responsabilités pour protéger les ressources informationnelles",
        "Définir le budget informatique de l'entreprise",
        "Recruter et former le personnel informatique",
      ],
      correctIndex: 0,
      source: "PSSI.pdf",
    },
    {
      id: "m201-q2",
      question:
        "Dans la hiérarchie du PSSI, quel niveau donne le « comment faire » aux équipes et aux utilisateurs ?",
      options: [
        "La politique de sécurité (niveau 1)",
        "Les directives et règles de sécurité (niveau 2)",
        "Les procédures et guides (niveau 3)",
      ],
      correctIndex: 2,
      source: "PSSI.pdf",
    },
    {
      id: "m201-q3",
      question: "Dans le PSSI, qui élabore, contrôle et met à jour la politique de sécurité ?",
      options: ["Le RSSI", "Seulement les utilisateurs", "Le service marketing"],
      correctIndex: 0,
      source: "PSSI.pdf",
    },
    {
      id: "m201-q4",
      question: "Selon le guide de création d'une PSSI, quelle est la première étape de la démarche ?",
      options: [
        "Analyser les risques",
        "Définir le périmètre",
        "Faire valider la PSSI par la direction",
      ],
      correctIndex: 1,
      source: "PSSI_Etapes_Creation.pdf",
    },
    {
      id: "m201-q5",
      question:
        "Quel principe fondamental du guide PSSI signifie que les actions importantes doivent pouvoir être enregistrées et analysées ?",
      options: ["La disponibilité", "La traçabilité", "L'intégrité"],
      correctIndex: 1,
      source: "PSSI_Etapes_Creation.pdf",
    },
    {
      id: "m201-q6",
      question:
        "Dans l'évolution des attaques par rançongiciel, que désigne le « Ransomware as a Service » (RaaS) ?",
      options: [
        "Un rançongiciel qui chiffre uniquement les serveurs",
        "Un modèle dans lequel un groupe loue son rançongiciel à d'autres opérateurs contre une part des rançons",
        "Une méthode de paiement de la rançon uniquement en cryptomonnaie",
      ],
      correctIndex: 1,
      source: "P1-ACTIVITÉ 2 - Réaliser une recherche sur les dernières attaques par rançongiciel.v0.3.pdf",
    },
    {
      id: "m201-q7",
      question: "Devant un message de rançon affiché sur le poste de travail, quelle est la première action du technicien ?",
      options: [
        "Payer la rançon pour débloquer les fichiers au plus vite",
        "Isoler la machine du réseau et alerter immédiatement la sécurité",
        "Éteindre puis rallumer l'ordinateur pour éliminer le logiciel malveillant",
      ],
      correctIndex: 1,
      source: "P1-ACTIVITÉ 2 - Réaliser une recherche sur les dernières attaques par rançongiciel.v0.3.pdf",
    },
    {
      id: "m201-q8",
      question: "Comment doivent être les sauvegardes pour vraiment protéger l'entreprise ?",
      options: [
        "Automatiques et testées régulièrement",
        "Stockées uniquement sur le serveur de production",
        "Réalisées une fois par an",
      ],
      correctIndex: 0,
      source: "P1-ACTIVITÉ 3 - Quiz - Comprendre le PSSI.pdf",
    },
    {
      id: "m201-q9",
      question:
        "Une application sert les factures via GET /invoices/{id} sans vérifier que l'identifiant appartient à l'utilisateur connecté. Quelle est la vulnérabilité ?",
      options: ["Broken Access Control / IDOR", "Injection SQL", "CSRF"],
      correctIndex: 0,
      source: "P2-ACTIVITÉ 1 - 10 scénarios d’attaque web.pdf",
    },
    {
      id: "m201-q10",
      question:
        "Une application télécharge une URL fournie par l'utilisateur sans valider l'hôte ni la plage d'IP, ce qui permet d'atteindre l'intranet. De quelle vulnérabilité s'agit-il ?",
      options: [
        "SSRF (Server-Side Request Forgery)",
        "SSTI (Server-Side Template Injection)",
        "XSS stocké",
      ],
      correctIndex: 0,
      source: "P2-ACTIVITÉ 1 - 10 scénarios d’attaque web[Éléments de correction].pdf",
    },
    {
      id: "m201-q11",
      question:
        "L'application rend du contenu utilisateur via un moteur de templates (Jinja/Twig) et autorise les éléments interprétables par ce moteur. Quelle attaque ?",
      options: [
        "SSTI — Server-Side Template Injection",
        "XSS reflété",
        "Désérialisation non sécurisée",
      ],
      correctIndex: 0,
      source: "P2-ACTIVITÉ 1 - 10 scénarios d’attaque web[Éléments de correction].pdf",
    },
    {
      id: "m201-q12",
      question: "Dans le tableau des CWE autorisés par l'activité, à quoi correspondent CWE-89 et CWE-79 ?",
      options: [
        "CWE-89 : requête SQL manipulée — CWE-79 : script injecté dans une page web (XSS)",
        "CWE-89 : XSS — CWE-79 : injection SQL",
        "CWE-89 : mot de passe par défaut — CWE-79 : composant obsolète",
      ],
      correctIndex: 0,
      source: "P2-ACTIVITÉ 3 - Comprendre les attaques Web (OWASP + CWE).v0.3.pdf",
    },
    {
      id: "m201-q13",
      question: "Quelles associations CWE sont correctes ?",
      options: [
        "CWE-601 : redirection / phishing — CWE-400 : DoS — CWE-798 : mot de passe par défaut",
        "CWE-601 : injection SQL — CWE-400 : XSS — CWE-798 : chiffrement",
        "CWE-601 : sauvegarde — CWE-400 : journalisation — CWE-798 : mises à jour",
      ],
      correctIndex: 0,
      source: "P2-ACTIVITÉ 4 - Classifier les attaques selon OWASP.V0.3.pdf",
    },
    {
      id: "m201-q14",
      question:
        "Dans l'analyse des vulnérabilités avancées, une application peut atteindre une ressource interne via une URL manipulée, et l'une de ses bibliothèques n'est plus mise à jour. Quels CWE correspondent ?",
      options: [
        "CWE-918 (SSRF) et CWE-1104 (composant obsolète)",
        "CWE-89 et CWE-20",
        "CWE-384 et CWE-601",
      ],
      correctIndex: 0,
      source: "P2-ACTIVITÉ 5 - Analyse des vulnérabilités avancées.v0.1.pdf",
    },
    {
      id: "m201-q15",
      question:
        "Dans la famille « Sécuriser l'authentification et les accès », quelles mesures doivent être placées ?",
      options: [
        "MFA, CAPTCHA, rate limiting, contrôle des autorisations et gestion sécurisée des sessions",
        "Requêtes SQL préparées, encodage des sorties et validation des entrées",
        "HTTPS, chiffrement des données et sauvegardes",
      ],
      correctIndex: 0,
      source: "P2-ACTIVITÉ 6 - Bonnes pratiques de protection des applications Web.v0.2.pdf",
    },
    {
      id: "m201-q16",
      question:
        "Un administrateur déclare : « Nous allons installer un pare-feu et un WAF, l'application sera alors sécurisée. » Que faut-il répondre ?",
      options: [
        "C'est vrai, le pare-feu et le WAF bloquent toutes les attaques",
        "C'est faux : une seule solution ne suffit pas, il faut une défense en profondeur (entrées, application, serveur, données, surveillance, sauvegardes)",
        "C'est vrai à condition que le pare-feu soit récent",
      ],
      correctIndex: 1,
      source: "P2-ACTIVITÉ 6 - Bonnes pratiques de protection des applications Web.v0.2.pdf",
    },
    {
      id: "m201-q17",
      question:
        "Lors de l'inscription des stagiaires, quelles autorités et quel cadre juridique sont associés à la protection des données personnelles ?",
      options: [
        "La loi 09-08 / RGPD, la CNDP au Maroc, la DGSSI en cas de cyberattaque, la CNIL en France",
        "La DGSSI uniquement, sans obligation de consentement",
        "Le antivirus de l'établissement",
      ],
      correctIndex: 0,
      source: "P2-ACTIVITÉ 7 - Appliquer les référentiels réglementaires de la cybersécurité.pdf",
    },
    {
      id: "m201-q18",
      question:
        "Dans l'étude de cas des risques sur le Cloud, quels types de risques l'activité demande-t-il de traiter chez les fournisseurs choisis ?",
      options: [
        "Les risques sur les données, les attaques par rançongiciel et les attaques par déni de service (DoS)",
        "Uniquement les risques sur les données",
        "Les pannes de courant du datacenter uniquement",
      ],
      correctIndex: 0,
      source: "P2-ACTIVITÉ 8 - Étude de cas des risques sur le cloud.pdf",
    },
    {
      id: "m201-q19",
      question:
        "Dans le benchmark des solutions de sécurité chez deux fournisseurs Cloud, quelles solutions sont attendues pour chaque fournisseur ?",
      options: [
        "Gestion des accès et des droits, chiffrement des données et des stockages, traçabilité des activités utilisateurs et API, isolation dans un réseau privé",
        "Uniquement le pare-feu et l'antivirus",
        "Uniquement le choix du type de déploiement (public, privé, hybride)",
      ],
      correctIndex: 0,
      source: "P2-ACTIVITÉ 9 - Réaliser un benchmark des solutions de sécurité chez 2 fournisseurs Cloud.pdf",
    },
    {
      id: "m201-q20",
      question:
        "Dans les cas pratiques de Groupomo : la fermeture des serveurs pendant la pandémie, la fuite de dossiers clients via le fournisseur EnterTrust, et l'e-mail avec pièce jointe installant un rançongiciel impactent respectivement quels objectifs de sécurité ?",
      options: [
        "Disponibilité — Confidentialité — Intégrité",
        "Confidentialité — Intégrité — Disponibilité",
        "Intégrité — Disponibilité — Confidentialité",
      ],
      correctIndex: 0,
      source:
        "P3-ACTIVITÉ 1 - Cas pratique 1.pdf, P3-ACTIVITÉ 2 - Cas pratique 2.pdf, P3-ACTIVITÉ 3 - Cas pratique 3.pdf",
    },
  ],
};
