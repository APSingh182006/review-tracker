const KEY = "tracker-token";
const SEC = "tracker-section";
export const getToken = () => (typeof window === "undefined" ? "" : localStorage.getItem(KEY) ?? "");
export const setToken = (t: string) => localStorage.setItem(KEY, t);
export const clearToken = () => localStorage.removeItem(KEY);
export const getLastSection = () => localStorage.getItem(SEC) ?? "";
export const setLastSection = (id: string) => localStorage.setItem(SEC, id);
