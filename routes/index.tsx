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
  getFileData,
  getFileURL,
  getTableOfContents,
  TableOfContents,
} from "@/util/utils.ts";

interface Data {
  tableOfContents: TableOfContents;
  content: string;
}

export default function Denonomicon({ url, data }: PageProps<Data>) {
  const path = !url.pathname || url.pathname === "/"
    ? "/introduction"
    : url.pathname as `/${string}`;

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
  const pageIndex = pageList.findIndex((page) => page.path === path);
  const sourceURL = getFileURL(path, url.origin);

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
        <link rel="icon" href="/denonomicon.ico" sizes="32x32 128x128 180x180 192x192" />
        <link rel="icon" href="/denonomicon.svg" type="image/svg+xml" />

        <title>
          {pageTitle === "" ? "Denonomicon" : `${pageTitle} | Denonomicon`}
        </title>
        <link rel="canonical" href={`${path}`} />
        <link rel="stylesheet" href="https://deno.land/fonts/inter/inter.css" />
        <link rel="stylesheet" href="https://deno.land/app.css" />
        <link rel="stylesheet" href="https://deno.land/gfm.css" />
      </Head>

      <div>
        <input
          type="checkbox"
          id="ToCToggle"
          class={tw`hidden checked:siblings:last-child:children:first-child:flex checked:sibling:(border-0 children:children:first-child:rotate-90)`}
          autoComplete="off"
        />

        <label
          htmlFor="ToCToggle"
          class={tw`lg:hidden block pl-5 py-2.5 font-medium border-b border-dark-border`}
        >
          <div class={tw`flex gap-2 items-center px-1.5`}>
            <Icons.ArrowRight class="text-[#9CA0AA]" />
            Menu
          </div>
        </label>

        <div
          class={tw`flex flex-col mt-0 mb-16 lg:(flex-row mt-12 gap-12 section-x-inset-xl)`}
        >
          <div
            class={tw`hidden pb-2 w-full border-b border-dark-border lg:(pb-0 border-none block w-72 flex-shrink-0)`}
          >
            <div
              class={tw`w-full space-y-4 section-x-inset-xl lg:section-x-inset-none`}
            >
              <img
                src="/denonomicon-title.svg"
                alt="Denonomicon title SVG"
              />
              <ToC
                tableOfContents={data.tableOfContents}
                path={path}
              />
            </div>
          </div>

          <main
            class={tw`focus:outline-none w-full flex flex-col section-x-inset-xl mt-7 lg:(section-x-inset-none mt-0)`}
            tabIndex={0}
          >
            <div class={tw`w-full justify-self-center flex-shrink-1`}>
              <a
                href={getDocURL(path)}
                class={tw`float-right py-2.5 px-4.5 rounded-md bg-[#F3F3F3] leading-none font-medium`}
              >
                Edit
              </a>

              <Markdown
                source={data.content}
                baseUrl={sourceURL}
              />

              <div class={tw`mt-14`}>
                {pageList[pageIndex - 1] && (
                  <a
                    href={pageList[pageIndex - 1].path}
                    class={tw`font-medium inline-flex items-center px-4.5 py-2.5 rounded-lg border border-dark-border gap-1.5`}
                  >
                    <Icons.ArrowLeft />
                    <div>{pageList[pageIndex - 1].name}</div>
                  </a>
                )}
                {pageList[pageIndex + 1] && (
                  <a
                    href={pageList[pageIndex + 1].path}
                    class={tw`font-medium inline-flex items-center px-4.5 py-2.5 rounded-lg border border-dark-border gap-1.5 float-right text-right`}
                  >
                    <div>{pageList[pageIndex + 1].name}</div>
                    <Icons.ArrowRight />
                  </a>
                )}
              </div>
            </div>
          </main>
        </div>
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
    <nav>
      <ol class={tw`list-decimal list-inside font-semibold nested`}>
        {Object.entries(tableOfContents).map(([slug, entry]) => {
          return (
            <li key={slug}>
              <input
                type="checkbox"
                id={slug}
                class={tw`hidden checked:siblings:even:children:first-child:rotate-90 checked:siblings:last-child:block`}
                checked={path.startsWith(`/${slug}/`)}
                disabled={!entry.children}
              />

              <label
                htmlFor={slug}
                class={tw`flex items-center gap-2 px-2.5 py-2 rounded-md block ${
                  path === `/${slug}`
                    ? "link bg-ultralight toc-active"
                    : "hover:text-gray-600"
                } font-semibold`}
              >
                <Icons.TriangleRight
                  class={entry.children ? "" : "invisible"}
                />
                <a href={`/${slug}`}>
                  {entry.name}
                </a>
              </label>

              {entry.children && (
                <ol class={tw`list-decimal font-normal nested hidden`}>
                  {Object.entries(entry.children).map(([childSlug, name]) => (
                    <li key={`${slug}/${childSlug}`}>
                      <a
                        href={`/${slug}/${childSlug}`}
                        class={tw`pl-8 pr-2.5 py-1 rounded-md block ${
                          path === `/${slug}/${childSlug}`
                            ? "link bg-ultralight toc-active"
                            : "hover:text-gray-600"
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

    const [tableOfContents, content] = await Promise.all([
      getTableOfContents(),
      getFileData(
        !url.pathname || url.pathname === "/" ? "/introduction" : url.pathname,
      ).catch((e) => {
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
