// Copyright 2022 the Deno authors. All rights reserved. MIT license.

const githubBasepath =
  "https://raw.githubusercontent.com/aapoalas/denonomicon/main/";
const docpath = "https://github.com/aapoalas/denonomicon/blob/main/";

export interface TableOfContents {
  [slug: string]: {
    name: string;
    children?: {
      [slug: string]: string;
    };
  };
}

export async function getTableOfContents(): Promise<TableOfContents> {
  const res = await fetch(`${githubBasepath}toc.json`);
  if (res.status !== 200) {
    throw Error(
      `Got an error (${res.status}) while getting the manual table of contents:\n${await res
        .text()}`,
    );
  }
  return await res.json();
}

export function getFileURL(path: string): string {
  return `${githubBasepath}${path}.md`;
}

export function getDocURL(path: string): string {
  return `${docpath}${path}.md`;
}
