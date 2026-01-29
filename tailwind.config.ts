import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: "#0b1220",
        mist: "#f5f2ed",
        sun: "#ffb443",
        sea: "#2b7a78",
        berry: "#e94b6f"
      },
      boxShadow: {
        glow: "0 20px 60px -30px rgba(255, 180, 67, 0.55)",
        soft: "0 20px 50px -40px rgba(11, 18, 32, 0.4)"
      }
    }
  },
  plugins: []
};

export default config;
