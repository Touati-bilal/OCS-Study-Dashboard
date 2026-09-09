import type { StudyOption } from "./types";

export interface LearningObjective {
  id: string;
  text: string;
}

export interface ChapterDef {
  id: string;
  title: string;
  objectives: LearningObjective[];
}

export interface ModuleDef {
  id: string;
  code: string;
  name: string;
  category: "main" | "secondary";
  folder: string;
  duration: number;
  coefficient: number;
  efmRegional: boolean;
  description: string;
  objectives: string[];
  chapters: ChapterDef[];
  skills?: string[];
  color: string;
}

/** Builds chapters where every chapter carries several granular, checkable learning objectives. */
function detailedChapters(defs: Array<{ title: string; objectives: string[] }>): ChapterDef[] {
  return defs.map((def, i) => ({
    id: `ch-${i + 1}`,
    title: def.title,
    objectives: def.objectives.map((text, j) => ({ id: `ch-${i + 1}-o-${j + 1}`, text })),
  }));
}

/** Builds simple chapters (one implicit objective matching the title) — used for secondary modules. */
function simpleChapters(titles: string[]): ChapterDef[] {
  return titles.map((title, i) => ({
    id: `ch-${i + 1}`,
    title,
    objectives: [{ id: `ch-${i + 1}-o-1`, text: title }],
  }));
}

