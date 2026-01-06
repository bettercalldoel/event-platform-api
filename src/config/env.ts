import "dotenv/config";

export const PORT = Number(process.env.PORT) || 4000;

export const MAIL_USER = process.env.MAIL_USER;
export const MAIL_PASS = process.env.MAIL_PASS;
export const BASE_URL_FE = process.env.BASE_URL_FE || "http://localhost:3000";
export const FRONTEND_URLS = process.env.FRONTEND_URLS || BASE_URL_FE;
