import axios from 'axios';

const browserHostname = typeof window !== "undefined" ? window.location.hostname : "127.0.0.1";
const browserProtocol = typeof window !== "undefined" ? window.location.protocol : "http:";

export const API_BASE_URL = `${browserProtocol}//${browserHostname}:8000`;

axios.defaults.xsrfCookieName = 'csrftoken';
axios.defaults.xsrfHeaderName = 'X-CSRFToken';
