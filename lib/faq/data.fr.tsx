/* eslint-disable react/no-unescaped-entities --
   French FAQ prose: literal apostrophes (l', d', n', qu'...) are pervasive and
   correct in the JSX text below. Escaping each one would hurt readability of
   this content file with no user-facing benefit. */
import { Link } from '@/i18n/navigation';
import type { FAQGroup } from './types';

export const FAQ_GROUPS_FR: FAQGroup[] = [
  {
    slug: 'getting-started',
    title: 'Premiers pas',
    blurb: "Installer SaleLinx, se connecter et les navigateurs pris en charge.",
    items: [
      {
        id: 'how-do-i-install',
        q: "Comment installer l'extension SaleLinx ?",
        a: (
          <p>
            Installez depuis le Chrome Web Store et épinglez l'extension à votre barre d'outils. Tutoriel complet avec captures d'écran dans{' '}
            <Link
              href="/docs/getting-started/install-the-extension"
              className="underline underline-offset-4"
            >
              Installer l'extension SaleLinx
            </Link>
            .
          </p>
        ),
        keywords: ['installer', 'configuration', 'chrome', 'ajouter'],
      },
      {
        id: 'which-browsers',
        q: 'Quels navigateurs SaleLinx prend-il en charge ?',
        a: (
          <p>
            Tout navigateur basé sur Chromium : Google Chrome, Microsoft Edge,
            Brave, Arc, Opera. Safari et Firefox ne sont pas pris en charge.
          </p>
        ),
        keywords: ['navigateur', 'chrome', 'edge', 'safari', 'firefox', 'brave'],
      },
      {
        id: 'free-trial',
        q: "Faut-il payer pour l'essayer ?",
        a: (
          <p>
            Vous bénéficiez d'un essai gratuit de 7 jours du forfait Starter,
            un par compte. Une carte bancaire est requise pour le démarrer,
            mais rien n'est débité pendant l'essai et vous pouvez annuler à
            tout moment depuis votre page de compte. Sans annulation, votre
            abonnement Starter démarre automatiquement à la fin de l'essai.
            Voir{' '}
            <Link href="/pricing" className="underline underline-offset-4">
              les tarifs
            </Link>{' '}
            pour ce que chaque niveau inclut.
          </p>
        ),
        keywords: ['gratuit', 'essai', 'tarifs', 'forfait', 'carte'],
      },
    ],
  },
  {
    slug: 'billing',
    title: 'Compte et facturation',
    blurb: "Forfaits, factures, moyens de paiement et annulations.",
    items: [
      {
        id: 'how-to-upgrade',
        q: 'Comment passer à un forfait supérieur ?',
        a: (
          <p>
            Connectez-vous sur{' '}
            <Link href="/account" className="underline underline-offset-4">
              salelinx.com/account
            </Link>{' '}
            et choisissez un nouveau forfait. Le changement s'applique immédiatement et vous êtes facturé au prorata pour le reste de la période.
          </p>
        ),
        keywords: ['surclasser', 'forfait', 'changer', 'niveau'],
      },
      {
        id: 'how-to-cancel',
        q: 'Comment annuler mon abonnement ?',
        a: (
          <p>
            Ouvrez votre{' '}
            <Link href="/account" className="underline underline-offset-4">
              page compte
            </Link>{' '}
            et cliquez sur <em>Gérer la facturation</em>. Vous arriverez dans le portail client Stripe où vous pourrez annuler. Vous gardez l'accès jusqu'à la fin de la période en cours.
          </p>
        ),
        keywords: ['annuler', 'désabonner', 'arrêter facturation'],
      },
      {
        id: 'change-plan-midmonth',
        q: 'Puis-je changer de forfait en cours de période de facturation ?',
        a: (
          <p>
            Oui. Les surclassements prennent effet immédiatement avec une facturation au prorata. Les déclassements prennent effet au début de la période suivante, pour que vous ne perdiez pas ce que vous avez déjà payé.
          </p>
        ),
        keywords: ['prorata', 'changer', 'déclasser'],
      },
      {
        id: 'where-are-invoices',
        q: 'Où puis-je récupérer mes factures ?',
        a: (
          <p>
            Dans le portail client Stripe. Ouvrez votre page compte, cliquez sur{' '}
            <em>Gérer la facturation</em>, puis <em>Historique des factures</em>.
          </p>
        ),
        keywords: ['facture', 'reçu', 'taxe', 'tva'],
      },
      {
        id: 'charged-twice',
        q: "J'ai été facturé deux fois, que faire ?",
        a: (
          <p>
            C'est presque toujours un prélèvement échoué puis réessayé, pas un vrai doublon. Vérifiez d'abord l'historique des factures dans le portail client. Si vous voyez deux prélèvements réussis, écrivez à{' '}
            <a
              href="mailto:support@salelinx.com"
              className="underline underline-offset-4"
            >
              support@salelinx.com
            </a>{' '}
            avec les IDs de facture et nous rembourserons le doublon.
          </p>
        ),
        keywords: ['doublon', 'remboursement', 'trop facturé', 'prélèvement'],
      },
    ],
  },
  {
    slug: 'troubleshooting',
    title: 'Dépannage',
    blurb: "Solutions aux problèmes les plus courants.",
    items: [
      {
        id: 'panel-not-appearing',
        q: "Le panneau SaleLinx n'apparaît pas sur Depop ou Vinted",
        a: (
          <div className="space-y-2">
            <p>Essayez dans cet ordre :</p>
            <ol className="list-decimal space-y-1 pl-5">
              <li>Rafraîchissez l'onglet de la marketplace.</li>
              <li>
                Assurez-vous que l'extension est épinglée et activée (icône puzzle dans la barre d'outils Chrome).
              </li>
              <li>
                Vérifiez que vous êtes sur une page produit ou profil. Le panneau ne s'ouvre pas sur les pages de recherche ou de paiement.
              </li>
              <li>Déconnectez-vous puis reconnectez-vous depuis l'extension.</li>
            </ol>
          </div>
        ),
        keywords: ['panneau', 'manquant', 'pas visible', 'depop', 'vinted'],
      },
      {
        id: 'listing-failed-to-post',
        q: "Une annonce n'a pas pu être publiée",
        a: (
          <p>
            La plupart des échecs viennent d'une déconnexion de la marketplace cible ou d'un champ requis qui ne correspond pas. Déconnectez-vous puis reconnectez-vous sur la marketplace cible, puis réessayez depuis le tableau de bord. Si toute une marketplace est en panne, consultez la{' '}
            <Link
              href="/docs/status"
              className="underline underline-offset-4"
            >
              page de statut des plateformes
            </Link>
            .
          </p>
        ),
        keywords: ['échec', 'erreur', 'publier', 'crosslist', 'téléverser'],
      },
      {
        id: 'crosslisting-stuck',
        q: "Le crosslisting est bloqué sur « Remplissage du formulaire... »",
        a: (
          <p>
            Ne touchez pas à l'onglet cible pendant que l'extension le remplit. Si c'est bloqué depuis plus d'une minute, cliquez sur <em>Annuler</em> dans le panneau et réessayez. Si cela se produit régulièrement sur une marketplace, c'est probablement un changement de mise en page de formulaire chez eux ; voir le{' '}
            <Link
              href="/docs/status"
              className="underline underline-offset-4"
            >
              statut des plateformes
            </Link>
            .
          </p>
        ),
        keywords: ['bloqué', 'figé', 'lent', 'remplissage'],
      },
      {
        id: 'cant-sign-in',
        q: "Je suis déconnecté et je ne peux pas me reconnecter",
        a: (
          <p>
            Réinitialisez votre mot de passe sur{' '}
            <Link
              href="/auth/forgot-password"
              className="underline underline-offset-4"
            >
              salelinx.com/auth/forgot-password
            </Link>
            . Votre compte site web et votre compte extension sont identiques, donc le nouveau mot de passe fonctionne sur les deux.
          </p>
        ),
        keywords: ['mot de passe', 'connexion', 'réinitialiser', 'verrouillé'],
      },
      {
        id: 'listings-not-syncing',
        q: 'Mes annonces ne se synchronisent pas dans le tableau de bord',
        a: (
          <p>
            Ouvrez le tableau de bord et cliquez sur le bouton <em>Resynchroniser</em> en haut à droite. S'il manque une annonce précise, ouvrez-la sur la marketplace une fois avec le panneau SaleLinx ouvert ; le panneau l'ajoute à la détection.
          </p>
        ),
        keywords: ['synchro', 'manquant', 'tableau de bord', 'rafraîchir'],
      },
    ],
  },
  {
    slug: 'privacy',
    title: 'Confidentialité et données',
    blurb: 'Ce que nous stockons, où cela vit et comment le supprimer.',
    items: [
      {
        id: 'store-marketplace-password',
        q: 'SaleLinx stocke-t-il mon mot de passe de marketplace ?',
        a: (
          <p>
            Non. SaleLinx utilise votre session de navigateur existante sur chaque marketplace, donc il n'y a aucun mot de passe à saisir, stocker ou divulguer.
          </p>
        ),
        keywords: ['mot de passe', 'identifiants', 'sécurité'],
      },
      {
        id: 'where-is-my-data',
        q: 'Où sont stockées mes données ?',
        a: (
          <p>
            Votre compte SaleLinx et l'index de vos annonces sont stockés dans Supabase (région UE). Les données des marketplaces elles-mêmes restent sur la marketplace.
          </p>
        ),
        keywords: ['données', 'stockage', 'supabase', 'région', 'ue'],
      },
      {
        id: 'delete-my-data',
        q: 'Comment supprimer mes données ?',
        a: (
          <p>
            Écrivez à{' '}
            <a
              href="mailto:support@salelinx.com"
              className="underline underline-offset-4"
            >
              support@salelinx.com
            </a>{' '}
            depuis l'adresse liée à votre compte. Nous confirmerons et supprimerons sous 7 jours.
          </p>
        ),
        keywords: ['supprimer', 'rgpd', 'effacer', 'compte'],
      },
    ],
  },
];
