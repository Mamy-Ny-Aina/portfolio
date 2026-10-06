import type { SiteContent } from './types';
import { i18n } from './utils';

/**
 * Contenu initial du portfolio, tiré du CV (septembre 2026).
 * Tout est modifiable depuis /admin ; ce fichier sert de base et de secours hors ligne.
 * Astuce : entourer des mots d’astérisques (*mot*) les met en valeur dans les titres.
 */
export const CONTENT_VERSION = 1;

export const CV_URL = '/api/files/m/cv-ndimby-razafinjatovo.pdf';

export const defaultContent: SiteContent = {
  version: CONTENT_VERSION,
  updatedAt: '2026-10-05T00:00:00.000Z',

  profile: {
    firstName: 'Ndimby',
    lastName: 'Razafinjatovo',
    fullName: 'Razafinjatovo Mamy Ny Aina Ndimby',
    role: i18n('Développeur Full-Stack', 'Full-Stack Developer', 'Mpamolavola Full-Stack'),
    headline: i18n(
      'Je conçois des applications web *robustes*, de l’idée jusqu’à la mise en production.',
      'I build *robust* web applications, from the first idea to production.',
      'Mamolavola rindrambaiko an-tranonkala *matanjaka* aho, manomboka amin’ny hevitra ka hatramin’ny famoahana azy.',
    ),
    intro: i18n(
      'Basé à Antananarivo, je développe aujourd’hui une plateforme d’Internet Banking et je poursuis un Master MBDS avec une spécialisation en intelligence artificielle.',
      'Based in Antananarivo, I currently build an Internet Banking platform while pursuing an MBDS Master’s degree specialising in artificial intelligence.',
      'Monina eto Antananarivo aho, manamboatra sehatra Internet Banking amin’izao fotoana izao, ary manohy ny Master MBDS manokana amin’ny faharanitan-tsaina artifisialy.',
    ),
    about: i18n(
      'Je suis passionné par la technologie, parce qu’elle ne cesse d’évoluer et offre toujours de nouvelles opportunités d’apprentissage. J’aime collaborer avec les autres : je suis quelqu’un de sociable et à l’écoute.\n\nTitulaire d’une licence en informatique de l’IT University, spécialisée en développement d’applications, j’ai conçu des solutions complètes pour la banque, les télécoms et la formation professionnelle — du front-end au back-end, de la base de données jusqu’au déploiement.\n\nJe poursuis aujourd’hui le Master MBDS (Mobiquité, Big Data et Systèmes Distribués) de l’Université Côte d’Azur, avec une spécialisation en intelligence artificielle, et je reste ouvert aux opportunités qui me permettront de renforcer mon expérience professionnelle.',
      'I’m passionate about technology because it never stops evolving and always opens new opportunities to learn. I enjoy working with others — I’m sociable and a good listener.\n\nWith a Bachelor’s degree in Computer Science from IT University, specialised in application development, I have built complete solutions for banking, telecoms and professional training — from front-end to back-end, from database design to deployment.\n\nI’m now pursuing the MBDS Master’s degree (Mobility, Big Data and Distributed Systems) at Université Côte d’Azur, specialising in artificial intelligence, and I’m open to opportunities that help me grow professionally.',
      'Tena tia ny teknolojia aho, satria tsy mitsahatra mivoatra izy ary manome fahafahana vaovao hianarana foana. Tiako ny miara-miasa amin’ny hafa: olona mora ifandraisana sy mahay mihaino aho.\n\nNahazo diplaoma Licence amin’ny informatika tao amin’ny IT University aho, manokana amin’ny famolavolana rindrambaiko. Efa nanamboatra vahaolana feno ho an’ny sehatry ny banky, ny serasera ary ny fampiofanana aho — manomboka amin’ny front-end ka hatramin’ny back-end, ny tahiry angona ary ny fametrahana azy an-tserasera.\n\nAmin’izao fotoana izao dia manohy ny Master MBDS (Mobiquité, Big Data ary Rafitra Mizarazara) ao amin’ny Université Côte d’Azur aho, manokana amin’ny faharanitan-tsaina artifisialy, ary vonona handray tolotra hanamafisana ny traikefako ara-asa.',
    ),
    location: i18n('Antananarivo, Madagascar', 'Antananarivo, Madagascar', 'Antananarivo, Madagasikara'),
    coordinates: '18.8792° S · 47.5079° E',
    timezone: 'Indian/Antananarivo',
    available: true,
    availability: i18n('Ouvert aux opportunités', 'Open to opportunities', 'Vonona handray tolotra'),
    photo: '/images/ndimby-portrait.webp',
    avatar: '/images/ndimby-avatar.webp',
    cv: i18n(CV_URL, '', ''),
    email: 'ndimbyrazafinjatovo999@gmail.com',
    phone: '+261 32 07 101 64',
    phoneAlt: '+261 38 20 744 42',
    whatsapp: '',
    showPhone: true,
    socials: [
      { id: 'github', label: 'GitHub', url: 'https://github.com/Mamy-Ny-Aina', icon: 'github' },
      { id: 'linkedin', label: 'LinkedIn', url: '', icon: 'linkedin' },
    ],
    stats: [
      { id: 'xp', value: '3', label: i18n('expériences professionnelles', 'professional experiences', 'traikefa ara-asa') },
      { id: 'langs', value: '8', label: i18n('langages de programmation', 'programming languages', 'fiteny fandaharana') },
      { id: 'fw', value: '10+', label: i18n('frameworks & outils', 'frameworks & tools', 'framework sy fitaovana') },
      { id: 'english', value: 'C2', label: i18n('niveau d’anglais certifié', 'certified English level', 'haavon’ny teny anglisy voamarina') },
    ],
  },

  experience: [
    {
      id: 'southsaico',
      role: i18n('Développeur Full-Stack', 'Full-Stack Developer', 'Mpamolavola Full-Stack'),
      company: 'SOUTHSAICO',
      client: i18n(
        'Projet client : plateforme Internet Banking pour SMMEC Madagascar',
        'Client project: Internet Banking platform for SMMEC Madagascar',
        'Tetikasa ho an’ny mpanjifa: sehatra Internet Banking ho an’ny SMMEC Madagasikara',
      ),
      type: i18n('Poste actuel', 'Current role', 'Asa ankehitriny'),
      start: '2025-11',
      end: '',
      current: true,
      location: i18n('Antananarivo', 'Antananarivo', 'Antananarivo'),
      summary: i18n(
        'Conception et développement d’une plateforme d’Internet Banking complète, de la conception fonctionnelle jusqu’au déploiement.',
        'Design and development of a complete Internet Banking platform, from functional design to deployment.',
        'Famolavolana sy fanamboarana sehatra Internet Banking feno, manomboka amin’ny famolavolana ny fiasany ka hatramin’ny fametrahana azy.',
      ),
      highlights: [
        i18n(
          'Développement d’une plateforme Internet Banking, de la conception fonctionnelle jusqu’aux tests et au déploiement.',
          'Built an Internet Banking platform, from functional design through testing and deployment.',
          'Nanamboatra sehatra Internet Banking, manomboka amin’ny famolavolana ny fiasany ka hatramin’ny fitsapana sy ny fametrahana azy.',
        ),
        i18n(
          'Réalisation des interfaces avec React et des données mock pour la validation client, puis conception de la base de données sous PostgreSQL.',
          'Built the React interfaces with mock data for client validation, then designed the PostgreSQL database.',
          'Nanao ny endrika tamin’ny React niaraka tamin’ny angona santionany ho fankatoavan’ny mpanjifa, avy eo namolavola ny tahiry angona PostgreSQL.',
        ),
        i18n(
          'Développement du back-end en Java / Spring Boot : authentification sécurisée, consultation des comptes, virements, e-documents et gestion financière.',
          'Developed the Java / Spring Boot back-end: secure authentication, account overview, transfers, e-documents and financial management.',
          'Nanamboatra ny back-end tamin’ny Java / Spring Boot: fidirana voaaro, fijerena ny kaonty, famindrana vola, antontan-taratasy nomerika ary fitantanana ara-bola.',
        ),
        i18n(
          'Participation aux tests, recettes, corrections et au traitement des retours clients dans un environnement Agile.',
          'Took part in testing, acceptance, fixes and client feedback handling in an Agile environment.',
          'Nandray anjara tamin’ny fitsapana, ny fankatoavana, ny fanitsiana ary ny fikarakarana ny hevitry ny mpanjifa tao anatin’ny tontolo Agile.',
        ),
      ],
      tech: ['React', 'Java', 'Spring Boot', 'PostgreSQL', 'REST API', 'Git'],
      link: '',
    },
    {
      id: 'orange',
      role: i18n('Développeur Full-Stack', 'Full-Stack Developer', 'Mpamolavola Full-Stack'),
      company: 'Orange Madagascar',
      client: i18n(
        'Application de gestion de processus métier',
        'Business process management application',
        'Rindrambaiko fitantanana ny dingana ara-asa',
      ),
      type: i18n('', '', ''),
      start: '2025-05',
      end: '2025-10',
      current: false,
      location: i18n('Antananarivo', 'Antananarivo', 'Antananarivo'),
      summary: i18n(
        'Développement d’une application complète de gestion des processus métier, avec un moteur de workflow conçu en interne.',
        'Development of a complete business process management application with an in-house workflow engine.',
        'Fanamboarana rindrambaiko feno fitantanana ny dingana ara-asa, miaraka amin’ny motera workflow natao manokana.',
      ),
      highlights: [
        i18n(
          'Développement d’une application complète de gestion des processus métier, de la conception jusqu’aux tests.',
          'Built a complete business process management application, from design to testing.',
          'Nanamboatra rindrambaiko feno fitantanana ny dingana ara-asa, manomboka amin’ny famolavolana ka hatramin’ny fitsapana.',
        ),
        i18n(
          'Réalisation du front-end avec Angular et du back-end avec Java / Quarkus.',
          'Built the front-end with Angular and the back-end with Java / Quarkus.',
          'Nanao ny front-end tamin’ny Angular sy ny back-end tamin’ny Java / Quarkus.',
        ),
        i18n(
          'Conception d’un moteur de workflow interne inspiré de Camunda : exécution des processus, affectation des tâches, notifications et suivi de l’avancement.',
          'Designed an in-house workflow engine inspired by Camunda: process execution, task assignment, notifications and progress tracking.',
          'Namolavola motera workflow anatiny nalaina tahaka ny Camunda: fanatanterahana ny dingana, fizarana ny asa, fampandrenesana ary fanaraha-maso ny fandrosoana.',
        ),
      ],
      tech: ['Angular', 'Java', 'Quarkus', 'MySQL', 'Figma', 'GitHub'],
      link: '',
    },
    {
      id: 'crm-vae',
      role: i18n('Développeur Full-Stack', 'Full-Stack Developer', 'Mpamolavola Full-Stack'),
      company: 'Freelance',
      client: i18n('CRM de suivi des parcours VAE', 'CRM for VAE journey tracking', 'CRM fanaraha-maso ny dingana VAE'),
      type: i18n('Freelance', 'Freelance', 'Tsy miankina'),
      start: '2026',
      end: '',
      current: false,
      location: i18n('À distance', 'Remote', 'Lavitra'),
      summary: i18n(
        'Développement d’un CRM dédié au suivi des parcours VAE, avec une gestion centralisée des candidats et de leur progression.',
        'Built a CRM dedicated to tracking VAE (Validation of Acquired Experience) journeys, with centralised management of candidates and their progress.',
        'Nanamboatra CRM natokana hanaraha-maso ny dingana VAE, miaraka amin’ny fitantanana afovoany ny kandida sy ny fandrosoany.',
      ),
      highlights: [
        i18n(
          'Gestion centralisée des candidats et suivi de leur progression tout au long du parcours VAE.',
          'Centralised candidate management and progress tracking throughout the VAE journey.',
          'Fitantanana afovoany ny kandida sy fanaraha-maso ny fandrosoany mandritra ny dingana VAE.',
        ),
        i18n(
          'Mise en place d’une vue Kanban, de tâches automatiques, de relances et de la gestion des dossiers.',
          'Implemented a Kanban view, automated tasks, reminders and case-file management.',
          'Nametraka fijery Kanban, asa mandeha ho azy, fampahatsiahivana ary fitantanana ny antontan-taratasy.',
        ),
        i18n(
          'Intégration de la gestion des utilisateurs, des e-mails et des échanges avec une plateforme externe.',
          'Integrated user management, e-mails and data exchange with an external platform.',
          'Nampiditra ny fitantanana ny mpampiasa, ny mailaka ary ny fifanakalozana amin’ny sehatra ivelany.',
        ),
      ],
      tech: ['Vue.js', 'Spring Boot', 'PostgreSQL', 'GitHub'],
      link: '',
    },
  ],

  projects: [
    {
      id: 'internet-banking',
      title: i18n('Internet Banking SMMEC', 'SMMEC Internet Banking', 'Internet Banking SMMEC'),
      category: i18n('Fintech · Banque en ligne', 'Fintech · Online banking', 'Fintech · Banky an-tserasera'),
      year: '2025 — 2026',
      summary: i18n(
        'Plateforme bancaire en ligne sécurisée : comptes, virements, e-documents et gestion financière.',
        'Secure online banking platform: accounts, transfers, e-documents and financial management.',
        'Sehatra banky an-tserasera voaaro: kaonty, famindrana vola, antontan-taratasy nomerika ary fitantanana ara-bola.',
      ),
      description: i18n(
        'Développée chez SOUTHSAICO pour SMMEC Madagascar, cette plateforme d’Internet Banking a été menée de la conception fonctionnelle jusqu’au déploiement. Les interfaces React ont d’abord été validées avec le client grâce à des données mock, avant la conception de la base PostgreSQL et le développement d’un back-end Java / Spring Boot exposant une API REST sécurisée.',
        'Built at SOUTHSAICO for SMMEC Madagascar, this Internet Banking platform was delivered from functional design to deployment. The React interfaces were first validated with the client using mock data, before designing the PostgreSQL database and developing a Java / Spring Boot back-end exposing a secure REST API.',
        'Natao tao amin’ny SOUTHSAICO ho an’ny SMMEC Madagasikara ity sehatra Internet Banking ity, nanomboka tamin’ny famolavolana ny fiasany ka hatramin’ny fametrahana azy. Nankatoavin’ny mpanjifa aloha ny endrika React tamin’ny alalan’ny angona santionany, vao namolavolana ny tahiry angona PostgreSQL sy ny back-end Java / Spring Boot manolotra API REST voaaro.',
      ),
      highlights: [
        i18n('Authentification sécurisée et gestion des accès', 'Secure authentication and access management', 'Fidirana voaaro sy fitantanana ny fahazoan-dalana'),
        i18n('Consultation des comptes et virements', 'Account overview and transfers', 'Fijerena ny kaonty sy famindrana vola'),
        i18n('E-documents et gestion financière', 'E-documents and financial management', 'Antontan-taratasy nomerika sy fitantanana ara-bola'),
        i18n('Tests, recette et retours clients en mode Agile', 'Testing, acceptance and client feedback in Agile', 'Fitsapana, fankatoavana ary hevitry ny mpanjifa amin’ny fomba Agile'),
      ],
      tech: ['React', 'Java', 'Spring Boot', 'PostgreSQL', 'REST API', 'Git'],
      image: '',
      gallery: [],
      links: [],
      featured: true,
      color: '#ff6a3d',
    },
    {
      id: 'bpm-workflow',
      title: i18n('Moteur de workflow BPM', 'BPM Workflow Engine', 'Motera workflow BPM'),
      category: i18n('Processus métier · Orange Madagascar', 'Business processes · Orange Madagascar', 'Dingana ara-asa · Orange Madagascar'),
      year: '2025',
      summary: i18n(
        'Application de gestion des processus métier avec un moteur de workflow interne inspiré de Camunda.',
        'Business process management app with an in-house workflow engine inspired by Camunda.',
        'Rindrambaiko fitantanana ny dingana ara-asa miaraka amin’ny motera workflow nalaina tahaka ny Camunda.',
      ),
      description: i18n(
        'Pour Orange Madagascar, j’ai développé une application complète de gestion des processus métier, de la conception jusqu’aux tests. Le cœur du projet est un moteur de workflow conçu en interne, inspiré de Camunda, qui orchestre l’exécution des processus, l’affectation des tâches, les notifications et le suivi de l’avancement. Front-end en Angular, back-end en Java / Quarkus.',
        'For Orange Madagascar, I developed a complete business process management application, from design to testing. At its core is an in-house workflow engine, inspired by Camunda, that orchestrates process execution, task assignment, notifications and progress tracking. Angular front-end, Java / Quarkus back-end.',
        'Ho an’ny Orange Madagascar, nanamboatra rindrambaiko feno fitantanana ny dingana ara-asa aho, nanomboka tamin’ny famolavolana ka hatramin’ny fitsapana. Ny fototry ny tetikasa dia motera workflow natao manokana, nalaina tahaka ny Camunda, mandrindra ny fanatanterahana ny dingana, ny fizarana ny asa, ny fampandrenesana ary ny fanaraha-maso ny fandrosoana. Front-end amin’ny Angular, back-end amin’ny Java / Quarkus.',
      ),
      highlights: [
        i18n('Moteur de workflow sur mesure', 'Custom workflow engine', 'Motera workflow natao manokana'),
        i18n('Affectation des tâches et notifications', 'Task assignment and notifications', 'Fizarana ny asa sy fampandrenesana'),
        i18n('Suivi de l’avancement des processus', 'Process progress tracking', 'Fanaraha-maso ny fandrosoan’ny dingana'),
        i18n('Maquettes Figma, front-end Angular', 'Figma mock-ups, Angular front-end', 'Maquette Figma, front-end Angular'),
      ],
      tech: ['Angular', 'Java', 'Quarkus', 'MySQL', 'Figma', 'GitHub'],
      image: '',
      gallery: [],
      links: [],
      featured: true,
      color: '#ffb23f',
    },
    {
      id: 'crm-vae',
      title: i18n('CRM parcours VAE', 'VAE Journey CRM', 'CRM dingana VAE'),
      category: i18n('CRM · Freelance', 'CRM · Freelance', 'CRM · Tsy miankina'),
      year: '2026',
      summary: i18n(
        'CRM de suivi des candidats VAE : vue Kanban, tâches automatiques, relances et gestion des dossiers.',
        'CRM for VAE candidates: Kanban view, automated tasks, reminders and case-file management.',
        'CRM fanaraha-maso ny kandida VAE: fijery Kanban, asa mandeha ho azy, fampahatsiahivana ary fitantanana ny antontan-taratasy.',
      ),
      description: i18n(
        'Projet freelance : un CRM dédié au suivi des parcours de Validation des Acquis de l’Expérience (VAE). Il centralise les candidats et leur progression, propose une vue Kanban, des tâches automatiques et des relances, et intègre la gestion des utilisateurs, des e-mails et des échanges avec une plateforme externe.',
        'Freelance project: a CRM dedicated to tracking VAE (Validation of Acquired Experience) journeys. It centralises candidates and their progress, offers a Kanban view, automated tasks and reminders, and integrates user management, e-mails and data exchange with an external platform.',
        'Tetikasa tsy miankina: CRM natokana hanaraha-maso ny dingana VAE (fanamarinana ny traikefa). Manangona ny kandida sy ny fandrosoany izy, manolotra fijery Kanban, asa mandeha ho azy sy fampahatsiahivana, ary mampiditra ny fitantanana ny mpampiasa, ny mailaka ary ny fifanakalozana amin’ny sehatra ivelany.',
      ),
      highlights: [
        i18n('Vue Kanban des candidats', 'Kanban view of candidates', 'Fijery Kanban ny kandida'),
        i18n('Tâches automatiques et relances', 'Automated tasks and reminders', 'Asa mandeha ho azy sy fampahatsiahivana'),
        i18n('Gestion des e-mails et des utilisateurs', 'E-mail and user management', 'Fitantanana ny mailaka sy ny mpampiasa'),
        i18n('Intégration avec une plateforme externe', 'Integration with an external platform', 'Fampifandraisana amin’ny sehatra ivelany'),
      ],
      tech: ['Vue.js', 'Spring Boot', 'PostgreSQL', 'GitHub'],
      image: '',
      gallery: [],
      links: [],
      featured: true,
      color: '#38c6b4',
    },
    {
      id: 'crypto-cloud',
      title: i18n('Crypto Cloud', 'Crypto Cloud', 'Crypto Cloud'),
      category: i18n('Cloud & mobile · Projet académique', 'Cloud & mobile · Academic project', 'Cloud sy finday · Tetikasa am-pianarana'),
      year: '',
      summary: i18n(
        'Application cloud de gestion de cryptomonnaies : front web, back-office et application mobile.',
        'Cloud app for managing cryptocurrencies: web front-end, back-office and mobile app.',
        'Rindrambaiko cloud fitantanana vola nomerika: front web, back-office ary rindrambaiko finday.',
      ),
      description: i18n(
        'Application cloud de gestion des cryptomonnaies composée d’un front web, d’un back-office et d’une application mobile. Elle gère les transactions, le suivi en temps réel et les notifications via Firebase, et se déploie avec Docker.',
        'A cloud application for managing cryptocurrencies, made of a web front-end, a back-office and a mobile app. It handles transactions, real-time tracking and notifications via Firebase, and is deployed with Docker.',
        'Rindrambaiko cloud fitantanana vola nomerika, misy front web, back-office ary rindrambaiko finday. Mitantana ny fifanakalozana, ny fanaraha-maso mivantana ary ny fampandrenesana amin’ny alalan’ny Firebase izy, ary apetraka amin’ny Docker.',
      ),
      highlights: [
        i18n('Front web, back-office et app mobile Flutter', 'Web front-end, back-office and Flutter mobile app', 'Front web, back-office ary rindrambaiko finday Flutter'),
        i18n('Transactions et suivi en temps réel', 'Transactions and real-time tracking', 'Fifanakalozana sy fanaraha-maso mivantana'),
        i18n('Notifications via Firebase', 'Notifications via Firebase', 'Fampandrenesana amin’ny Firebase'),
        i18n('Déploiement conteneurisé avec Docker', 'Containerised deployment with Docker', 'Fametrahana amin’ny Docker'),
      ],
      tech: ['Java (JSP, Servlets)', '.NET', 'Flutter', 'MySQL', 'Firestore', 'Docker'],
      image: '',
      gallery: [],
      links: [],
      featured: false,
      color: '#7d9cff',
    },
    {
      id: 'java-framework',
      title: i18n('Framework web Java', 'Java Web Framework', 'Framework web Java'),
      category: i18n('Architecture logicielle · Projet académique', 'Software architecture · Academic project', 'Rafitra rindrambaiko · Tetikasa am-pianarana'),
      year: '',
      summary: i18n(
        'Framework web en Java inspiré de Spring Boot : routes, contrôleurs, services et persistance.',
        'Java web framework inspired by Spring Boot: routing, controllers, services and persistence.',
        'Framework web amin’ny Java nalaina tahaka ny Spring Boot: lalana, controller, service ary fitahirizana angona.',
      ),
      description: i18n(
        'Développement d’un framework web en Java inspiré de Spring Boot pour créer des applications web évolutives. Il gère les routes, les contrôleurs, les services et la persistance des données grâce à une architecture modulaire, avec une configuration simplifiée et une gestion des dépendances par annotations.',
        'A Java web framework inspired by Spring Boot for building scalable web applications. It handles routing, controllers, services and data persistence through a modular architecture, with simplified configuration and annotation-based dependency management.',
        'Framework web amin’ny Java nalaina tahaka ny Spring Boot, hanamboarana rindrambaiko an-tranonkala azo itarina. Mitantana ny lalana, ny controller, ny service ary ny fitahirizana angona amin’ny alalan’ny rafitra mizara ho modules izy, miaraka amin’ny fanamboarana tsotra sy ny fitantanana ny fiankinana amin’ny annotations.',
      ),
      highlights: [
        i18n('Routage et contrôleurs par annotations', 'Annotation-based routing and controllers', 'Lalana sy controller amin’ny annotations'),
        i18n('Gestion des dépendances via annotations', 'Annotation-driven dependency management', 'Fitantanana ny fiankinana amin’ny annotations'),
        i18n('Couche de persistance des données', 'Data persistence layer', 'Sosona fitahirizana angona'),
        i18n('Architecture modulaire et évolutive', 'Modular, scalable architecture', 'Rafitra mizara ho modules sy azo itarina'),
      ],
      tech: ['Java', 'Annotations', 'MVC'],
      image: '',
      gallery: [],
      links: [],
      featured: false,
      color: '#d39a6a',
    },
  ],

  skills: [
    { id: 'languages', name: i18n('Langages', 'Languages', 'Fiteny fandaharana'), items: ['Java', 'PHP', 'C#', 'JavaScript', 'Python', 'C', 'Perl', 'SQL'] },
    {
      id: 'frameworks',
      name: i18n('Frameworks', 'Frameworks', 'Framework'),
      items: ['Spring Boot', 'Quarkus', '.NET', 'Laravel', 'CodeIgniter', 'Django', 'Angular', 'React', 'Vue.js', 'Flutter'],
    },
    { id: 'web', name: i18n('Web & front-end', 'Web & front-end', 'Web sy front-end'), items: ['HTML', 'CSS', 'Bootstrap', 'REST API'] },
    { id: 'databases', name: i18n('Bases de données', 'Databases', 'Tahiry angona'), items: ['PostgreSQL', 'MySQL', 'Oracle', 'Firestore'] },
    { id: 'tools', name: i18n('Outils & DevOps', 'Tools & DevOps', 'Fitaovana sy DevOps'), items: ['Git', 'GitHub', 'Docker', 'Firebase', 'Figma'] },
  ],

  education: [
    {
      id: 'mbds',
      title: i18n('Master MBDS', 'MBDS Master’s degree', 'Master MBDS'),
      field: i18n(
        'Mobiquité, Big Data et Systèmes Distribués',
        'Mobility, Big Data and Distributed Systems',
        'Mobiquité, Big Data ary Rafitra Mizarazara',
      ),
      school: 'Université Côte d’Azur',
      location: i18n(
        'Nice (France) · en partenariat avec l’IT University, Madagascar',
        'Nice (France) · in partnership with IT University, Madagascar',
        'Nice (Frantsa) · miara-miasa amin’ny IT University, Madagasikara',
      ),
      period: '2025',
      current: true,
      detail: i18n(
        'Spécialisation en intelligence artificielle.',
        'Specialisation in artificial intelligence.',
        'Manokana amin’ny faharanitan-tsaina artifisialy.',
      ),
    },
    {
      id: 'licence',
      title: i18n('Licence en informatique', 'Bachelor’s degree in Computer Science', 'Licence amin’ny informatika'),
      field: i18n('Spécialisée en développement d’applications', 'Specialised in application development', 'Manokana amin’ny famolavolana rindrambaiko'),
      school: 'IT University (ITU)',
      location: i18n('Antananarivo', 'Antananarivo', 'Antananarivo'),
      period: '2022 — 2025',
      current: false,
      detail: i18n('Diplôme obtenu en octobre 2025.', 'Graduated in October 2025.', 'Nahazo ny diplaoma tamin’ny Oktobra 2025.'),
    },
    {
      id: 'bac',
      title: i18n('Baccalauréat série D', 'Baccalaureate (Science, Series D)', 'Bakalorea andiany D'),
      field: i18n('Série scientifique', 'Science stream', 'Andiany siantifika'),
      school: 'École Sacré-Cœur Antanimena (ESCA)',
      location: i18n('Antananarivo', 'Antananarivo', 'Antananarivo'),
      period: '2022',
      current: false,
      detail: i18n('', '', ''),
    },
  ],

  certifications: [
    {
      id: 'english-c2',
      title: i18n('Certificat d’anglais — niveau C2', 'English Language Certificate — C2', 'Taratasy fanamarinana teny anglisy — C2'),
      issuer: 'International TESOL Training Institute Madagascar (ITTI)',
      date: i18n('Août 2025', 'August 2025', 'Aogositra 2025'),
      url: '',
    },
    {
      id: 'robotics',
      title: i18n('Formation en robotique et Arduino', 'Robotics & Arduino training', 'Fiofanana momba ny robotika sy Arduino'),
      issuer: 'GasyTech',
      date: i18n('Mai 2025', 'May 2025', 'Mey 2025'),
      url: '',
    },
    {
      id: 'delf-b2',
      title: i18n('DELF — niveau B2', 'DELF — B2 level (French)', 'DELF — ambaratonga B2'),
      issuer: 'Alliance Française d’Antananarivo',
      date: i18n('2024', '2024', '2024'),
      url: '',
    },
  ],

  languages: [
    { id: 'mg', name: i18n('Malagasy', 'Malagasy', 'Malagasy'), level: i18n('Langue maternelle', 'Native', 'Teny reny'), score: 100 },
    { id: 'fr', name: i18n('Français', 'French', 'Frantsay'), level: i18n('Courant · DELF B2', 'Fluent · DELF B2', 'Mahay tsara · DELF B2'), score: 85 },
    { id: 'en', name: i18n('Anglais', 'English', 'Anglisy'), level: i18n('Maîtrise · C2', 'Proficient · C2', 'Tena mahay · C2'), score: 95 },
  ],

  sections: [
    { id: 'hero', visible: true, label: i18n('Accueil', 'Home', 'Fandraisana'), title: i18n('', '', ''), subtitle: i18n('', '', '') },
    {
      id: 'about',
      visible: true,
      label: i18n('À propos', 'About', 'Momba ahy'),
      title: i18n(
        'Passionné par la technologie, guidé par la *curiosité*.',
        'Passionate about technology, driven by *curiosity*.',
        'Tia teknolojia, entanin’ny *fitiavana mahafantatra*.',
      ),
      subtitle: i18n('', '', ''),
    },
    {
      id: 'experience',
      visible: true,
      label: i18n('Expériences', 'Experience', 'Traikefa'),
      title: i18n('Des projets concrets, *en production*.', 'Real-world projects, *in production*.', 'Tetikasa tena izy, *efa mandeha*.'),
      subtitle: i18n('', '', ''),
    },
    {
      id: 'projects',
      visible: true,
      label: i18n('Projets', 'Projects', 'Tetikasa'),
      title: i18n('Réalisations *sélectionnées*', 'Selected *work*', 'Asa *voafantina*'),
      subtitle: i18n(
        'Cliquez sur un projet pour découvrir les détails.',
        'Click a project to see the details.',
        'Tsindrio ny tetikasa iray hahitana ny antsipiriany.',
      ),
    },
    {
      id: 'skills',
      visible: true,
      label: i18n('Compétences', 'Skills', 'Fahaiza-manao'),
      title: i18n('Une boîte à outils *full-stack*.', 'A *full-stack* toolbox.', 'Fitaovana *full-stack* feno.'),
      subtitle: i18n('', '', ''),
    },
    {
      id: 'education',
      visible: true,
      label: i18n('Parcours', 'Education', 'Fianarana'),
      title: i18n('Formation & *certifications*', 'Education & *certifications*', 'Fianarana sy *fanamarinana*'),
      subtitle: i18n('', '', ''),
    },
    {
      id: 'contact',
      visible: true,
      label: i18n('Contact', 'Contact', 'Fifandraisana'),
      title: i18n('Construisons quelque chose *ensemble*.', 'Let’s build something *together*.', 'Andao *hiara-hanorina* zavatra.'),
      subtitle: i18n(
        'Un poste, une mission freelance ou simplement une question ? Écrivez-moi, je réponds rapidement.',
        'A role, a freelance mission or just a question? Write to me — I reply quickly.',
        'Asa, iraka tsy miankina, na fanontaniana fotsiny? Manorata amiko, hamaly haingana aho.',
      ),
    },
  ],

  guide: {
    enabled: true,
    name: 'Fanilo',
    pronoun: 'he',
    tagline: i18n('Guide IA du portfolio', 'Portfolio AI guide', 'Mpitarika IA ny portfolio'),
    greeting: i18n(
      'Bonjour ! Je suis Fanilo, le guide IA de ce portfolio. Je peux vous faire visiter le site ou répondre à vos questions sur Ndimby : son parcours, ses compétences, ses projets…',
      'Hello! I’m Fanilo, this portfolio’s AI guide. I can take you on a tour of the site or answer your questions about Ndimby — his background, skills and projects.',
      'Manao ahoana! Izaho no Fanilo, mpitarika IA amin’ity portfolio ity. Afaka mitarika anao hitsidika ny tranonkala aho, na mamaly ny fanontanianao momba an’i Ndimby: ny diany, ny fahaiza-manaony ary ny tetikasany.',
    ),
    knowledge: i18n(
      'Ndimby (nom complet : Razafinjatovo Mamy Ny Aina Ndimby) est ouvert aux opportunités professionnelles : postes de développeur, missions freelance et collaborations. Il s’intéresse particulièrement à l’intelligence artificielle, au Big Data et aux systèmes distribués, qu’il étudie dans le cadre de son Master MBDS. Le nom de ce guide, « Fanilo », signifie « la torche » en malagasy : celle qui éclaire le chemin.',
      'Ndimby (full name: Razafinjatovo Mamy Ny Aina Ndimby) is open to professional opportunities: developer roles, freelance missions and collaborations. He is particularly interested in artificial intelligence, Big Data and distributed systems, which he studies in his MBDS Master’s degree. The guide’s name, “Fanilo”, means “the torch” in Malagasy: the one that lights the way.',
      'Vonona handray tolotra ara-asa i Ndimby (anarana feno: Razafinjatovo Mamy Ny Aina Ndimby): asa mpamolavola, iraka tsy miankina ary fiaraha-miasa. Liana manokana amin’ny faharanitan-tsaina artifisialy, ny Big Data ary ny rafitra mizarazara izy, izay ianarany ao amin’ny Master MBDS. Ny anaran’ity mpitarika ity, « Fanilo », dia midika hoe ilay jiro manazava ny lalana.',
    ),
    suggestions: [
      i18n('Quel est son parcours ?', 'What’s his background?', 'Inona avy ny diany?'),
      i18n('Quelles technologies maîtrise-t-il ?', 'Which technologies does he master?', 'Inona avy ireo teknolojia fehezany?'),
      i18n('Parle-moi du projet Internet Banking', 'Tell me about the Internet Banking project', 'Lazao amiko ny tetikasa Internet Banking'),
      i18n('Est-il disponible ?', 'Is he available?', 'Malalaka ve izy?'),
    ],
    tour: [
      {
        id: 'tour-hero',
        section: 'hero',
        text: i18n(
          'Bienvenue ! Voici Ndimby Razafinjatovo, développeur full-stack basé à Antananarivo, à Madagascar. Je vous emmène découvrir son parcours en quelques étapes.',
          'Welcome! Meet Ndimby Razafinjatovo, a full-stack developer based in Antananarivo, Madagascar. Let me show you around in a few steps.',
          'Tongasoa! Ity i Ndimby Razafinjatovo, mpamolavola full-stack monina eto Antananarivo, Madagasikara. Andeha hotarihiko hijery ny diany amin’ny dingana vitsivitsy ianao.',
        ),
      },
      {
        id: 'tour-about',
        section: 'about',
        text: i18n(
          'Ndimby est un passionné de technologie, sociable et à l’écoute. Diplômé de l’IT University, il poursuit aujourd’hui un Master MBDS avec une spécialisation en intelligence artificielle.',
          'Ndimby is passionate about technology, sociable and a good listener. A graduate of IT University, he is now pursuing an MBDS Master’s degree specialising in artificial intelligence.',
          'Tia teknolojia i Ndimby, mora ifandraisana ary mahay mihaino. Nahazo diplaoma tao amin’ny IT University izy, ary manohy Master MBDS manokana amin’ny faharanitan-tsaina artifisialy amin’izao fotoana izao.',
        ),
      },
      {
        id: 'tour-experience',
        section: 'experience',
        text: i18n(
          'Côté expérience : il développe actuellement une plateforme d’Internet Banking chez SOUTHSAICO. Avant cela, il a conçu un moteur de workflow pour Orange Madagascar et réalisé un CRM en freelance.',
          'On the experience side: he is currently building an Internet Banking platform at SOUTHSAICO. Before that, he designed a workflow engine for Orange Madagascar and delivered a CRM as a freelancer.',
          'Raha ny traikefa: manamboatra sehatra Internet Banking ao amin’ny SOUTHSAICO izy amin’izao fotoana izao. Talohan’izay dia namolavola motera workflow ho an’ny Orange Madagascar izy, ary nanamboatra CRM ho mpiasa tsy miankina.',
        ),
      },
      {
        id: 'tour-projects',
        section: 'projects',
        text: i18n(
          'Voici une sélection de ses réalisations. Cliquez sur un projet pour découvrir les détails, les fonctionnalités et les technologies utilisées.',
          'Here is a selection of his work. Click any project to see the details, features and technologies used.',
          'Ireto ny asa voafantina nataony. Tsindrio ny tetikasa iray raha te hahita ny antsipiriany, ny fiasany ary ny teknolojia nampiasaina.',
        ),
      },
      {
        id: 'tour-skills',
        section: 'skills',
        text: i18n(
          'Sa boîte à outils couvre tout le cycle : Java et Spring Boot, Quarkus, React, Angular, PostgreSQL, Docker… du front-end au back-end.',
          'His toolbox covers the whole cycle: Java and Spring Boot, Quarkus, React, Angular, PostgreSQL, Docker… from front-end to back-end.',
          'Mandrakotra ny dingana rehetra ny fitaovany: Java sy Spring Boot, Quarkus, React, Angular, PostgreSQL, Docker… manomboka amin’ny front-end ka hatramin’ny back-end.',
        ),
      },
      {
        id: 'tour-education',
        section: 'education',
        text: i18n(
          'Son parcours : une licence en informatique à l’IT University, le Master MBDS de l’Université Côte d’Azur, un certificat d’anglais niveau C2 et le DELF B2.',
          'His education: a Bachelor’s in Computer Science from IT University, the MBDS Master’s at Université Côte d’Azur, a C2 English certificate and the DELF B2.',
          'Ny fianarany: Licence amin’ny informatika tao amin’ny IT University, Master MBDS ao amin’ny Université Côte d’Azur, taratasy fanamarinana teny anglisy C2 ary DELF B2.',
        ),
      },
      {
        id: 'tour-contact',
        section: 'contact',
        text: i18n(
          'Et pour finir : un projet, un poste ou une question ? Écrivez-lui directement ici, il vous répondra rapidement. Je reste disponible si vous avez des questions !',
          'And finally: a project, a role or a question? Write to him right here — he will get back to you quickly. I’m still here if you have any questions!',
          'Ary farany: manana tetikasa, asa na fanontaniana ve ianao? Manorata aminy mivantana eto, hamaly anao haingana izy. Mbola eto foana aho raha manana fanontaniana ianao!',
        ),
      },
    ],
    voice: true,
    autoGreet: true,
    greetDelay: 8,
  },

  seo: {
    title: i18n(
      'Ndimby Razafinjatovo — Développeur Full-Stack',
      'Ndimby Razafinjatovo — Full-Stack Developer',
      'Ndimby Razafinjatovo — Mpamolavola Full-Stack',
    ),
    description: i18n(
      'Portfolio de Ndimby Razafinjatovo, développeur full-stack à Antananarivo : Java, Spring Boot, Quarkus, React, Angular. Expériences, projets, compétences et contact.',
      'Portfolio of Ndimby Razafinjatovo, full-stack developer in Antananarivo: Java, Spring Boot, Quarkus, React, Angular. Experience, projects, skills and contact.',
      'Portfolio an’i Ndimby Razafinjatovo, mpamolavola full-stack eto Antananarivo: Java, Spring Boot, Quarkus, React, Angular. Traikefa, tetikasa, fahaiza-manao ary fifandraisana.',
    ),
    image: '/og-image.jpg',
  },

  marquee: ['Java', 'Spring Boot', 'Quarkus', 'React', 'Angular', 'Vue.js', 'PostgreSQL', 'Docker', '.NET', 'Laravel', 'Django', 'Flutter', 'MySQL', 'Oracle', 'Git', 'Firebase'],

  ui: {},
};
