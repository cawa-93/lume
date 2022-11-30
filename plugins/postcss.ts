import {
  autoprefixer,
  postcss,
  postcssImport,
  postcssNesting,
} from "../deps/postcss.ts";
import { isUrl, merge } from "../core/utils.ts";
import { Page } from "../core/filesystem.ts";
import { posix } from "../deps/path.ts";
import { prepareAsset, saveAsset } from "./source_maps.ts";

import type { Helper, Site, SourceMap } from "../core.ts";
import type { SourceMapOptions } from "../deps/postcss.ts";

export interface Options {
  /** The list of extensions this plugin applies to */
  extensions: string[];

  /** Custom includes path for `postcss-import` */
  includes: string | false;

  /** Plugins to use by postcss */
  plugins: unknown[];

  /** Set `true` append your plugins to the defaults */
  keepDefaultPlugins: boolean;
}

// Default options
export const defaults: Options = {
  extensions: [".css"],
  includes: false,
  plugins: [
    postcssNesting(),
    autoprefixer(),
  ],
  keepDefaultPlugins: false,
};

/** A plugin to load all CSS files and process them using PostCSS */
export default function (userOptions?: Partial<Options>) {
  return (site: Site) => {
    const options = merge(
      { ...defaults, includes: site.options.includes },
      userOptions,
    );

    if (options.keepDefaultPlugins && userOptions?.plugins?.length) {
      options.plugins = defaults.plugins.concat(userOptions.plugins);
    }

    const plugins = [...options.plugins];

    if (options.includes) {
      site.includes(options.extensions, options.includes);

      plugins.unshift(configureImport(site));
    }

    // @ts-ignore: Argument of type 'unknown[]' is not assignable to parameter of type 'AcceptedPlugin[]'.
    const runner = postcss(plugins);

    site.loadAssets(options.extensions);
    site.process(options.extensions, postCss);
    site.filter("postcss", filter as Helper, true);

    async function postCss(file: Page) {
      const { content, filename, sourceMap, enableSourceMap } = prepareAsset(
        site,
        file,
      );
      const to = site.dest(file.outputPath!);
      const map: SourceMapOptions | undefined = enableSourceMap
        ? {
          inline: false,
          prev: sourceMap,
          annotation: false,
        }
        : undefined;

      // Process the code with PostCSS
      const result = await runner.process(content, { from: filename, to, map });

      saveAsset(
        site,
        file,
        result.css,
        result.map?.toJSON() as unknown as SourceMap,
      );
    }

    async function filter(code: string) {
      const result = await runner.process(code, { from: undefined });
      return result.css;
    }
  };
}

/**
 * Function to configure the postcssImport
 * using the Lume reader and the includes loader
 */
function configureImport(site: Site) {
  return postcssImport({
    /** Resolve the import path */
    resolve(id: string, basedir: string) {
      if (isUrl(id)) {
        return id;
      }

      return posix.join(id.startsWith(".") ? basedir : "/", id);
    },

    /** Load the content (using the Lume reader) */
    async load(file: string) {
      return await site.getContent(file);
    },
  });
}