export const MAIN_MODULES: ModuleDef[] = [
  {
    id: "M201",
    code: "M201",
    name: "S'initier aux fondamentaux de la cybersécurité",
    category: "main",
    folder: "CyberSecurity/M201",
    duration: 75,
    coefficient: 2,
    efmRegional: false,
    description:
      "Ce module permet d'acquérir des bases solides en cybersécurité : concepts fondamentaux, terminologie, principes de sécurité, normes et réglementations, ainsi qu'une découverte des différents métiers du domaine.",
    objectives: [
      "Comprendre la terminologie de la cybersécurité.",
      "Connaître les fondamentaux de la sécurité de l'information.",
      "Comprendre les menaces et attaques courantes.",
      "Connaître les normes internationales de cybersécurité.",
      "Comprendre les réglementations en cybersécurité.",
      "Découvrir les domaines et métiers de la cybersécurité.",
    ],
    chapters: detailedChapters([
      {
        title: "Cybersecurity Terminology",
        objectives: [
          "Définir les notions de vulnérabilité, menace et risque",
          "Distinguer confidentialité, intégrité et disponibilité (triade CIA)",
          "Connaître le vocabulaire des acteurs (hacker, pentester, RSSI, SOC...)",
        ],
      },
      {
        title: "Standards and Regulations",
        objectives: [
          "Connaître la norme ISO/IEC 27001",
          "Identifier les normes PCI-DSS et NIST",
          "Comprendre les réglementations RGPD et loi 09-08",
        ],
      },
      {
        title: "Security Principles",
        objectives: [
          "Appliquer le principe de défense en profondeur",
          "Comprendre le principe du moindre privilège",
          "Identifier les principales menaces et attaques courantes",
        ],
      },
      {
        title: "Cybersecurity Careers",
        objectives: [
          "Découvrir les métiers techniques (pentester, analyste SOC, forensic)",
          "Découvrir les métiers de gouvernance (RSSI, auditeur, DPO)",
          "Identifier les certifications du domaine (CEH, OSCP, CISSP)",
        ],
      },
    ]),
    color: "#48a3ff",
  },
  {
    id: "M202",
    code: "M202",
    name: "Appliquer les méthodologies des tests d'intrusions",
    category: "main",
    folder: "CyberSecurity/M202",
    duration: 105,
    coefficient: 3,
    efmRegional: true,
    description:
      "Ce module est consacré à l'apprentissage et à l'application des méthodologies professionnelles de tests d'intrusion : planification, reconnaissance, identification des vulnérabilités, exploitation en environnement contrôlé et rédaction d'un rapport professionnel.",
    objectives: [
      "Comprendre les méthodologies professionnelles de tests d'intrusion.",
      "Planifier et réaliser une mission de test d'intrusion.",
      "Identifier les vulnérabilités d'un système d'information.",
      "Exploiter les vulnérabilités dans un environnement contrôlé.",
      "Analyser les résultats d'un test d'intrusion.",
      "Rédiger un rapport professionnel de test d'intrusion.",
    ],
    chapters: detailedChapters([
      {
        title: "Découvrir les méthodologies de test d'intrusion",
        objectives: [
          "Distinguer la méthodologie OSSTMM",
          "Identifier la méthodologie PTES",
          "Distinguer la méthodologie OWASP WSTG",
        ],
      },
      {
        title: "Identifier les vulnérabilités au sein d'un système d'information",
        objectives: [
          "Utiliser Kali Linux pour la reconnaissance",
          "Scanner les vulnérabilités avec Nessus",
          "Réaliser une évaluation des vulnérabilités (Vulnerability Assessment)",
        ],
      },
      {
        title: "Exploiter les vulnérabilités au sein d'un système d'information",
        objectives: [
          "Exploiter des vulnérabilités en environnement contrôlé",
          "Automatiser des tâches d'exploitation avec Python",
          "Élever ses privilèges après compromission",
        ],
      },
      {
        title: "Rédiger un rapport de synthèse de test d'intrusion",
        objectives: [
          "Structurer un rapport professionnel de pentest",
          "Prioriser les vulnérabilités selon leur criticité",
          "Formuler des recommandations de remédiation",
        ],
      },
    ]),
    skills: [
      "OSSTMM",
      "PTES",
      "OWASP WSTG",
      "Kali Linux",
      "Nessus",
      "Python",
      "Vulnerability Assessment",
      "Exploitation",
      "Report Writing",
    ],
    color: "#fb7185",
  },
  {
    id: "M203",
    code: "M203",
    name: "Analyser les attaques et les incidents de cybersécurité",
    category: "main",
    folder: "CyberSecurity/M203",
    duration: 105,
    coefficient: 3,
    efmRegional: true,
    description:
      "Ce module permet d'apprendre à analyser les attaques informatiques, comprendre les incidents de sécurité, appliquer les procédures de gestion des incidents, effectuer le Threat Hunting et répondre efficacement aux incidents de cybersécurité.",
    objectives: [
      "Comprendre les incidents de sécurité.",
      "Analyser le Cyber Kill Chain.",
      "Appliquer les procédures de gestion des incidents.",
      "Utiliser le framework NIST 800-61 R2.",
      "Effectuer le Threat Hunting.",
      "Répondre efficacement aux incidents.",
      "Automatiser certaines réponses aux incidents.",
      "Documenter les incidents de manière professionnelle.",
    ],
    chapters: detailedChapters([
      {
        title: "S'approprier la notion d'un incident de sécurité",
        objectives: [
          "Définir ce qu'est un incident de sécurité",
          "Analyser le Cyber Kill Chain",
          "Classifier les types d'incidents",
        ],
      },
      {
        title: "Appliquer les procédures de gestion des incidents",
        objectives: [
          "Appliquer le framework NIST 800-61 R2",
          "Suivre les étapes de détection, confinement et éradication",
          "Documenter un incident de manière professionnelle",
        ],
      },
      {
        title: "Effectuer le Threat Hunting",
        objectives: [
          "Formuler des hypothèses de chasse aux menaces",
          "Utiliser des indicateurs de compromission (IOC)",
          "Analyser les logs et sources de données pour détecter une menace",
        ],
      },
      {
        title: "Répondre à des incidents de cybersécurité",
        objectives: [
          "Répondre efficacement à un incident en cours",
          "Automatiser certaines réponses aux incidents (SOAR)",
          "Réaliser un retour d'expérience post-incident",
        ],
      },
    ]),
    skills: ["Gestion des incidents", "Cyber Kill Chain", "NIST 800-61 R2", "Threat Hunting", "Incident Response"],
    color: "#fbbf24",
  },
  {
    id: "M204",
    code: "M204",
    name: "Assurer le durcissement de la sécurité des systèmes et réseaux",
    category: "main",
    folder: "CyberSecurity/M204",
    duration: 90,
    coefficient: 3,
    efmRegional: true,
    description:
      "Ce module permet d'apprendre les principes du durcissement (Hardening) des systèmes et des réseaux informatiques afin de réduire leur surface d'attaque et renforcer leur niveau de sécurité.",
    objectives: [
      "Comprendre les principes du durcissement.",
      "Utiliser les normes et référentiels de sécurité.",
      "Appliquer les bonnes pratiques d'administration sécurisée.",
      "Durcir les équipements réseau.",
      "Sécuriser Windows et Linux.",
      "Déployer des solutions DLP.",
      "Mettre en place la traçabilité des événements.",
    ],
    chapters: detailedChapters([
      {
        title: "Présenter les normes et les standards de durcissement",
        objectives: [
          "Connaître les normes ANSSI",
          "Appliquer les référentiels CIS Benchmark",
          "Comprendre les bonnes pratiques d'administration sécurisée",
        ],
      },
      {
        title: "Maîtriser le durcissement du réseau",
        objectives: ["Configurer un firewall", "Mettre en place un VPN", "Sécuriser les échanges avec TLS"],
      },
      {
        title: "Maîtriser le durcissement du système",
        objectives: [
          "Durcir un système Windows",
          "Durcir un système Linux",
          "Durcir un environnement Active Directory",
        ],
      },
      {
        title: "Déployer des solutions DLP et de traçabilité",
        objectives: [
          "Déployer une solution DLP (Data Loss Prevention)",
          "Mettre en place la traçabilité des événements",
          "Centraliser et surveiller les journaux d'activité",
        ],
      },
    ]),
    skills: ["Hardening", "CIS Benchmark", "Firewall", "VPN", "TLS", "Windows Hardening", "Linux Hardening", "DLP"],
    color: "#34d399",
  },
  {
    id: "M205",
    code: "M205",
    name: "Appréhender les méthodes d'investigation numérique",
    category: "main",
    folder: "CyberSecurity/M205",
    duration: 90,
    coefficient: 2,
    efmRegional: false,
    description:
      "Ce module permet d'apprendre les méthodes d'investigation numérique (Digital Forensics), la collecte, l'acquisition, l'analyse et la présentation des preuves numériques lors d'enquêtes de cybersécurité.",
    objectives: [
      "Comprendre l'investigation numérique",
      "Maîtriser les concepts techniques",
      "Comprendre les disques et systèmes de fichiers",
      "Acquérir des preuves numériques",
      "Analyser les preuves numériques",
    ],
    chapters: detailedChapters([
      {
        title: "Introduction à l'investigation numérique",
        objectives: [
          "Comprendre les principes du Digital Forensics",
          "Connaître la chaîne de possession (chain of custody)",
          "Distinguer les types de forensics (disque, mémoire, réseau, mobile)",
        ],
      },
      {
        title: "Concepts techniques essentiels",
        objectives: [
          "Comprendre le fonctionnement du stockage numérique",
          "Connaître les formats d'image forensique",
          "Utiliser les outils d'investigation numérique",
        ],
      },
      {
        title: "Disques durs et systèmes de fichiers",
        objectives: [
          "Comprendre les systèmes de fichiers (NTFS, FAT, ext4)",
          "Analyser la structure d'un disque dur",
          "Identifier les zones de données cachées ou supprimées",
        ],
      },
      {
        title: "Acquisition des preuves numériques",
        objectives: [
          "Réaliser une acquisition de disque (Disk Imaging)",
          "Acquérir la mémoire vive (RAM Acquisition)",
          "Préserver l'intégrité des preuves (hachage)",
        ],
      },
      {
        title: "Analyse des preuves numériques",
        objectives: [
          "Analyser un système Windows (Windows Forensics)",
          "Analyser les navigateurs et emails (Browser/Email Forensics)",
          "Rédiger un rapport d'investigation numérique",
        ],
      },
    ]),
    skills: ["Digital Forensics", "Disk Imaging", "RAM Acquisition", "Windows Forensics", "Report Writing"],
    color: "#a78bfa",
  },
  {
    id: "M206",
    code: "M206",
    name: "Développer des stratégies de gestion des risques",
    category: "main",
    folder: "CyberSecurity/M206",
    duration: 90,
    coefficient: 2,
    efmRegional: false,
    description:
      "Ce module présente les stratégies de gestion des risques en cybersécurité, les méthodes d'identification, d'évaluation, de traitement et de suivi des risques afin de protéger les systèmes d'information.",
    objectives: [
      "Comprendre la gestion des risques",
      "Identifier les actifs critiques",
      "Évaluer les menaces et vulnérabilités",
      "Choisir une méthodologie de gestion des risques",
      "Identifier et traiter les risques",
      "Mettre en place une amélioration continue",
    ],
    chapters: detailedChapters([
      {
        title: "Introduction à la gestion des risques en cybersécurité",
        objectives: [
          "Comprendre les notions de risque, menace et vulnérabilité",
          "Comprendre les enjeux de la gestion des risques",
        ],
      },
      {
        title: "Analyse de l'environnement",
        objectives: [
          "Identifier les actifs critiques de l'organisation",
          "Cartographier l'environnement informationnel",
        ],
      },
      {
        title: "Méthodologies de gestion des risques",
        objectives: [
          "Appliquer la méthode ISO 27005",
          "Appliquer la méthode NIST SP 800-30",
          "Découvrir la méthode OCTAVE",
        ],
      },
      {
        title: "Identification des risques",
        objectives: ["Identifier les sources de risques", "Recenser les scénarios de menaces"],
      },
      {
        title: "Évaluation des risques",
        objectives: ["Évaluer la probabilité et l'impact d'un risque", "Prioriser les risques identifiés"],
      },
      {
        title: "Traitement des risques",
        objectives: [
          "Choisir une stratégie de traitement (éviter, réduire, transférer, accepter)",
          "Mettre en place des mesures de mitigation",
        ],
      },
      {
        title: "Suivi et amélioration continue",
        objectives: [
          "Suivre l'évolution des risques dans le temps",
          "Appliquer le cycle PDCA (Plan-Do-Check-Act)",
        ],
      },
    ]),
    skills: ["Risk Management", "ISO 27005", "NIST SP 800-30", "OCTAVE", "PDCA"],
    color: "#22d3ee",
  },
];

