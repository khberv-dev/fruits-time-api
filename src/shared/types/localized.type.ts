export class Localized<T> {
  uz?: T;
  ru?: T;
  en?: T;

  constructor(uz: T, ru: T, en: T) {
    this.uz = uz;
    this.ru = ru;
    this.en = en;
  }

  static defaultString = new Localized<string>('N/A', 'N/A', 'N/A');
  static defaultStringArray = new Localized<string[]>([], [], []);
}
