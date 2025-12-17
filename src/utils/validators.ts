export const validateEmail = (email: string): boolean => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

export const validatePassword = (password: string): boolean => {
  return password.length >= 8;
};

export const validateLotSize = (lotSize: string): boolean => {
  const num = parseFloat(lotSize);
  return !isNaN(num) && num > 0 && num <= 100;
};

export const validatePrice = (price: string): boolean => {
  const num = parseFloat(price);
  return !isNaN(num) && num > 0;
};

export const validatePips = (pips: string): boolean => {
  const num = parseFloat(pips);
  return !isNaN(num) && num >= 0;
};