/** Practical modules for the OCC (Cloud Computing) option. */
export const MAIN_MODULES_OCC: ModuleDef[] = [
  {
    id: "OCC-M201",
    code: "M201",
    name: "Comprendre l'architecture Cloud",
    category: "main",
    folder: "CC/M201",
    duration: 45,
    coefficient: 2,
    efmRegional: false,
    description: "Ce module permet de comprendre l'architecture Cloud.",
    objectives: [],
    chapters: detailedChapters([
      {
        title: "Identifier les concepts du Cloud",
        objectives: ["Découvrir le Cloud", "Connaitre les pertinences de passage au Cloud"],
      },
      {
        title: "Comprendre la structure du Cloud",
        objectives: ["Appréhender les types de service Cloud", "Différencier les modèles de déploiement Cloud"],
      },
      {
        title: "Mesurer les apports du Cloud pour l'entreprise",
        objectives: ["Suivre la tendance du marché Cloud", "Identifier l'impact du Cloud sur les entreprises"],
      },
      {
        title: "Découvrir les utilisations du Cloud",
        objectives: [
          "Comprendre la mise à l'échelle des ressources Cloud",
          "Découvrir les mécanismes de performance et de la haute disponibilité",
          "Articuler les aspects financiers du Cloud",
        ],
      },
    ]),
    color: "#48a3ff",
  },
  {
    id: "OCC-M202",
    code: "M202",
    name: "Explorer un environnement Cloud propriétaire en ligne public",
    category: "main",
    folder: "CC/M202",
    duration: 45,
    coefficient: 2,
    efmRegional: true,
    description: "Ce module permet d'explorer un environnement Cloud propriétaire en ligne public.",
    objectives: [],
    chapters: detailedChapters([
      {
        title: "S'initier avec le fournisseur Cloud",
        objectives: [
          "Comparer les fournisseurs géants du Cloud",
          "Découvrir l'historique du fournisseur Cloud à explorer",
        ],
      },
      {
        title: "Initialiser les accès au portail du fournisseur Cloud",
        objectives: ["Créer un abonnement", "Paramétrer le portail"],
      },
      {
        title: "Explorer les services du fournisseur Cloud",
        objectives: [
          "Découvrir les ressources techniques",
          "Répertorier les services opérationnels",
          "Explorer les aspects de facturation",
          "Identifier les offres de service avancées",
        ],
      },
    ]),
    color: "#fb7185",
  },
  {
    id: "OCC-M203",
    code: "M203",
    name: "Implémenter un environnement Cloud avec une solution libre",
    category: "main",
    folder: "CC/M203",
    duration: 135,
    coefficient: 3,
    efmRegional: true,
    description: "Ce module permet d'implémenter un environnement Cloud avec une solution libre.",
    objectives: [],
    chapters: simpleChapters(["Implémenter un environnement Cloud avec une solution libre"]),
    color: "#fbbf24",
  },
  {
    id: "OCC-M204",
    code: "M204",
    name: "Administrer un environnement Cloud propriétaire en ligne public",
    category: "main",
    folder: "CC/M204",
    duration: 105,
    coefficient: 3,
    efmRegional: true,
    description: "Ce module permet d'administrer un environnement Cloud propriétaire en ligne public.",
    objectives: [],
    chapters: detailedChapters([
      {
        title: "Provisionner une machine virtuelle",
        objectives: [
          "Établir les prérequis à la création d'une VM",
          "Créer une machine virtuelle",
          "Configurer la disponibilité des VM",
        ],
      },
      {
        title: "Déployer un réseau virtuel",
        objectives: [
          "Explorer les aspects de base d'un réseau virtuel",
          "Explorer les aspects avancés d'un réseau virtuel",
        ],
      },
      {
        title: "Gérer les données",
        objectives: ["Explorer les fonctionnalités de stockage", "Découvrir les types de stockage"],
      },
      {
        title: "Administrer des applications web",
        objectives: [
          "Administrer un site web avec des machines virtuelles",
          "Administrer un site web avec un service géré (PaaS)",
        ],
      },
      {
        title: "Déployer la conteneurisation",
        objectives: [
          "Connaitre les concepts de base de la conteneurisation",
          "Gérer les images des conteneurs",
          "Déployer des conteneurs",
        ],
      },
      {
        title: "Maintenir un environnement de production",
        objectives: ["Gouverner les ressources Cloud", "Assurer le bon fonctionnement des ressources"],
      },
    ]),
    color: "#34d399",
  },
  {
    id: "OCC-M205",
    code: "M205",
    name: "Sécuriser un environnement Cloud propriétaire en ligne public",
    category: "main",
    folder: "CC/M205",
    duration: 105,
    coefficient: 3,
    efmRegional: false,
    description: "Ce module permet de sécuriser un environnement Cloud propriétaire en ligne public.",
    objectives: [],
    chapters: detailedChapters([
      {
        title: "Se préparer pour la sécurité dans le Cloud",
        objectives: ["Identifier les enjeux de sécurité Cloud", "Appréhender des aspects de sécurité Cloud"],
      },
      {
        title: "Adopter une infrastructure Cloud sécurisée",
        objectives: [
          "Renforcer la sécurité des VM",
          "Sécuriser le réseau",
          "Gérer les identités",
          "Protéger les données",
        ],
      },
      {
        title: "Superviser les ressources Cloud",
        objectives: ["Utiliser les outils natifs du Cloud", "Utiliser un outil externe SIEM"],
      },
    ]),
    color: "#a78bfa",
  },
  {
    id: "OCC-M206",
    code: "M206",
    name: "Gouverner les données dans le Cloud",
    category: "main",
    folder: "CC/M206",
    duration: 75,
    coefficient: 2,
    efmRegional: false,
    description: "Ce module permet de gouverner les données dans le Cloud.",
    objectives: [],
    chapters: simpleChapters(["Gouverner les données dans le Cloud"]),
    color: "#22d3ee",
  },
  {
    id: "OCC-M207",
    code: "M207",
    name: "Établir une stratégie de maintien d'un SI dans un Cloud propriétaire en ligne public",
    category: "main",
    folder: "CC/M207",
    duration: 90,
    coefficient: 2,
    efmRegional: false,
    description: "Ce module permet d'établir une stratégie de maintien d'un SI dans un Cloud propriétaire en ligne public.",
    objectives: [],
    chapters: simpleChapters(["Établir une stratégie de maintien d'un SI dans un Cloud propriétaire en ligne public"]),
    color: "#2dd4bf",
  },
];

