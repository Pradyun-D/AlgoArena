import axios from 'axios';

const browserHostname = typeof window !== "undefined" ? window.location.hostname : "127.0.0.1";
const browserProtocol = typeof window !== "undefined" ? window.location.protocol : "http:";
const isLocalHost = ["localhost", "127.0.0.1"].includes(browserHostname);

export const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL ||
  (isLocalHost ? `${browserProtocol}//${browserHostname}:8000` : `${browserProtocol}//${browserHostname}`);

axios.defaults.xsrfCookieName = 'csrftoken';
axios.defaults.xsrfHeaderName = 'X-CSRFToken';
