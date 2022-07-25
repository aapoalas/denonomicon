// Copyright 2022 the Deno authors. All rights reserved. MIT license.

/** @jsx h */
/** @jsxFrag Fragment */
import { Fragment, h } from "preact";
import { PageProps, RouteConfig } from "$fresh/server.ts";
import { Head } from "$fresh/runtime.ts";
import { tw } from "@twind";
import { Handlers } from "$fresh/server.ts";
import { Markdown } from "@/components/Markdown.tsx";
import * as Icons from "@/components/Icons.tsx";
import {
  getDocURL,
  getFileURL,
  getTableOfContents,
  TableOfContents,
} from "@/util/utils.ts";

interface Data {
  tableOfContents: TableOfContents;
  content: string;
}

export default function Denonomicon({ url, data }: PageProps<Data>) {
  const path = url.pathname || "/introduction";

  const pageList = (() => {
    const tempList: { path: string; name: string }[] = [];

    Object.entries(data.tableOfContents).forEach(([slug, entry]) => {
      tempList.push({ path: `/${slug}`, name: entry.name });

      if (entry.children) {
        Object.entries(entry.children).map(([childSlug, name]) =>
          tempList.push({ path: `/${slug}/${childSlug}`, name })
        );
      }
    });

    return tempList;
  })();
  const pageIndex = pageList.findIndex(
    (page) => page.path === path,
  );
  const sourceURL = getFileURL(path);

  const tableOfContentsMap = (() => {
    const map = new Map<string, string>();
    Object.entries(data.tableOfContents).forEach(([slug, entry]) => {
      if (entry.children) {
        Object.entries(entry.children).forEach(([childSlug, name]) => {
          map.set(`/${slug}/${childSlug}`, name);
        });
      }
      map.set(`/${slug}`, entry.name);
    });

    return map;
  })();
  const pageTitle = tableOfContentsMap.get(path) || "";

  return (
    <>
      <Head>
        <title>
          {pageTitle === "" ? "Denonomicon" : `${pageTitle} | Denonomicon`}
        </title>
        <link rel="canonical" href={`${path}`} />
        <link rel="stylesheet" href="https://deno.land/fonts/inter/inter.css" />
        <link rel="stylesheet" href="https://deno.land/app.css" />
        <link rel="stylesheet" href="https://deno.land/gfm.css" />
      </Head>

      <div class={tw`flex flex-col lg:flex-row`}>
        <div>
          <input
            type="checkbox"
            id="ToCToggle"
            class={tw`hidden checked:siblings:flex checked:sibling:(border-0 children:first-child:rotate-90)`}
            autoComplete="off"
          />

          <label
            htmlFor="ToCToggle"
            class={tw`lg:hidden ml-3.5 py-2 px-1.5 flex items-center gap-2 font-medium border-b border-gray-200`}
          >
            <Icons.ThinArrowRight />
            Menu
          </label>

          <div
            class={tw`hidden w-full bg-gray-50 top-0 flex-shrink-0 overflow-y-auto flex-col border-y border-gray-200 lg:(block sticky w-72 border-0 border-r h-screen)`}
          >
            <ToC tableOfContents={data.tableOfContents} path={path} />
          </div>
        </div>

        <main class={tw`focus:outline-none w-full flex flex-col`} tabIndex={0}>
          <div
            class={tw`section-x-inset-md pb-12 sm:pb-20 w-full justify-self-center flex-shrink-1`}
          >
            <a
              href={getDocURL(path)}
              class={tw`text-gray-500 hover:text-gray-900 transition duration-150 ease-in-out float-right ${
                path.split("/").length === 2 ? "mt-11" : "mt-9"
              } mr-4`}
            >
              <span class={tw`sr-only`}>GitHub</span>
              <Icons.GitHub class="inline" />
            </a>

            <Markdown source={data.content} baseUrl={sourceURL} />

            <div class={tw`mt-4 pt-4 border-t border-gray-200`}>
              {pageList[pageIndex - 1] !== undefined && (
                <a
                  href={pageList[pageIndex - 1].path}
                  class={tw`text-gray-900 hover:text-gray-600 font-normal`}
                >
                  ← {pageList[pageIndex - 1].name}
                </a>
              )}
              {pageList[pageIndex + 1] !== undefined && (
                <a
                  href={pageList[pageIndex + 1].path}
                  class={tw`text-gray-900 hover:text-gray-600 font-normal float-right`}
                >
                  {pageList[pageIndex + 1].name} →
                </a>
              )}
            </div>
          </div>
        </main>
      </div>

      <script
        dangerouslySetInnerHTML={{
          __html: `
        (function() {
          document.querySelectorAll(".toc-active").forEach(el=>{el.scrollIntoView({block:"center"});});
        })();
      `,
        }}
      />
    </>
  );
}

function ToC({
  tableOfContents,
  path,
}: {
  tableOfContents: TableOfContents;
  path: string;
}) {
  return (
    <nav class={tw`pt-2 pb-8 px-4`}>
      <ol class={tw`list-decimal list-inside font-semibold nested`}>
        {Object.entries(tableOfContents).map(([slug, entry]) => {
          return (
            <li key={slug} class={tw`my-2`}>
              <a
                href={`/${slug}`}
                class={tw`${
                  path === `/${slug}`
                    ? "text-blue-600 hover:text-blue-500 toc-active"
                    : "text-gray-900 hover:text-gray-600"
                } font-bold`}
              >
                {entry.name}
              </a>
              {entry.children && (
                <ol class={tw`pl-4 list-decimal nested`}>
                  {Object.entries(entry.children).map(([childSlug, name]) => (
                    <li key={`${slug}/${childSlug}`} class={tw`my-0.5`}>
                      <a
                        href={`/${slug}/${childSlug}`}
                        class={tw`${
                          path === `/${slug}/${childSlug}`
                            ? "text-blue-600 hover:text-blue-500 toc-active"
                            : "text-gray-900 hover:text-gray-600"
                        } font-normal`}
                      >
                        {name}
                      </a>
                    </li>
                  ))}
                </ol>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

export const handler: Handlers<Data> = {
  async GET(req, { render }) {
    const url = new URL(req.url);
    if (url.pathname.endsWith(".md")) {
      url.pathname = url.pathname.slice(0, -3);
      return Response.redirect(url);
    }

    const sourceURL = getFileURL(
      url.pathname || "/introduction",
    );
    const [tableOfContents, content] = await Promise.all([
      getTableOfContents(),
      fetch(sourceURL)
        .then(async (res) => {
          if (res.status !== 200) {
            await res.body?.cancel();
            throw Error(
              `Got an error (${res.status}) while getting the documentation file (${sourceURL}).`,
            );
          }
          return res.text();
        })
        .catch((e) => {
          console.error("Failed to fetch content:", e);
          return "# 404 - Not Found\nWhoops, the page does not seem to exist.";
        }),
    ]);

    return render!({ tableOfContents, content });
  },
};

export const config: RouteConfig = {
  routeOverride: "*",
};
