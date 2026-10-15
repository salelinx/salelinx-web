/* eslint-disable react/no-unescaped-entities --
   French FAQ prose: literal apostrophes (l', d', n', qu'...) are pervasive and
   correct in the JSX text below. Escaping each one would hurt readability of
   this content file with no user-facing benefit. */
import { Link } from '@/i18n/navigation';
import { CHROME_WEB_STORE_URL } from '@/lib/site';
import { InstallExtensionButton } from '@/components/InstallExtensionButton';
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
          <>
            <p>
              Installez depuis le{' '}
              <a
                href={CHROME_WEB_STORE_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="underline underline-offset-4"
              >
                Chrome Web Store
              </a>{' '}
              et épinglez l'extension à votre barre d'outils. Tutoriel complet avec captures d'écran dans{' '}
              <Link
                href="/docs/getting-started/install-the-extension"
                className="underline underline-offset-4"
              >
                Installer l'extension SaleLinx
              </Link>
              .
            </p>
            <InstallExtensionButton
              label="Ajouter à Chrome"
              className="mt-3 inline-flex items-center gap-2 rounded-full bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-zinc-800 dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-100"
            />
          </>
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
            Non. Vous bénéficiez d'un essai gratuit de 14 jours du forfait
            Starter, avec les mêmes fonctionnalités que Starter mais des
            quotas plus bas (voir{' '}
            <Link href="/pricing" className="underline underline-offset-4">
              les tarifs
            </Link>
            ). Une carte bancaire est requise pour le démarrer, mais rien
            n'est débité pendant l'essai et vous pouvez annuler à tout moment
            depuis votre page de compte. Il y a un essai par compte SaleLinx
            et par boutique Depop ou Vinted. Sans annulation, votre abonnement
            Starter démarre automatiquement à la fin de l'essai.
          </p>
        ),
        keywords: ['gratuit', 'essai', 'tarifs', 'forfait', 'carte'],
      },
    ],
  },
  {
    slug: 'billing',
    title: 'Compte et facturation',
    blurb: "Forfaits, factures, annulations et récompenses de parrainage.",
    items: [
      {
        id: 'how-to-upgrade',
        q: 'Comment passer à un forfait supérieur ?',
        a: (
          <p>
            Avec un forfait payant, ouvrez votre{' '}
            <Link href="/account" className="underline underline-offset-4">
              page compte
            </Link>
            , cliquez sur <strong>Gérer l'abonnement</strong> et choisissez le
            nouveau forfait dans le portail de facturation Stripe. Pendant
            votre essai gratuit, choisissez plutôt un forfait sur la{' '}
            <Link href="/pricing" className="underline underline-offset-4">
              page des tarifs
            </Link>{' '}
            ou cliquez sur <strong>Passer à Starter maintenant</strong> sur
            votre page compte. Cela met fin à l'essai et débite votre carte
            tout de suite, et les nouveaux quotas s'appliquent immédiatement.
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
            et cliquez sur <strong>Gérer l'abonnement</strong>. Le portail de
            facturation Stripe s'ouvre et vous pouvez y annuler. Vous gardez
            l'accès jusqu'à la fin de la période déjà payée, et vous pouvez
            revenir sur l'annulation au même endroit d'ici là. Si vous annulez
            pendant l'essai gratuit, rien ne vous est facturé.
          </p>
        ),
        keywords: ['annuler', 'désabonner', 'arrêter facturation'],
      },
      {
        id: 'change-plan-midmonth',
        q: 'Puis-je changer de forfait en cours de période de facturation ?',
        a: (
          <p>
            Oui. Pendant l'essai gratuit, choisir un forfait sur la{' '}
            <Link href="/pricing" className="underline underline-offset-4">
              page des tarifs
            </Link>{' '}
            met fin à l'essai plus tôt : votre carte est débitée pour ce
            forfait tout de suite et ses quotas s'appliquent immédiatement.
            Avec un forfait payant, tout changement se fait dans le portail de
            facturation Stripe : cliquez sur{' '}
            <strong>Gérer l'abonnement</strong> sur votre{' '}
            <Link href="/account" className="underline underline-offset-4">
              page compte
            </Link>{' '}
            et choisissez le forfait. Pour passer à un forfait inférieur,
            passez toujours par <strong>Gérer l'abonnement</strong>.
          </p>
        ),
        keywords: ['prorata', 'changer', 'déclasser', 'essai'],
      },
      {
        id: 'where-are-invoices',
        q: 'Où puis-je récupérer mes factures ?',
        a: (
          <p>
            Ouvrez votre{' '}
            <Link href="/account" className="underline underline-offset-4">
              page compte
            </Link>{' '}
            et cliquez sur <strong>Gérer l'abonnement</strong>. Le portail de
            facturation Stripe s'ouvre sur l'historique de vos factures, que
            vous pouvez télécharger une par une.
          </p>
        ),
        keywords: ['facture', 'reçu', 'taxe', 'tva'],
      },
      {
        id: 'charged-twice',
        q: "J'ai été facturé deux fois, que faire ?",
        a: (
          <p>
            C'est presque toujours un prélèvement échoué puis réessayé, pas un
            vrai doublon. Vérifiez d'abord vos factures :{' '}
            <strong>Gérer l'abonnement</strong> sur votre page compte les ouvre
            dans le portail de facturation Stripe. Si vous voyez deux
            prélèvements réussis, écrivez à{' '}
            <a
              href="mailto:support@salelinx.com"
              className="underline underline-offset-4"
            >
              support@salelinx.com
            </a>{' '}
            avec les numéros de facture et nous rembourserons le doublon.
          </p>
        ),
        keywords: ['doublon', 'remboursement', 'trop facturé', 'prélèvement'],
      },
      {
        id: 'refer-and-earn',
        q: 'Comment fonctionne le parrainage ?',
        a: (
          <p>
            Copiez votre lien depuis l'onglet <strong>Parrainage</strong> du
            panneau SaleLinx, ou depuis <strong>Parrainez un ami</strong> sur
            votre{' '}
            <Link href="/account" className="underline underline-offset-4">
              page compte
            </Link>
            . Les amis qui s'inscrivent avec ce lien obtiennent une réduction
            sur leur premier mois. Une fois qu'un ami a payé, vous gagnez du
            temps gratuit sur votre propre forfait : 1 semaine s'il choisit
            Starter, 2 semaines pour Pro, 1 mois pour Business. Il arrive sous
            forme de crédit sur votre prochaine facture SaleLinx environ une
            semaine après son premier paiement, à condition que vous ayez
            vous-même un forfait. Toutes les règles sont dans les{' '}
            <Link
              href="/legal/referral-terms"
              className="underline underline-offset-4"
            >
              conditions du programme de parrainage
            </Link>
            .
          </p>
        ),
        keywords: ['parrainage', 'parrainer', 'inviter', 'ami', 'récompense', 'crédit', 'réduction'],
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
            <p>
              Le panneau s'ouvre depuis le lanceur SaleLinx, en bas à droite de
              chaque page Depop et Vinted : cliquez dessus, ou appuyez sur
              Alt+S (le raccourci par défaut) dans un onglet Depop ou Vinted.
              L'icône SaleLinx de la barre d'outils Chrome ouvre seulement une
              petite fenêtre pour se connecter. Si vous ne voyez pas le
              lanceur :
            </p>
            <ol className="list-decimal space-y-1 pl-5">
              <li>
                Rafraîchissez l'onglet Depop ou Vinted. Les onglets déjà ouverts
                quand vous avez installé ou mis à jour SaleLinx doivent être
                rafraîchis.
              </li>
              <li>
                Vérifiez que SaleLinx est activé : ouvrez chrome://extensions et
                regardez son interrupteur.
              </li>
              <li>
                Toujours rien ?{' '}
                <Link
                  href="/help/support"
                  className="underline underline-offset-4"
                >
                  Contactez l'assistance
                </Link>
                .
              </li>
            </ol>
          </div>
        ),
        keywords: ['panneau', 'manquant', 'pas visible', 'lanceur', 'depop', 'vinted'],
      },
      {
        id: 'update-available',
        q: "SaleLinx indique qu'une mise à jour est disponible ou que j'ai des versions de retard",
        a: (
          <p>
            Chrome met SaleLinx à jour tout seul. Quand une nouvelle version
            est téléchargée, le panneau affiche une bannière qui l'annonce :
            cliquez sur <strong>Recharger pour mettre à jour</strong> et la
            page se rafraîchit sur la nouvelle version. Si le panneau indique
            que vous avez une ou plusieurs versions de retard, Chrome n'a pas
            encore récupéré la mise à jour. Cliquez sur{' '}
            <strong>Ouvrir la page des extensions</strong> (ou allez sur
            chrome://extensions), activez le <strong>Mode développeur</strong>{' '}
            en haut à droite, cliquez sur <strong>Mettre à jour</strong>, puis
            rafraîchissez vos onglets Depop et Vinted.
          </p>
        ),
        keywords: ['mise à jour', 'version', 'retard', 'obsolète', 'recharger'],
      },
      {
        id: 'in-use-another-device',
        q: 'SaleLinx indique être utilisé sur un autre appareil',
        a: (
          <p>
            Vous pouvez être connecté sur plusieurs appareils, mais un seul à
            la fois peut utiliser SaleLinx. Si le panneau affiche{' '}
            <strong>Utilisé sur un autre appareil</strong>, cliquez sur{' '}
            <strong>Utiliser ici</strong> pour continuer ici : l'autre appareil
            est déconnecté de SaleLinx. Si vous venez de fermer vos onglets
            Depop et Vinted sur l'autre appareil, la place se libère aussi
            d'elle-même en 10 minutes environ. Si vous ne reconnaissez pas
            l'autre appareil, reprenez la main puis changez votre mot de passe
            depuis votre{' '}
            <Link href="/account" className="underline underline-offset-4">
              page compte
            </Link>
            .
          </p>
        ),
        keywords: ['appareil', 'autre appareil', 'ordinateur', 'utiliser ici', 'partagé'],
      },
      {
        id: 'salelinx-temporarily-down',
        q: 'SaleLinx indique être temporairement indisponible',
        a: (
          <p>
            Le panneau n'arrive pas à joindre nos serveurs pour le moment.
            Depop et Vinted ne sont pas touchés : vous pouvez continuer à
            utiliser les deux sites normalement, et vos annonces y restent
            intactes. Le message disparaît tout seul dès que SaleLinx est de
            nouveau joignable, inutile donc de réinstaller, de vous déconnecter
            ou de réinitialiser votre mot de passe, même si l'écran de
            connexion affiche le même message. À partir de la version 1.1.12,
            il couvre tout le panneau et propose un bouton{' '}
            <strong>Fermer SaleLinx</strong> ; les versions précédentes
            l'affichent sous forme de bannière en haut du panneau.
          </p>
        ),
        keywords: ['panne', 'indisponible', 'hors service', 'ne fonctionne pas', 'hors ligne'],
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
            . Si vous vous êtes inscrit avec Google, il n'y a pas de mot de
            passe à réinitialiser : utilisez le bouton{' '}
            <strong>Continuer avec Google</strong> sur la page de connexion.
            Votre compte site web et votre compte extension sont identiques,
            donc la reconnexion fonctionne sur les deux.
          </p>
        ),
        keywords: ['mot de passe', 'connexion', 'réinitialiser', 'verrouillé', 'google'],
      },
      {
        id: 'open-a-marketplace-tab',
        q: "SaleLinx me demande d'ouvrir un onglet Depop ou Vinted",
        a: (
          <p>
            SaleLinx passe par vos propres sessions Depop et Vinted connectées,
            donc une fonctionnalité a besoin qu'un onglet de sa marketplace
            soit ouvert quelque part dans Chrome. N'importe quelle fenêtre
            convient, et ce n'est pas forcément l'onglet que vous regardez.
            Cliquez sur <strong>Ouvrir Depop</strong> ou{' '}
            <strong>Ouvrir Vinted</strong> dans le message, ou ouvrez le site
            vous-même ; le crosslisting a besoin des deux. Si un onglet est
            ouvert mais que SaleLinx vous demande de le recharger (par exemple
            après que Chrome l'a mis en veille pour économiser la mémoire),
            cliquez sur <strong>Recharger l'onglet Depop</strong> ou{' '}
            <strong>Recharger l'onglet Vinted</strong>. À partir de la version
            1.1.12, <strong>Mes annonces</strong> propose aussi d'ouvrir
            l'onglet manquant lors d'un rafraîchissement ; les versions
            précédentes demandaient de recharger un onglet même quand aucun
            n'était ouvert.
          </p>
        ),
        keywords: ['onglet', 'ouvrir', 'recharger', 'depop', 'vinted'],
      },
      {
        id: 'wrong-marketplace-account',
        q: 'SaleLinx indique que je suis connecté à Depop ou Vinted avec un autre compte',
        a: (
          <p>
            SaleLinx fonctionne uniquement avec les comptes Depop et Vinted qui
            lui sont liés, et met en pause les fonctions de cette marketplace
            tant que le site est connecté à un autre compte. Pour corriger,
            déconnectez-vous de Depop ou Vinted, reconnectez-vous avec le
            compte lié et rechargez l'onglet. Si vous voulez plutôt que
            SaleLinx utilise l'autre compte, ouvrez{' '}
            <strong>Paramètres</strong> dans le panneau, cliquez sur{' '}
            <strong>Délier</strong> sous{' '}
            <strong>Comptes de plateformes</strong>, puis sur{' '}
            <strong>Lier</strong> pour le compte avec lequel vous êtes
            connecté. Plus de détails dans{' '}
            <Link
              href="/docs/getting-started/connect-your-first-marketplace"
              className="underline underline-offset-4"
            >
              Connecter votre première marketplace
            </Link>
            .
          </p>
        ),
        keywords: ['autre compte', 'mauvais compte', 'compte différent', 'relier', 'délier'],
      },
      {
        id: 'account-already-linked',
        q: 'SaleLinx indique que mon compte Depop ou Vinted est déjà lié ou a déjà utilisé un essai gratuit',
        a: (
          <p>
            Chaque compte Depop ou Vinted ne peut être lié qu'à un seul compte
            SaleLinx à la fois. S'il est lié à un autre de vos comptes
            SaleLinx, connectez-vous à celui-ci, cliquez sur{' '}
            <strong>Délier</strong> dans <strong>Paramètres</strong>, puis
            reconnectez-vous à ce compte-ci et liez-le. Chaque boutique n'a
            aussi droit qu'à un essai gratuit : si elle en a déjà eu un sur un
            autre compte SaleLinx, vous pourrez la lier ici après avoir
            souscrit un forfait payant depuis la{' '}
            <Link href="/pricing" className="underline underline-offset-4">
              page des tarifs
            </Link>
            . Si vous n'avez plus accès à l'autre compte,{' '}
            <Link href="/help/support" className="underline underline-offset-4">
              contactez l'assistance
            </Link>
            .
          </p>
        ),
        keywords: ['déjà lié', 'lier', 'essai', 'autre compte', 'impossible de lier'],
      },
      {
        id: 'listings-not-syncing',
        q: "Mes annonces n'apparaissent pas ou ne sont pas à jour",
        a: (
          <p>
            SaleLinx lit vos annonces sur Depop et Vinted tant qu'un onglet de
            cette marketplace est ouvert et connecté à votre compte lié. Dans{' '}
            <strong>Mes annonces</strong>, le statut à côté de Depop et Vinted,
            en haut, indique la dernière synchronisation de chacun : cliquez
            sur <strong>Tout rafraîchir</strong>, ou sur le bouton de
            rafraîchissement d'une marketplace, pour synchroniser tout de
            suite. S'il vous demande d'ouvrir ou de recharger un onglet, ou
            indique que votre session a expiré, faites-le sur le site de la
            marketplace puis rafraîchissez à nouveau. Plus de détails dans le{' '}
            <Link
              href="/docs/inventory/listings"
              className="underline underline-offset-4"
            >
              guide Mes annonces
            </Link>
            .
          </p>
        ),
        keywords: ['synchro', 'manquant', 'mes annonces', 'rafraîchir', 'pas à jour'],
      },
      {
        id: 'crosslisting-stuck',
        q: 'Le crosslisting est bloqué ou ne démarre pas',
        a: (
          <div className="space-y-2">
            <p>Vérifiez ces points dans l'ordre :</p>
            <ol className="list-decimal space-y-1 pl-5">
              <li>
                Vos comptes Depop et Vinted sont tous les deux liés, et un
                onglet Depop et un onglet Vinted sont ouverts et connectés à
                ces comptes. Le panneau vous indique ce qui manque.
              </li>
              <li>
                Regardez la <Link href="/docs/getting-started/queue" className="underline underline-offset-4">file d'attente</Link> en bas de la barre latérale du
                panneau. SaleLinx exécute une tâche à la fois, donc un
                crosslisting reste <strong>En attente</strong> jusqu'à la fin
                de la tâche qui le précède. S'il est <strong>En pause</strong>,
                cliquez sur <strong>Reprendre</strong>.
              </li>
              <li>
                <strong>Limité</strong> signifie que Depop ou Vinted limite les
                requêtes. SaleLinx attend et reprend tout seul à la fin du
                compte à rebours.
              </li>
              <li>
                Si vous avez épuisé votre quota mensuel de crosslistings,
                SaleLinx indique que la limite est atteinte. Il se réinitialise
                au début de chaque mois (UTC) ; voir{' '}
                <Link href="/pricing" className="underline underline-offset-4">
                  les tarifs
                </Link>{' '}
                pour des forfaits plus larges.
              </li>
            </ol>
            <p>
              Si une marketplace échoue sans arrêt, consultez la{' '}
              <Link
                href="/docs/status"
                className="underline underline-offset-4"
              >
                page de statut des plateformes
              </Link>
              .
            </p>
          </div>
        ),
        keywords: ['bloqué', 'figé', 'lent', 'en attente', 'crosslist'],
      },
      {
        id: 'listing-failed-to-post',
        q: "Le crosslisting d'une annonce a échoué",
        a: (
          <p>
            La file d'attente en bas de la barre latérale du panneau indique
            combien d'annonces ont échoué. La plupart des échecs viennent d'une
            déconnexion de la marketplace vers laquelle vous copiez, ou
            d'informations que cette marketplace n'a pas acceptées.
            Connectez-vous-y avec votre compte lié, puis sélectionnez l'annonce
            dans <strong>Mes annonces</strong> et cliquez à nouveau sur{' '}
            <strong>Publier ailleurs</strong>. À partir de la version 1.1.12,
            les annonces en échec ne comptent pas dans votre quota mensuel de
            crosslistings. Si toute une marketplace a des problèmes, consultez
            la{' '}
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
        id: 'presets-not-syncing',
        q: 'Mes préréglages enregistrés ne sont pas sur mon autre ordinateur',
        a: (
          <p>
            Les préréglages enregistrés se synchronisent via votre compte SaleLinx avec tout forfait ou essai actif. Vérifiez d'abord que les deux appareils sont connectés au même compte et que votre forfait est actif. Le préréglage sélectionné est propre à chaque appareil : choisissez-le à nouveau sur la seconde machine. Se déconnecter efface les préréglages de ce navigateur ; ils reviennent à la prochaine connexion. Détails dans{' '}
            <Link
              href="/docs/getting-started/account-and-subscription"
              className="underline underline-offset-4"
            >
              Compte et abonnement
            </Link>
            .
          </p>
        ),
        keywords: ['préréglage', 'préréglages', 'réglages', 'synchro', 'appareil'],
      },
      {
        id: 'contact-support',
        q: "Comment contacter l'assistance ?",
        a: (
          <p>
            Ouvrez l'onglet <strong>Support</strong> du panneau SaleLinx,
            choisissez un <strong>Type</strong>, décrivez le problème et
            cliquez sur <strong>Envoyer</strong>. Les tickets envoyés depuis le
            panneau incluent la version de votre extension et votre forfait, ce
            qui nous aide à trouver la cause. Vous pouvez aussi nous écrire
            depuis la{' '}
            <Link href="/help/support" className="underline underline-offset-4">
              page de contact
            </Link>{' '}
            ou par e-mail à{' '}
            <a
              href="mailto:support@salelinx.com"
              className="underline underline-offset-4"
            >
              support@salelinx.com
            </a>
            . Nous vous prévenons par e-mail quand nous répondons, et vous
            pouvez suivre la conversation et y répondre dans{' '}
            <strong>Mes tickets</strong> de l'onglet Support ou dans{' '}
            <strong>Vos tickets</strong> sur votre{' '}
            <Link href="/account" className="underline underline-offset-4">
              page compte
            </Link>
            .
          </p>
        ),
        keywords: ['assistance', 'support', 'contact', 'aide', 'ticket', 'bug'],
      },
    ],
  },
  {
    slug: 'ebay',
    title: 'eBay',
    blurb: 'Connecter eBay, y crosslister, et ce que ça coûte.',
    items: [
      {
        id: 'ebay-connect',
        q: 'Comment connecter mon compte eBay ?',
        a: <p>Ouvrez le panneau SaleLinx, allez dans <em>Paramètres</em> et cliquez sur <em>Lier</em> sur la ligne eBay. Connectez-vous sur la page d'eBay et autorisez SaleLinx à gérer vos annonces. SaleLinx ne voit jamais votre mot de passe eBay, et vous pouvez délier le compte à tout moment.</p>,
        keywords: ['ebay', 'connecter', 'lier', 'compte'],
      },
      {
        id: 'ebay-fees',
        q: 'Le crosslisting vers eBay est-il payant ?',
        a: <p>eBay applique ses frais d'insertion habituels, comme pour une annonce créée à la main. SaleLinx affiche les frais eBay de chaque article avant toute publication, pour que vous puissiez revenir en arrière ou retirer des articles. Les annonces eBay sont publiées directement, car eBay n'a pas de brouillons.</p>,
        keywords: ['ebay', 'frais', 'prix', 'crosslist'],
      },
      {
        id: 'ebay-site-access',
        q: "Chrome demande d'autoriser SaleLinx sur les sites eBay. Dois-je accepter ?",
        a: <p>Non. Cela sert uniquement à afficher le panneau SaleLinx sur les pages eBay. La liaison eBay, Mes annonces et le Crosslist fonctionnent sans. Vous pouvez l'autoriser plus tard depuis les <em>Paramètres</em>.</p>,
        keywords: ['ebay', 'autorisation', 'chrome', 'autoriser'],
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
            Non. SaleLinx passe par les sessions Depop et Vinted déjà
            connectées dans votre propre navigateur, vous ne nous donnez donc
            jamais de mot de passe de marketplace. Pour lier une boutique à
            votre compte SaleLinx, nous enregistrons seulement son nom
            d'utilisateur et son identifiant de compte. eBay se connecte via la page de connexion d'eBay, et SaleLinx ne voit jamais votre mot de passe eBay. Pour eBay, nous conservons aussi le jeton d'accès fourni par eBay, pour que SaleLinx puisse agir sur vos annonces.
          </p>
        ),
        keywords: ['mot de passe', 'identifiants', 'sécurité'],
      },
      {
        id: 'where-is-my-data',
        q: 'Où sont stockées mes données ?',
        a: (
          <p>
            Votre compte SaleLinx, votre forfait, vos réglages et les noms
            d'utilisateur de vos boutiques liées sont stockés chez notre
            fournisseur de base de données, Supabase, et les paiements sont
            gérés par Stripe. Le contenu et les photos des annonces ne sont
            stockés chez nous que pour les annonces que vous enregistrez dans
            le cloud ; le reste de ce que SaleLinx lit sur Depop et Vinted
            n'est pas stocké sur nos serveurs. Les données transitent en HTTPS,
            Supabase les chiffre au repos, et des règles d'accès rattachent
            chaque annonce et chaque photo à votre compte. Les lieux où nos
            prestataires traitent les données sont indiqués dans notre{' '}
            <Link href="/legal/privacy" className="underline underline-offset-4">
              politique de confidentialité
            </Link>
            .
          </p>
        ),
        keywords: ['données', 'stockage', 'supabase', 'cloud', 'région', 'chiffrement'],
      },
      {
        id: 'delete-my-data',
        q: 'Comment supprimer mes données ?',
        a: (
          <p>
            Ouvrez votre{' '}
            <Link href="/account" className="underline underline-offset-4">
              page compte
            </Link>
            , descendez tout en bas et cliquez sur{' '}
            <strong>Supprimer le compte</strong>. Saisissez votre mot de passe
            (inutile si vous vous connectez avec Google) et nous vous envoyons
            un lien de confirmation par e-mail : ouvrez-le dans les 60 minutes
            en étant connecté et confirmez une dernière fois. Votre compte, vos
            annonces, images, comptes de marketplace liés, historique
            d'utilisation et tickets d'assistance sont alors supprimés
            immédiatement, et tout abonnement est annulé sans remboursement du
            temps restant. Vous pouvez aussi écrire à{' '}
            <a
              href="mailto:support@salelinx.com"
              className="underline underline-offset-4"
            >
              support@salelinx.com
            </a>{' '}
            depuis l'adresse liée à votre compte : nous effectuerons la
            suppression sous 30 jours.
          </p>
        ),
        keywords: ['supprimer', 'rgpd', 'effacer', 'compte'],
      },
    ],
  },
];
