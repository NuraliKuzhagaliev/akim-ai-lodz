import type { Category, IndicatorId } from './types';
export const categoryLabels: Record<Category, string> = {
  transport: 'Транспорт',
  ecology: 'Экология',
  social: 'Соцсфера',
  safety: 'Безопасность',
  services: 'Сервисы',
};
export const indicatorLabels: Record<IndicatorId, string> = {
  T1: 'Разгрузка дорог',
  T2: 'Общественный транспорт',
  E1: 'Озеленение',
  E2: 'Качество воздуха',
  S1: 'Школы и детсады',
  S2: 'Первичная медпомощь',
  B1: 'Безопасность улиц',
  B2: 'Безопасность на дорогах',
  C1: 'Надёжность ЖКХ',
  C2: 'Обращения жителей',
};
