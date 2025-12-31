/* eslint-disable @typescript-eslint/no-explicit-any */
import i18n from "i18next";
import Backend from "i18next-fs-backend";
import { dirname, join } from "path";
import { fileURLToPath } from "url";
import { logger } from "./logger.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const TIMEOUT = Number(process.env.TOLGEE_TIMEOUT ?? 5) * 1000;

const getLanguages = async () => {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), TIMEOUT);
  try {
    const response = await fetch(
      `${process.env.TOLGEE_URL}/v2/projects/${process.env.TOLGEE_PROJECT_ID}/languages`,
      {
        headers: {
          "x-api-key": process.env.TOLGEE_API_KEY ?? "",
        },
        signal: controller.signal,
      }
    );
    const resp = (await response.json()) as any;
    return resp._embedded.languages.map((item) => item.tag);
  } finally {
    clearTimeout(timeoutId);
  }
};
const getTranslations = async (lang: string) => {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), TIMEOUT);
  try {
    const response = await fetch(
      `${process.env.TOLGEE_URL}/v2/projects/${process.env.TOLGEE_PROJECT_ID}/translations/${lang}`,
      {
        headers: {
          "x-api-key": process.env.TOLGEE_API_KEY ?? "",
        },
        signal: controller.signal,
      }
    );

    const resp = (await response.json()) as object;
    return resp[lang];
  } finally {
    clearTimeout(timeoutId);
  }
};

export const loadResources = async () => {
  try {
    const languages = await getLanguages();
    const translations = await Promise.all(
      languages.map(async (lang) => {
        const translations = await getTranslations(lang);
        return { lang, translations };
      })
    );
    logger.info("Tolgee loaded successfully");

    return translations.reduce(
      (acc, { lang, translations }) => {
        acc[lang] = { translation: translations };
        return acc;
      },
      {} as Record<string, any>
    );
  } catch (error) {
    logger.error(
      `Failed loading Tolgee at ${process.env.TOLGEE_URL} : ${error}`
    );
    return;
  }
};
export async function reloadTranslations() {
  const resources = await loadResources();
  for (const lng of Object.keys(resources)) {
    i18n.addResourceBundle(
      lng,
      "translation",
      resources[lng].translation,
      true,
      true
    );
  }
  console.log("Tolgee reloaded successfully");
}

i18n.use(Backend).init({
  // debug: true,
  initImmediate: false,
  lng: "en",
  fallbackLng: "en",
  resources: await loadResources(),
  backend: {
    loadPath: join(__dirname, "./lang/{lng}.json"),
  },
  interpolation: {
    escapeValue: false,
    prefix: "{",
    suffix: "}",
  },
});

export default i18n;
