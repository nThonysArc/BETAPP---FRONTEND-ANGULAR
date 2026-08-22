/**
 * Convierte un Date del datepicker a 'YYYY-MM-DD' usando los componentes
 * LOCALES de la fecha (getFullYear/getMonth/getDate), NO toISOString().
 *
 * toISOString() convierte a UTC primero, lo que puede restar un dia si el
 * usuario esta en una zona horaria negativa (como Peru, UTC-5) y selecciona
 * una fecha cerca de medianoche - un bug clasico y sutil de fechas en JS.
 */
export function toIsoDateString(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}