/** Practical modules for the ORS (Réseaux & Systèmes) option. */
export const MAIN_MODULES_ORS: ModuleDef[] = [
  {
    id: "ORS-M201",
    code: "M201",
    name: "Mise en place d'une infrastructure réseaux",
    category: "main",
    folder: "RS/M201",
    duration: 120,
    coefficient: 3,
    efmRegional: true,
    description: "Ce module permet de mettre en place une infrastructure réseaux.",
    objectives: [],
    chapters: detailedChapters([
      {
        title: "Maîtriser les concepts de commutation",
        objectives: [
          "Configurer les périphériques réseaux",
          "Appliquer les concepts de commutation",
          "Mettre en œuvre des VLAN",
        ],
      },
      {
        title: "Établir un réseau d'entreprise évolutif",
        objectives: [
          "Étudier l'évolutivité du réseau",
          "Implémenter la redondance dans les réseaux commutés sans boucle",
          "Configurer l'agrégation des liaisons",
          "Comprendre le concept du FHRP",
        ],
      },
      {
        title: "Mettre en œuvre les protocoles de configuration dynamique",
        objectives: ["Comprendre le fonctionnement de DHCPv4", "Comprendre le fonctionnement de SLAAC et DHCPv6"],
      },
      {
        title: "Sécuriser un réseau local",
        objectives: ["Sécuriser la couche 2 du réseau LAN", "Concevoir et sécuriser un réseau local sans fil"],
      },
      {
        title: "Mettre en œuvre le routage d'un réseau d'entreprise",
        objectives: [
          "Comprendre les concepts de routage",
          "Implémenter le protocole OSPF à zone unique et multiple",
          "Implémenter le protocole BGP",
        ],
      },
      {
        title: "Gérer la connectivité des réseaux d'entreprise",
        objectives: [
          "Étudier les réseaux étendus",
          "Sécuriser l'accès aux réseaux",
          "Mettre en place un système de gestion et de supervision des réseaux",
        ],
      },
      {
        title: "Mettre en place une solution VOIP",
        objectives: ["Présentation de la téléphonie classique", "Décrire l'architecture VOIP"],
      },
    ]),
    color: "#48a3ff",
  },
  {
    id: "ORS-M202",
    code: "M202",
    name: "Administration d'un environnement Windows",
    category: "main",
    folder: "RS/M202",
    duration: 105,
    coefficient: 3,
    efmRegional: true,
    description: "Ce module permet d'administrer un environnement Windows.",
    objectives: [],
    chapters: simpleChapters([
      "Installation Windows Server 2019",
      "Console de gestion de serveur",
      "Service de domaine Active Directory",
      "Gestion des objets Active Directory",
      "Implémentation d'un serveur DHCP",
      "Implémentation d'un serveur DNS",
      "Infrastructure des stratégies de groupe",
      "Implémentation d'un serveur de fichiers",
      "Gestion du système de fichiers DFS",
      "Gestion de politique de sécurité",
      "Implémentation du service de déploiement",
    ]),
    color: "#fb7185",
  },
  {
    id: "ORS-M203",
    code: "M203",
    name: "Administration d'un environnement Cloud",
    category: "main",
    folder: "RS/M203",
    duration: 75,
    coefficient: 2,
    efmRegional: false,
    description: "Ce module permet d'administrer un environnement Cloud.",
    objectives: [],
    chapters: detailedChapters([
      {
        title: "Acquérir les concepts de base du Cloud Computing",
        objectives: [
          "Comprendre le Cloud Computing comme solution clé-en-main",
          "Designer les technologies « enablers »",
          "Schématiser les modèles et services Cloud",
        ],
      },
      {
        title: "Gérer les composants essentiels d'une plateforme Cloud",
        objectives: [
          "Comprendre les composants essentiels de la plateforme Cloud",
          "Gérer les accès",
          "Gérer les ressources matérielles et logicielles",
          "Gérer les données en Cloud",
          "Gérer les performances",
        ],
      },
      {
        title: "Comparer les plateformes propriétaires et open source",
        objectives: [
          "Présenter les plateformes propriétaires",
          "Mettre en place une plateforme open source : OpenStack",
          "Se familiariser avec les outils d'automatisation et d'orchestration",
        ],
      },
      {
        title: "Comprendre les concepts de migration vers le Cloud",
        objectives: [
          "Comparer l'hébergement Cloud et l'hébergement local",
          "Identifier les démarches de migration",
          "Manipuler les outils de migration vers le Cloud",
        ],
      },
    ]),
    color: "#fbbf24",
  },
  {
    id: "ORS-M204",
    code: "M204",
    name: "Enjeux de la technologie SDN",
    category: "main",
    folder: "RS/M204",
    duration: 85,
    coefficient: 2,
    efmRegional: false,
    description: "Ce module présente les enjeux de la technologie SDN.",
    objectives: [],
    chapters: detailedChapters([
      {
        title: "Comprendre les réseaux informatiques en nuage",
        objectives: [
          "Définir le Cloud Networking",
          "Présenter la IAC (Infrastructure as a Code) et les API",
        ],
      },
      {
        title: "Utiliser le Software Defined Network (SDN)",
        objectives: [
          "Maîtriser les concepts de base de la technologie SDN",
          "Analyser les contrôleurs OpenFlow",
          "Assurer la sécurité dans les environnements SDN",
        ],
      },
      {
        title: "Utiliser les protocoles",
        objectives: ["Découvrir les services et protocoles de routage dans le SDN", "Étudier les solutions SDN"],
      },
    ]),
    color: "#34d399",
  },
  {
    id: "ORS-M205",
    code: "M205",
    name: "Administration d'un environnement Linux",
    category: "main",
    folder: "RS/M205",
    duration: 105,
    coefficient: 3,
    efmRegional: true,
    description: "Ce module permet d'administrer un environnement Linux.",
    objectives: [],
    chapters: simpleChapters(["Administration d'un environnement Linux"]),
    color: "#a78bfa",
  },
  {
    id: "ORS-M206",
    code: "M206",
    name: "Sécurité d'une infrastructure digitale",
    category: "main",
    folder: "RS/M206",
    duration: 75,
    coefficient: 2,
    efmRegional: true,
    description: "Ce module permet d'assurer la sécurité d'une infrastructure digitale.",
    objectives: [],
    chapters: detailedChapters([
      {
        title: "Les bases de la sécurité informatique",
        objectives: [
          "Notions de base",
          "Composantes sécuritaires",
          "Bonnes pratiques et recommandations",
          "Sécurité du poste de travail",
        ],
      },
      {
        title: "Les réglementations juridiques",
        objectives: [
          "Introduction à la cybercriminalité",
          "Le processus de la cyberattaque",
          "Les risques juridiques",
          "Les réglementations juridiques",
        ],
      },
      {
        title: "La gestion des risques et d'incidents",
        objectives: ["Classification des risques", "Les contre-mesures", "Analyse des logs", "Framework de gestion"],
      },
      {
        title: "Sécurité réseaux",
        objectives: [
          "Méthodes de sécurité des échanges",
          "Sécurité architecturale",
          "Types et principes des VPN",
          "L'utilisation des VPN",
          "L'architecture DM-VPN",
          "Les IDS/IPS",
        ],
      },
      {
        title: "Les listes de contrôle d'accès",
        objectives: ["Les Access List standards", "Les Access List nommées", "Les Access List étendues"],
      },
      {
        title: "La cryptographie",
        objectives: ["Les types d'algorithmes cryptographiques", "Complexités des algorithmes cryptographiques"],
      },
      {
        title: "Infrastructure PKI",
        objectives: ["Structure et organisation", "Les fonctions de certification"],
      },
    ]),
    color: "#22d3ee",
  },
  {
    id: "ORS-M207",
    code: "M207",
    name: "Gestion d'un projet d'infrastructure digitale",
    category: "main",
    folder: "RS/M207",
    duration: 45,
    coefficient: 1,
    efmRegional: false,
    description: "Ce module permet de gérer un projet d'infrastructure digitale.",
    objectives: [],
    chapters: detailedChapters([
      {
        title: "Acquérir les connaissances de base sur la gestion de projet traditionnelle et agile selon PRINCE2",
        objectives: [
          "Comprendre la gestion de projet",
          "Identifier les principes, les thèmes et les processus de PRINCE2",
          "Découvrir la méthode PRINCE2 Agile",
        ],
      },
      {
        title: "Découvrir les compétences organisationnelles de l'ITIL",
        objectives: ["Identifier les dernières versions d'ITIL", "Spécifier les processus de gestion des services"],
      },
      {
        title: "Comprendre le fonctionnement des systèmes de gestion des tickets",
        objectives: [
          "Énumérer les principes de gestion des tickets IT",
          "Maîtriser les règles principales d'entretien téléphonique",
          "Manipuler un système de gestion des tickets",
        ],
      },
    ]),
    color: "#2dd4bf",
  },
];

