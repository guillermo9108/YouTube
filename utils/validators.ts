
/**
 * Validadores de negocio centralizados
 */

export const isValidUsername = (username: string): boolean => {
    return /^[a-zA-Z0-9_]{3,20}$/.test(username);
};

export const isValidPassword = (password: string): boolean => {
    return password.length >= 6;
};

export const isValidPrice = (price: number | string): boolean => {
    const num = Number(price);
    return !isNaN(num) && num >= 0;
};

export const sanitizeFilename = (name: string): string => {
    return name.replace(/[^a-z0-9]/gi, '_').toLowerCase();
};
