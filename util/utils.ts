// Copyright 2022 the Deno authors. All rights reserved. MIT license.

const docpath =
  "https://github.com/aapoalas/denonomicon/blob/main/static/contents";

export interface TableOfContents {
  [slug: string]: {
    name: string;
    children?: {
      [slug: string]: string;
    };
  };
}

export async function getTableOfContents(): Promise<TableOfContents> {
  const res = await Deno.readTextFile(`${Deno.cwd()}/toc.json`);
  return JSON.parse(res);
}

export function getFileURL(path: string, baseUrl: string): string {
  return `${baseUrl}/contents${path}.md`;
}

export const getFileData = (path: string): Promise<string> =>
  Deno.readTextFile(`${Deno.cwd()}/static/contents${path}.md`);

export function getDocURL(path: `/${string}`): string {
  return `${docpath}${path}.md`;
}