export const SECONDARY_MODULES: ModuleDef[] = [
  {
    id: "EGTS202",
    code: "EGTS202",
    name: "Français",
    category: "secondary",
    folder: "CyberSecurity/EGTS202 - Français",
    duration: 115,
    coefficient: 2,
    efmRegional: false,
    description:
      "Ce module vise à renforcer la maîtrise du français à l'écrit et à l'oral dans un contexte professionnel : rédaction de rapports techniques, communication professionnelle, synthèse de documents et expression orale structurée.",
    objectives: [
      "Rédiger des rapports techniques clairs et structurés.",
      "Communiquer efficacement à l'oral dans un contexte professionnel.",
      "Synthétiser et analyser des documents techniques.",
      "Améliorer l'orthographe, la grammaire et le style rédactionnel.",
    ],
    chapters: simpleChapters([
      "Rédaction de rapports techniques",
      "Communication professionnelle orale",
      "Synthèse et analyse de documents",
      "Orthographe, grammaire et style",
    ]),
    color: "#fb7185",
  },
  {
    id: "EGTS203",
    code: "EGTS203",
    name: "Anglais technique",
    category: "secondary",
    folder: "CyberSecurity/EGTS203 - Anglais technique",
    duration: 50,
    coefficient: 2,
    efmRegional: false,
    description:
      "Ce module permet d'acquérir le vocabulaire technique anglais utilisé en informatique et en cybersécurité, de comprendre la documentation technique en anglais, et de communiquer professionnellement à l'écrit et à l'oral.",
    objectives: [
      "Maîtriser le vocabulaire technique IT / cybersécurité en anglais.",
      "Lire et comprendre de la documentation technique (RFC, CVE, writeups).",
      "Rédiger des emails et rapports professionnels en anglais.",
      "Suivre des cours, conférences et tutoriels cyber en anglais sans sous-titres.",
    ],
    chapters: simpleChapters([
      "Vocabulaire technique IT / cybersécurité",
      "Documentation technique (RFC, CVE, writeups)",
      "Rédaction professionnelle en anglais",
      "Compréhension orale technique",
    ]),
    color: "#48a3ff",
  },
  {
    id: "EGTS204",
    code: "EGTS204",
    name: "Culture entrepreneuriale",
    category: "secondary",
    folder: "CyberSecurity/EGTS204 - Culture entrepreneuriale",
    duration: 45,
    coefficient: 2,
    efmRegional: false,
    description:
      "Ce module introduit les notions fondamentales de l'entrepreneuriat : l'environnement économique, la création d'entreprise, le business model et l'esprit entrepreneurial.",
    objectives: [
      "Comprendre les bases de l'environnement entrepreneurial.",
      "Identifier les étapes de création d'une entreprise.",
      "Comprendre la notion de business model.",
      "Développer un esprit entrepreneurial appliqué à la tech.",
    ],
    chapters: simpleChapters([
      "Environnement entrepreneurial",
      "Création d'entreprise",
      "Business model",
      "Esprit entrepreneurial appliqué à la tech",
    ]),
    color: "#fbbf24",
  },
  {
    id: "EGTS205",
    code: "EGTS205",
    name: "Compétences comportementales",
    category: "secondary",
    folder: "CyberSecurity/EGTS205 - Compétences comportementales",
    duration: 30,
    coefficient: 2,
    efmRegional: false,
    description:
      "Ce module développe les soft skills essentielles au monde professionnel : communication interpersonnelle, travail d'équipe, gestion du temps et gestion du stress.",
    objectives: [
      "Améliorer la communication interpersonnelle.",
      "Travailler efficacement en équipe.",
      "Gérer son temps et ses priorités.",
      "Gérer le stress et la pression dans un contexte professionnel.",
    ],
    chapters: simpleChapters([
      "Communication interpersonnelle",
      "Travail d'équipe",
      "Gestion du temps et des priorités",
      "Gestion du stress",
    ]),
    color: "#34d399",
  },
  {
    id: "EGTS208",
    code: "EGTS208",
    name: "Entrepreneuriat - PIE 2",
    category: "secondary",
    folder: "CyberSecurity/EGTS208 - Entrepreneuriat-PIE 2",
    duration: 80,
    coefficient: 2,
    efmRegional: false,
    description:
      "Ce module accompagne l'élaboration d'un Projet Innovant d'Entreprise (PIE) : étude de marché, plan d'affaires, présentation et pitch du projet.",
    objectives: [
      "Élaborer une étude de marché.",
      "Construire un plan d'affaires (business plan).",
      "Structurer et présenter un projet entrepreneurial (pitch).",
      "Appliquer les notions d'entrepreneuriat à un projet concret, idéalement lié à la cybersécurité.",
    ],
    chapters: simpleChapters([
      "Étude de marché",
      "Plan d'affaires (business plan)",
      "Structuration et pitch du projet",
      "Application à un projet cyber",
    ]),
    color: "#a78bfa",
  },
  {
    id: "EGTSA206",
    code: "EGTSA206",
    name: "Culture et techniques avancées du numérique",
    category: "secondary",
    folder: "CyberSecurity/EGTSA206 - Culture et techniques avancées du numérique",
    duration: 30,
    coefficient: 1,
    efmRegional: false,
    description:
      "Ce module développe la culture numérique générale et la veille technologique : tendances du numérique, outils numériques avancés, transformation digitale.",
    objectives: [
      "Comprendre les grandes tendances du numérique.",
      "Effectuer une veille technologique structurée.",
      "Utiliser des outils numériques avancés.",
      "Comprendre les enjeux de la transformation digitale.",
    ],
    chapters: simpleChapters([
      "Tendances du numérique",
      "Veille technologique",
      "Outils numériques avancés",
      "Transformation digitale",
    ]),
    color: "#22d3ee",
  },
];

