const LOCAL = "http://localhost:8000";

function defaultBase() {
  if (typeof window === "undefined") return LOCAL;
  const h = window.location.hostname;
  if (h === "frontir.org" || h === "www.frontir.org" || h.endsWith(".netlify.app"))
    return "https://frontir.onrender.com";
  return LOCAL;
}

const API = process.env.REACT_APP_API_URL || defaultBase();

export default API;

