const GUATEMALA_TIME_ZONE = 'America/Guatemala';

const dateParts = (value = new Date()) => {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: GUATEMALA_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(value instanceof Date ? value : new Date(value));
  return Object.fromEntries(parts.map(({ type, value: part }) => [type, part]));
};

export const guatemalaInputDate = (value = new Date()) => {
  const { year, month, day } = dateParts(value);
  return `${year}-${month}-${day}`;
};

export const guatemalaMonthStart = (value = new Date()) => {
  const { year, month } = dateParts(value);
  return `${year}-${month}-01`;
};

export const guatemalaDaysAgo = (days) => guatemalaInputDate(new Date(Date.now() - days * 86400000));

export const formatGuatemalaDate = (value, options = {}) => {
  if (!value) return '—';
  return new Intl.DateTimeFormat('es-GT', {
    timeZone: GUATEMALA_TIME_ZONE,
    day: '2-digit', month: '2-digit', year: 'numeric', ...options,
  }).format(new Date(value));
};

export const formatGuatemalaDateTime = (value) => formatGuatemalaDate(value, {
  hour: '2-digit', minute: '2-digit', second: '2-digit',
});

export { GUATEMALA_TIME_ZONE };
