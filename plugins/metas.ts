import { merge } from "../core/utils/object.ts";
import { getCurrentVersion } from "../core/utils/lume_version.ts";
import { getDataValue } from "../core/utils/data_values.ts";

import type Site from "../core/site.ts";
import type { Data, Page } from "../core/file.ts";

export interface Options {
  /** The list extensions this plugin applies to */
  extensions?: string[];

  /** The key name for the transformations definitions */
  name?: string;
}

export interface MetaData {
  /** The type of the site default is website */
  type?: string | ((data: Data) => string | undefined);

  /** The name of the site */
  site?: string | ((data: Data) => string | undefined);

  /** The title of the page */
  title?: string | ((data: Data) => string | undefined);

  /** The page language */
  lang?: string | ((data: Data) => string | undefined);

  /** The description of the page */
  description?: string | ((data: Data) => string | undefined);

  /** The image of the page */
  image?: string | ((data: Data) => string | undefined);

  /** The icon of the site */
  icon?: string | ((data: Data) => string | undefined);

  /** The page keywords */
  keywords?: string[] | ((data: Data) => string[] | undefined);

  /** The twitter username */
  twitter?: string | ((data: Data) => string | undefined);

  /** The color theme */
  color?: string | ((data: Data) => string | undefined);

  /** Robots configuration (Boolean to enable/disable, String for a custom value) */
  robots?: string | boolean | ((data: Data) => string | boolean | undefined);

  /** Whether include the generator or not (Boolean to enable/disable, String for a custom value) */
  generator?: string | boolean | ((data: Data) => string | boolean | undefined);

  /** Other meta tags */
  // deno-lint-ignore no-explicit-any
  [name: string]: any;
}

const defaults: Options = {
  extensions: [".html"],
  name: "metas",
};

const defaultGenerator = `Lume ${getCurrentVersion()}`;

/** A plugin to insert meta tags for SEO and social media */
export default function (userOptions?: Options) {
  const options = merge(defaults, userOptions);

  return (site: Site) => {
    // Configure the merged keys
    site.mergeKey(options.name, "object");
    site.process(options.extensions, (pages) => pages.forEach(metas));

    function metas(page: Page) {
      const metas = page.data[options.name] as MetaData | undefined;

      if (!metas || !page.document) {
        return;
      }

      const { document, data } = page;
      const [main, other] = getMetas(metas);
      const metaIcon = getDataValue(data, main["icon"]);
      const metaImage = getDataValue(data, main["image"]);

      const url = site.url(page.data.url, true);
      const icon = metaIcon ? new URL(site.url(metaIcon), url).href : undefined;
      const image = metaImage
        ? new URL(site.url(metaImage), url).href
        : undefined;

      const type = getDataValue(data, main["type"]);
      const site_name = getDataValue(data, main["site"]);
      const lang = getDataValue(data, main["lang"]);
      const title = getDataValue(data, main["title"]);
      const description = getDataValue(data, main["description"]);
      const twitter = getDataValue(data, main["twitter"]);
      const keywords = getDataValue(data, main["keywords"]);
      const robots = getDataValue(data, main["robots"]);
      const color = getDataValue(data, main["color"]);
      const generator = getDataValue(data, main["generator"]);

      // Open graph
      addMeta(document, "property", "og:type", type || "website");
      addMeta(document, "property", "og:site_name", site_name);
      addMeta(document, "property", "og:locale", lang);
      addMeta(document, "property", "og:title", title, 65);
      addMeta(document, "property", "og:description", description, 155);
      addMeta(document, "property", "og:url", url);
      addMeta(document, "property", "og:image", image || icon);

      // Twitter cards
      addMeta(
        document,
        "name",
        "twitter:card",
        image ? "summary_large_image" : "summary",
      );
      addMeta(document, "name", "twitter:site", twitter);

      // SEO
      addMeta(document, "name", "description", description, 155);
      addMeta(document, "name", "keywords", keywords?.join(", "));
      addMeta(document, "property", "canonical", url);
      
      if (robots === true) {
        addMeta(document, "name", "robots", "index, follow");
      } else if (robots === false) {
        addMeta(document, "name", "robots", "noindex, nofollow, noarchive");
      } else if (robots) {
        addMeta(document, "name", "robots", robots);
      }

      // Misc
      addMeta(document, "name", "theme-color", color);

      if (generator) {
        addMeta(
          document,
          "name",
          "generator",
          generator === true ? defaultGenerator : generator,
        );
      }

      for (const [name, value] of Object.entries(other)) {
        addMeta(document, "name", name, getDataValue(data, value));
      }
    }
  };
}

function addMeta(
  document: Document,
  propName: string,
  propValue: string,
  content?: string,
  limit?: number,
) {
  if (!content) {
    return;
  }
  content = content
    .replaceAll(/<[^>]*>/g, "")
    .replaceAll(/\s+/g, " ")
    .trim();

  if (limit && content.length > limit) {
    content = content.substring(0, limit - 1).trimEnd() + "…";
  }

  const meta = document.createElement("meta");
  meta.setAttribute(propName, propValue);
  meta.setAttribute("content", content);
  document.head.appendChild(meta);
  document.head.appendChild(document.createTextNode("\n"));
}

/** Extends Data interface */
declare global {
  namespace Lume {
    export interface Data {
      /**
       * Meta elements
       * @see https://lume.land/plugins/metas/
       */
      metas?: MetaData;
    }
  }
}

function getMetas(metas: MetaData): [MetaData, Record<string, unknown>] {
  const {
    type,
    site,
    title,
    lang,
    description,
    image,
    icon,
    keywords,
    twitter,
    color,
    robots,
    generator,
    ...other
  } = metas;
  return [{
    type,
    site,
    title,
    lang,
    description,
    image,
    icon,
    keywords,
    twitter,
    color,
    robots,
    generator,
  }, other];
}