/** Practical (main) modules keyed by study option — OCS/OCC/ORS each get their own M201-M207. */
export const MAIN_MODULES_BY_OPTION: Record<StudyOption, ModuleDef[]> = {
  OCS: MAIN_MODULES,
  OCC: MAIN_MODULES_OCC,
  ORS: MAIN_MODULES_ORS,
};

export function getMainModules(option: StudyOption | null | undefined): ModuleDef[] {
  return option ? MAIN_MODULES_BY_OPTION[option] : [];
}

export const STUDY_OPTION_TITLES: Record<StudyOption, string> = {
  OCS: "Cybersécurité",
  OCC: "Cloud Computing",
  ORS: "Réseaux & Systèmes",
};

export function getMainModulesSubtitle(option: StudyOption | null | undefined): string {
  if (!option) return "";
  const modules = getMainModules(option);
  const title = STUDY_OPTION_TITLES[option];
  if (modules.length === 0) return `${title} — modules à venir`;
  return `${title} — ${modules[0].code} à ${modules[modules.length - 1].code}`;
}

/** Main modules for the given option plus the EGTS modules shared across every option. */
export function getModulesForOption(option: StudyOption | null | undefined): ModuleDef[] {
  return [...getMainModules(option), ...SECONDARY_MODULES];
}

/** Flat list of every module across every option — used for static route generation and id lookups. */
export const ALL_MODULES: ModuleDef[] = [
  ...MAIN_MODULES,
  ...MAIN_MODULES_OCC,
  ...MAIN_MODULES_ORS,
  ...SECONDARY_MODULES,
];

export function getModuleById(id: string): ModuleDef | undefined {
  return ALL_MODULES.find((m) => m.id === id);
}

export function countObjectives(module: ModuleDef): number {
  return module.chapters.reduce((sum, ch) => sum + ch.objectives.length, 0);
}

/** True for practical modules belonging to the OCC or ORS options (ids are prefixed "OCC-"/"ORS-"). */
export function isOccOrsModule(moduleId: string): boolean {
  return moduleId.startsWith("OCC-") || moduleId.startsWith("ORS-");
}
