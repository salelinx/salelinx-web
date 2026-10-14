// Brave and Vivaldi send a plain Chrome user agent, so they land under Chrome.
const BROWSERS: [RegExp, string][] = [
  [/Edg\//, 'Edge'],
  [/OPR\//, 'Opera'],
  [/SamsungBrowser\//, 'Samsung'],
  [/YaBrowser\//, 'Yandex'],
  [/Firefox\//, 'Firefox'],
  [/Chrome\//, 'Chrome'],
];

export function browserName(userAgent: string | null): string | null {
  if (!userAgent) return null;
  return BROWSERS.find(([re]) => re.test(userAgent))?.[1] ?? 'Other';
}
