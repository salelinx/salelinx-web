import { Link } from '@/i18n/navigation';
import { CHROME_WEB_STORE_URL } from '@/lib/site';
import { InstallExtensionButton } from '@/components/InstallExtensionButton';
import type { FAQGroup } from './types';

export const FAQ_GROUPS_DE: FAQGroup[] = [
  {
    slug: 'getting-started',
    title: 'Erste Schritte',
    blurb: 'SaleLinx installieren, anmelden und unterstützte Browser.',
    items: [
      {
        id: 'how-do-i-install',
        q: 'Wie installiere ich die SaleLinx-Erweiterung?',
        a: (
          <>
            <p>
              Installiere aus dem{' '}
              <a
                href={CHROME_WEB_STORE_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="underline underline-offset-4"
              >
                Chrome Web Store
              </a>{' '}
              und hefte die Erweiterung an deine Symbolleiste. Vollständige Anleitung mit Screenshots in{' '}
              <Link
                href="/docs/getting-started/install-the-extension"
                className="underline underline-offset-4"
              >
                SaleLinx-Erweiterung installieren
              </Link>
              .
            </p>
            <InstallExtensionButton
              label="Zu Chrome hinzufügen"
              className="mt-3 inline-flex items-center gap-2 rounded-full bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-zinc-800 dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-100"
            />
          </>
        ),
        keywords: ['installieren', 'einrichten', 'chrome', 'hinzufügen'],
      },
      {
        id: 'which-browsers',
        q: 'Welche Browser unterstützt SaleLinx?',
        a: (
          <p>
            Jeden Chromium-basierten Browser: Google Chrome, Microsoft Edge, Brave, Arc, Opera. Safari und Firefox werden nicht unterstützt.
          </p>
        ),
        keywords: ['browser', 'chrome', 'edge', 'safari', 'firefox', 'brave'],
      },
      {
        id: 'free-trial',
        q: 'Muss ich bezahlen, um es auszuprobieren?',
        a: (
          <p>
            Du bekommst eine kostenlose 7-Tage-Testphase des Starter-Pakets,
            eine pro Konto. Zum Start ist eine Karte erforderlich, während der
            Testphase wird aber nichts abgebucht, und du kannst jederzeit über
            deine Kontoseite kündigen. Ohne Kündigung startet dein Starter-Abo
            automatisch am Ende der Testphase. Siehe{' '}
            <Link href="/pricing" className="underline underline-offset-4">
              Preise
            </Link>
            , was jede Stufe enthält.
          </p>
        ),
        keywords: ['kostenlos', 'test', 'preise', 'paket', 'karte'],
      },
    ],
  },
  {
    slug: 'billing',
    title: 'Konto und Abrechnung',
    blurb: 'Pakete, Rechnungen, Zahlungsmethoden und Kündigungen.',
    items: [
      {
        id: 'how-to-upgrade',
        q: 'Wie upgrade ich mein Paket?',
        a: (
          <p>
            Melde dich auf{' '}
            <Link href="/account" className="underline underline-offset-4">
              salelinx.com/account
            </Link>{' '}
            an und wähle ein neues Paket. Die Änderung gilt sofort und du zahlst anteilig für den Rest des Abrechnungszeitraums.
          </p>
        ),
        keywords: ['upgrade', 'paket', 'wechseln', 'stufe'],
      },
      {
        id: 'how-to-cancel',
        q: 'Wie kündige ich mein Abonnement?',
        a: (
          <p>
            Öffne deine{' '}
            <Link href="/account" className="underline underline-offset-4">
              Kontoseite
            </Link>{' '}
            und klicke auf <em>Abrechnung verwalten</em>. Du landest im Stripe-Kundenportal, wo du kündigen kannst. Du behältst den Zugriff bis zum Ende des aktuellen Zeitraums.
          </p>
        ),
        keywords: ['kündigen', 'abbestellen', 'abrechnung stoppen'],
      },
      {
        id: 'change-plan-midmonth',
        q: 'Kann ich das Paket mitten im Abrechnungszeitraum wechseln?',
        a: (
          <p>
            Ja. Upgrades greifen sofort mit anteiliger Abrechnung. Downgrades greifen zu Beginn des nächsten Abrechnungszeitraums, damit du das bereits Bezahlte nicht verlierst.
          </p>
        ),
        keywords: ['anteilig', 'wechseln', 'downgrade'],
      },
      {
        id: 'where-are-invoices',
        q: 'Wo finde ich meine Rechnungen?',
        a: (
          <p>
            Im Stripe-Kundenportal. Öffne deine Kontoseite, klicke auf{' '}
            <em>Abrechnung verwalten</em>, dann auf <em>Rechnungsverlauf</em>.
          </p>
        ),
        keywords: ['rechnung', 'beleg', 'steuer', 'mwst'],
      },
      {
        id: 'charged-twice',
        q: 'Mir wurde doppelt belastet, was tun?',
        a: (
          <p>
            Fast immer ist es eine fehlgeschlagene und wiederholte Buchung, kein echter Duplikat. Prüfe zuerst den Rechnungsverlauf im Kundenportal. Wenn du zwei erfolgreiche Buchungen siehst, schreibe an{' '}
            <a
              href="mailto:support@salelinx.com"
              className="underline underline-offset-4"
            >
              support@salelinx.com
            </a>{' '}
            mit den Rechnungs-IDs, und wir erstatten das Duplikat.
          </p>
        ),
        keywords: ['duplikat', 'erstattung', 'überzahlt', 'buchung'],
      },
    ],
  },
  {
    slug: 'troubleshooting',
    title: 'Fehlerbehebung',
    blurb: 'Lösungen für die häufigsten Probleme.',
    items: [
      {
        id: 'panel-not-appearing',
        q: 'Das SaleLinx-Panel erscheint nicht auf Depop oder Vinted',
        a: (
          <div className="space-y-2">
            <p>Versuche Folgendes der Reihe nach:</p>
            <ol className="list-decimal space-y-1 pl-5">
              <li>Aktualisiere den Marktplatz-Tab.</li>
              <li>
                Stelle sicher, dass die Erweiterung angeheftet und aktiviert ist (Puzzle-Symbol in der Chrome-Symbolleiste).
              </li>
              <li>
                Bestätige, dass du auf einer Produkt- oder Profilseite bist. Das Panel öffnet sich nicht auf Such- oder Kaufseiten.
              </li>
              <li>Melde dich aus der Erweiterung ab und wieder an.</li>
            </ol>
          </div>
        ),
        keywords: ['panel', 'fehlt', 'nicht sichtbar', 'depop', 'vinted'],
      },
      {
        id: 'listing-failed-to-post',
        q: 'Ein Inserat konnte nicht veröffentlicht werden',
        a: (
          <p>
            Die meisten Fehler entstehen, weil du auf dem Zielmarktplatz abgemeldet bist oder ein Pflichtfeld nicht sauber gemappt wird. Melde dich auf dem Zielmarktplatz ab und wieder an und versuche es dann über das Dashboard erneut. Wenn ein ganzer Marktplatz ausgefallen ist, sieh dir die{' '}
            <Link
              href="/docs/status"
              className="underline underline-offset-4"
            >
              Statusseite der Marktplätze
            </Link>{' '}
            an.
          </p>
        ),
        keywords: ['fehlgeschlagen', 'fehler', 'posten', 'crosslist', 'hochladen'],
      },
      {
        id: 'crosslisting-stuck',
        q: 'Das Crosslisting hängt bei „Formular ausfüllen...“',
        a: (
          <p>
            Fasse den Ziel-Tab nicht an, während die Erweiterung ihn ausfüllt. Wenn es länger als eine Minute hängt, klicke im Panel auf <em>Abbrechen</em> und versuche es erneut. Tritt es auf einem Marktplatz wiederholt auf, liegt das meist an einer Formularänderung auf deren Seite; siehe{' '}
            <Link
              href="/docs/status"
              className="underline underline-offset-4"
            >
              Marktplatz-Status
            </Link>
            .
          </p>
        ),
        keywords: ['hängt', 'eingefroren', 'langsam', 'ausfüllen'],
      },
      {
        id: 'cant-sign-in',
        q: 'Ich bin abgemeldet und kann mich nicht wieder anmelden',
        a: (
          <p>
            Setze dein Passwort zurück unter{' '}
            <Link
              href="/auth/forgot-password"
              className="underline underline-offset-4"
            >
              salelinx.com/auth/forgot-password
            </Link>
            . Dein Website- und Erweiterungskonto sind gleich, also funktioniert das neue Passwort bei beiden.
          </p>
        ),
        keywords: ['passwort', 'anmelden', 'zurücksetzen', 'gesperrt'],
      },
      {
        id: 'listings-not-syncing',
        q: 'Meine Inserate synchronisieren sich nicht mit dem Dashboard',
        a: (
          <p>
            Öffne das Dashboard und klicke rechts oben auf die Schaltfläche <em>Neu synchronisieren</em>. Fehlt ein bestimmtes Inserat, öffne es einmal auf dem Marktplatz bei geöffnetem SaleLinx-Panel; das Panel fügt es bei der Erkennung hinzu.
          </p>
        ),
        keywords: ['sync', 'fehlt', 'dashboard', 'aktualisieren'],
      },
    ],
  },
  {
    slug: 'privacy',
    title: 'Datenschutz und Daten',
    blurb: 'Was wir speichern, wo es liegt und wie du es löschst.',
    items: [
      {
        id: 'store-marketplace-password',
        q: 'Speichert SaleLinx mein Marktplatz-Passwort?',
        a: (
          <p>
            Nein. SaleLinx nutzt deine bestehende Browser-Sitzung auf jedem Marktplatz, also gibt es kein Passwort einzugeben, zu speichern oder zu leaken.
          </p>
        ),
        keywords: ['passwort', 'zugangsdaten', 'sicherheit'],
      },
      {
        id: 'where-is-my-data',
        q: 'Wo werden meine Daten gespeichert?',
        a: (
          <p>
            Dein SaleLinx-Konto und der Inserate-Index liegen in Supabase (EU-Region). Die Marktplatz-Daten selbst bleiben beim jeweiligen Marktplatz.
          </p>
        ),
        keywords: ['daten', 'speicherung', 'supabase', 'region', 'eu'],
      },
      {
        id: 'delete-my-data',
        q: 'Wie lösche ich meine Daten?',
        a: (
          <p>
            Schreibe von der Adresse deines Kontos an{' '}
            <a
              href="mailto:support@salelinx.com"
              className="underline underline-offset-4"
            >
              support@salelinx.com
            </a>
            . Wir bestätigen und löschen innerhalb von 7 Tagen.
          </p>
        ),
        keywords: ['löschen', 'dsgvo', 'entfernen', 'konto'],
      },
    ],
  },
];
