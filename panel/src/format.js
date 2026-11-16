export const money = (amount) => `Rs. ${Number(amount || 0).toLocaleString()}`;

export const count = (n) => Number(n || 0).toLocaleString();

const plainDate = (value) => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value);

// Moments show in Pakistan time whatever the computer's timezone; a plain date shows as it is.
export const date = (value) => {
  if (!value) return '-';
  if (plainDate(value)) {
    const [y, m, d] = value.split('-').map(Number);
    return new Date(y, m - 1, d).toLocaleDateString('en-PK', { year: 'numeric', month: 'short', day: 'numeric' });
  }
  return new Date(value).toLocaleDateString('en-PK', { year: 'numeric', month: 'short', day: 'numeric', timeZone: 'Asia/Karachi' });
};

export const dateTime = (value) => {
  if (!value) return '-';
  return new Date(value).toLocaleString('en-PK', {
    year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Karachi',
  });
};

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
export const monthYear = (month, year) => (month && year ? `${MONTHS[month - 1]} ${year}` : '-');
